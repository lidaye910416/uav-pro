# backend/app/services/__init__.py
"""服务模块 - 业务服务层.

主流程服务:
- ChromaService: RAG 向量库
"""
from app.services.alert_service import (
    create_alert, delete_alert, get_alert_by_id, get_alert_stats, get_alerts, update_alert,
)
from app.services.auth_service import (
    authenticate_user, create_user, create_user_token, get_user_by_email, get_user_by_username,
)
from app.services.chroma_service import (
    ChromaService, get_chroma_service, get_rag_context, search_sops,
)
from app.services.types import (
    AnnotatedImage, Detection, DetectionResult, FrameData, MaskDetail,
    SSEEvent, VideoInfo, VisionResult,
)

__all__ = [
    # Types
    "FrameData", "VideoInfo", "Detection", "MaskDetail",
    "DetectionResult", "AnnotatedImage", "VisionResult", "SSEEvent",
    # Services
    "ChromaService",
    "get_chroma_service",
    "get_rag_context",
    "search_sops",
    # Auth / Alerts
    "authenticate_user", "create_user", "create_user_token",
    "get_user_by_username", "get_user_by_email",
    "create_alert", "get_alerts", "get_alert_by_id",
    "update_alert", "delete_alert", "get_alert_stats",
]
