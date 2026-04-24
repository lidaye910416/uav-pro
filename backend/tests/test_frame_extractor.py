import pytest
from PIL import Image
from app.services.perception.frame_extractor import extract_frames, load_image


class TestLoadImage:
    """load_image: 加载单张图片文件"""

    def test_load_image_returns_rgb_pil_image(self):
        """加载测试图片文件，返回 RGB 模式的 PIL Image"""
        img = load_image("tests/fixtures/sample.jpg")
        assert img is not None
        assert isinstance(img, Image.Image)
        assert img.mode == "RGB"
        assert img.size[0] > 0 and img.size[1] > 0

    def test_load_image_png(self):
        """PNG 文件也能正常加载"""
        img = load_image("tests/fixtures/sample.png")
        assert img is not None
        assert img.mode == "RGB"

    def test_load_image_nonexistent_returns_none(self):
        """不存在的文件返回 None，不抛异常"""
        result = load_image("tests/fixtures/nonexistent.jpg")
        assert result is None


class TestExtractFrames:
    """extract_frames: 从视频按间隔提取帧"""

    def test_extract_frames_from_video(self):
        """从测试视频中按间隔提取帧，返回非空帧列表"""
        frames = extract_frames("tests/fixtures/sample.mp4", interval_sec=1.0)
        assert isinstance(frames, list)
        assert len(frames) >= 1
        for frame in frames:
            assert isinstance(frame, Image.Image)
            assert frame.mode == "RGB"

    def test_extract_frames_nonexistent_file_returns_empty_list(self):
        """不存在的视频文件返回空列表，不抛异常"""
        frames = extract_frames("nonexistent_video.mp4", interval_sec=1.0)
        assert frames == []

    def test_extract_frames_different_interval(self):
        """不同 interval 返回不同数量的帧"""
        frames_half = extract_frames("tests/fixtures/sample.mp4", interval_sec=0.5)
        frames_one = extract_frames("tests/fixtures/sample.mp4", interval_sec=1.0)
        # 更小间隔应该 >= 更大间隔的帧数
        assert len(frames_half) >= len(frames_one)
