"""Shared pytest fixtures for backend tests.

Provides ``admin_client`` which yields a TestClient with the
``get_current_user`` dependency stubbed to always return an admin dict.
"""
from __future__ import annotations

import pytest


@pytest.fixture
def admin_client():
    """FastAPI TestClient with admin auth stubbed.

    Skips the test if app imports fail (e.g. missing optional deps).
    """
    try:
        # 注: backend/main.py 位于 backend/ 根, 不是 backend/app/main.py
        from main import app
        # 注: get_current_user 实际定义在 routes_auth, 这里必须用同一个函数对象,
        # 否则 FastAPI 的 dependency_overrides 不会命中。
        from app.api.routes_auth import get_current_user
    except ImportError as e:
        pytest.skip(f"app imports broken: {e}")

    def _fake_user():
        return {"username": "admin", "is_admin": True}

    app.dependency_overrides[get_current_user] = _fake_user
    try:
        # avoid starlette/httpx warning spam during collection
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            from fastapi.testclient import TestClient
            with TestClient(app) as client:
                yield client
    finally:
        app.dependency_overrides.clear()
