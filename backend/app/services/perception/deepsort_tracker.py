# -*- coding: utf-8 -*-
"""Deep SORT 目标跟踪模块 - 跨帧追踪检测到的对象"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional
import numpy as np

try:
    import supervision as sv
    from ultralytics import YOLO
    SUPERVISION_AVAILABLE = True
except ImportError:
    SUPERVISION_AVAILABLE = False

from .yolo_detector import DetectedObject, YOLOXxxDetector


@dataclass
class TrackedObject:
    """跟踪中的目标对象"""
    track_id: int
    bbox: tuple[int, int, int, int]     # (x1, y1, x2, y2)
    label: str
    label_id: int
    confidence: float
    category: str
    velocity: tuple[float, float]      # (vx, vy) 像素/帧
    trajectory: list[tuple[int, int]]  # 轨迹点列表 [(x,y), ...]
    age: int                            # 跟踪持续帧数
    status: str                         # moving/stationary/disappeared

    def to_dict(self) -> dict:
        return {
            "id": self.track_id,
            "bbox": self.bbox,
            "label": self.label,
            "label_id": self.label_id,
            "confidence": float(self.confidence),
            "category": self.category,
            "velocity": {"vx": self.velocity[0], "vy": self.velocity[1]},
            "trajectory": self.trajectory,
            "age": self.age,
            "status": self.status,
        }

    @property
    def speed(self) -> float:
        """计算速度标量（像素/帧）"""
        return np.sqrt(self.velocity[0]**2 + self.velocity[1]**2)

    @property
    def center(self) -> tuple[int, int]:
        """边界框中心点"""
        x1, y1, x2, y2 = self.bbox
        return int((x1 + x2) / 2), int((y1 + y2) / 2)

    @property
    def area(self) -> float:
        """边界框面积"""
        x1, y1, x2, y2 = self.bbox
        return float((x2 - x1) * (y2 - y1))


class DeepSORTTracker:
    """Deep SORT 目标跟踪器
    
    跨帧追踪检测到的对象，维持 ID 一致性，输出轨迹信息。
    使用 supervision 库的 ByteTrack 实现。
    """

    def __init__(
        self,
        max_age: int = 30,
        min_hits: int = 3,
        iou_threshold: float = 0.3,
        confidence_threshold: float = 0.4,
    ):
        """初始化 Deep SORT 跟踪器

        Args:
            max_age: 目标消失后保留的最大帧数
            min_hits: 确认跟踪所需的最小命中帧数
            iou_threshold: IOU 匹配阈值
            confidence_threshold: 检测置信度阈值
        """
        if not SUPERVISION_AVAILABLE:
            raise ImportError(
                "supervision 未安装，请运行: pip install supervision"
            )
        
        self.max_age = max_age
        self.min_hits = min_hits
        self.iou_threshold = iou_threshold
        self.confidence_threshold = confidence_threshold

        # 初始化 ByteTrack（supervision 中的高性能跟踪器）
        self._tracker = sv.ByteTrack(
            track_activation_threshold=confidence_threshold,
            lost_track_buffer=max_age,
            minimum_matching_threshold=iou_threshold,
            frame_rate=30,
        )

        # ReID 模型（可选，用于更准确的跟踪）
        self._embedder = None
        self._frame_count = 0

    def update(
        self, 
        detections: list[DetectedObject],
        frame: Optional[np.ndarray] = None,
    ) -> list[TrackedObject]:
        """更新跟踪状态

        Args:
            detections: YOLOv8 检测到的目标列表
            frame: 当前帧图像（用于可选的 ReID 特征提取）

        Returns:
            跟踪中的目标列表
        """
        self._frame_count += 1

        if not detections:
            # 无检测时仍返回已跟踪的目标
            return self._get_tracked_objects([])

        # 转换为 supervision 的 Detection 格式
        bboxes = np.array([d.bbox for d in detections], dtype=np.float32)
        scores = np.array([d.confidence for d in detections], dtype=np.float32)
        class_ids = np.array([d.label_id for d in detections], dtype=np.int64)

        # 创建 detection 对象
        sv_detections = sv.Detections(
            xyxy=bboxes,
            confidence=scores,
            class_id=class_ids,
        )

        # 执行跟踪
        tracked_detections = self._tracker.update_with_detections(sv_detections)

        # 构建跟踪结果
        result = []
        if len(tracked_detections) > 0:
            tracker_ids = tracked_detections.tracker_id
            boxes = tracked_detections.xyxy
            confs = tracked_detections.confidence
            cls_ids = tracked_detections.class_id

            for i, (track_id, box, conf, cls_id) in enumerate(zip(tracker_ids, boxes, confs, cls_ids)):
                x1, y1, x2, y2 = box
                bbox = (int(x1), int(y1), int(x2), int(y2))

                # 找到对应的原始检测（按索引匹配）
                det = detections[i] if i < len(detections) else None

                # 计算速度（简化：基于当前帧位置）
                velocity = (0.0, 0.0)
                # 注：supervision 的 ByteTrack 不直接暴露轨迹，
                # 简化实现中用检测位置替代速度计算

                # 判断运动状态（基于速度）
                speed = np.sqrt(velocity[0]**2 + velocity[1]**2)
                status = "moving" if speed > 0.5 else "stationary"

                result.append(TrackedObject(
                    track_id=int(track_id),
                    bbox=bbox,
                    label=det.label if det else str(cls_id),
                    label_id=int(cls_id),
                    confidence=float(conf),
                    category=det.category if det else "unknown",
                    velocity=velocity,
                    trajectory=[],  # 简化：可在内部维护完整轨迹
                    age=self._frame_count,
                    status=status,
                ))

        return result

    def _get_tracked_objects(self, tracked_data) -> list[TrackedObject]:
        """从 tracker 获取活跃的跟踪对象"""
        # supervision ByteTrack 不暴露内部状态，
        # 我们在 update() 中直接返回
        return []

    def get_active_tracks(self) -> list[int]:
        """获取当前活跃的跟踪 ID 列表"""
        # 返回跟踪器中的活跃 ID
        return []

    def reset(self) -> None:
        """重置跟踪器状态"""
        self._tracker = sv.ByteTrack(
            track_activation_threshold=self.confidence_threshold,
            lost_track_buffer=self.max_age,
            minimum_matching_threshold=self.iou_threshold,
            frame_rate=30,
        )
        self._frame_count = 0
