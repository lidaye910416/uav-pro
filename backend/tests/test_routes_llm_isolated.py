"""Standalone smoke test for routes_llm — runs without full app imports.

Tests the new per-stage endpoints by mounting only the llm_router on a
minimal FastAPI app. Skips tests if dependencies are missing.
"""
from __future__ import annotations


def _try_import_app():
    try:
        from fastapi import FastAPI
        from app.api.routes_llm import public_router, router as admin_router
        from app.core.config import settings
        from app.llm import llm_router
    except ImportError as e:
        return None, None, None, None, e
    return public_router, admin_router, settings, llm_router, None


def _build_client():
    public_router, admin_router, settings, llm_router, err = _try_import_app()
    if err is not None:
        import pytest
        pytest.skip(f"deps missing: {err}")

    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.routes_auth import get_current_user

    def _fake_user():
        return {"username": "admin", "is_admin": True}

    app = FastAPI()
    app.include_router(public_router)
    app.include_router(admin_router)
    app.dependency_overrides[get_current_user] = _fake_user
    return TestClient(app), llm_router, settings


def test_public_stages_no_auth_required(tmp_path, monkeypatch):
    client, llm_router, _ = _build_client()
    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(llm_router, "_STAGE_OVERRIDES", {"vision": {}, "decision": {}})

    r = client.get("/llm/stages")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "vision" in body and "decision" in body
    assert "scope" in body
    for stage in ("vision", "decision"):
        s = body[stage]
        assert "api_key" not in s
        assert "base_url" not in s
        for k in ("provider", "model", "protocol", "multimodal", "override_active", "active_client"):
            assert k in s, f"missing {k} in stage {stage}"


def test_public_stages_reflects_override(tmp_path, monkeypatch):
    client, llm_router, _ = _build_client()
    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(
        llm_router,
        "_STAGE_OVERRIDES",
        {"vision": {"provider": "minimax", "model": "MiniMax-M3"}, "decision": {}},
    )
    r = client.get("/llm/stages")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["vision"]["provider"] == "minimax"
    assert body["vision"]["model"] == "MiniMax-M3"
    assert body["vision"]["override_active"] is True


def test_public_stages_protocol_active_client(tmp_path, monkeypatch):
    client, llm_router, _ = _build_client()
    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(llm_router, "_STAGE_OVERRIDES", {"vision": {}, "decision": {}})

    r = client.get("/llm/stages")
    body = r.json()
    for stage in ("vision", "decision"):
        s = body[stage]
        assert s["protocol"] == "ollama"
        assert s["active_client"] == "ollama"
        assert s["multimodal"] is True


def test_llm_status_includes_stages_and_scope(tmp_path, monkeypatch):
    client, llm_router, _ = _build_client()
    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(llm_router, "_STAGE_OVERRIDES", {"vision": {}, "decision": {}})

    r = client.get("/llm/status")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "scope" in body
    assert "stages" in body
    assert "vision" in body["stages"]
    assert "decision" in body["stages"]
    assert body["scope"] == "unified"
    assert body["stages"]["vision"]["provider"] == "ollama"


def test_admin_per_stage_get_returns_applied(tmp_path, monkeypatch):
    client, llm_router, _ = _build_client()
    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(llm_router, "_STAGE_OVERRIDES", {"vision": {}, "decision": {}})

    r = client.get("/admin/llm/per-stage")
    assert r.status_code == 200, r.text
    body = r.json()
    for stage in ("vision", "decision"):
        s = body[stage]
        for k in ("provider", "base_url", "api_key_set", "model", "active_client"):
            assert k in s
        assert "api_key" not in s
        assert isinstance(s["api_key_set"], bool)


def test_admin_per_stage_get_matches_post(tmp_path, monkeypatch):
    client, llm_router, _ = _build_client()
    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(llm_router, "_STAGE_OVERRIDES", {"vision": {}, "decision": {}})

    payload = {
        "vision": {"provider": "minimax", "model": "MiniMax-M3"},
        "decision": {"provider": "ollama", "model": "gemma4:e2b"},
    }
    r = client.post("/admin/llm/per-stage", json=payload)
    assert r.status_code == 200, r.text

    r = client.get("/admin/llm/per-stage")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["vision"]["provider"] == "minimax"
    assert body["vision"]["model"] == "MiniMax-M3"
    assert body["decision"]["provider"] == "ollama"


def test_admin_per_stage_get_does_not_leak_key(tmp_path, monkeypatch):
    client, llm_router, settings = _build_client()
    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(
        llm_router,
        "_STAGE_OVERRIDES",
        {"vision": {"provider": "minimax", "api_key": "sk-secret-xyz", "model": "MiniMax-M3"}, "decision": {}},
    )
    monkeypatch.setattr(settings, "EXTERNAL_LLM_API_KEY", "")

    r = client.get("/admin/llm/per-stage")
    body = r.json()
    for stage in ("vision", "decision"):
        assert "api_key" not in body[stage]
    assert body["vision"]["api_key_set"] is True