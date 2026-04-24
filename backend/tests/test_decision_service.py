import pytest
from unittest.mock import patch, MagicMock
from app.decision_service import DecisionService, AlertDecision


class TestAlertDecision:
    """AlertDecision Pydantic model validation."""

    def test_valid_decision(self):
        decision = AlertDecision(
            should_alert=True,
            risk_level="high",
            title="应急车道停车",
            description="车辆在应急车道停车超过3分钟",
            recommendation="通知交警前往处理",
            confidence=0.85,
        )
        assert decision.should_alert is True
        assert decision.risk_level == "high"
        assert 0.0 <= decision.confidence <= 1.0

    def test_confidence_out_of_range_raises(self):
        """confidence > 1.0 raises ValidationError"""
        with pytest.raises(Exception):
            AlertDecision(
                should_alert=False,
                risk_level="low",
                title="正常",
                description="desc",
                recommendation="rec",
                confidence=2.0,
            )

    def test_risk_level_choices(self):
        for level in ["low", "medium", "high", "critical"]:
            d = AlertDecision(
                should_alert=False,
                risk_level=level,
                title="t",
                description="d",
                recommendation="r",
                confidence=0.5,
            )
            assert d.risk_level == level


class TestDecisionService:
    """DecisionService.decide(): calls Ollama, returns AlertDecision."""

    def test_returns_alert_decision(self):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": '{"should_alert":true,"risk_level":"high","title":"应急车道停车","description":"车辆占用应急车道","recommendation":"通知交警","confidence":0.9}'
        }
        mock_response.raise_for_status = MagicMock()

        with patch("app.decision_service.httpx.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value.__enter__.return_value = mock_client
            mock_client.post.return_value = mock_response

            service = DecisionService()
            result = service.decide(
                scene_description="白色轿车停在应急车道",
                context_docs=["应急车道停车超过3分钟 → 高风险预警"],
            )
            assert isinstance(result, AlertDecision)
            assert result.should_alert is True
            assert result.risk_level == "high"
            assert 0.0 <= result.confidence <= 1.0

    def test_passes_context_docs_to_prompt(self):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": '{"should_alert":false,"risk_level":"low","title":"正常","description":"无异常","recommendation":"持续监控","confidence":0.95}'
        }
        mock_response.raise_for_status = MagicMock()

        with patch("app.decision_service.httpx.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value.__enter__.return_value = mock_client
            mock_client.post.return_value = mock_response

            DecisionService().decide("场景", ["文档A", "文档B"])
            payload = mock_client.post.call_args.kwargs["json"]
            assert "文档A" in payload["prompt"]
            assert "文档B" in payload["prompt"]

    def test_uses_config_model(self):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": '{"should_alert":false,"risk_level":"low","title":"t","description":"d","recommendation":"r","confidence":0.5}'
        }
        mock_response.raise_for_status = MagicMock()

        with patch("app.decision_service.httpx.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value.__enter__.return_value = mock_client
            mock_client.post.return_value = mock_response

            DecisionService().decide("场景", [])
            payload = mock_client.post.call_args.kwargs["json"]
            assert payload["model"] == "gemma4-e2b"  # from config

    def test_offline_raises_llm_error(self):
        from app.vision_service import LLMServiceUnavailableError

        with patch("app.decision_service.httpx.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value.__enter__.return_value = mock_client
            import httpx
            mock_client.post.side_effect = httpx.ConnectError("Connection refused")

            service = DecisionService()
            with pytest.raises(LLMServiceUnavailableError):
                service.decide("场景", [])
