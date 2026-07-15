"""管理员接口: LLM Provider 切换与连通性测试."""
from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.api.routes_auth import get_current_user
from app.core.config import resolve_provider_id, settings
from app.llm.external_client import ExternalLLMClient
from app.llm.llm_router import (
    clear_stage_override,
    get_provider_status,
    set_provider_override,
    set_stage_override,
)
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/llm", tags=["admin-llm"])
public_router = APIRouter(prefix="/llm", tags=["llm"])


# ── Request / Response 模型 ──────────────────────────────────────────────────

class ProviderUpdate(BaseModel):
    provider: str = Field(..., pattern="^(local|external|ollama|anthropic|openai|minimax|deepseek|custom)$")
    base_url: str | None = None
    api_key: str | None = None
    model: str | None = None


class StageStatus(BaseModel):
    provider: str
    model: str
    override_active: bool


class ProviderStatus(BaseModel):
    provider: str
    provider_label: str = ""
    external_base_url: str
    external_model: str
    external_api_key_set: bool
    override_active: bool = False
    ollama_model: str = ""
    ollama_base_url: str = ""
    stages: dict = Field(default_factory=dict)


class LLMStatusResponse(BaseModel):
    provider: str
    model: str
    base_url: str
    display_name: str
    description: str
    scope: str = "unified"  # "unified" | "per-stage"
    stages: dict = Field(default_factory=dict)  # {vision, decision} → {provider, model, protocol, multimodal, override_active, active_client}


class TestRequest(BaseModel):
    base_url: str
    api_key: str
    model: str


class TestResponse(BaseModel):
    ok: bool
    message: str


class ProviderCatalogItem(BaseModel):
    id: str
    label: str
    default_base_url: str
    default_model: str = ""
    protocol: str
    multimodal: bool
    models: list[str] = []


class ModelsResponse(BaseModel):
    provider: str
    models: list[str] = []
    warning: str | None = None


class StageConfig(BaseModel):
    provider: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    model: str | None = None


class PerStageUpdate(BaseModel):
    vision: StageConfig | None = None
    decision: StageConfig | None = None


class StageApplied(BaseModel):
    provider: str
    base_url: str
    api_key_set: bool
    model: str
    active_client: str  # "ollama" | "external"


class PerStageResponse(BaseModel):
    vision: StageApplied
    decision: StageApplied


# ── 公开端点的精简 schema (不暴露 base_url / api_key) ────────────────────────

class StagePublicInfo(BaseModel):
    provider: str
    model: str
    protocol: str = ""
    multimodal: bool = False
    override_active: bool = False
    active_client: str = "external"  # "ollama" | "external"


class PublicStagesResponse(BaseModel):
    scope: str = "unified"
    vision: StagePublicInfo
    decision: StagePublicInfo


# ── 公开端点 (无需鉴权, 不暴露 api_key) ──────────────────────────────────────

@public_router.get("/status", response_model=LLMStatusResponse)
async def get_llm_status() -> LLMStatusResponse:
    """返回当前生效 provider/model/base_url (公开只读, 不暴露 api_key)."""
    status = get_provider_status()
    pid = status["provider"]
    if pid == "ollama":
        model = status["ollama_model"] or "gemma4:e2b"
        base_url = status["ollama_base_url"] or "http://localhost:11434"
        display_name = f"Local Ollama ({model})"
    else:
        model = status["external_model"] or "MiniMax-M3"
        base_url = status["external_base_url"]
        label = status.get("provider_label", pid)
        active_marker = " · 已激活 override" if status.get("override_active") else ""
        display_name = f"{label} ({model}){active_marker}"

    stages = status.get("stages") or {}
    # scope 判断: 两阶段都未 override 且与全局 provider 一致 → unified; 否则 per-stage
    vision_pid = stages.get("vision", {}).get("provider", pid)
    decision_pid = stages.get("decision", {}).get("provider", pid)
    scope = "unified" if (vision_pid == decision_pid == pid) else "per-stage"

    return LLMStatusResponse(
        provider=pid,
        model=model,
        base_url=base_url,
        display_name=display_name,
        description=(
            "识别层 / 决策层 LLM 当前生效配置。管理员可在 Admin → Settings → Provider 切换。"
            f"Stages: vision={vision_pid}:{stages.get('vision', {}).get('model', '')}, "
            f"decision={decision_pid}:{stages.get('decision', {}).get('model', '')}"
        ),
        scope=scope,
        stages=stages,
    )


@public_router.get("/stages", response_model=PublicStagesResponse)
async def get_llm_stages() -> PublicStagesResponse:
    """返回识别 / 决策 两阶段的 provider/model/protocol, 公开只读.

    不暴露 base_url / api_key. 供 frontend badge / pipeline 卡片按阶段展示当前生效配置。
    """
    status = get_provider_status()
    raw_stages = status.get("stages") or {}
    pid = status["provider"]

    def _public(stage: str) -> StagePublicInfo:
        s = raw_stages.get(stage) or {}
        s_pid = s.get("provider") or pid
        return StagePublicInfo(
            provider=s_pid,
            model=s.get("model", "") or "",
            protocol=s.get("protocol", ""),
            multimodal=bool(s.get("multimodal", False)),
            override_active=bool(s.get("override_active", False)),
            active_client=s.get("active_client", "external"),
        )

    scope = "unified" if (
        raw_stages.get("vision", {}).get("provider", pid)
        == raw_stages.get("decision", {}).get("provider", pid)
        == pid
    ) else "per-stage"

    return PublicStagesResponse(
        scope=scope,
        vision=_public("vision"),
        decision=_public("decision"),
    )


# ── 工具函数 ────────────────────────────────────────────────────────────────

def _resolve_provider_inputs(payload: dict[str, Any]) -> dict[str, Any]:
    """把传入 payload 规范化, 补全 base_url / model / api_key 默认值.

    - 兼容 "local" / "external" 别名
    - base_url 缺失 → 从 catalog 取默认
    - model 缺失 → 从 catalog 取第一个
    - api_key 缺失 → 使用 settings.EXTERNAL_LLM_API_KEY (ollama 不需要)
    """
    raw_provider = payload.get("provider") or settings.LLM_PROVIDER or "local"
    pid = resolve_provider_id(raw_provider)
    meta = settings.LLM_PROVIDERS_CATALOG.get(pid) or {}
    base_url = payload.get("base_url") or meta.get("default_base_url") or ""
    models = meta.get("models") or []
    model = payload.get("model") or (models[0] if models else "")
    if pid == "ollama":
        api_key = ""
    else:
        api_key = payload.get("api_key") or settings.EXTERNAL_LLM_API_KEY or ""
    return {
        "provider": pid,
        "base_url": base_url,
        "api_key": api_key,
        "model": model,
    }


def _active_client_label(provider_id: str) -> str:
    """返回 active_client 标识 (ollama | external) 供前端展示."""
    pid = resolve_provider_id(provider_id)
    return "ollama" if pid == "ollama" else "external"


def _stage_applied_from(stage: str, provider_id: str, fields: dict[str, Any]) -> StageApplied:
    pid = resolve_provider_id(provider_id)
    meta = settings.LLM_PROVIDERS_CATALOG.get(pid) or {}
    base_url = fields.get("base_url") or meta.get("default_base_url") or ""
    model = fields.get("model") or ""
    if not model:
        models = meta.get("models") or []
        model = models[0] if models else ""
    api_key = fields.get("api_key") or ""
    return StageApplied(
        provider=pid,
        base_url=base_url,
        api_key_set=bool(api_key),
        model=model,
        active_client=_active_client_label(pid),
    )


# ── 端点 ────────────────────────────────────────────────────────────────────

@router.get("/provider", response_model=ProviderStatus)
async def get_provider(_: User = Depends(get_current_user)) -> ProviderStatus:
    """返回当前 LLM provider 状态."""
    status = get_provider_status()
    stages = {}
    for sk in ("vision", "decision"):
        s = status["stages"][sk]
        stages[sk] = StageStatus(
            provider=s["provider"], model=s["model"], override_active=s["override_active"]
        )
    return ProviderStatus(
        provider=status["provider"],
        provider_label=status.get("provider_label", status["provider"]),
        external_base_url=status["external_base_url"],
        external_model=status["external_model"],
        external_api_key_set=status["external_api_key_set"],
        override_active=status["override_active"],
        ollama_model=status.get("ollama_model", ""),
        ollama_base_url=status.get("ollama_base_url", ""),
        stages=stages,
    )


@router.post("/provider", response_model=ProviderStatus)
async def update_provider(
    body: ProviderUpdate,
    _: User = Depends(get_current_user),
) -> ProviderStatus:
    """更新运行时 provider 覆盖 (立即生效, 写盘)."""
    payload: dict[str, Any] = {"provider": body.provider}
    if body.base_url is not None:
        payload["base_url"] = body.base_url
    if body.api_key is not None:
        payload["api_key"] = body.api_key
    if body.model is not None:
        payload["model"] = body.model
    set_provider_override(payload)
    # Masked log - never print the raw secret.
    if body.api_key:
        masked = (
            f"{'*' * max(0, len(body.api_key) - 4)}{body.api_key[-4:]}"
            if len(body.api_key) >= 4
            else "***"
        )
        logger.info(
            "管理员更新 LLM provider: provider=%s model=%s api_key=%s (len=%d)",
            body.provider,
            body.model,
            masked,
            len(body.api_key),
        )
    else:
        logger.info("管理员更新 LLM provider: provider=%s model=%s", body.provider, body.model)

    return await get_provider(_=_)


@router.post("/test", response_model=TestResponse)
async def test_provider(
    body: TestRequest,
    _: User = Depends(get_current_user),
) -> TestResponse:
    """对给定 (base_url/api_key/model) 做最小连通性测试, 不影响全局状态."""
    client = ExternalLLMClient(
        base_url=body.base_url,
        api_key=body.api_key,
        model=body.model,
    )
    result = await client.test()
    return TestResponse(ok=result["ok"], message=result["message"])


@router.get("/providers", response_model=list[ProviderCatalogItem])
async def list_providers(_: User = Depends(get_current_user)) -> list[ProviderCatalogItem]:
    """返回 provider 目录 (供管理端下拉选择)."""
    items: list[ProviderCatalogItem] = []
    for pid, meta in settings.LLM_PROVIDERS_CATALOG.items():
        models = list(meta.get("models") or [])
        default_model = models[0] if models else ""
        items.append(ProviderCatalogItem(
            id=pid,
            label=meta.get("label", pid),
            default_base_url=meta.get("default_base_url", ""),
            default_model=default_model,
            protocol=meta.get("protocol", "anthropic"),
            multimodal=bool(meta.get("multimodal", False)),
            models=models,
        ))
    return items


@router.get("/models", response_model=ModelsResponse)
async def list_models(
    provider: str = Query(..., description="Provider id (ollama/anthropic/openai/...)"),
    base_url: str | None = Query(None),
    api_key: str | None = Query(None),
    _: User = Depends(get_current_user),
) -> ModelsResponse:
    """返回某 provider 的可用模型列表.

    - ollama: 实时拉 /api/tags
    - 其他: 返回 catalog 默认 models
    - 任何异常都返回 200 + warning, 绝不上抛 5xx, 绝不回显 api_key
    """
    pid = resolve_provider_id(provider)
    meta = settings.LLM_PROVIDERS_CATALOG.get(pid) or {}
    catalog_models = list(meta.get("models") or [])

    if pid == "ollama":
        # 实时拉 ollama 标签
        bu = base_url or meta.get("default_base_url") or settings.OLLAMA_BASE_URL
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                r = await client.get(f"{bu.rstrip('/')}/api/tags")
                r.raise_for_status()
                data = r.json()
            models = [m.get("name") for m in (data.get("models") or []) if m.get("name")]
            return ModelsResponse(provider=pid, models=models)
        except Exception as exc:  # noqa: BLE001
            logger.warning("拉取 ollama 模型列表失败 (%s): %s", bu, exc)
            return ModelsResponse(
                provider=pid,
                models=catalog_models,
                warning=f"无法连接 {bu}: {type(exc).__name__}",
            )

    # 其他 provider 直接返回 catalog 模型
    return ModelsResponse(provider=pid, models=catalog_models)


