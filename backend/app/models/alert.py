import enum
from sqlalchemy import Column, Integer, String, DateTime, Float, Text, Enum as SQLEnum
from sqlalchemy.sql import func
from app.core.database import Base


class RiskLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlertStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    risk_level = Column(SQLEnum(RiskLevel), default=RiskLevel.LOW)
    status = Column(SQLEnum(AlertStatus), default=AlertStatus.PENDING)
    latitude = Column(Float)
    longitude = Column(Float)
    location_name = Column(String(200))
    image_url = Column(String(500))
    video_url = Column(String(500))
    scene_description = Column(Text, nullable=True)   # LLM 视觉理解描述
    recommendation = Column(Text, nullable=True)     # AI 处置建议
    confidence = Column(Float, nullable=True)         # LLM 置信度
    source_type = Column(String(20), nullable=True)   # "image" / "video"
    source_path = Column(String(500), nullable=True)  # 原始文件路径
    pipeline_mode = Column(String(20), nullable=True)  # "single" / "dual"
    ai_model = Column(String(100), nullable=True)     # 使用的 AI 模型
    detection_details = Column(Text, nullable=True)   # YOLO 检测详情 JSON
    created_by = Column(Integer)
    confirmed_by = Column(Integer)
    resolved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
