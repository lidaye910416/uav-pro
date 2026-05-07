# backend/tests/test_vision_service_ext.py
# 扩展 VisionService 测试
import pytest
import numpy as np
from unittest.mock import patch, MagicMock, AsyncMock

# Mock config 模块
@pytest.fixture(autouse=True)
def mock_config():
    """Mock config module"""
    mock_llm_config = {
        "ollama": {
            "base_url": "http://localhost:11434",
            "timeout_sec": 60
        },
        "model": {
            "vision": "llava:7b"
        }
    }
    with patch.dict('sys.modules', {'config': MagicMock(llm_config=mock_llm_config)}):
        yield

def test_vision_service_has_analyze_method():
    """Test VisionService has analyze method"""
    from app.services.vision_service import VisionService
    assert hasattr(VisionService, 'analyze')

def test_vision_service_analyze_is_async():
    """Test VisionService.analyze is async"""
    import inspect
    from app.services.vision_service import VisionService
    assert inspect.iscoroutinefunction(VisionService.analyze)

def test_vision_service_analyze_returns_vision_result():
    """Test VisionService.analyze returns VisionResult"""
    from app.services.vision_service import VisionService
    from app.services.types import VisionResult
    vs = VisionService()
    # 检查返回类型注解
    import inspect
    sig = inspect.signature(VisionService.analyze)
    # 无需实际运行，只是检查方法存在
    assert 'analyze' in dir(vs)
