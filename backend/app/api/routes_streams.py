"""视频流管理 + 感知层: 帧提取 + 自动分析触发."""
from __future__ import annotations

import asyncio
import base64
import os
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any

import cv2
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.api.routes_auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/streams", tags=["感知层"])

# ── Stream Registry ──────────────────────────────────────────────────────────

STREAM_REGISTRY: dict[str, dict[str, Any]] = {}
ANALYSIS_TASKS: dict[str, asyncio.Task | None] = {}


class StreamConfig(BaseModel):
    name: str
    source_type: str = Field(pattern="^(file|rtsp|image)$")
    source_path: str
    auto_analyze: bool = False
    interval_sec: float = Field(ge=1.0, le=60.0, default=5.0)


class StreamInfo(BaseModel):
    id: str
    name: str
    source_type: str
    source_path: str
    auto_analyze: bool
    interval_sec: float
    status: str  # idle | running | error
    last_frame_ts: float | None = None


# ── Frame Extraction ─────────────────────────────────────────────────────────

def _extract_frame(path: str, source_type: str) -> bytes | None:
    if source_type == "file":
        cap = cv2.VideoCapture(path)
    elif source_type == "rtsp":
        cap = cv2.VideoCapture(path)
    elif source_type == "image":
        with open(path, "rb") as f:
            return f.read()
    else:
        return None
    if not cap or not cap.isOpened():
        return None
    ret, frame = cap.read()
    cap.release()
    if not ret or frame is None:
        return None
    _, jpg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return jpg.tobytes()


# ── Background Perception Loop ───────────────────────────────────────────────

async def _perception_loop(stream_id: str) -> None:
    """持续提取帧，可选触发分析 pipeline."""
    stream = STREAM_REGISTRY.get(stream_id)
    if not stream:
        return

    while ANALYSIS_TASKS.get(stream_id) is not None:
        stream_obj = STREAM_REGISTRY.get(stream_id)
        if not stream_obj or not stream_obj.get("auto_analyze"):
            break

        frame_bytes = _extract_frame(
            stream_obj["source_path"],
            stream_obj["source_type"],
        )

        if frame_bytes:
            # 保存临时帧，触发分析
            tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
            tmp.write(frame_bytes)
            tmp.close()

            try:
                # 直接调用 pipeline，不走 HTTP
                from app.analyze_pipeline import AnalyzePipeline
                from app.api.routes_analyze import _broadcast
                pipeline = AnalyzePipeline()
                decision = pipeline.run(tmp.name)
                if decision and decision.should_alert:
                    payload = {
                        "id": int(time.time() * 1000),
                        "title": decision.title,
                        "description": decision.description,
                        "risk_level": decision.risk_level,
                        "recommendation": decision.recommendation,
                        "confidence": decision.confidence,
                        "source_type": "stream",
                        "source_path": stream_id,
                        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                    }
                    await _broadcast(payload)
                    stream_obj["last_frame_ts"] = time.time()
            except Exception:
                pass
            finally:
                os.unlink(tmp.name)

        await asyncio.sleep(stream_obj.get("interval_sec", 5.0))


# ── REST Endpoints ────────────────────────────────────────────────────────────

@router.get("", response_model=list[StreamInfo])
def list_streams() -> list[StreamInfo]:
    return [
        StreamInfo(id=sid, status=s.get("status", "idle"), **s)
        for sid, s in STREAM_REGISTRY.items()
    ]


@router.post("", response_model=StreamInfo)
def add_stream(cfg: StreamConfig, _: User = Depends(get_current_user)) -> StreamInfo:
    if cfg.source_type == "file":
        p = Path(cfg.source_path)
        if not p.exists():
            raise HTTPException(400, f"文件不存在: {cfg.source_path}")

    sid = str(uuid.uuid4())[:8]
    STREAM_REGISTRY[sid] = cfg.model_dump()
    STREAM_REGISTRY[sid]["status"] = "idle"
    STREAM_REGISTRY[sid]["last_frame_ts"] = None
    ANALYSIS_TASKS[sid] = None
    return StreamInfo(id=sid, status="idle", **cfg.model_dump())


@router.delete("/{stream_id}")
def remove_stream(stream_id: str, _: User = Depends(get_current_user)) -> dict:
    if stream_id not in STREAM_REGISTRY:
        raise HTTPException(404, "流不存在")

    task = ANALYSIS_TASKS.pop(stream_id, None)
    if task and not task.done():
        task.cancel()
    STREAM_REGISTRY.pop(stream_id)
    return {"ok": True}


@router.post("/{stream_id}/start")
def start_stream(stream_id: str, _: User = Depends(get_current_user)) -> StreamInfo:
    if stream_id not in STREAM_REGISTRY:
        raise HTTPException(404, "流不存在")

    STREAM_REGISTRY[stream_id]["status"] = "running"
    ANALYSIS_TASKS[stream_id] = asyncio.ensure_future(_perception_loop(stream_id))
    return StreamInfo(id=stream_id, **STREAM_REGISTRY[stream_id])


@router.post("/{stream_id}/stop")
def stop_stream(stream_id: str, _: User = Depends(get_current_user)) -> StreamInfo:
    if stream_id not in STREAM_REGISTRY:
        raise HTTPException(404, "流不存在")

    task = ANALYSIS_TASKS.pop(stream_id, None)
    if task and not task.done():
        task.cancel()
    STREAM_REGISTRY[stream_id]["status"] = "idle"
    return StreamInfo(id=stream_id, **STREAM_REGISTRY[stream_id])


@router.get("/{stream_id}/frame")
def get_current_frame(stream_id: str) -> StreamingResponse:
    if stream_id not in STREAM_REGISTRY:
        raise HTTPException(404, "流不存在")

    stream = STREAM_REGISTRY[stream_id]
    frame_bytes = _extract_frame(stream["source_path"], stream["source_type"])

    if frame_bytes is None:
        raise HTTPException(500, "无法读取帧")

    return StreamingResponse(
        iter([frame_bytes]),
        media_type="image/jpeg",
        headers={"Cache-Control": "no-cache"},
    )


@router.get("/{stream_id}/mjpeg")
def mjpeg_feed(stream_id: str):
    if stream_id not in STREAM_REGISTRY:
        raise HTTPException(404, "流不存在")

    stream = STREAM_REGISTRY[stream_id]

    async def generate():
        while True:
            frame_bytes = _extract_frame(stream["source_path"], stream["source_type"])
            if frame_bytes:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n"
                    + frame_bytes
                    + b"\r\n"
                )
            await asyncio.sleep(0.5)

    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )
