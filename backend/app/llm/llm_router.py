"""LLM Provider 路由器.

按运行时配置 (settings.LLM_PROVIDER 或管理员覆盖) 选择本地 Ollama 或外部 LLM。
所有调用方应通过 get_llm_client() 获取客户端实例。

接口统一为:
    - chat_text(prompt, system="") -> str
    - chat_vision(image_b64, prompt) -> str

支持 per-stage (vision / decision) 独立路由；管理员覆盖持久化到
``backend/data/llm_provider.json``，重启后自动恢复。
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any, Protocol

import httpx

from app.core.config import resolve_provider_id, settings

from app.llm.external_client import ExternalLLMClient

logger = logging.getLogger(__name__)


class LLMClient(Protocol):
    """统一 LLM 客户端协议 (Duck typing 即可)."""

    async def chat_text(self, prompt: str, system: str = "") -> str: ...
    async def chat_vision(self, image_b64: str, prompt: str) -> str: ...


# ── 持久化文件 (backend/data/llm_provider.json) ────────────────────────────────

_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_SETTINGS_FILE = _DATA_DIR / "llm_provider.json"


# ── 运行时覆盖 (供管理端切换) ─────────────────────────────────────────────────
_provider_override: dict[str, Any] = {
    "provider": None,
    "base_url": None,
    "api_key": None,
    "model": None,
}

# ── Per-stage 覆盖 (vision / decision 独立) ────────────────────────────────────
_STAGE_OVERRIDES: dict[str, dict] = {"vision": {}, "decision": {}}


# ── 本地 Ollama 适配 ─────────────────────────────────────────────────────────

class _OllamaClient:
    """薄封装 Ollama HTTP API, 提供与 ExternalLLMClient 一致的接口."""

    def __init__(self, base_url: str, model: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model

    async def chat_text(self, prompt: str, system: str = "") -> str:
        full_prompt = f"{system}\n\n{prompt}" if system else prompt
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": full_prompt,
                    "stream": False,
                    "options": {"temperature": 0.3, "num_ctx": 4096},
                },
            )
            r.raise_for_status()
            return r.json().get("response", "").strip()

    async def chat_vision(self, image_b64: str, prompt: str) -> str:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "images": [image_b64],
                    "stream": False,
                    "options": {"num_predict": 200},
                },
            )
            r.raise_for_status()
            return r.json().get("response", "").strip()


# ── Provider 解析 ────────────────────────────────────────────────────────────

def _resolve_provider() -> str:
    """运行时覆盖 > settings 默认."""
    override = _provider_override.get("provider")
    if override:
        return str(override)
    return settings.LLM_PROVIDER or "local"


def _provider_meta(provider_id: str) -> dict[str, Any] | None:
    """从目录中查找 provider 元信息, 不存在则返回 None."""
    return settings.LLM_PROVIDERS_CATALOG.get(provider_id)


def _default_model_for(provider_id: str) -> str | None:
    meta = _provider_meta(provider_id)
    if not meta:
        return None
    models = meta.get("models") or []
    return models[0] if models else None


def _default_base_url_for(provider_id: str) -> str:
    meta = _provider_meta(provider_id)
    if not meta:
        return ""
    return meta.get("default_base_url") or ""


def _make_client(
    provider_id: str,
    base_url: str | None = None,
    api_key: str | None = None,
    model: str | None = None,
) -> LLMClient:
    """根据 provider id 构造客户端.

    Args:
        provider_id: 目录 id (ollama/anthropic/minimax/openai/deepseek/custom)
            兼容: local → ollama, external → anthropic
        base_url: 覆盖默认 base_url
        api_key: 覆盖默认 api_key (仅对 external provider 有意义)
        model: 覆盖默认 model
    """
    pid = resolve_provider_id(provider_id)
    meta = _provider_meta(pid)
    protocol = (meta or {}).get("protocol", "anthropic")

    # Ollama 协议 → 本地客户端
    if pid == "ollama" or protocol == "ollama":
        bu = base_url or _default_base_url_for(pid) or settings.OLLAMA_BASE_URL
        m = model or _default_model_for(pid) or settings.MODEL_GEMMA4
        logger.info("LLM 路由 -> ollama (%s @ %s)", m, bu)
        return _OllamaClient(base_url=bu, model=m)

    # 其他 (anthropic 协议或 openai 协议 — 当前统一走 ExternalLLMClient)
    bu = base_url or _default_base_url_for(pid) or settings.EXTERNAL_LLM_BASE_URL
    m = model or _default_model_for(pid) or settings.EXTERNAL_LLM_MODEL
    ak = api_key or settings.EXTERNAL_LLM_API_KEY
    logger.info("LLM 路由 -> external [%s] (%s @ %s)", pid, m, bu)
    return ExternalLLMClient(base_url=bu, api_key=ak, model=m)


def get_llm_client() -> LLMClient:
    """返回当前生效的 LLM 客户端 (按 provider 切换 local/external).

    向后兼容: 旧代码通过本接口获取默认 provider 客户端, 行为保持不变。
    """
    provider = _resolve_provider()
    pid = resolve_provider_id(provider)
    if pid == "ollama" and not _provider_override.get("provider"):
        # 快速路径: 无覆盖时使用 settings 默认
        logger.info("LLM 路由 -> local ollama (%s)", settings.MODEL_GEMMA4)
        return _OllamaClient(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.MODEL_GEMMA4,
        )
    return _make_client(
        provider_id=pid,
        base_url=_provider_override.get("base_url"),
        api_key=_provider_override.get("api_key"),
        model=_provider_override.get("model"),
    )


# ── Per-stage 解析 ───────────────────────────────────────────────────────────

def _resolve_stage_provider(stage: str) -> tuple[str, dict[str, Any]]:
    """返回 (provider_id, override_dict) 用于该 stage.

    优先级: _STAGE_OVERRIDES[stage] > VISION_*/DECISION_* env > LLM_PROVIDER 默认
    """
    stage_override = _STAGE_OVERRIDES.get(stage) or {}

    env_provider = (
        settings.VISION_PROVIDER if stage == "vision" else settings.DECISION_PROVIDER
    )
    env_model = (
        settings.VISION_MODEL if stage == "vision" else settings.DECISION_MODEL
    )

    pid = stage_override.get("provider") or env_provider or _resolve_provider()
    if not pid:
        pid = _resolve_provider()
    base_url = stage_override.get("base_url")
    api_key = stage_override.get("api_key")
    model = stage_override.get("model") or env_model

    return pid, {
        "base_url": base_url,
        "api_key": api_key,
        "model": model,
    }


def get_stage_client(stage: str) -> LLMClient:
    """返回指定阶段的 LLM 客户端 (vision / decision)."""
    if stage not in ("vision", "decision"):
        raise ValueError(f"unknown stage: {stage!r}")
    pid, fields = _resolve_stage_provider(stage)
    return _make_client(
        provider_id=pid,
        base_url=fields["base_url"],
        api_key=fields["api_key"],
        model=fields["model"],
    )


def get_vision_client() -> LLMClient:
    """识别层 (视觉) 客户端."""
    return get_stage_client("vision")


def get_decision_client() -> LLMClient:
    """决策层客户端."""
    return get_stage_client("decision")


# ── 管理员接口辅助 ──────────────────────────────────────────────────────────

def set_provider_override(payload: dict[str, Any]) -> None:
    """设置运行时 provider 覆盖 (兼容旧接口, 同时写盘).

    payload 字段: provider, base_url, api_key, model (均可选)
    """
    for key in ("provider", "base_url", "api_key", "model"):
        if key in payload:
            _provider_override[key] = payload[key]
    _persist()


def set_stage_override(stage: str, **kwargs: Any) -> dict[str, Any]:
    """设置 per-stage 覆盖, 立即写盘.

    支持字段: provider, base_url, api_key, model
    """
    if stage not in _STAGE_OVERRIDES:
        raise ValueError(f"unknown stage: {stage!r}")
    current = dict(_STAGE_OVERRIDES[stage])
    for key in ("provider", "base_url", "api_key", "model"):
        if key in kwargs and kwargs[key] is not None:
            current[key] = kwargs[key]
    _STAGE_OVERRIDES[stage] = current
    _persist()
    return current


def clear_stage_override(stage: str) -> None:
    """清除某阶段覆盖 (回到 settings.LLM_PROVIDER 默认)."""
    if stage in _STAGE_OVERRIDES:
        _STAGE_OVERRIDES[stage] = {}
        _persist()


def get_provider_status() -> dict[str, Any]:
    """返回当前生效 provider 状态 (override 优先, settings 后备)."""
    provider_raw = _resolve_provider()
    pid = resolve_provider_id(provider_raw)
    ov = _provider_override or {}

    def _ov_get(key, settings_attr=None):
        v = ov.get(key)
        if v:
            return str(v)
        if settings_attr:
            return str(getattr(settings, settings_attr) or "")
        return ""

    if pid == "ollama":
        effective_model = (
            _ov_get("model", "MODEL_GEMMA4")
            or _default_model_for("ollama")
            or "gemma4:e2b"
        )
        effective_base_url = (
            _ov_get("base_url", None)
            or settings.OLLAMA_BASE_URL
            or _default_base_url_for("ollama")
        )
        effective_api_key = ""
    else:
        effective_model = (
            _ov_get("model", "EXTERNAL_LLM_MODEL")
            or _default_model_for(pid)
            or ""
        )
        effective_base_url = (
            _ov_get("base_url", "EXTERNAL_LLM_BASE_URL")
            or _default_base_url_for(pid)
        )
        effective_api_key = _ov_get("api_key", "EXTERNAL_LLM_API_KEY")

    stage_status: dict[str, Any] = {}
    for stage in ("vision", "decision"):
        s_pid, s_fields = _resolve_stage_provider(stage)
        s_pid_norm = resolve_provider_id(s_pid)
        s_model = s_fields["model"] or _default_model_for(s_pid_norm) or ""
        s_meta = settings.LLM_PROVIDERS_CATALOG.get(s_pid_norm) or {}
        s_protocol = s_meta.get("protocol", "anthropic") if s_pid_norm != "ollama" else "ollama"
        # 检查该阶段是否真实设置了 api_key (stage override 或全局 env 兜底)
        stage_ov = _STAGE_OVERRIDES.get(stage) or {}
        stage_api_key_set = bool(stage_ov.get("api_key")) or bool(settings.EXTERNAL_LLM_API_KEY)
        stage_status[stage] = {
            "provider": s_pid_norm,
            "model": s_model,
            "override_active": bool(_STAGE_OVERRIDES.get(stage)),
            "protocol": s_protocol,
            "multimodal": bool(s_meta.get("multimodal", False)),
            "active_client": "ollama" if s_pid_norm == "ollama" else "external",
            "api_key_set": stage_api_key_set if s_pid_norm != "ollama" else False,
        }

    return {
        "provider": pid,
        "provider_label": (settings.LLM_PROVIDERS_CATALOG.get(pid) or {}).get("label", pid),
        "external_base_url": effective_base_url if pid != "ollama" else "",
        "external_model": effective_model,
        "external_api_key_set": bool(effective_api_key),
        "override_active": ov.get("provider") is not None,
        "ollama_model": effective_model if pid == "ollama" else "",
        "ollama_base_url": effective_base_url if pid == "ollama" else "",
        "stages": stage_status,
    }


# ── 持久化 ────────────────────────────────────────────────────────────────────

def _persist() -> None:
    """把当前覆盖 (全局 + stage) 写入 JSON 文件."""
    try:
        _DATA_DIR.mkdir(parents=True, exist_ok=True)
        payload = {
            "provider_override": {k: v for k, v in _provider_override.items() if v is not None},
            "stage_overrides": {
                stage: {k: v for k, v in (ov or {}).items() if v is not None}
                for stage, ov in _STAGE_OVERRIDES.items()
            },
        }
        _SETTINGS_FILE.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except OSError as exc:
        logger.warning("写入 LLM 持久化失败 (%s): %s", _SETTINGS_FILE, exc)


def _load_persisted() -> None:
    """模块导入时读取 JSON 覆盖, 静默失败."""
    if not _SETTINGS_FILE.exists():
        return
    try:
        raw = json.loads(_SETTINGS_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("读取 LLM 持久化失败 (%s): %s", _SETTINGS_FILE, exc)
        return

    ov = raw.get("provider_override") or {}
    if isinstance(ov, dict):
        for key in ("provider", "base_url", "api_key", "model"):
            if key in ov and ov[key] is not None:
                _provider_override[key] = ov[key]

    stages = raw.get("stage_overrides") or {}
    if isinstance(stages, dict):
        for stage in ("vision", "decision"):
            stage_ov = stages.get(stage) or {}
            if isinstance(stage_ov, dict) and stage_ov:
                _STAGE_OVERRIDES[stage] = {
                    k: v for k, v in stage_ov.items() if v is not None
                }


# 启动时加载一次
_load_persisted()

# 启动时输出当前生效的 provider 状态 (让路由切换在日志里可见)
try:
    _startup_status = get_provider_status()
    _resolved_base_url = (
        _startup_status["external_base_url"]
        if _startup_status["provider"] != "ollama"
        else _startup_status["ollama_base_url"]
    )
    _resolved_model = (
        _startup_status["external_model"]
        if _startup_status["provider"] != "ollama"
        else _startup_status["ollama_model"]
    )
    logger.info(
        "[llm-startup] active=%s label=%s base_url=%s model=%s override_active=%s api_key_set=%s",
        _startup_status["provider"],
        _startup_status.get("provider_label", ""),
        _resolved_base_url,
        _resolved_model,
        _startup_status["override_active"],
        _startup_status["external_api_key_set"],
    )
except Exception as _exc:  # noqa: BLE001
    logger.warning("[llm-startup] log 失败: %s", _exc)