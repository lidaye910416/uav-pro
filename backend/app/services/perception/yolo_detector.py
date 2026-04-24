# -*- coding: utf-8 -*-
"""YOLOv8 目标检测模块 - 检测视频帧中的车辆、行人、障碍物"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
import numpy as np

try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False


def _ensure_proxy_env():
    """确保代理环境变量设置（用于下载模型）"""
    import os
    if not os.environ.get("http_proxy"):
        os.environ["http_proxy"] = "http://127.0.0.1:10887"
    if not os.environ.get("https_proxy"):
        os.environ["https_proxy"] = "http://127.0.0.1:10887"


@dataclass
class DetectedObject:
    """检测到的目标对象"""
    bbox: tuple[int, int, int, int]   # (x1, y1, x2, y2) 像素坐标
    label: str                         # COCO 类别名称
    label_id: int                     # COCO 类别 ID
    confidence: float                 # 置信度 0.0-1.0
    category: str                     # 归类：vehicle/person/obstacle/other

    def to_dict(self) -> dict:
        return {
            "bbox": self.bbox,
            "label": self.label,
            "label_id": self.label_id,
            "confidence": float(self.confidence),
            "category": self.category,
        }


# COCO 类别到业务类别的映射（class_id → category）
COCO_TO_CATEGORY = {
    # 行人
    0: "person",    # person
    # 车辆类
    1: "vehicle",   # bicycle
    2: "vehicle",   # car
    3: "vehicle",   # motorcycle
    4: "vehicle",   # bus
    5: "vehicle",   # train
    6: "vehicle",   # truck
    # 障碍物/交通设施
    9: "obstacle",  # traffic light
    10: "obstacle",  # stop sign
    13: "obstacle",  # bench
    14: "obstacle",  # backpack
    15: "obstacle",  # umbrella
    19: "obstacle",  # tie
    20: "obstacle",  # suitcase
    21: "obstacle",  # knife
    22: "obstacle",  # sports ball
    23: "obstacle",  # kite
    24: "obstacle",  # baseball bat
    25: "obstacle",  # skateboard
    26: "obstacle",  # surfboard
    27: "obstacle",  # tennis racket
}

# COCO 类别 ID → 标签名称（官方 COCO 映射）
LABEL_NAMES = {
    0: "person",
    1: "bicycle",
    2: "car",
    3: "motorcycle",
    4: "bus",
    5: "train",
    6: "truck",
    7: "boat",
    8: "traffic light",
    9: "stop sign",
    10: "bench",
    11: "backpack",
    12: "umbrella",
    13: "tie",
    14: "suitcase",
    15: "knife",
    16: "sports ball",
    17: "kite",
    18: "baseball bat",
    19: "skateboard",
    20: "surfboard",
    21: "tennis racket",
}


class YOLOXxxDetector:
    """YOLOv8 目标检测器
    
    使用 YOLOv8l 实时检测视频帧中的车辆、行人、障碍物。
    基于 COCO 预训练权重，支持零样本检测。
    """

    # 默认关注的类别（高性能过滤）
    DEFAULT_CLASSES = {2, 3, 4, 5, 6, 7, 10, 11, 13, 15}

    def __init__(
        self,
        model_name: str = "yolov8n.pt",
        confidence_threshold: float = 0.35,
        device: Optional[str] = None,
    ):
        """初始化 YOLOv8 检测器

        Args:
            model_name: YOLOv8 模型名称，可选 yolov8n/s/m/l/x.pt
            confidence_threshold: 置信度阈值（默认 0.35）
            device: 推理设备，如 'cuda'、'cpu'，None 则自动选择
        """
        if not ULTRALYTICS_AVAILABLE:
            raise ImportError(
                "ultralytics 未安装，请运行: pip install ultralytics"
            )

        # 确保代理环境变量设置（用于下载模型）
        _ensure_proxy_env()
        self.model_name = model_name
        self.confidence_threshold = confidence_threshold
        self._model: Optional[YOLO] = None
        self._device = device

    @property
    def model(self) -> YOLO:
        """懒加载模型"""
        if self._model is None:
            self._model = YOLO(self.model_name)
            if self._device:
                self._model.to(self._device)
        return self._model

    def detect(self, frame: np.ndarray) -> list[DetectedObject]:
        """检测单帧中的目标

        Args:
            frame: BGR 格式的 numpy 数组 (H, W, 3)

        Returns:
            检测到的目标列表（按置信度降序排列）
        """
        if frame is None or frame.size == 0:
            return []

        h, w = frame.shape[:2]
        
        # 执行推理
        results = self.model(frame, verbose=False)
        
        detected = []
        for result in results:
            boxes = result.boxes
            if boxes is None or len(boxes) == 0:
                continue

            for box in boxes:
                conf = float(box.conf[0])
                if conf < self.confidence_threshold:
                    continue

                label_id = int(box.cls[0])
                
                # 只保留关注的类别
                if label_id not in COCO_TO_CATEGORY:
                    continue

                # 获取边界框 (xyxy 格式)
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                
                # 转换为整数
                x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)

                detected.append(DetectedObject(
                    bbox=(x1, y1, x2, y2),
                    label=LABEL_NAMES.get(label_id, f"class_{label_id}"),
                    label_id=label_id,
                    confidence=conf,
                    category=COCO_TO_CATEGORY[label_id],
                ))

        # 按置信度降序排列
        detected.sort(key=lambda x: x.confidence, reverse=True)
        return detected

    def get_status(self) -> dict:
        """获取检测器状态信息"""
        return {
            "model_name": self.model_name,
            "confidence_threshold": self.confidence_threshold,
            "device": self._device or "auto",
            "available": ULTRALYTICS_AVAILABLE,
        }
