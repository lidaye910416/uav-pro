# backend/tests/test_pipeline_manager_unit.py
import pytest
import asyncio
from app.services.pipeline_manager import PipelineManager, get_pipeline_manager

def test_pipeline_manager_singleton():
    """Test PipelineManager is singleton"""
    pm1 = PipelineManager()
    pm2 = PipelineManager()
    assert pm1 is pm2

def test_get_pipeline_manager_returns_same_instance():
    """Test get_pipeline_manager returns same instance"""
    pm1 = get_pipeline_manager()
    pm2 = get_pipeline_manager()
    assert pm1 is pm2

def test_create_pipeline_returns_string():
    """Test create_pipeline returns pipeline_id string"""
    pm = PipelineManager()
    pipeline_id = pm.create_pipeline("default")
    assert isinstance(pipeline_id, str)
    assert len(pipeline_id) > 0
    # 直接删除（清理）
    if pipeline_id in pm._pipelines:
        del pm._pipelines[pipeline_id]

def test_get_pipeline_returns_pipeline():
    """Test get_pipeline returns Pipeline object"""
    pm = PipelineManager()
    pipeline_id = pm.create_pipeline("default")
    pipeline = pm.get_pipeline(pipeline_id)
    assert pipeline is not None
    assert pipeline.video_id == "default"
    # 直接删除
    if pipeline_id in pm._pipelines:
        del pm._pipelines[pipeline_id]

@pytest.mark.asyncio
async def test_destroy_pipeline_returns_true():
    """Test destroy_pipeline returns True on success"""
    pm = PipelineManager()
    pipeline_id = pm.create_pipeline("default")
    result = pm.destroy_pipeline(pipeline_id)
    assert result is True

@pytest.mark.asyncio
async def test_get_pipeline_after_destroy_returns_none():
    """Test get_pipeline returns None after destroy"""
    pm = PipelineManager()
    pipeline_id = pm.create_pipeline("default")
    pm.destroy_pipeline(pipeline_id)
    pipeline = pm.get_pipeline(pipeline_id)
    assert pipeline is None

@pytest.mark.asyncio
async def test_list_pipelines_returns_list():
    """Test list_pipelines returns list"""
    pm = PipelineManager()
    # 先清理
    for p in list(pm.list_pipelines()):
        pm.destroy_pipeline(p["pipeline_id"])
    
    pipeline_id = pm.create_pipeline("default")
    pipelines = pm.list_pipelines()
    
    assert isinstance(pipelines, list)
    assert len(pipelines) >= 1
    
    # 清理
    pm.destroy_pipeline(pipeline_id)

@pytest.mark.asyncio
async def test_create_multiple_pipelines():
    """Test creating multiple pipelines"""
    pm = PipelineManager()
    # 清理
    for p in list(pm.list_pipelines()):
        pm.destroy_pipeline(p["pipeline_id"])
    
    id1 = pm.create_pipeline("default")
    id2 = pm.create_pipeline("gal_1")
    
    pipelines = pm.list_pipelines()
    assert len(pipelines) == 2
    
    # 清理
    pm.destroy_pipeline(id1)
    pm.destroy_pipeline(id2)
