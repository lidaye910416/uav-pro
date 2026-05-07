# backend/tests/test_routes_demo_refactor.py
"""测试 routes_demo 重构后的接口"""
import pytest

def test_routes_demo_can_import():
    """Test routes_demo can be imported"""
    from app.api import routes_demo
    assert routes_demo is not None

def test_routes_demo_has_router():
    """Test routes_demo has router"""
    from app.api.routes_demo import router
    assert router is not None

def test_routes_demo_has_stream_endpoint():
    """Test routes_demo has stream endpoint"""
    from app.api.routes_demo import router
    # 获取所有路由（包括前缀）
    routes = []
    for r in router.routes:
        if hasattr(r, 'path'):
            # 路由已经有 prefix
            routes.append(r.path)
    # 检查 /demo/stream 或 /stream
    assert any("stream" in r.lower() for r in routes)

def test_routes_demo_has_videos_endpoint():
    """Test routes_demo has videos endpoint"""
    from app.api.routes_demo import router
    routes = []
    for r in router.routes:
        if hasattr(r, 'path'):
            routes.append(r.path)
    # 检查 /demo/videos
    assert any("videos" in r.lower() for r in routes)
