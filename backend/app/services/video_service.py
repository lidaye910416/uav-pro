# backend/app/services/video_service.py
"""视频服务 - 封装视频读取和帧提取"""
from __future__ import annotations

from pathlib import Path
from typing import Optional
import cv2

from app.services.types import FrameData, VideoInfo


# 视频路径配置
DEMO_VIDEO = Path(__file__).resolve().parents[2] / "data" / "streams" / "gal_1.mp4"
MITRA_VIDEO_DIR = Path(__file__).resolve().parents[2] / "data" / "streams" / "MiTra"

# 视频列表配置
MITRA_VIDEOS: list[dict] = [
    {"id": "gal_1", "label": "gal_1 · 测试视频", "filename": "gal_1.mp4", "device": "TEST-01"},
    {"id": "d1", "label": "T1-D1 · 1号机", "filename": "T1_D1.mp4", "device": "UAV-01"},
    {"id": "d2", "label": "T1-D2 · 2号机", "filename": "T1_D2.mp4", "device": "UAV-02"},
    {"id": "d3", "label": "T1-D3 · 3号机", "filename": "T1_D3.mp4", "device": "UAV-03"},
    {"id": "d4", "label": "T1-D4 · 4号机", "filename": "T1_D4.mp4", "device": "UAV-04"},
    {"id": "d5", "label": "T1-D5 · 5号机", "filename": "T1_D5.mp4", "device": "UAV-05"},
    {"id": "d6", "label": "T1-D6 · 6号机", "filename": "T1_D6.mp4", "device": "UAV-06"},
]


class VideoService:
    """视频服务 - 封装视频读取和帧提取"""
    
    def __init__(self, video_id: str):
        self.video_id = video_id
        self._video_path: Optional[Path] = None
    
    @property
    def video_path(self) -> Optional[Path]:
        """获取视频路径"""
        if self._video_path is None:
            self._video_path = self.resolve_video_path(self.video_id)
        return self._video_path
    
    @classmethod
    def resolve_video_path(cls, video_id: str) -> Optional[Path]:
        """解析 video_id 到路径"""
        if video_id == "default":
            return DEMO_VIDEO if DEMO_VIDEO.exists() else None
        
        if video_id == "gal_1":
            p = Path(__file__).resolve().parents[2] / "data" / "streams" / "gal_1.mp4"
            return p if p.exists() else None
        
        for v in MITRA_VIDEOS:
            if v["id"] == video_id:
                p = MITRA_VIDEO_DIR / v["filename"]
                return p if p.exists() else None
        
        return None
    
    def get_video_info(self) -> VideoInfo:
        """获取视频信息"""
        path = self.video_path
        
        if path is None or not path.exists():
            return VideoInfo(
                video_id=self.video_id,
                label=f"Video {self.video_id}",
                filename="",
                exists=False,
                total_frames=0,
                fps=0.0,
                width=0,
                height=0,
            )
        
        cap = cv2.VideoCapture(str(path))
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        cap.release()
        
        # 查找 label
        label = f"Video {self.video_id}"
        for v in MITRA_VIDEOS:
            if v["id"] == self.video_id:
                label = v["label"]
                break
        
        return VideoInfo(
            video_id=self.video_id,
            label=label,
            filename=path.name,
            exists=True,
            total_frames=total,
            fps=round(fps, 1),
            width=w,
            height=h,
        )
    
    def extract_frames(self, count: int = 3) -> list[FrameData]:
        """提取均匀分布的帧"""
        path = self.video_path
        if path is None or not path.exists():
            return []
        
        cap = cv2.VideoCapture(str(path))
        if not cap.isOpened():
            return []
        
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        cap.release()
        
        if total <= 0 or fps <= 0:
            return []
        
        interval = total // count if count > 0 else 1
        frames: list[FrameData] = []
        
        for i in range(count):
            frame_idx = i * interval
            cap = cv2.VideoCapture(str(path))
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            cap.release()
            
            if ret and frame is not None:
                frames.append(FrameData(
                    frame_idx=frame_idx,
                    timestamp=frame_idx / fps if fps > 0 else 0,
                    frame_bgr=frame,
                ))
        
        return frames
    
    @classmethod
    def list_available_videos(cls) -> dict:
        """列出所有可用视频"""
        default_info = cls("default").get_video_info()
        
        mitra = []
        for v in MITRA_VIDEOS:
            vs = cls(v["id"])
            info = vs.get_video_info()
            mitra.append({
                "id": v["id"],
                "label": v["label"],
                "filename": v["filename"],
                "device": v["device"],
                "exists": info.exists,
                "total_frames": info.total_frames,
                "fps": info.fps,
                "width": info.width,
                "height": info.height,
            })
        
        return {
            "default": {
                "id": "default",
                "label": default_info.label,
                "filename": default_info.filename,
                "exists": default_info.exists,
                "total_frames": default_info.total_frames,
                "fps": default_info.fps,
                "width": default_info.width,
                "height": default_info.height,
            },
            "mitra": mitra,
        }
