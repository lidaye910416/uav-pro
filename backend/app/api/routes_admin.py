"""管理员接口: 系统健康 / RAG知识库 / 统计 / Pipeline配置."""
from __future__ import annotations

import httpx
import os
from pathlib import Path
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.api.routes_auth import get_current_user
from app.models.user import User
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from sqlalchemy import select, func
from app.models.alert import Alert
from app.models.data_record import DataRecord

router = APIRouter(prefix="/admin", tags=["admin"])


class HealthResponse(BaseModel):
    service: str
    status: str  # healthy | degraded | down
    latency_ms: float | None = None
    detail: str | None = None


class OllamaHealth(BaseModel):
    status: str
    models: list[str] = []
    error: str | None = None


class ChromaHealth(BaseModel):
    status: str
    collections: list[str] = []
    error: str | None = None


class SystemStats(BaseModel):
    total_alerts: int
    alerts_by_risk: dict[str, int]
    alerts_by_status: dict[str, int]
    total_records: int
    registered_streams: int


class RAGDoc(BaseModel):
    text: str
    metadata: dict | None = None


# ── 健康检查 ─────────────────────────────────────────────────────────────────

@router.get("/health", response_model=list[HealthResponse])
async def system_health() -> list[HealthResponse]:
    """检查所有依赖服务的健康状态."""
    results: list[HealthResponse] = []

    # Ollama
    try:
        import time
        t0 = time.perf_counter()
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
        latency = (time.perf_counter() - t0) * 1000
        if r.status_code == 200:
            models = [m.get("name", "") for m in r.json().get("models", [])]
            results.append(HealthResponse(
                service="ollama", status="healthy",
                latency_ms=round(latency, 1),
                detail=f"{len(models)} models loaded",
            ))
        else:
            results.append(HealthResponse(
                service="ollama", status="degraded",
                detail=f"HTTP {r.status_code}",
            ))
    except Exception as e:
        results.append(HealthResponse(
            service="ollama", status="down", detail=str(e),
        ))

    # ChromaDB
    try:
        import time
        t0 = time.perf_counter()
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"http://localhost:8001/api/v1/heartbeat")
        latency = (time.perf_counter() - t0) * 1000
        results.append(HealthResponse(
            service="chromadb", status="healthy" if r.status_code == 200 else "degraded",
            latency_ms=round(latency, 1),
        ))
    except Exception as e:
        results.append(HealthResponse(
            service="chromadb", status="down", detail=str(e),
        ))

    # Database
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(select(func.count(Alert.id)))
        results.append(HealthResponse(service="database", status="healthy"))
    except Exception as e:
        results.append(HealthResponse(
            service="database", status="down", detail=str(e),
        ))

    return results


@router.get("/ollama", response_model=OllamaHealth)
async def ollama_status() -> OllamaHealth:
    """Ollama 模型状态."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
        if r.status_code == 200:
            models = [m.get("name", "") for m in r.json().get("models", [])]
            return OllamaHealth(status="running", models=models)
        return OllamaHealth(status="error", error=f"HTTP {r.status_code}")
    except Exception as e:
        return OllamaHealth(status="error", error=str(e))


@router.get("/chromadb", response_model=ChromaHealth)
async def chromadb_status() -> ChromaHealth:
    """ChromaDB 状态."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get("http://localhost:8001/api/v1/heartbeat")
        if r.status_code == 200:
            # 尝试获取 collections
            try:
                rc = await client.get("http://localhost:8001/api/v1collections")
                cols = [c.get("name", "") for c in rc.json()] if rc.status_code == 200 else []
            except Exception:
                cols = []
            return ChromaHealth(status="running", collections=cols)
        return ChromaHealth(status="error", error=f"HTTP {r.status_code}")
    except Exception as e:
        return ChromaHealth(status="error", error=str(e))


# ── 系统统计 ─────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=SystemStats)
async def system_stats() -> SystemStats:
    """获取系统整体统计."""
    async with AsyncSessionLocal() as session:
        # 总预警数
        total = (await session.execute(select(func.count(Alert.id)))).scalar() or 0

        # 按风险级别统计
        risk_counts: dict[str, int] = {}
        for level in ["critical", "high", "medium", "low"]:
            cnt = (await session.execute(
                select(func.count(Alert.id)).where(Alert.risk_level == level)
            )).scalar() or 0
            risk_counts[level] = cnt

        # 按状态统计
        status_counts: dict[str, int] = {}
        for status in ["pending", "confirmed", "resolved", "dismissed"]:
            cnt = (await session.execute(
                select(func.count(Alert.id)).where(Alert.status == status)
            )).scalar() or 0
            status_counts[status] = cnt

        # 总记录数
        total_records = (await session.execute(
            select(func.count(DataRecord.id))
        )).scalar() or 0

    from app.api.routes_streams import STREAM_REGISTRY
    return SystemStats(
        total_alerts=total,
        alerts_by_risk=risk_counts,
        alerts_by_status=status_counts,
        total_records=total_records,
        registered_streams=len(STREAM_REGISTRY),
    )


# ── RAG 知识库管理 ───────────────────────────────────────────────────────────

@router.post("/rag/add")
def rag_add_document(doc: RAGDoc, _: User = Depends(get_current_user)) -> dict:
    """向 RAG 知识库添加 SOP 文档."""
    try:
        from app.rag_service import RAGService
        rag = RAGService()
        rag.add_document(doc.text, metadata=doc.metadata)
        return {"ok": True, "chunks": 1}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.get("/rag/search")
def rag_search(q: str, k: int = 3) -> dict:
    """RAG 向量检索（测试用，无需认证）."""
    try:
        from app.rag_service import RAGService
        rag = RAGService()
        results = rag.retrieve(q, top_k=k)
        return {"query": q, "results": results, "count": len(results)}
    except Exception as e:
        return {"query": q, "results": [], "error": str(e)}


# ── Pipeline 配置 ───────────────────────────────────────────────────────────

class PipelineConfigUpdate(BaseModel):
    mode: str | None = None


class PipelineModelInfo(BaseModel):
    name: str
    loaded: bool
    size: int | None = None


class PipelineStatus(BaseModel):
    mode: str
    gemma4_e2b: PipelineModelInfo
    vision: PipelineModelInfo
    decision: PipelineModelInfo
    all_available: list[str]


@router.get("/pipeline", response_model=PipelineStatus)
async def get_pipeline_status() -> PipelineStatus:
    """返回当前 pipeline 配置状态和 Ollama 可用模型列表."""
    all_models: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            if r.status_code == 200:
                all_models = [m["name"] for m in r.json().get("models", [])]
    except Exception:
        pass

    def model_info(name: str) -> PipelineModelInfo:
        return PipelineModelInfo(
            name=name,
            loaded=name in all_models,
        )

    return PipelineStatus(
        mode=settings.PIPELINE_MODE,
        gemma4_e2b=model_info(settings.MODEL_GEMMA4),
        vision=model_info(settings.MODEL_VISION),
        decision=model_info(settings.MODEL_DECISION),
        all_available=all_models,
    )


@router.put("/pipeline")
async def update_pipeline_config(
    cfg: PipelineConfigUpdate,
    _: User = Depends(get_current_user),
) -> dict:
    """更新 pipeline 运行模式（需要管理员认证）。"""
    if cfg.mode and cfg.mode not in ("single", "dual"):
        return {"ok": False, "error": "mode 必须是 'single' 或 'dual'"}

    new_mode = cfg.mode or settings.PIPELINE_MODE

    # 写入 .env 文件
    env_path = Path(__file__).resolve().parents[2] / ".env"
    env_lines = env_path.read_text().splitlines() if env_path.exists() else []
    updated = False
    new_lines: list[str] = []
    for line in env_lines:
        if line.startswith("PIPELINE_MODE="):
            new_lines.append(f"PIPELINE_MODE={new_mode}")
            updated = True
        else:
            new_lines.append(line)
    if not updated:
        new_lines.append(f"PIPELINE_MODE={new_mode}")
    env_path.write_text("\n".join(new_lines) + "\n")

    return {"ok": True, "mode": new_mode, "message": "重启服务后生效"}

