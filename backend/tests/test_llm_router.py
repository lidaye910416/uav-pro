"""Tests for app.llm.llm_router provider override + per-stage resolution + persistence.

Force-test isolation: never write to real backend/data/llm_provider.json.
The conftest-ish monkeypatch below redirects _SETTINGS_FILE to a tmp path.
"""
from __future__ import annotations

import json
import os

# 引入模块前锁定关键 env, 避免污染用户机器的真实配置
os.environ.setdefault("LLM_PROVIDER", "ollama")
os.environ.setdefault("EXTERNAL_LLM_API_KEY", "")


def _reload_router():
    """Re-import llm_router to pick up monkeypatched _SETTINGS_FILE."""
    import importlib

    from app.llm import llm_router

    importlib.reload(llm_router)
    return llm_router


def test_default_provider_is_ollama(tmp_path, monkeypatch):
    from app.llm import llm_router

    # 重定向持久化路径 + 清空运行时覆盖
    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(llm_router, "_provider_override", {"provider": None, "base_url": None, "api_key": None, "model": None})
    monkeypatch.setattr(llm_router, "_STAGE_OVERRIDES", {"vision": {}, "decision": {}})

    client = llm_router.get_llm_client()
    assert client.__class__.__name__ == "_OllamaClient"


def test_provider_override_switches_to_external(tmp_path, monkeypatch):
    from app.llm import llm_router
    from app.llm.external_client import ExternalLLMClient

    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(llm_router, "_STAGE_OVERRIDES", {"vision": {}, "decision": {}})
    monkeypatch.setattr(llm_router, "_provider_override", {
        "provider": "anthropic",
        "api_key": "sk-test",
        "base_url": "https://api.anthropic.com",
        "model": "claude-sonnet-4-5",
    })

    client = llm_router.get_llm_client()
    assert isinstance(client, ExternalLLMClient)
    assert client.model == "claude-sonnet-4-5"


def test_stage_clients_fallback_to_default_when_override_empty(tmp_path, monkeypatch):
    from app.llm import llm_router

    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(llm_router, "_STAGE_OVERRIDES", {"vision": {}, "decision": {}})
    monkeypatch.setattr(llm_router, "_provider_override", {
        "provider": "anthropic",
        "api_key": "sk-test",
        "base_url": "https://api.anthropic.com",
        "model": "claude-sonnet-4-5",
    })

    v = llm_router.get_vision_client()
    d = llm_router.get_decision_client()
    # 只要两个客户端都能拿到, 验证不抛异常; stage 覆盖为空时回退到 _resolve_provider
    assert v is not None and d is not None


def test_persistence_writes_to_tmp_path(tmp_path, monkeypatch):
    from app.llm import llm_router

    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(llm_router, "_provider_override", {"provider": None, "base_url": None, "api_key": None, "model": None})
    monkeypatch.setattr(llm_router, "_STAGE_OVERRIDES", {"vision": {}, "decision": {}})

    # Apply provider override
    llm_router.set_provider_override({
        "provider": "minimax",
        "api_key": "sk-x",
        "base_url": "https://api.minimaxi.com/anthropic",
        "model": "MiniMax-M3",
    })

    assert fake.exists()
    data = json.loads(fake.read_text())
    po = data.get("provider_override") or {}
    assert po.get("provider") == "minimax"
    assert po.get("model") == "MiniMax-M3"

    # Apply stage override
    llm_router.set_stage_override("vision", provider="ollama")
    data = json.loads(fake.read_text())
    so = (data.get("stage_overrides") or {}).get("vision") or {}
    assert so.get("provider") == "ollama"


def test_clear_stage_override(tmp_path, monkeypatch):
    from app.llm import llm_router

    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(llm_router, "_STAGE_OVERRIDES", {"vision": {"provider": "ollama"}, "decision": {}})

    llm_router.clear_stage_override("vision")
    data = json.loads(fake.read_text())
    so = (data.get("stage_overrides") or {})
    assert so.get("vision") in ({}, None)


def test_get_provider_status_contains_both_stages(tmp_path, monkeypatch):
    from app.llm import llm_router

    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(llm_router, "_provider_override", {"provider": None, "base_url": None, "api_key": None, "model": None})
    monkeypatch.setattr(llm_router, "_STAGE_OVERRIDES", {"vision": {}, "decision": {}})

    status = llm_router.get_provider_status()
    assert "provider" in status
    assert "stages" in status
    assert "vision" in status["stages"]
    assert "decision" in status["stages"]


def test_get_provider_status_prefers_override(tmp_path, monkeypatch):
    """Override should win over settings.* in get_provider_status()."""
    from app.llm import llm_router

    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(
        llm_router,
        "_provider_override",
        {
            "provider": "minimax",
            "api_key": "sk-fake-0003",
            "base_url": "https://api.minimaxi.com/anthropic",
            "model": "MiniMax-M3",
        },
    )
    monkeypatch.setattr(llm_router, "_STAGE_OVERRIDES", {"vision": {}, "decision": {}})

    s = llm_router.get_provider_status()
    assert s["provider"] == "minimax", s
    assert s["external_model"] == "MiniMax-M3", s
    assert s["external_base_url"] == "https://api.minimaxi.com/anthropic", s
    assert s["external_api_key_set"] is True, s
    assert s["override_active"] is True, s


def test_get_provider_status_falls_back_to_settings_when_no_override(tmp_path, monkeypatch):
    from app.llm import llm_router

    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(
        llm_router,
        "_provider_override",
        {"provider": None, "base_url": None, "api_key": None, "model": None},
    )
    monkeypatch.setattr(llm_router, "_STAGE_OVERRIDES", {"vision": {}, "decision": {}})

    s = llm_router.get_provider_status()
    assert s["provider"] == "ollama", s
    # Should NOT show override_active when nothing is set
    assert s["override_active"] is False or s["override_active"] is None, s
