# Skill: 重构感知中心 + 飞控平台

## 目标
1. 重构感知中心 (`/monitor`) - 移除帧差法，迁移到 YOLO+SAM pipeline
2. 增强飞控平台 (`/flight`) - 集成 Leaflet 地图显示飞行轨迹（样例数据 + 后端预留）

---

## 任务 1: 感知中心重构

### 1.1 移除内容
- 删除 `MotionParamsPanel` 组件（帧差法参数面板）
- 删除 `MotionParams` 接口和相关状态
- 删除与 `motion-params` API 的交互
- 移除统计行中的 "阈值" 和 "最小面积" 字段

### 1.2 新增组件: YOLOParamsPanel

```typescript
interface YOLOParams {
  confidence_threshold: number  // 0.35 (slider 10-100)
  sam_enabled: boolean          // true
  model_name: string            // "yolov8n.pt"
}
```

**面板布局**:
```
┌─────────────────────────────────┐
│ ◉ YOLO+SAM 感知参数              │
├─────────────────────────────────┤
│ 置信度阈值    [======○===] 35% │
│ SAM 分割      [启用 ●] [禁用 ○] │
│ 模型选择      [yolov8n ▾]       │
├─────────────────────────────────┤
│ 活跃通道: 4     ROI总数: 12     │
│ FPS: 30        预警数: 2        │
└─────────────────────────────────┘
```

### 1.3 修改 VideoCard
- 保留 ROI 画布功能，但标注内容从"运动检测"改为"YOLO检测"
- 显示检测到的目标类别（车辆/行人）

### 1.4 修改 StatsRow
**新的统计项**:
| 显示 | 数据来源 |
|------|----------|
| 总预警 | `/api/v1/admin/stats` |
| 严重/高危/中等/低危 | `/api/v1/admin/stats` |
| 感知中 | 活跃视频通道数 |
| 模型 | 当前选择的模型 |
| FPS | 每秒处理帧数 |

**移除**: 阈值、最小面积

### 1.5 添加 API 端点
在 `routes_analyze.py` 添加:

```python
@router.get("/yolo-params")
def get_yolo_params():
    return {
        "confidence_threshold": 0.35,
        "sam_enabled": True,
        "model_name": "yolov8n.pt",
    }

@router.patch("/yolo-params")
def update_yolo_params(params: dict):
    # 更新全局 YOLO 配置
    return {"status": "ok"}
```

### 1.6 修改的文件
- `frontend/apps/dashboard/app/monitor/page.tsx`
  - 移除 MotionParams 相关代码
  - 导入并使用 YOLOParamsPanel
  - 更新 StatsRow 字段
  - 更新 VideoCard 显示

---

## 任务 2: 飞控平台地图增强

### 2.1 当前状态说明
由于无人机运行管理模块尚未接入真实设备和数据，**前端使用样例数据**，但**后端接口需预留扩展**，确保后期可平滑接入真实数据源。

### 2.2 安装依赖
```bash
cd /Users/jasonlee/UAV_PRO/website/frontend
npm install leaflet react-leaflet @types/leaflet
```

### 2.3 后端接口设计（预留扩展）

```python
# backend/app/api/routes_uav.py

from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class TrackPoint(BaseModel):
    """轨迹点 - 后期可扩展字段"""
    lat: float
    lng: float
    altitude: Optional[float] = None
    speed: Optional[float] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    # 预留扩展: signal, battery, heading, etc.

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
    last_seen: datetime
    # 预留扩展: manufacturer, serial_no, firmware_version, etc.
    
class UAVWithTrack(BaseModel):
    """带轨迹的无人机 - 用于地图显示"""
    device: UAVDevice
    track: list[TrackPoint]  # 最近 N 个轨迹点
    
class FlightStats(BaseModel):
    """飞行统计 - 预留扩展"""
    flying_count: int
    hovering_count: int
    offline_count: int
    avg_battery: float
    total_flight_time: float  # 预留: 总飞行时长(小时)
    total_distance: float     # 预留: 总飞行里程(公里)

@router.get("/uavs")
def list_uavs() -> list[UAVWithTrack]:
    """获取所有无人机状态和轨迹（当前返回样例数据）"""
    # 后期可扩展为: 
    # 1. 从 DJI SDK 获取真实设备数据
    # 2. 从 MQTT 消息队列订阅实时位置
    # 3. 从数据库查询历史轨迹
    return SAMPLE_UAVS  # 样例数据

@router.get("/uavs/{uav_id}")
def get_uav(uav_id: str) -> UAVWithTrack:
    """获取单架无人机详情"""
    return ...

@router.get("/uavs/{uav_id}/track")
def get_uav_track(uav_id: str, minutes: int = 5) -> list[TrackPoint]:
    """获取无人机历史轨迹（默认最近5分钟）"""
    # 后期可扩展为查询数据库或时间序列存储
    return ...
```

### 2.4 样例数据（前端）

