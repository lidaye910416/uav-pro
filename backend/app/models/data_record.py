from sqlalchemy import Column, Integer, String, DateTime, Float, JSON, Text
from sqlalchemy.sql import func
from app.core.database import Base


class DataRecord(Base):
    __tablename__ = "data_records"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(50), index=True)
    record_type = Column(String(50))  # telemetry, image, video, sensor
    file_path = Column(String(500))
    record_metadata = Column(JSON)  # renamed: metadata is reserved by SQLAlchemy
    latitude = Column(Float)
    longitude = Column(Float)
    altitude = Column(Float)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
