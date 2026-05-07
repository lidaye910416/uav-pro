# backend/tests/test_pipeline_integration.py
"""Pipeline 集成测试"""
import pytest
import asyncio
import numpy as np
from app.services.pipeline import Pipeline
from app.services.video_service import VideoService
from app.services.perception_service import PerceptionService

@pytest.mark.asyncio
async def test_pipeline_with_video_service():
    """Test Pipeline with VideoService"""
    vs = VideoService("default")
    info = vs.get_video_info()
    
    # 跳过如果视频不存在
    if not info.exists:
        pytest.skip("Demo video not available")
    
    pipeline = Pipeline(
        video_id="default",
        video_service=vs,
        perception_service=PerceptionService(),
    )
    
    events = []
    async for event in pipeline.start():
        events.append(event)
        # 只取前几个事件
        if len(events) >= 3:
            break
    
    assert len(events) > 0

@pytest.mark.asyncio
async def test_pipeline_extract_frames():
    """Test extracting frames from video"""
    vs = VideoService("default")
    frames = vs.extract_frames(count=2)
    
    # 如果视频不存在，可能返回空
    if len(frames) == 0:
        pytest.skip("Demo video not available")
    
    assert len(frames) == 2
    assert frames[0].frame_bgr is not None

@pytest.mark.asyncio
async def test_pipeline_manager_integration():
    """Test PipelineManager creating and managing pipelines"""
    from app.services.pipeline_manager import PipelineManager
    
    pm = PipelineManager()
    
    # 清理
    for p in list(pm.list_pipelines()):
        pm.destroy_pipeline(p["pipeline_id"])
    
    # 创建
    pid1 = pm.create_pipeline("default")
    pid2 = pm.create_pipeline("gal_1")
    
    pipelines = pm.list_pipelines()
    assert len(pipelines) == 2
    
    # 清理
    pm.destroy_pipeline(pid1)
    pm.destroy_pipeline(pid2)

def test_video_service_list_videos():
    """Test listing all videos"""
    videos = VideoService.list_available_videos()
    
    assert "default" in videos
    assert "mitra" in videos
    assert isinstance(videos["mitra"], list)
