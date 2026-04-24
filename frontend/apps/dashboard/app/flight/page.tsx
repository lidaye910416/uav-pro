"use client"
import { useState, useEffect } from "react"
import Sidebar from "../../components/Layout/Sidebar"
import FlightMap from "../../components/FlightMap"
import { UAVDevice, TrackPoint } from "../../components/types"

type UAVStatus = "flying" | "hovering" | "landing" | "offline"

const STATUS_CONFIG: Record<UAVStatus, { label: string; color: string; dotColor: string }> = {
  flying:    { label: "飞行中",  color: "var(--accent-green)", dotColor: "var(--accent-green)" },
  hovering:  { label: "悬停中",  color: "var(--accent-blue)", dotColor: "var(--accent-blue)" },
  landing:   { label: "降落中",  color: "var(--accent-amber)", dotColor: "var(--accent-amber)" },
  offline:   { label: "离线",    color: "var(--text-muted)", dotColor: "var(--accent-red)" },
}

// 样例数据（后期可替换为真实 API 数据）
// 坐标位置: 武汉市武昌区中北路275号联投科技产业大厦
const SAMPLE_UAVS: UAVDevice[] = [
  {
    id: "UAV-001", name: "巡检机 A", model: "DJI M350 RTK",
    status: "flying", battery: 87, altitude: 120, speed: 45,
    lat: 30.5540, lng: 114.3315, signal: 92,
    lastSeen: new Date().toISOString(),
    manufacturer: "DJI", serialNo: "SN-2024-001", heading: 45
  },
  {
    id: "UAV-002", name: "巡检机 B", model: "DJI Mavic 3T",
    status: "hovering", battery: 62, altitude: 80, speed: 0,
    lat: 30.5550, lng: 114.3325, signal: 78,
    lastSeen: new Date().toISOString(),
    manufacturer: "DJI", serialNo: "SN-2024-002", heading: 180
  },
  {
    id: "UAV-003", name: "巡检机 C", model: "DJI M350 RTK",
    status: "offline", battery: 0, altitude: 0, speed: 0,
    lat: 30.5530, lng: 114.3305, signal: 0,
    lastSeen: new Date(Date.now() - 3600000).toISOString(),
    manufacturer: "DJI", serialNo: "SN-2024-003"
  },
]

function BatteryBar({ level }: { level: number }) {
  const color = level > 50 ? "var(--accent-green)" : level > 20 ? "var(--accent-amber)" : "var(--accent-red)"
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>🔋</span>
      <div className="w-16 h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${level}%`, background: color }} />
      </div>
      <span className="text-xs font-mono font-bold" style={{ color }}>{level}%</span>
    </div>
  )
}

function SignalBar({ level }: { level: number }) {
  const bars = [25, 50, 75, 100]
  return (
    <div className="flex items-end gap-0.5 h-4">
      {bars.map((threshold, i) => (
        <div
          key={i}
          className="w-1 rounded-sm transition-all"
          style={{
            height: `${(i + 1) * 25}%`,
            background: level >= threshold ? "var(--accent-green)" : "var(--border)",
          }}
        />
      ))}
    </div>
  )
}

