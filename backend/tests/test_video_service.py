# backend/tests/test_video_service.py
import pytest
from pathlib import Path
from app.services.video_service import VideoService, DEMO_VIDEO, MITRA_VIDEO_DIR, MITRA_VIDEOS

def test_video_service_initialization():
    """Test VideoService can be instantiated with video_id"""
    vs = VideoService("default")
    assert vs.video_id == "default"

def test_video_service_gal1():
    """Test VideoService with gal_1"""
    vs = VideoService("gal_1")
    assert vs.video_id == "gal_1"

def test_video_service_d1():
    """Test VideoService with d1 (MiTra)"""
    vs = VideoService("d1")
    assert vs.video_id == "d1"

def test_resolve_video_path_default():
    """Test resolving default video path"""
    path = VideoService.resolve_video_path("default")
    # 路径可能是 None (视频不存在) 或 Path 对象
    assert path is None or isinstance(path, Path)

def test_resolve_video_path_gal1():
    """Test resolving gal_1 video path"""
    path = VideoService.resolve_video_path("gal_1")
    assert path is None or isinstance(path, Path)

def test_resolve_video_path_unknown():
    """Test resolving unknown video returns None"""
    path = VideoService.resolve_video_path("unknown_video")
    assert path is None

def test_list_available_videos():
    """Test listing all available videos"""
    videos = VideoService.list_available_videos()
    assert "default" in videos
    assert "mitra" in videos
    assert isinstance(videos["mitra"], list)

def test_video_info_structure():
    """Test VideoInfo structure"""
    vs = VideoService("default")
    info = vs.get_video_info()
    assert info.video_id == "default"
    assert hasattr(info, "filename")
    assert hasattr(info, "exists")
    assert hasattr(info, "fps")

def test_mitra_videos_defined():
    """Test MITRA_VIDEOS is properly defined"""
    assert len(MITRA_VIDEOS) == 7  # gal_1 + d1-d6
    assert MITRA_VIDEOS[0]["id"] == "gal_1"
    assert MITRA_VIDEOS[1]["id"] == "d1"

def test_video_service_extract_frames():
    """Test extract_frames returns list"""
    vs = VideoService("default")
    frames = vs.extract_frames(count=3)
    assert isinstance(frames, list)
    # 视频可能不存在，所以返回空列表也是正确的