@router.get("/per-stage", response_model=PerStageResponse)
async def get_per_stage(
    _: User = Depends(get_current_user),
) -> PerStageResponse:
    """读取当前 vision / decision 两阶段生效配置 (不修改). 供 Admin ProviderTab mount 时直接获取."""
    status = get_provider_status()
    raw_stages = status.get("stages") or {}
    pid = status["provider"]

    def _applied(stage: str) -> StageApplied:
        s = raw_stages.get(stage) or {}
        s_pid = s.get("provider") or pid
        s_model = s.get("model") or ""
        meta = settings.LLM_PROVIDERS_CATALOG.get(s_pid) or {}
        base_url = meta.get("default_base_url") or ""
        return StageApplied(
            provider=s_pid,
            base_url=base_url,
            api_key_set=bool(s.get("api_key_set", False)),
            model=s_model,
            active_client=s.get("active_client", "external"),
        )

    return PerStageResponse(vision=_applied("vision"), decision=_applied("decision"))


@router.post("/per-stage", response_model=PerStageResponse)
async def update_per_stage(
    body: PerStageUpdate,
    _: User = Depends(get_current_user),
) -> PerStageResponse:
    """更新 vision / decision 两阶段独立 provider 覆盖.

    写入并落盘, 下次启动自动恢复. 返回应用结果 + 当前 active_client 类型.
    """
    applied_vision_pid = settings.VISION_PROVIDER or settings.LLM_PROVIDER
    applied_vision_fields: dict[str, Any] = {}
    applied_decision_pid = settings.DECISION_PROVIDER or settings.LLM_PROVIDER
    applied_decision_fields: dict[str, Any] = {}

    if body.vision is not None:
        payload = body.vision.model_dump(exclude_none=True)
        resolved = _resolve_provider_inputs(payload)
        applied = set_stage_override(
            "vision",
            provider=resolved["provider"],
            base_url=resolved["base_url"] or None,
            api_key=resolved["api_key"] or None,
            model=resolved["model"] or None,
        )
        applied_vision_pid = applied.get("provider", applied_vision_pid)
        applied_vision_fields = {
            "base_url": applied.get("base_url", ""),
            "api_key": applied.get("api_key", ""),
            "model": applied.get("model", ""),
        }
        logger.info("管理员更新 vision 阶段 provider: %s", applied_vision_pid)

    if body.decision is not None:
        payload = body.decision.model_dump(exclude_none=True)
        resolved = _resolve_provider_inputs(payload)
        applied = set_stage_override(
            "decision",
            provider=resolved["provider"],
            base_url=resolved["base_url"] or None,
            api_key=resolved["api_key"] or None,
            model=resolved["model"] or None,
        )
        applied_decision_pid = applied.get("provider", applied_decision_pid)
        applied_decision_fields = {
            "base_url": applied.get("base_url", ""),
            "api_key": applied.get("api_key", ""),
            "model": applied.get("model", ""),
        }
        logger.info("管理员更新 decision 阶段 provider: %s", applied_decision_pid)

    return PerStageResponse(
        vision=_stage_applied_from("vision", applied_vision_pid, applied_vision_fields),
        decision=_stage_applied_from("decision", applied_decision_pid, applied_decision_fields),
    )


@router.delete("/per-stage/{stage}")
async def clear_per_stage(
    stage: str,
    _: User = Depends(get_current_user),
) -> dict[str, Any]:
    """清除某阶段覆盖 (回到 settings 默认)."""
    if stage not in ("vision", "decision"):
        return {"ok": False, "message": f"unknown stage: {stage}"}
    clear_stage_override(stage)
    return {"ok": True, "stage": stage}


__all__ = ["router", "public_router"]