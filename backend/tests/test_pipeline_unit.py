# backend/tests/test_pipeline_unit.py
import pytest
from app.services.pipeline import Pipeline, PipelineStatus

def test_pipeline_initialization():
    """Test Pipeline can be initialized"""
    pipeline = Pipeline(video_id="default")
    assert pipeline.video_id == "default"
    assert pipeline.status == PipelineStatus.IDLE
    assert pipeline.id is not None
    assert len(pipeline.id) > 0

def test_pipeline_status_transitions():
    """Test Pipeline status transitions"""
    pipeline = Pipeline(video_id="default")
    assert pipeline.status == PipelineStatus.IDLE
    
    pipeline.status = PipelineStatus.RUNNING
    assert pipeline.status == PipelineStatus.RUNNING
    
    pipeline.status = PipelineStatus.DONE
    assert pipeline.status == PipelineStatus.DONE

def test_pipeline_has_services_property():
    """Test Pipeline has service properties"""
    pipeline = Pipeline(video_id="default")
    
    # 检查服务属性
    assert hasattr(pipeline, 'video_service')
    assert hasattr(pipeline, 'perception_service')
    assert hasattr(pipeline, 'vision_service')
    assert hasattr(pipeline, 'rag_service')
    assert hasattr(pipeline, 'decision_service')
    assert hasattr(pipeline, 'stop')
    assert hasattr(pipeline, 'start')

def test_pipeline_with_custom_services():
    """Test Pipeline initialization with custom services"""
    mock_video = object()
    mock_perception = object()
    
    pipeline = Pipeline(
        video_id="test",
        video_service=mock_video,
        perception_service=mock_perception
    )
    
    assert pipeline.video_service is mock_video
    assert pipeline.perception_service is mock_perception
    assert pipeline.video_id == "test"

def test_pipeline_status_enum_values():
    """Test all PipelineStatus enum values"""
    assert PipelineStatus.IDLE.value == "idle"
    assert PipelineStatus.RUNNING.value == "running"
    assert PipelineStatus.STOPPING.value == "stopping"
    assert PipelineStatus.DONE.value == "done"
    assert PipelineStatus.ERROR.value == "error"
