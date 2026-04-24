"""Analyze API: image upload → LLM analysis → SSE push."""
from __future__ import annotations

import aiofiles
import asyncio
import json
from pathlib import Path
from typing import Any, AsyncGenerator

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.analyze_pipeline import AnalyzePipeline
from app.core.config import settings
from app.models.alert import Alert, RiskLevel
from app.models.user import User
from app.api.routes_auth import get_current_user
from app.vision_service import LLMServiceUnavailableError

router = APIRouter(prefix="/analyze", tags=["智能分析"])

# In-memory SSE subscriber queues
_subscribers: list[asyncio.Queue[dict[str, Any]]] = []


async def _sse_stream(queue: asyncio.Queue[dict[str, Any]]) -> AsyncGenerator[bytes, None]:
    """Yield SSE-formatted events from a queue."""
    while True:
        try:
            data = await asyncio.wait_for(queue.get(), timeout=60.0)
            yield f"event: alert\ndata: {json.dumps(data, default=str)}\n\n".encode()
        except asyncio.TimeoutError:
            # Send keepalive newline
            yield b"\n"


@router.get("/status")
async def analyze_status() -> dict[str, Any]:
    """Check whether Ollama is reachable and which models are available."""
    import httpx
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            r.raise_for_status()
            available = [m["name"] for m in r.json().get("models", [])]

        mode = settings.PIPELINE_MODE
        active_model: str | None = None
        if mode == "single":
            active_model = settings.MODEL_GEMMA4 if settings.MODEL_GEMMA4 in available else None
        else:
            active_model = settings.MODEL_VISION if settings.MODEL_VISION in available else None

        return {
            "status": "online",
            "pipeline_mode": mode,
            "active_model": active_model,
            "available_models": available,
        }
    except Exception:
        return {"status": "offline", "pipeline_mode": settings.PIPELINE_MODE, "active_model": None, "available_models": []}


@router.post("/image")
async def analyze_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Upload an image → run the AnalyzePipeline → return decision.

    If the decision requires an alert, the alert is persisted to the DB
    and broadcast to all SSE subscribers.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Only image files are accepted")

    # Save upload to a temp file
    suffix = Path(file.filename or "upload.jpg").suffix or ".jpg"
    temp_path = Path("/tmp") / f"uav_upload_{id(file)}{suffix}"
    try:
        async with aiofiles.open(temp_path, "wb") as out:
            content = await file.read()
            await out.write(content)

        pipeline = AnalyzePipeline()
        decision = pipeline.run(str(temp_path))

    except LLMServiceUnavailableError:
        raise HTTPException(
            status_code=503,
            detail="LLM service unavailable. Is Ollama running?",
        )
    except Exception as exc:
        raise HTTPException(500, detail=str(exc))
    finally:
        temp_path.unlink(missing_ok=True)

    result: dict[str, Any] = {
        "should_alert": decision.should_alert,
        "risk_level": decision.risk_level,
        "title": decision.title,
        "description": decision.description,
        "recommendation": decision.recommendation,
        "confidence": decision.confidence,
    }

    # Persist and broadcast if alert
    if decision.should_alert:
        from app.core.database import AsyncSessionLocal

        async with AsyncSessionLocal() as session:
            alert = Alert(
                title=decision.title,
                description=decision.description,
                risk_level=RiskLevel(decision.risk_level),
                scene_description=result.get("scene_description"),
                recommendation=decision.recommendation,
                confidence=decision.confidence,
                source_type="image",
                source_path=file.filename,
                status="pending",
            )
            session.add(alert)
            await session.commit()
            await session.refresh(alert)

            broadcast_payload = {
                "id": alert.id,
                "title": decision.title,
                "risk_level": decision.risk_level,
                "description": decision.description,
                "recommendation": decision.recommendation,
                "confidence": decision.confidence,
                "created_at": str(alert.created_at),
            }
            result["id"] = alert.id
            await _broadcast(broadcast_payload)

    return result


@router.get("/stream")
async def alert_stream() -> StreamingResponse:
    """SSE endpoint — clients subscribe to receive real-time alert notifications."""
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
    _subscribers.append(queue)

    async def cleanup():
        _subscribers.remove(queue)

    return StreamingResponse(
        _sse_stream(queue),
        media_type="text/event-stream",
        background=cleanup,
    )


async def _broadcast(payload: dict[str, Any]) -> None:
    """Push an alert payload to all SSE subscribers."""
    for q in _subscribers:
        await q.put(payload)
