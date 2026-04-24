from __future__ import annotations

from pathlib import Path
from typing import Optional

import cv2
from PIL import Image

__all__ = ["load_image", "extract_frames"]


def load_image(path: str) -> Optional[Image.Image]:
    """Load a single image file and return it as RGB PIL Image.
    Returns None if the file doesn't exist or can't be decoded.
    """
    try:
        img = Image.open(path)
        if img.mode != "RGB":
            img = img.convert("RGB")
        return img
    except Exception:
        return None


def extract_frames(video_path: str, interval_sec: float = 1.0) -> list[Image.Image]:
    """Extract frames from a video file at the given interval.

    Args:
        video_path: Path to the video file (MP4/AVI/MOV supported).
        interval_sec: Time in seconds between extracted frames.

    Returns:
        A list of PIL Image objects (RGB mode). Returns an empty list
        if the file doesn't exist or can't be opened.
    """
    if not Path(video_path).exists():
        return []

    cap = cv2.VideoCapture(str(video_path))
    try:
        if not cap.isOpened():
            return []

        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps <= 0:
            return []

        interval_frames = max(1, int(fps * interval_sec))
        frames: list[Image.Image] = []
        frame_idx = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % interval_frames == 0:
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                frames.append(Image.fromarray(frame_rgb))
            frame_idx += 1

        return frames
    finally:
        cap.release()
