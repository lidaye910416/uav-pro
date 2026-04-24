from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.alert import RiskLevel, AlertStatus


class AlertBase(BaseModel):
    title: str
    description: Optional[str] = None
    risk_level: RiskLevel = RiskLevel.LOW
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None


class AlertCreate(AlertBase):
    scene_description: Optional[str] = None
    recommendation: Optional[str] = None
    confidence: Optional[float] = None
    source_type: Optional[str] = None
    source_path: Optional[str] = None


class AlertUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    risk_level: Optional[RiskLevel] = None
    status: Optional[AlertStatus] = None


class AlertInDB(AlertBase):
    id: int
    status: AlertStatus
    created_by: Optional[int] = None
    confirmed_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AlertListResponse(BaseModel):
    total: int
    items: list[AlertInDB]
