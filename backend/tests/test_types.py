# backend/tests/test_types.py
import pytest
from app.services.types import (
    FrameData, VideoInfo, Detection, MaskDetail,
    DetectionResult, AnnotatedImage, VisionResult,
    DecisionResult, PipelineStatus, SSEEvent
)

def test_frame_data_dataclass():
    """Test FrameData dataclass"""
    frame = FrameData(frame_idx=100, timestamp=3.33, frame_bgr=None)
    assert frame.frame_idx == 100
    assert frame.timestamp == 3.33

def test_detection_dataclass():
    """Test Detection dataclass"""
    det = Detection(label="car", bbox=[10, 20, 100, 200], confidence=0.85)
    assert det.label == "car"
    assert det.confidence == 0.85
    assert len(det.bbox) == 4

def test_pipeline_status_enum():
    """Test PipelineStatus enum values"""
    assert PipelineStatus.IDLE.value == "idle"
    assert PipelineStatus.RUNNING.value == "running"
    assert PipelineStatus.DONE.value == "done"
    assert PipelineStatus.ERROR.value == "error"

def test_sse_event_dataclass():
    """Test SSEEvent dataclass"""
    event = SSEEvent(event="stage", data={"stage": "perception", "progress": 50})
    assert event.event == "stage"
    assert event.data["stage"] == "perception"

def test_vision_result_dataclass():
    """Test VisionResult dataclass"""
    vr = VisionResult(
        has_event=True,
        incident_type="collision",
        severity="high",
        confidence=0.85,
        scene_description="test scene",
        description="test description"
    )
    assert vr.has_event is True
    assert vr.incident_type == "collision"
    assert vr.confidence == 0.85

def test_decision_result_dataclass():
    """Test DecisionResult dataclass"""
    dr = DecisionResult(
        risk_level="high",
        title="测试告警",
        recommended_response="通知交警"
    )
    assert dr.risk_level == "high"
    assert dr.title == "测试告警"

def test_video_info_dataclass():
    """Test VideoInfo dataclass"""
    vi = VideoInfo(
        video_id="default",
        label="测试视频",
        filename="test.mp4",
        exists=True,
        total_frames=100,
        fps=30.0,
        width=1920,
        height=1080
    )
    assert vi.video_id == "default"
    assert vi.exists is True
    assert vi.fps == 30.0
