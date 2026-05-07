# backend/app/services/types.py
"""共享数据类型定义"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any


@dataclass
class FrameData:
    """视频帧数据"""
    frame_idx: int
    timestamp: float
    frame_bgr: Any  # np.ndarray | None


@dataclass
class VideoInfo:
    """视频信息"""
    video_id: str
    label: str
    filename: str
    exists: bool
    total_frames: int
    fps: float
    width: int
    height: int


@dataclass
class Detection:
    """目标检测结果"""
    label: str
    bbox: list[int]  # [x1, y1, x2, y2]
    confidence: float


@dataclass
class MaskDetail:
    """SAM 分割掩膜详情"""
    label: str
    color: str
    pixel_count: int
    confidence: float


@dataclass
class DetectionResult:
    """检测结果"""
    frame_idx: int
    timestamp: str
    resolution: str
    detections: int
    detection_details: list[Detection]
    mask_details: list[MaskDetail]
    segmentations: int


@dataclass
class AnnotatedImage:
    """标注图像"""
    image_url: str  # 访问路径
    result: DetectionResult


@dataclass
class VisionResult:
    """视觉分析结果"""
    has_event: bool
    incident_type: str
    severity: str
    confidence: float
    scene_description: str
    description: str


@dataclass
class DecisionResult:
    """决策结果"""
    risk_level: str
    title: str
    recommended_response: str


class PipelineStatus(Enum):
    """Pipeline 状态"""
    IDLE = "idle"
    RUNNING = "running"
    STOPPING = "stopping"
    DONE = "done"
    ERROR = "error"


@dataclass
class SSEEvent:
    """SSE 事件"""
    event: str
    data: dict[str, Any]
