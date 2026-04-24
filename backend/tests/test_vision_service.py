import pytest
from unittest.mock import patch, MagicMock
from app.vision_service import VisionService, LLMServiceUnavailableError


class TestLLMServiceUnavailableError:
    """LLMServiceUnavailableError is a dedicated exception for Ollama offline"""

    def test_is_exception_subclass(self):
        err = LLMServiceUnavailableError("test message")
        assert isinstance(err, Exception)
        assert "test message" in str(err)

    def test_raised_by_offline_service(self):
        service = VisionService(ollama_url="http://localhost:19999")
        with pytest.raises(LLMServiceUnavailableError):
            service.describe_image("tests/fixtures/sample.jpg")


class TestVisionServiceDescribeImage:
    """describe_image: calls Ollama with base64 image, returns text"""

    def test_returns_string_on_success(self):
        """Ollama returns a non-empty string description"""
        with patch("app.vision_service.httpx.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value.__enter__.return_value = mock_client
            mock_response = MagicMock()
            mock_response.json.return_value = {"response": "一架无人机在天空飞行"}
            mock_response.raise_for_status = MagicMock()
            mock_client.post.return_value = mock_response

            service = VisionService()
            desc = service.describe_image("tests/fixtures/sample.jpg")
            assert isinstance(desc, str)
            assert len(desc) > 0

    def test_returns_chinese_text(self):
        """描述内容为中文"""
        with patch("app.vision_service.httpx.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value.__enter__.return_value = mock_client
            mock_response = MagicMock()
            mock_response.json.return_value = {"response": "一辆红色汽车停在路边"}
            mock_response.raise_for_status = MagicMock()
            mock_client.post.return_value = mock_response

            service = VisionService()
            desc = service.describe_image("tests/fixtures/sample.jpg")
            assert any("\u4e00" <= c <= "\u9fff" for c in desc)

    def test_sends_base64_image_to_ollama(self):
        """base64-encoded image is included in the POST payload"""
        with patch("app.vision_service.httpx.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value.__enter__.return_value = mock_client
            mock_response = MagicMock()
            mock_response.json.return_value = {"response": "test"}
            mock_response.raise_for_status = MagicMock()
            mock_client.post.return_value = mock_response

            service = VisionService(model="gemma4-e2b")
            service.describe_image("tests/fixtures/sample.jpg", prompt="describe")

            call_args = mock_client.post.call_args
            payload = call_args.kwargs["json"]
            assert "images" in payload
            assert isinstance(payload["images"], list)
            assert len(payload["images"]) == 1
            # base64 strings are alphanumeric + "+/="
            assert all(c.isalnum() or c in "+/=" for c in payload["images"][0])

    def test_uses_config_model_and_url_by_default(self):
        """Without overrides, uses model/url from config"""
        with patch("app.vision_service.httpx.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value.__enter__.return_value = mock_client
            mock_response = MagicMock()
            mock_response.json.return_value = {"response": "ok"}
            mock_response.raise_for_status = MagicMock()
            mock_client.post.return_value = mock_response

            service = VisionService()
            service.describe_image("tests/fixtures/sample.jpg")
            # Uses gemma4-e2b from config
            payload = mock_client.post.call_args.kwargs["json"]
            assert payload["model"] == "gemma4-e2b"
