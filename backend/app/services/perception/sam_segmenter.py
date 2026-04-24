# -*- coding: utf-8 -*-
"""SAM 精确分割模块 - 使用 Meta 官方 Segment Anything Model"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional
import numpy as np
import cv2

# 优先使用官方 segment_anything
try:
    from segment_anything import SamPredictor, sam_model_registry
    SAM_AVAILABLE = True
except ImportError:
    try:
        from segment_anything_hq import SamPredictor, sam_model_registry
        SAM_AVAILABLE = True
    except ImportError:
        SAM_AVAILABLE = False
        sam_model_registry = None


# 官方 SAM ViT-B 模型路径（相对于 backend 根目录）
_SAM_VIT_B_PATH = Path(__file__).resolve().parents[3] / "models" / "sam" / "sam_vit_b.pth"


@dataclass
class SegmentationMask:
    """分割掩膜结果"""
    mask: np.ndarray              # 二值掩膜 (H, W)
    polygon: list[list[float]]   # 轮廓多边形点列表
    bbox: tuple[int, int, int, int]  # 包围盒
    area: float                   # 掩膜面积（像素数）
    confidence: float             # 分割置信度

    def to_dict(self) -> dict:
        return {
            "polygon": self.polygon,
            "bbox": self.bbox,
            "area": float(self.area),
            "confidence": float(self.confidence),
        }


def _mask_to_polygon(mask: np.ndarray) -> list[list[float]]:
    """将二值掩膜转换为轮廓多边形"""
    if mask.dtype != np.uint8:
        mask = (mask * 255).astype(np.uint8)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return []

    largest = max(contours, key=cv2.contourArea)
    epsilon = 0.01 * cv2.arcLength(largest, True)
    approx = cv2.approxPolyDP(largest, epsilon, True)
    polygon = [[float(p[0][0]), float(p[0][1])] for p in approx]
    return polygon


class SAMSegmenter:
    """SAM 分割器 - 使用 Meta 官方 Segment Anything Model
    
    支持 vit_b/vit_l/vit_h 模型，使用 bbox 提示进行精确分割。
    """

    def __init__(
        self,
        model_size: str = "vit_b",
        device: Optional[str] = None,
    ):
        """初始化 SAM 分割器

        Args:
            model_size: 模型大小，可选 vit_b/vit_l/vit_h
            device: 推理设备，None 则自动选择
        """
        if not SAM_AVAILABLE:
            raise ImportError(
                "segment-anything 未安装，请运行: pip install segment-anything"
            )

        self.model_size = model_size
        self._device = device or ("cuda" if self._check_cuda() else "cpu")
        self._predictor: Optional[SamPredictor] = None
        self._model_loaded = False
        self._image_loaded = False

    def _load_model(self) -> bool:
        """加载 SAM 模型"""
        if self._model_loaded:
            return True

        try:
            # 使用本地模型路径
            if _SAM_VIT_B_PATH.exists():
                checkpoint = str(_SAM_VIT_B_PATH)
                print(f"[SAMSegmenter] 使用本地模型: {checkpoint}")
            else:
                # 如果本地没有，尝试自动下载
                checkpoint = "vit_b"
                print(f"[SAMSegmenter] 尝试下载模型: vit_b")

            sam = sam_model_registry["vit_b"](checkpoint=checkpoint)
            self._predictor = SamPredictor(sam)
            self._model_loaded = True
            print(f"[SAMSegmenter] Meta SAM ViT-B 加载成功")
            return True

        except Exception as e:
            print(f"[SAMSegmenter] SAM 模型加载失败: {e}")
            return False

    def segment(
        self,
        image: np.ndarray,
        bboxes: list[tuple[int, int, int, int]],
        multimask_output: bool = False,
    ) -> list[SegmentationMask]:
        """使用 bbox 提示进行分割

        Args:
            image: BGR 格式的图像 (H, W, 3)
            bboxes: 边界框列表 [(x1, y1, x2, y2), ...]
            multimask_output: 是否输出多个掩膜

        Returns:
            分割掩膜列表
        """
        if not bboxes:
            return []

        # 懒加载模型
        if not self._load_model():
            return []

        try:
            # 转换图像为 RGB
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

            # 设置图像（仅在图像变化时重新设置）
            if not self._image_loaded:
                self._predictor.set_image(image_rgb)
                self._image_loaded = True

            results = []
            for bbox in bboxes:
                x1, y1, x2, y2 = bbox

                # SAM 使用 bbox 格式：[[x1, y1], [x2, y2]]
                input_box = np.array([[x1, y1], [x2, y2]])

                # 预测分割
                masks, scores, _ = self._predictor.predict(
                    point_coords=None,
                    point_labels=None,
                    box=input_box,
                    multimask_output=multimask_output,
                )

                # 取最佳掩膜（如果 multimask_output=True）
                if multimask_output and len(masks) > 0:
                    best_idx = np.argmax(scores)
                    mask = masks[best_idx]
                    score = scores[best_idx]
                else:
                    mask = masks[0] if len(masks) > 0 else np.zeros(image.shape[:2], dtype=bool)
                    score = float(np.max(scores)) if len(scores) > 0 else 0.5

                area = float(np.sum(mask))
                polygon = _mask_to_polygon(mask)

                results.append(SegmentationMask(
                    mask=mask,
                    polygon=polygon,
                    bbox=bbox,
                    area=area,
                    confidence=float(score),
                ))

            return results

        except Exception as e:
            print(f"[SAMSegmenter] 分割失败: {e}")
            return []

    def segment_from_detections(
        self,
        image: np.ndarray,
        detections: list,
    ) -> list[SegmentationMask]:
        """对检测结果进行分割

        Args:
            image: BGR 格式的图像
            detections: 检测结果列表，每个元素需要有 .bbox 属性

        Returns:
            分割掩膜列表
        """
        bboxes = []
        for det in detections:
            if hasattr(det, "bbox"):
                bboxes.append(det.bbox)
        return self.segment(image, bboxes)

    def reset(self):
        """重置分割器状态"""
        self._image_loaded = False

    def get_status(self) -> dict:
        """获取分割器状态"""
        return {
            "model_size": self.model_size,
            "device": self._device,
            "loaded": self._model_loaded,
            "available": SAM_AVAILABLE,
        }

    @staticmethod
    def _check_cuda() -> bool:
        """检查 CUDA 是否可用"""
        try:
            import torch
            return torch.cuda.is_available()
        except ImportError:
            return False


# 便捷函数
def segment_image(
    image: np.ndarray,
    bboxes: list[tuple[int, int, int, int]],
) -> list[SegmentationMask]:
    """便捷函数：对图像进行分割

    Args:
        image: BGR 图像
        bboxes: 边界框列表

    Returns:
        分割掩膜列表
    """
    segmenter = SAMSegmenter()
    return segmenter.segment(image, bboxes)
