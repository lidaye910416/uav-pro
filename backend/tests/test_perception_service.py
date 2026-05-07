# backend/tests/test_perception_service.py
import pytest
import numpy as np
from app.services.perception_service import (
    PerceptionService, 
    MASK_COLORS_DISPLAY,
    _get_mask_color,
    _get_color_display_name
)

def test_perception_service_initialization():
    """Test PerceptionService can be instantiated"""
    ps = PerceptionService()
    assert ps.confidence_threshold == 0.25

def test_perception_service_with_custom_threshold():
    """Test PerceptionService with custom threshold"""
    ps = PerceptionService(confidence_threshold=0.5)
    assert ps.confidence_threshold == 0.5

def test_mask_colors_display():
    """Test mask color display mapping"""
    assert MASK_COLORS_DISPLAY.get("person") == "绿色"
    assert MASK_COLORS_DISPLAY.get("car") == "浅蓝色"
    assert MASK_COLORS_DISPLAY.get("truck") == "橙色"
    assert MASK_COLORS_DISPLAY.get("bus") == "紫色"
    assert MASK_COLORS_DISPLAY.get("bicycle") == "天蓝色"
    assert MASK_COLORS_DISPLAY.get("motorcycle") == "青色"

def test_get_mask_color():
    """Test mask color mapping returns tuple"""
    color = _get_mask_color("person")
    assert isinstance(color, tuple)
    assert len(color) == 3  # BGR format

def test_get_color_display_name():
    """Test color display name mapping"""
    assert _get_color_display_name("person") == "绿色"
    assert _get_color_display_name("car") == "浅蓝色"
    assert _get_color_display_name("unknown") == "黄绿色"  # default

def test_process_frame_returns_annotated_image():
    """Test process_frame returns AnnotatedImage structure"""
    ps = PerceptionService()
    # Create dummy frame
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    result = ps.process_frame(frame, frame_idx=100)
    assert result is not None
    assert hasattr(result, 'image_url')
    assert hasattr(result, 'result')
    assert hasattr(result.result, 'frame_idx')
    assert hasattr(result.result, 'detections')
    assert hasattr(result.result, 'resolution')

def test_detect_returns_detection_result():
    """Test detect returns DetectionResult structure"""
    ps = PerceptionService()
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    result = ps.detect(frame)
    assert result is not None
    assert hasattr(result, 'frame_idx')
    assert hasattr(result, 'detections')
    assert hasattr(result, 'detection_details')
    assert isinstance(result.detection_details, list)

def test_annotate_returns_annotated_image():
    """Test annotate returns AnnotatedImage structure"""
    ps = PerceptionService()
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    from app.services.types import Detection
    detections = [
        Detection(label="car", bbox=[10, 20, 100, 200], confidence=0.85)
    ]
    result = ps.annotate(frame, detections, frame_idx=50)
    assert result is not None
    assert hasattr(result, 'image_url')
    assert hasattr(result, 'result')
