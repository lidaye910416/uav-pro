# -*- coding: utf-8 -*-
"""YOLO Pipeline 整合模块 - 串联 YOLOv8 + Deep SORT + SAM + PromptBuilder"""
from __future__ import annotations

from typing import Optional
from dataclasses import dataclass
import time
import cv2
import numpy as np

from app.services.perception.yolo_detector import YOLOXxxDetector, DetectedObject
from app.services.perception.deepsort_tracker import DeepSORTTracker, TrackedObject
from app.services.perception.prompt_builder import PromptBuilder
from app.services.perception.sam_segmenter import SAMSegmenter, SegmentationMask
from app.services.perception.mask_visualizer import MaskVisualizer, get_category_type


@dataclass
class PipelineResult:
    """Pipeline 处理结果"""
    frame_idx: int
    timestamp: float
    resolution: tuple[int, int]
    detected: list[DetectedObject]
    tracked: list[TrackedObject]
    masks: list[SegmentationMask]  # SAM 分割结果
    combined_image: Optional[np.ndarray]  # 合并可视化图像
    enhanced_prompt: str  # Gemma 提示词文本
    gemma_prompt_data: dict  # 完整的 prompt 数据（包含检测信息、掩膜信息等）
    anomaly_indicators: list
    detection_summary: str  # 用于 Gemma 的检测摘要
    processing_time_ms: float

    def to_dict(self) -> dict:
        return {
            "frame_idx": self.frame_idx,
            "timestamp": self.timestamp,
            "resolution": f"{self.resolution[0]}×{self.resolution[1]}",
            "total_detections": len(self.detected),
            "segmentations": len(self.masks),
            "active_tracks": len(self.tracked),
            "anomaly_count": len(self.anomaly_indicators),
            "suspected_incidents": list(set(a.type for a in self.anomaly_indicators)),
            "detection_summary": self.detection_summary,
            "processing_time_ms": round(self.processing_time_ms, 1),
        }

    def get_roi_list(self) -> list[dict]:
        """返回归一化的 ROI 列表（兼容前端 VideoPlayer）"""
        w, h = self.resolution
        return [
            {
                "x1": round(obj.bbox[0] / w * 100, 1),
                "y1": round(obj.bbox[1] / h * 100, 1),
                "x2": round(obj.bbox[2] / w * 100, 1),
                "y2": round(obj.bbox[3] / h * 100, 1),
                "confidence": float(obj.confidence),
                "label": obj.label,
                "category": obj.category,
            }
            for obj in self.detected
        ]

    def get_mask_list(self) -> list[dict]:
        """返回分割掩码信息列表"""
        return [
            {
                "bbox": m.bbox,
                "area": float(m.area),
                "confidence": float(m.confidence),
                "polygon_count": len(m.polygon),
            }
            for m in self.masks
        ]


