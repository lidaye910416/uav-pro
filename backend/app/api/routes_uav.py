"""UAV 管理接口 - 预留扩展结构，支持后期接入真实设备数据"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel, Field

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/uav", tags=["无人机管理"])

# ── 数据模型（预留扩展）─────────────────────────────────────────────────────

class TrackPoint(BaseModel):
    """轨迹点 - 后期可扩展字段"""
    lat: float
    lng: float
    altitude: Optional[float] = None
    speed: Optional[float] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    # 预留扩展: signal, battery, heading, etc.

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class UAVDevice(BaseModel):
    """无人机设备 - 预留扩展字段"""
    id: str
    name: str
    model: str
    status: str  # flying/hovering/landing/offline
    battery: float
    altitude: float
    speed: float
    lat: float
    lng: float
    signal: float
    last_seen: datetime = Field(default_factory=datetime.utcnow)
    # 预留扩展字段
    manufacturer: Optional[str] = None
    serial_no: Optional[str] = None
    firmware_version: Optional[str] = None
    heading: Optional[float] = None
    flight_time: Optional[float] = None  # 累计飞行时长(小时)
    total_distance: Optional[float] = None  # 累计飞行里程(公里)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class UAVWithTrack(BaseModel):
    """带轨迹的无人机 - 用于地图显示"""
    device: UAVDevice
    track: list[TrackPoint] = []  # 最近 N 个轨迹点


class FlightStats(BaseModel):
    """飞行统计 - 预留扩展"""
    flying_count: int
    hovering_count: int
    offline_count: int
    avg_battery: float
    total_flight_time: Optional[float] = None  # 预留: 总飞行时长(小时)
    total_distance: Optional[float] = None  # 预留: 总飞行里程(公里)


# ── 样例数据（后期替换为真实数据源）─────────────────────────────────────────

SAMPLE_UAVS: list[UAVWithTrack] = [
    UAVWithTrack(
        device=UAVDevice(
            id="UAV-001",
            name="巡检机 A",
            model="DJI M350 RTK",
            status="flying",
            battery=87,
            altitude=120,
            speed=45,
            lat=23.1291,
            lng=113.2644,
            signal=92,
            last_seen=datetime.utcnow(),
            manufacturer="DJI",
            serial_no="SN-2024-001",
            heading=45,
        ),
        track=[],
    ),
    UAVWithTrack(
        device=UAVDevice(
            id="UAV-002",
            name="巡检机 B",
            model="DJI Mavic 3T",
            status="hovering",
            battery=62,
            altitude=80,
            speed=0,
            lat=23.1301,
            lng=113.2654,
            signal=78,
            last_seen=datetime.utcnow(),
            manufacturer="DJI",
            serial_no="SN-2024-002",
            heading=180,
        ),
        track=[],
    ),
    UAVWithTrack(
        device=UAVDevice(
            id="UAV-003",
            name="巡检机 C",
            model="DJI M350 RTK",
            status="offline",
            battery=0,
            altitude=0,
            speed=0,
            lat=23.1281,
            lng=113.2634,
            signal=0,
            last_seen=datetime.utcnow() - timedelta(hours=1),
            manufacturer="DJI",
            serial_no="SN-2024-003",
        ),
        track=[],
    ),
]


# ── API 端点 ──────────────────────────────────────────────────────────────────

@router.get("/uavs", response_model=list[UAVWithTrack])
async def list_uavs() -> list[UAVWithTrack]:
    """获取所有无人机状态和轨迹（当前返回样例数据）
    
    后期可扩展为:
    1. 从 DJI SDK 获取真实设备数据
    2. 从 MQTT 消息队列订阅实时位置
    3. 从数据库查询历史轨迹
    """
    return SAMPLE_UAVS


@router.get("/uavs/{uav_id}", response_model=UAVWithTrack)
async def get_uav(uav_id: str) -> UAVWithTrack:
    """获取单架无人机详情"""
    for uav in SAMPLE_UAVS:
        if uav.device.id == uav_id:
            return uav
    raise HTTPException(404, detail=f"UAV {uav_id} not found")


@router.get("/uavs/{uav_id}/track", response_model=list[TrackPoint])
async def get_uav_track(uav_id: str, minutes: int = 5) -> list[TrackPoint]:
    """获取无人机历史轨迹（默认最近5分钟）
    
    后期可扩展为查询数据库或时间序列存储
    """
    for uav in SAMPLE_UAVS:
        if uav.device.id == uav_id:
            return uav.track
    raise HTTPException(404, detail=f"UAV {uav_id} not found")


@router.get("/stats", response_model=FlightStats)
async def get_flight_stats() -> FlightStats:
    """获取飞行统计信息"""
    flying = [u for u in SAMPLE_UAVS if u.device.status == "flying"]
    hovering = [u for u in SAMPLE_UAVS if u.device.status == "hovering"]
    offline = [u for u in SAMPLE_UAVS if u.device.status == "offline"]
    online = flying + hovering
    
    avg_bat = sum(u.device.battery for u in online) / max(1, len(online))
    
    return FlightStats(
        flying_count=len(flying),
        hovering_count=len(hovering),
        offline_count=len(offline),
        avg_battery=round(avg_bat, 1),
        total_flight_time=None,  # 预留: 从数据库查询
        total_distance=None,  # 预留: 从数据库查询
    )
