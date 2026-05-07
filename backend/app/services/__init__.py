# backend/app/services/__init__.py
"""服务模块"""
from app.services.types import (
    FrameData, VideoInfo, Detection, MaskDetail,
    DetectionResult, AnnotatedImage, VisionResult,
    DecisionResult, PipelineStatus, SSEEvent
)
from app.services.video_service import VideoService
from app.services.perception_service import PerceptionService
from app.services.vision_service import VisionService
from app.services.pipeline import Pipeline
from app.services.pipeline_manager import PipelineManager, get_pipeline_manager

__all__ = [
    # Types
    "FrameData", "VideoInfo", "Detection", "MaskDetail",
    "DetectionResult", "AnnotatedImage", "VisionResult",
    "DecisionResult", "PipelineStatus", "SSEEvent",
    # Services
    "VideoService",
    "PerceptionService",
    "VisionService",
    "Pipeline",
    "PipelineManager",
    "get_pipeline_manager",
]