class YOLOPipeline:
    """YOLO 检测 Pipeline

    串联 YOLOv8 检测 + Deep SORT 跟踪 + SAM 分割 + MaskVisualizer 可视化。
    为 SSE 接口提供统一的 pipeline 调用。

    新架构（Stage 1）：
    1. YOLOv8 检测车辆、行人等目标
    2. SAM 对检测框进行像素级分割
    3. MaskVisualizer 生成彩色标注图像
    4. 合并图 + 检测摘要 → Gemma 分析
    """

    def __init__(
        self,
        model_name: str = "yolov8n.pt",
        confidence_threshold: float = 0.4,
        max_age: int = 30,
        scene_context: str = "高速公路航拍，UAV视角",
        device: Optional[str] = None,
        enable_sam: bool = True,
    ):
        """初始化 YOLO Pipeline

        Args:
            model_name: YOLOv8 模型名称
            confidence_threshold: 检测置信度阈值
            max_age: 跟踪器最大保留帧数
            scene_context: 场景描述
            device: 推理设备
            enable_sam: 是否启用 SAM 分割
        """
        self.detector = YOLOXxxDetector(
            model_name=model_name,
            confidence_threshold=confidence_threshold,
            device=device,
        )
        self.tracker = DeepSORTTracker(
            max_age=max_age,
            min_hits=3,
            confidence_threshold=confidence_threshold,
        )
        self.prompt_builder = PromptBuilder(scene_context=scene_context)
        self.visualizer = MaskVisualizer()

        # SAM 分割器（可选）
        self._sam: Optional[SAMSegmenter] = None
        self._sam_available = False
        self._sam_enabled = enable_sam
        self._try_init_sam()

        self._frame_count = 0
        self._fps = 30.0
        self._is_ready = False

    def _try_init_sam(self) -> None:
        """尝试初始化 SAM 分割器"""
        if not self._sam_enabled:
            return
        try:
            self._sam = SAMSegmenter(model_size="vit_b")
            self._sam_available = True
            print("[YOLOPipeline] SAM 分割器初始化成功")
        except ImportError as e:
            print(f"[YOLOPipeline] SAM 不可用（缺少依赖）: {e}")
            self._sam_available = False
        except Exception as e:
            print(f"[YOLOPipeline] SAM 初始化失败: {e}")
            self._sam_available = False

    @property
    def sam_available(self) -> bool:
        """SAM 是否可用"""
        return self._sam_available and self._sam is not None

    def initialize(self) -> bool:
        """初始化 Pipeline，加载模型

        Returns:
            是否成功初始化
        """
        try:
            # 触发模型懒加载
            _ = self.detector.model
            self._is_ready = True
            return True
        except Exception as e:
            print(f"[YOLOPipeline] 初始化失败: {e}")
            self._is_ready = False
            return False

    @property
    def is_ready(self) -> bool:
        """Pipeline 是否就绪"""
        return self._is_ready

    def process_frame(self, frame: np.ndarray) -> PipelineResult:
        """处理单帧（无 SAM 分割，仅 YOLO + DeepSORT）

        Args:
            frame: BGR 格式的 numpy 数组

        Returns:
            Pipeline 处理结果
        """
        # 调用完整处理，但不进行 SAM 分割
        return self.process_frame_with_sam(frame, use_sam=False)

    def process_frame_with_sam(
        self,
        frame: np.ndarray,
        use_sam: bool = True,
    ) -> PipelineResult:
        """处理单帧（含 SAM 分割和可视化）

        这是新的 Stage 1 核心方法：
        1. YOLOv8 检测目标
        2. SAM 像素级分割（可选）
        3. 生成彩色标注图像
        4. 构建检测摘要

        Args:
            frame: BGR 格式的 numpy 数组
            use_sam: 是否使用 SAM 分割（False 则跳过）

        Returns:
            Pipeline 处理结果（包含 combined_image）
        """
        t_start = time.time()

        h, w = frame.shape[:2]
        fps = self._fps
        frame_idx = self._frame_count
        timestamp = frame_idx / fps if fps > 0 else 0.0

        # ── 1. YOLOv8 检测 ────────────────────────────────────────────────────
        detected = self.detector.detect(frame)

        # ── 2. Deep SORT 跟踪 ──────────────────────────────────────────────────
        tracked = self.tracker.update(detected, frame)

        # ── 3. SAM 分割（可选）─────────────────────────────────────────────────
        masks: list[SegmentationMask] = []
        if use_sam and self.sam_available and detected:
            try:
                bboxes = [d.bbox for d in detected]
                masks = self._sam.segment(frame, bboxes)
            except Exception as e:
                print(f"[YOLOPipeline] SAM 分割失败: {e}")
                masks = []

        # ── 4. 生成合并可视化图像 ──────────────────────────────────────────────
        combined_image: Optional[np.ndarray] = None
        if detected:
            try:
                viz_result = self.visualizer.visualize(
                    frame,
                    detected,
                    masks if masks else None,
                    show_labels=True,
                    show_confidence=True,
                    max_display=30,
                )
                combined_image = viz_result.image
            except Exception as e:
                print(f"[YOLOPipeline] 可视化失败: {e}")

        # ── 5. 生成检测摘要 ────────────────────────────────────────────────────
        detection_summary = self.visualizer.get_detection_summary(detected, tracked)

        # ── 6. 生成 Gemma 提示词（对齐标准格式）─────────────────────────────────
        gemma_prompt_data = self.visualizer.build_gemma_prompt(
            detections=detected,
            masks=masks if masks else None,
            tracked=tracked,
        )
        enhanced_prompt = gemma_prompt_data['prompt']

        anomaly_indicators = []  # anomaly_indicators 从 Gemma 返回结果中获取

        self._frame_count += 1
        processing_time_ms = (time.time() - t_start) * 1000

        return PipelineResult(
            frame_idx=frame_idx,
            timestamp=timestamp,
            resolution=(w, h),
            detected=detected,
            tracked=tracked,
            masks=masks,
            combined_image=combined_image,
            enhanced_prompt=enhanced_prompt,
            gemma_prompt_data=gemma_prompt_data,  # 包含完整的 prompt 数据
            anomaly_indicators=anomaly_indicators,
            detection_summary=detection_summary,
            processing_time_ms=processing_time_ms,
        )

    def process_video(
        self,
        video_path: str,
        max_frames: int = 0,
        skip_frames: int = 1,
        callback=None,
    ) -> list[PipelineResult]:
        """处理视频文件

        Args:
            video_path: 视频文件路径
            max_frames: 最大处理帧数（0=不限制）
            skip_frames: 跳帧数（1=每帧处理）
            callback: 每帧处理后的回调函数

        Returns:
            处理结果列表
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise FileNotFoundError(f"无法打开视频: {video_path}")

        self._fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        results = []

        frame_idx = 0
        processed = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % skip_frames != 0:
                frame_idx += 1
                continue

            result = self.process_frame(frame)
            results.append(result)

            if callback:
                callback(result)

            processed += 1
            frame_idx += 1

            if max_frames > 0 and processed >= max_frames:
                break

        cap.release()
        return results

    def reset(self) -> None:
        """重置 Pipeline 状态"""
        self._frame_count = 0
        self.tracker.reset()
        self.prompt_builder.reset()

    def get_status(self) -> dict:
        """获取 Pipeline 状态"""
        return {
            "ready": self._is_ready,
            "frame_count": self._frame_count,
            "fps": self._fps,
            "detector": self.detector.get_status(),
        }


# ── 单例模式（全局共享 Pipeline）────────────────────────────────────────────

_pipeline_instance: Optional[YOLOPipeline] = None


def get_pipeline(
    model_name: str = "yolov8l.pt",
    confidence_threshold: float = 0.4,
) -> YOLOPipeline:
    """获取全局 Pipeline 实例（单例模式）

    Args:
        model_name: YOLOv8 模型名称
        confidence_threshold: 检测置信度阈值

    Returns:
        YOLOPipeline 实例
    """
    global _pipeline_instance
    if _pipeline_instance is None:
        _pipeline_instance = YOLOPipeline(
            model_name=model_name,
            confidence_threshold=confidence_threshold,
        )
        _pipeline_instance.initialize()
    return _pipeline_instance


def reset_pipeline() -> None:
    """重置全局 Pipeline"""
    global _pipeline_instance
    if _pipeline_instance:
        _pipeline_instance.reset()
    _pipeline_instance = None
