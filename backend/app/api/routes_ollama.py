"""Ollama 模型管理接口."""
from __future__ import annotations

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter(prefix="/ollama", tags=["Ollama"])


class ModelInfo(BaseModel):
    name: str
    modified_at: str
    size: int


class OllamaModelsResponse(BaseModel):
    models: list[ModelInfo]


@router.get("/models", response_model=OllamaModelsResponse)
async def list_models():
    """返回 Ollama 中所有可用模型."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            r.raise_for_status()
            raw = r.json()
            models = [
                ModelInfo(
                    name=m["name"],
                    modified_at=m.get("modified_at", ""),
                    size=m.get("size", 0),
                )
                for m in raw.get("models", [])
            ]
            return OllamaModelsResponse(models=models)
    except Exception:
        return OllamaModelsResponse(models=[])