```typescript
// frontend/apps/dashboard/app/flight/page.tsx

interface UAVDevice {
  id: string
  name: string
  model: string
  status: "flying" | "hovering" | "landing" | "offline"
  battery: number
  altitude: number
  speed: number
  lat: number
  lng: number
  signal: number
  lastSeen: string
  // 预留扩展字段（前端暂时不用）
  manufacturer?: string
  serialNo?: string
  firmwareVersion?: string
  heading?: number  // 朝向角度
  flightTime?: number  // 累计飞行时长
  totalDistance?: number  // 累计飞行里程
}

const SAMPLE_UAVS: UAVDevice[] = [
  { 
    id: "UAV-001", name: "巡检机 A", model: "DJI M350 RTK", 
    status: "flying", battery: 87, altitude: 120, speed: 45, 
    lat: 23.1291, lng: 113.2644, signal: 92, 
    lastSeen: new Date().toISOString(),
    manufacturer: "DJI", serialNo: "SN-2024-001", heading: 45
  },
  { 
    id: "UAV-002", name: "巡检机 B", model: "DJI Mavic 3T", 
    status: "hovering", battery: 62, altitude: 80, speed: 0, 
    lat: 23.1301, lng: 113.2654, signal: 78, 
    lastSeen: new Date().toISOString(),
    manufacturer: "DJI", serialNo: "SN-2024-002", heading: 180
  },
  { 
    id: "UAV-003", name: "巡检机 C", model: "DJI M350 RTK", 
    status: "offline", battery: 0, altitude: 0, speed: 0, 
    lat: 23.1281, lng: 113.2634, signal: 0, 
    lastSeen: new Date(Date.now() - 3600000).toISOString(),
    manufacturer: "DJI", serialNo: "SN-2024-003"
  },
]

// 轨迹数据结构（预留扩展）
interface TrackPoint {
  lat: number
  lng: number
  timestamp: number
  altitude?: number
  speed?: number
  // 预留扩展: heading, signal, battery
}
```

### 2.5 创建 FlightMap 组件

```typescript
// frontend/apps/dashboard/components/FlightMap.tsx
"use client"
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { UAVDevice, TrackPoint } from "../types"

// 状态颜色映射
const STATUS_COLORS = {
  flying: "#00E596",    // 绿色
  hovering: "#4A9EFF",  // 蓝色
  landing: "#FFB800",   // 琥珀色
  offline: "#6B7280",   // 灰色
}

// 创建 UAV 图标
function createUAVIcon(status: string): L.DivIcon {
  const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || "#6B7280"
  return L.divIcon({
    className: "uav-marker",
    html: `<div style="
      width: 24px; height: 24px;
      background: ${color};
      border-radius: 50%;
      border: 2px solid #000;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 8px ${color};
    "><span style="font-size: 12px; color: #000;">▲</span></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

// 绘制轨迹线
function drawTrack(track: TrackPoint[], color: string): L.PolylineOptions {
  const positions = track.map(p => [p.lat, p.lng] as [number, number])
  return {
    positions,
    color,
    weight: 3,
    opacity: 0.7,
    dashArray: "5, 10",  // 虚线表示历史轨迹
  }
}

interface FlightMapProps {
  uavs: UAVDevice[]
  tracks: Record<string, TrackPoint[]>  // uav_id -> track points
}

