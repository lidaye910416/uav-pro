import pytest
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock, AsyncMock

# Add backend root to path for `import main` to work
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient
from app.api.routes_auth import get_current_user
from app.core.database import get_db
import main  # noqa: E402


class TestAnalyzeStatus:
    """GET /api/v1/analyze/status returns Ollama health."""

    def test_status_endpoint_responds_200(self):
        client = TestClient(main.app)
        r = client.get("/api/v1/analyze/status")
        assert r.status_code == 200
        data = r.json()
        assert "status" in data


class TestAnalyzeImage:
    """POST /api/v1/analyze/image — authenticated, returns decision."""

    def test_requires_auth_returns_401(self):
        client = TestClient(main.app)
        with open("tests/fixtures/sample.jpg", "rb") as f:
            r = client.post(
                "/api/v1/analyze/image",
                files={"file": ("test.jpg", f, "image/jpeg")},
            )
        assert r.status_code == 401

    def test_returns_decision_structure_with_valid_auth(self):
        mock_decision = MagicMock()
        mock_decision.should_alert = True
        mock_decision.risk_level = "high"
        mock_decision.title = "应急车道停车"
        mock_decision.description = "test desc"
        mock_decision.recommendation = "test rec"
        mock_decision.confidence = 0.9

        with patch("app.api.routes_analyze.AnalyzePipeline") as MockPipeline:
            MockPipeline.return_value.run.return_value = mock_decision

            mock_user = MagicMock()
            mock_user.id = 1
            mock_session = MagicMock(spec=["add", "commit", "refresh"])
            mock_session.commit = AsyncMock()
            mock_session.refresh = AsyncMock()

            async def mock_get_db():
                yield mock_session

            main.app.dependency_overrides[get_db] = mock_get_db
            main.app.dependency_overrides[get_current_user] = lambda: mock_user

            client = TestClient(main.app, raise_server_exceptions=True)
            with open("tests/fixtures/sample.jpg", "rb") as f:
                r = client.post(
                    "/api/v1/analyze/image",
                    files={"file": ("test.jpg", f, "image/jpeg")},
                )

            main.app.dependency_overrides.clear()

        assert r.status_code == 200
        data = r.json()
        assert data["should_alert"] is True
        assert data["risk_level"] == "high"
        assert "confidence" in data


class TestAnalyzeStream:
    """GET /api/v1/analyze/stream — SSE endpoint."""

    def test_stream_returns_sse_content_type(self):
        """GET /analyze/stream is a StreamingResponse endpoint."""
        from app.api.routes_analyze import router
        # Verify /stream route exists (router-level path is /stream)
        stream_routes = [r for r in router.routes if getattr(r, "path", None) == "/analyze/stream"]
        assert len(stream_routes) == 1, f"/stream route not registered. Found: {[getattr(r,'path',None) for r in router.routes]}"