function UAVCard({ uav }: { uav: UAVDevice }) {
  const status = STATUS_CONFIG[uav.status]
  return (
    <div
      className="rounded-2xl p-4 transition-all overflow-hidden"
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${uav.status === "offline" ? "var(--border)" : status.color}40`,
        boxShadow: uav.status !== "offline" ? `0 0 16px ${status.color}15` : "none",
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{uav.name}</div>
          <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{uav.model}</div>
        </div>
        <div className="flex items-center gap-2">
          <SignalBar level={uav.signal} />
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: status.dotColor,
                boxShadow: uav.status !== "offline" ? `0 0 6px ${status.dotColor}` : "none",
              }}
            />
            <span className="text-xs font-mono" style={{ color: status.color }}>{status.label}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center p-2 rounded-lg" style={{ background: "var(--bg-primary)" }}>
          <div className="text-sm font-bold font-mono" style={{ color: "var(--accent-amber)" }}>{Math.round(uav.altitude)}m</div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>高度</div>
        </div>
        <div className="text-center p-2 rounded-lg" style={{ background: "var(--bg-primary)" }}>
          <div className="text-sm font-bold font-mono" style={{ color: "var(--accent-blue)" }}>{Math.round(uav.speed)}km/h</div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>速度</div>
        </div>
        <div className="text-center p-2 rounded-lg" style={{ background: "var(--bg-primary)" }}>
          <div className="text-sm font-bold font-mono" style={{ color: "var(--accent-purple)" }}>{Math.round(uav.signal)}%</div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>信号</div>
        </div>
      </div>

      <BatteryBar level={Math.round(uav.battery)} />

      <div className="mt-2 text-xs font-mono truncate" style={{ color: "var(--text-muted)" }}>
        位置: {uav.lat.toFixed(4)}, {uav.lng.toFixed(4)}
      </div>

      {/* 预留扩展字段显示 */}
      {uav.serialNo && (
        <div className="mt-1 text-xs font-mono truncate" style={{ color: "var(--text-muted)" }}>
          序列号: {uav.serialNo}
        </div>
      )}
      {uav.heading !== undefined && (
        <div className="mt-1 text-xs font-mono truncate" style={{ color: "var(--text-muted)" }}>
          朝向: {uav.heading}°
        </div>
      )}
    </div>
  )
}

export default function FlightPage() {
  // 样例数据（后期替换为 API 调用: fetch("/api/v1/uav/uavs")）
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
        const newPoint: TrackPoint = {
          lat: newLat,
          lng: newLng,
          timestamp: Date.now(),
          altitude: uav.altitude,
          speed: uav.speed,
        }
        
        setTracks(prev => {
          const existing = prev[uav.id] || []
          // 保留最近 5 分钟（300 个点 @2s）
          const updated = [...existing, newPoint].slice(-300)
          return { ...prev, [uav.id]: updated }
        })
        
        return {
          ...uav,
          lat: newLat,
          lng: newLng,
          altitude: Math.max(0, uav.altitude + (Math.random() - 0.5) * 2),
          speed: uav.status === "hovering" ? 0 : Math.max(0, uav.speed + (Math.random() - 0.5) * 3),
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

  const flyingCount = uavs.filter(u => u.status === "flying" || u.status === "hovering").length

  return (
    <>
      <Sidebar />
      <div className="min-h-screen p-6 ml-60" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-widest" style={{ color: "var(--text-primary)" }}>
              飞控平台
            </h1>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              无人机实时监控 · 飞行轨迹 · 设备状态
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: "var(--accent-green)", boxShadow: "0 0 6px var(--accent-green)" }} />
              <span style={{ color: "var(--text-secondary)" }}>在线: <span style={{ color: "var(--accent-green)" }}>{flyingCount}</span> / {uavs.length}</span>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "在线飞行", value: flyingCount, color: "var(--accent-green)" },
            { label: "悬停中", value: uavs.filter(u => u.status === "hovering").length, color: "var(--accent-blue)" },
            { label: "离线设备", value: uavs.filter(u => u.status === "offline").length, color: "var(--accent-red)" },
            { label: "平均电量", value: `${Math.round(uavs.filter(u => u.status !== "offline").reduce((a, u) => a + u.battery, 0) / Math.max(1, flyingCount))}%`, color: "var(--accent-amber)" },
          ].map((item) => (
            <div key={item.label} className="p-4 rounded-xl text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Main: UAV cards + map */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: UAV list */}
          <div className="space-y-4">
            {uavs.map((uav) => (
              <UAVCard key={uav.id} uav={uav} />
            ))}
          </div>

          {/* Right: Flight Map */}
          <div className="lg:col-span-2">
            <div className="text-xs font-bold mb-3 tracking-widest" style={{ color: "var(--text-muted)" }}>实时飞行轨迹</div>
            <FlightMap uavs={uavs} tracks={tracks} />
            <div className="mt-3 p-3 rounded-xl text-xs" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <span style={{ color: "var(--accent-amber)" }}>◉</span> 数据来源: 样例数据（后期接入 DJI O3 图传链路）·{" "}
              <span style={{ color: "var(--accent-blue)" }}>▲</span> 飞行区域: 武昌区·中北路275号·联投科技大厦 ·{" "}
              <span style={{ color: "var(--accent-purple)" }}>◆</span> 点击标记查看详情
            </div>
            {/* 图例 */}
            <div className="mt-2 flex items-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full" style={{ background: "#00E596" }}></span>
                飞行中
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full" style={{ background: "#4A9EFF" }}></span>
                悬停
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full" style={{ background: "#6B7280" }}></span>
                离线
              </span>
              <span className="flex items-center gap-1">
                <span className="w-6 h-0.5" style={{ background: "#00E596", opacity: 0.5 }}></span>
                历史轨迹
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
