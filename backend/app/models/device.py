from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, Text, JSON
from sqlalchemy.sql import func
from app.core.database import Base


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    device_name = Column(String(100), nullable=False)
    device_type = Column(String(50))  # uav, camera, sensor, gateway
    device_id = Column(String(100), unique=True, index=True)
    status = Column(String(20), default="offline")  # online, offline, error
    latitude = Column(Float)
    longitude = Column(Float)
    altitude = Column(Float)
    battery_level = Column(Float)
    last_seen = Column(DateTime(timezone=True))
    device_config = Column(JSON)  # renamed: config reserved word on some DBs
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