export default function FlightMap({ uavs, tracks }: FlightMapProps) {
  const defaultCenter: [number, number] = [23.1291, 113.2644]
  const defaultZoom = 14
  
  return (
    <MapContainer center={defaultCenter} zoom={defaultZoom} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {uavs.map(uav => {
        const track = tracks[uav.id] || []
        const color = STATUS_COLORS[uav.status as keyof typeof STATUS_COLORS]
        
        return (
          <div key={uav.id}>
            {/* 轨迹线 */}
            {track.length > 1 && (
              <Polyline {...drawTrack(track, color)} />
            )}
            
            {/* UAV 图标 */}
            <Marker 
              position={[uav.lat, uav.lng]}
              icon={createUAVIcon(uav.status)}
            >
              <Popup>
                <div style={{ fontFamily: "monospace", minWidth: 180 }}>
                  <h3 style={{ margin: "0 0 8px", color: "#FFB800" }}>{uav.name}</h3>
                  <p style={{ margin: "2px 0", fontSize: 12 }}>型号: {uav.model}</p>
                  <p style={{ margin: "2px 0", fontSize: 12 }}>电池: {uav.battery}%</p>
                  <p style={{ margin: "2px 0", fontSize: 12 }}>高度: {uav.altitude}m</p>
                  <p style={{ margin: "2px 0", fontSize: 12 }}>速度: {uav.speed} km/h</p>
                  <p style={{ margin: "2px 0", fontSize: 12 }}>位置: {uav.lat.toFixed(4)}, {uav.lng.toFixed(4)}</p>
                  {uav.serialNo && (
                    <p style={{ margin: "2px 0", fontSize: 11, color: "#666" }}>序列号: {uav.serialNo}</p>
                  )}
                  {uav.heading !== undefined && (
                    <p style={{ margin: "2px 0", fontSize: 11, color: "#666" }}>朝向: {uav.heading}°</p>
                  )}
                  <p style={{ margin: "8px 0 0", fontSize: 10, color: "#999" }}>
                    最后更新: {new Date(uav.lastSeen).toLocaleTimeString()}
                  </p>
                </div>
              </Popup>
            </Marker>
          </div>
        )
      })}
    </MapContainer>
  )
}
```

### 2.6 修改 flight/page.tsx

```typescript
export default function FlightPage() {
  // 样例数据（后期替换为 API 调用）
  const [uavs, setUavs] = useState<UAVDevice[]>(SAMPLE_UAVS)
  
  // 轨迹记录（每架 UAV 最近 5 分钟）
  const [tracks, setTracks] = useState<Record<string, TrackPoint[]>>({})
  
  // 模拟实时更新（样例数据）
  useEffect(() => {
    const id = setInterval(() => {
      setUavs(prev => prev.map(uav => {
        if (uav.status === "offline") return uav
        
        const jitter = () => (Math.random() - 0.5) * 0.0002
        
        // 更新位置
        const newLat = uav.lat + jitter()
        const newLng = uav.lng + jitter()
        
        // 添加轨迹点
        setTracks(prev => {
          const existing = prev[uav.id] || []
          const newPoint: TrackPoint = {
            lat: newLat,
            lng: newLng,
            timestamp: Date.now(),
            altitude: uav.altitude,
            speed: uav.speed,
          }
          // 保留最近 5 分钟（300 个点 @2s）
          const updated = [...existing, newPoint].slice(-300)
          return { ...prev, [uav.id]: updated }
        })
        
        return {
          ...uav,
          lat: newLat,
          lng: newLng,
          altitude: Math.max(0, uav.altitude + (Math.random() - 0.5) * 2),
          battery: Math.max(0, uav.battery - 0.02),
          lastSeen: new Date().toISOString(),
        }
      }))
    }, 2000)
    
    return () => clearInterval(id)
  }, [])
  
  // 后期替换为真实 API:
  // useEffect(() => {
  //   fetch("/api/v1/uav/uavs")
  //     .then(r => r.json())
  //     .then(data => setUavs(data))
  // }, [])
  
  return (
    <>
      <Sidebar />
      <FlightMap uavs={uavs} tracks={tracks} />
    </>
  )
}
```

### 2.7 后端预留的文件结构

```
backend/app/
├── api/
│   ├── routes_uav.py      # 无人机管理接口（当前返回样例数据）
│   └── routes_analyze.py  # YOLO 参数接口
├── models/
│   ├── uav.py             # 无人机数据模型（预留扩展）
│   └── track.py           # 轨迹数据模型（预留扩展）
└── services/
    ├── uav_service.py     # 无人机服务层（预留）
    └── dji_sdk.py         # DJI SDK 集成（预留）
```

---

## 实现顺序

1. **感知中心** - 先完成
   - [ ] 创建 YOLOParamsPanel
   - [ ] 修改 monitor/page.tsx
   - [ ] 添加后端 yolo-params API

2. **飞控平台** - 后完成
   - [ ] 安装 leaflet 依赖
   - [ ] 创建 FlightMap 组件
   - [ ] 修改 flight/page.tsx
   - [ ] 创建后端 uav 路由（样例数据 + 预留结构）

---

## 验收标准

### 感知中心
- [ ] MotionParamsPanel 已删除
- [ ] YOLOParamsPanel 正常显示
- [ ] 参数修改可同步到后端
- [ ] 视频卡片显示检测标注
- [ ] StatsRow 显示正确字段

### 飞控平台
- [ ] 地图正确加载 OSM 图层
- [ ] UAV 图标显示在正确位置
- [ ] 点击图标显示详情弹窗（含预留字段）
- [ ] 历史轨迹线条正确渲染
- [ ] 样例数据实时更新
- [ ] 后端预留 API 结构（可扩展）

---

## 后端扩展预留清单

| 字段/接口 | 说明 | 后期接入方式 |
|----------|------|-------------|
| `heading` | 朝向角度 | DJI SDK |
| `serialNo` | 设备序列号 | DJI SDK |
| `firmwareVersion` | 固件版本 | DJI SDK |
| `flightTime` | 累计飞行时长 | 数据库 |
| `totalDistance` | 累计飞行里程 | 数据库 |
| `/api/v1/uav/uavs` | 实时设备列表 | MQTT/WebSocket |
| `/api/v1/uav/{id}/track` | 历史轨迹 | 时序数据库 |

---

*Created: 2026-04-24*
*Updated: 2026-04-24 (增加后端预留 + UAV详情弹窗)*
