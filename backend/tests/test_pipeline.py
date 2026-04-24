import pytest
from unittest.mock import patch, MagicMock
from app.decision_service import AlertDecision


class TestAnalyzePipeline:
    """AnalyzePipeline wires vision → RAG → decision services together."""

    @pytest.fixture
    def mock_vision(self):
        with patch("app.analyze_pipeline.VisionService") as Mock:
            instance = Mock.return_value
            instance.describe_image.return_value = "一辆白色轿车停在应急车道，双闪开启"
            yield instance

    @pytest.fixture
    def mock_rag(self):
        with patch("app.analyze_pipeline.RAGService") as Mock:
            instance = Mock.return_value
            instance.retrieve.return_value = [
                "应急车道停车超过3分钟 → 高风险预警",
                "应急车道禁止非紧急情况停车",
            ]
            yield instance

    @pytest.fixture
    def mock_decision(self):
        with patch("app.analyze_pipeline.DecisionService") as Mock:
            instance = Mock.return_value
            instance.decide.return_value = AlertDecision(
                should_alert=True,
                risk_level="high",
                title="应急车道停车",
                description="车辆占用应急车道超过3分钟",
                recommendation="通知交警前往处理",
                confidence=0.92,
            )
            yield instance

    def test_initializes_all_services(self, mock_vision, mock_rag, mock_decision):
        from app.analyze_pipeline import AnalyzePipeline

        pipeline = AnalyzePipeline()
        assert pipeline.vision is not None
        assert pipeline.rag is not None
        assert pipeline.decision is not None

    def test_run_returns_alert_decision(self, mock_vision, mock_rag, mock_decision):
        from app.analyze_pipeline import AnalyzePipeline

        pipeline = AnalyzePipeline()
        result = pipeline.run("tests/fixtures/sample.jpg")
        assert isinstance(result, AlertDecision)
        assert result.should_alert is True
        assert result.risk_level == "high"
        assert 0.0 <= result.confidence <= 1.0

    def test_run_calls_services_in_order(self, mock_vision, mock_rag, mock_decision):
        from app.analyze_pipeline import AnalyzePipeline

        pipeline = AnalyzePipeline()
        pipeline.run("tests/fixtures/sample.jpg")

        # Vision was called first
        mock_vision.describe_image.assert_called_once_with("tests/fixtures/sample.jpg")
        # RAG was called with the vision description
        mock_rag.retrieve.assert_called_once()
        # Decision was called with (vision_desc, rag_docs)
        mock_decision.decide.assert_called_once()

    def test_analyze_frame_convenience_function(self, mock_vision, mock_rag, mock_decision):
        from app.analyze_pipeline import analyze_frame

        result = analyze_frame("tests/fixtures/sample.jpg")
        assert isinstance(result, AlertDecision)
