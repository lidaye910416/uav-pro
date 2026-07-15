"""Tests for admin LLM routes (routes_llm.py).

All require ``admin_client`` fixture from conftest (auth stubbed).
"""
from __future__ import annotations


def test_list_providers_admin(admin_client):
    r = admin_client.get("/api/v1/admin/llm/providers")
    assert r.status_code == 200, r.text
    body = r.json()
    ids = [p["id"] for p in body]
    assert "ollama" in ids
    assert "anthropic" in ids
    assert "minimax" in ids
    assert "deepseek" in ids
    assert "openai" in ids


def test_models_for_minimax(admin_client):
    r = admin_client.get("/api/v1/admin/llm/models", params={"provider": "minimax"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert "MiniMax-M3" in body.get("models", [])


def test_models_for_ollama_returns_list(admin_client):
    r = admin_client.get("/api/v1/admin/llm/models", params={"provider": "ollama"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert "models" in body
    assert isinstance(body["models"], list)
    # warning 字段 (成功时可为 None 或缺失)
    if "warning" in body and body["warning"]:
        # 如果 ollama 不可达, 也允许返回 catalog 默认 + warning
        assert isinstance(body["warning"], str)


def test_per_stage_setter(admin_client, tmp_path, monkeypatch):
    # redirect persistence so we don't pollute real data dir
    from app.llm import llm_router
    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(llm_router, "_STAGE_OVERRIDES", {"vision": {}, "decision": {}})

    payload = {
        "vision": {"provider": "minimax", "model": "MiniMax-M3"},
        "decision": {"provider": "ollama"},
    }
    r = admin_client.post("/api/v1/admin/llm/per-stage", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["vision"]["provider"] == "minimax"
    assert body["decision"]["provider"] == "ollama"


def test_provider_update_backward_compat_minimax(admin_client, tmp_path, monkeypatch):
    from app.llm import llm_router
    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(llm_router, "_provider_override", {"provider": None, "base_url": None, "api_key": None, "model": None})

    payload = {
        "provider": "minimax",
        "api_key": "sk-test",
        "base_url": "https://api.minimaxi.com/anthropic",
        "model": "MiniMax-M3",
    }
    r = admin_client.post("/api/v1/admin/llm/provider", json=payload)
    assert r.status_code == 200, r.text


def test_save_then_get_reflects_override(admin_client, tmp_path, monkeypatch):
    """BEFORE FIX: status reported settings defaults even after save.

    AFTER FIX: GET /admin/llm/provider returns what was just saved.
    """
    from app.llm import llm_router

    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(
        llm_router,
        "_provider_override",
        {"provider": None, "base_url": None, "api_key": None, "model": None},
    )
    monkeypatch.setattr(llm_router, "_STAGE_OVERRIDES", {"vision": {}, "decision": {}})

    r = admin_client.post(
        "/api/v1/admin/llm/provider",
        json={
            "provider": "minimax",
            "api_key": "sk-fake-test-0001",
            "base_url": "https://api.minimaxi.com/anthropic",
            "model": "MiniMax-M3",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["provider"] == "minimax", body
    assert body["external_model"] == "MiniMax-M3", body
    assert body["external_api_key_set"] is True, body
    assert body["override_active"] is True, body
    assert body.get("provider_label"), body

    r2 = admin_client.get("/api/v1/admin/llm/provider")
    assert r2.status_code == 200
    assert r2.json()["provider"] == "minimax"
    assert r2.json()["external_model"] == "MiniMax-M3"
    assert r2.json()["external_api_key_set"] is True


def test_public_status_reflects_override(admin_client, tmp_path, monkeypatch):
    """BEFORE FIX: /llm/status returned settings defaults. AFTER FIX: matches override."""
    from app.llm import llm_router

    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(
        llm_router,
        "_provider_override",
        {"provider": None, "base_url": None, "api_key": None, "model": None},
    )
    monkeypatch.setattr(llm_router, "_STAGE_OVERRIDES", {"vision": {}, "decision": {}})

    admin_client.post(
        "/api/v1/admin/llm/provider",
        json={
            "provider": "anthropic",
            "api_key": "sk-fake-anthropic-0002",
            "base_url": "https://api.anthropic.com",
            "model": "claude-sonnet-4-5",
        },
    )
    r = admin_client.get("/api/v1/llm/status")
    assert r.status_code == 200
    body = r.json()
    assert body["provider"] == "anthropic", body
    assert body["model"] == "claude-sonnet-4-5", body
    # public endpoint must NOT leak api_key
    assert "api_key" not in body
    # public endpoint MUST include override marker in display_name
    assert "已激活 override" in body.get("display_name", ""), body
