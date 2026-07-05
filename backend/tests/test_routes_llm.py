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


# ── Per-stage 公开端点 (GET /llm/stages) ────────────────────────────────────────


def test_public_stages_no_auth_required(client, tmp_path, monkeypatch):
    """GET /llm/stages 不需要鉴权, 返回 vision/decision 公开信息."""
    from app.llm import llm_router
    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(llm_router, "_STAGE_OVERRIDES", {"vision": {}, "decision": {}})

    r = client.get("/api/v1/llm/stages")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "vision" in body and "decision" in body
    assert "scope" in body
    for stage in ("vision", "decision"):
        s = body[stage]
        # 公开端点不暴露 base_url / api_key
        assert "api_key" not in s
        assert "base_url" not in s
        # 必须包含这些字段
        for k in ("provider", "model", "protocol", "multimodal", "override_active", "active_client"):
            assert k in s, f"missing {k} in stage {stage}: {s}"


def test_public_stages_reflects_override(client, tmp_path, monkeypatch):
    """vision override 后, /llm/stages 应反映新 provider."""
    from app.llm import llm_router
    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(
        llm_router,
        "_STAGE_OVERRIDES",
        {"vision": {"provider": "minimax", "model": "MiniMax-M3"}, "decision": {}},
    )

    r = client.get("/api/v1/llm/stages")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["vision"]["provider"] == "minimax"
    assert body["vision"]["model"] == "MiniMax-M3"
    assert body["vision"]["override_active"] is True
    # 未 override 的 decision 应为默认 (ollama)
    assert body["decision"]["provider"] == "ollama"


def test_public_stages_protocol_and_active_client(client, tmp_path, monkeypatch):
    """protocol / active_client 字段在公开 schema 中正确填充."""
    from app.llm import llm_router
    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(llm_router, "_STAGE_OVERRIDES", {"vision": {}, "decision": {}})

    r = client.get("/api/v1/llm/stages")
    body = r.json()
    for stage in ("vision", "decision"):
        s = body[stage]
        # 默认 ollama → protocol=ollama, active_client=ollama
        assert s["protocol"] == "ollama"
        assert s["active_client"] == "ollama"
        assert s["multimodal"] is True


def test_llm_status_includes_stages_and_scope(client, tmp_path, monkeypatch):
    """GET /llm/status 应返回结构化 stages 与 scope."""
    from app.llm import llm_router
    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(llm_router, "_STAGE_OVERRIDES", {"vision": {}, "decision": {}})
    monkeypatch.setattr(llm_router, "_provider_override", {"provider": None, "base_url": None, "api_key": None, "model": None})

    r = client.get("/api/v1/llm/status")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "scope" in body
    assert "stages" in body
    assert "vision" in body["stages"]
    assert "decision" in body["stages"]
    # 默认两阶段都是 ollama, scope 应为 unified
    assert body["scope"] == "unified"
    assert body["stages"]["vision"]["provider"] == "ollama"


# ── Admin per-stage GET (GET /admin/llm/per-stage) ─────────────────────────────


def test_admin_per_stage_get_requires_auth(client):
    """无 admin token 时, GET /admin/llm/per-stage 应返回 401/403."""
    r = client.get("/api/v1/admin/llm/per-stage")
    assert r.status_code in (401, 403), r.text


def test_admin_per_stage_get_returns_applied(admin_client, tmp_path, monkeypatch):
    """admin_client 可读取 vision/decision 完整 StageApplied (含 base_url)."""
    from app.llm import llm_router
    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(llm_router, "_STAGE_OVERRIDES", {"vision": {}, "decision": {}})

    r = admin_client.get("/api/v1/admin/llm/per-stage")
    assert r.status_code == 200, r.text
    body = r.json()
    for stage in ("vision", "decision"):
        s = body[stage]
        for k in ("provider", "base_url", "api_key_set", "model", "active_client"):
            assert k in s, f"missing {k} in stage {stage}: {s}"
        # base_url 必须存在 (admin 可看), api_key 必须不直接出现 (bool api_key_set 替代)
        assert "api_key" not in s
        assert isinstance(s["api_key_set"], bool)


def test_admin_per_stage_get_matches_post(admin_client, tmp_path, monkeypatch):
    """POST 后 GET, 应读回相同 vision/decision provider."""
    from app.llm import llm_router
    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(llm_router, "_STAGE_OVERRIDES", {"vision": {}, "decision": {}})

    payload = {
        "vision": {"provider": "minimax", "model": "MiniMax-M3"},
        "decision": {"provider": "ollama", "model": "gemma4:e2b"},
    }
    r = admin_client.post("/api/v1/admin/llm/per-stage", json=payload)
    assert r.status_code == 200, r.text

    r = admin_client.get("/api/v1/admin/llm/per-stage")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["vision"]["provider"] == "minimax"
    assert body["vision"]["model"] == "MiniMax-M3"
    assert body["decision"]["provider"] == "ollama"


def test_admin_per_stage_get_does_not_leak_key(admin_client, tmp_path, monkeypatch):
    """设置 vision override 含 api_key 后, GET 不回显 key, 仅 api_key_set bool."""
    from app.llm import llm_router
    fake = tmp_path / "llm_provider.json"
    monkeypatch.setattr(llm_router, "_SETTINGS_FILE", fake)
    monkeypatch.setattr(
        llm_router,
        "_STAGE_OVERRIDES",
        {"vision": {"provider": "minimax", "api_key": "sk-secret-xyz", "model": "MiniMax-M3"}, "decision": {}},
    )
    # Ensure settings has no key for stage fallback (override key is the source of truth).
    from app.core.config import settings
    monkeypatch.setattr(settings, "EXTERNAL_LLM_API_KEY", "")

    r = admin_client.get("/api/v1/admin/llm/per-stage")
    body = r.json()
    # 任何 stage 都不应出现 api_key 字符串字段
    for stage in ("vision", "decision"):
        assert "api_key" not in body[stage], body
    # vision 因有 override api_key, api_key_set 应为 True
    assert body["vision"]["api_key_set"] is True
