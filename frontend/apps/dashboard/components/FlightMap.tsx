"use client"
import { UAVDevice, TrackPoint } from "./types"
import { useState, useEffect, useRef, useCallback } from "react"

// 状态颜色映射
const STATUS_COLORS: Record<string, string> = {
  flying: "#00E596",
  hovering: "#4A9EFF",
  landing: "#FFB800",
  offline: "#6B7280",
}

// 位置信息: 武汉市武昌区中北路275号联投科技产业大厦
const LOCATION_NAME = "武汉市武昌区·中北路275号·联投科技产业大厦"
const DEFAULT_CENTER: [number, number] = [30.5540, 114.3315]
const DEFAULT_ZOOM = 17

interface FlightMapProps {
  uavs: UAVDevice[]
  tracks: Record<string, TrackPoint[]>
}

// 地图控制按钮
function MapControls({ onZoomIn, onZoomOut, onFitBounds }: {
  onZoomIn: () => void
  onZoomOut: () => void
  onFitBounds: () => void
}) {
  return (
    <div className="absolute top-3 right-3 flex flex-col gap-1 z-[1000]">
      <button
        onClick={onZoomIn}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all hover:opacity-80"
        style={{ background: "rgba(0,0,0,0.7)", border: "1px solid var(--border)", color: "var(--accent-amber)" }}
        title="放大"
      >
        +
      </button>
      <button
        onClick={onZoomOut}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all hover:opacity-80"
        style={{ background: "rgba(0,0,0,0.7)", border: "1px solid var(--border)", color: "var(--accent-amber)" }}
        title="缩小"
      >
        −
      </button>
      <button
        onClick={onFitBounds}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all hover:opacity-80"
        style={{ background: "rgba(0,0,0,0.7)", border: "1px solid var(--accent-green)", color: "var(--accent-green)" }}
        title="显示全部无人机"
      >
        ⊙
      </button>
    </div>
  )
}

// 飞控地图组件
export default function FlightMap({ uavs, tracks }: FlightMapProps) {
  const mapRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 初始化 Leaflet 地图
  useEffect(() => {
    let mounted = true
    let mapInstance: any = null

    const initMap = async () => {
      try {
        // 动态导入 Leaflet
        const L = (await import("leaflet")).default || await import("leaflet")

        if (!mounted || !containerRef.current) {
          return
        }

        // 确保容器有尺寸
        const container = containerRef.current
        container.style.height = "400px"
        container.style.width = "100%"

        // 创建地图实例
        mapInstance = new L.Map(container, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          zoomControl: false,
          attributionControl: false,
        })

        // 添加卫星地图底图 (Esri World Imagery)
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
          maxZoom: 19,
          attribution: "Esri World Imagery",
        }).addTo(mapInstance)

        mapRef.current = mapInstance

        if (mounted) {
          setIsReady(true)
        }
      } catch (err) {
        console.error("地图初始化失败:", err)
        if (mounted) {
          setError(String(err))
        }
      }
    }

    // 延迟初始化，确保 DOM 完全渲染
    const timer = setTimeout(initMap, 100)

    return () => {
      mounted = false
      clearTimeout(timer)
      if (mapInstance) {
        mapInstance.remove()
        mapInstance = null
      }
    }
  }, [])

  // 地图控制函数
  const handleZoomIn = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.zoomIn()
    }
  }, [])

  const handleZoomOut = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.zoomOut()
    }
  }, [])

  const handleFitBounds = useCallback(() => {
    if (mapRef.current && uavs.length > 0) {
      const L = (window as any).L
      if (L) {
        // 计算所有无人机的边界
        const bounds = L.latLngBounds(uavs.map(uav => [uav.lat, uav.lng]))
        mapRef.current.fitBounds(bounds, { padding: [50, 50] })
      }
    }
  }, [uavs])

  // 更新地图上的标记
  useEffect(() => {
    if (!isReady || !mapRef.current) return

    const updateMarkers = async () => {
      try {
        const L = (await import("leaflet")).default || await import("leaflet")
        const map = mapRef.current

        // 清除非底图图层
        map.eachLayer((layer: any) => {
          if (!(layer instanceof L.TileLayer)) {
            map.removeLayer(layer)
          }
        })

        // 绘制 UAV 轨迹和标记
        uavs.forEach((uav) => {
          const track = tracks[uav.id] || []
          const color = STATUS_COLORS[uav.status] || STATUS_COLORS.offline
          const isActive = uav.status !== "offline"

          // 绘制轨迹线
          if (track.length >= 2) {
            const positions = track.map((p) => [p.lat, p.lng] as [number, number])
            L.polyline(positions, {
              color,
              weight: 3,
              opacity: 0.6,
              dashArray: "5,5",
            }).addTo(map)
          }

          // 绘制 UAV 标记
          L.circleMarker([uav.lat, uav.lng], {
            radius: isActive ? 8 : 5,
            color: isActive ? color : "#6B7280",
            fillColor: color,
            fillOpacity: 0.9,
            weight: 2,
          })
            .bindPopup(`<b>${uav.name}</b><br/>${uav.model}<br/>状态: ${uav.status}`)
            .addTo(map)
        })
      } catch (err) {
        console.error("更新标记失败:", err)
      }
    }

    updateMarkers()
  }, [isReady, uavs, tracks])

  // 加载状态
  if (error) {
    return (
      <div
        className="rounded-2xl overflow-hidden relative flex flex-col items-center justify-center"
        style={{ height: 400, background: "var(--bg-card)", border: "1px solid var(--border)", position: "relative" }}
      >
        <div className="text-xs mb-2 z-10" style={{ color: "var(--accent-red)" }}>地图加载失败</div>
        <div className="text-xs px-4 text-center z-10" style={{ color: "var(--text-muted)" }}>{error}</div>
      </div>
    )
  }

  if (!isReady) {
    return (
      <div
        className="rounded-2xl overflow-hidden relative flex items-center justify-center"
        style={{ height: 400, background: "var(--bg-card)", border: "1px solid var(--border)", position: "relative" }}
      >
        {/* 加载时也显示容器占位 */}
        <div ref={containerRef} style={{ height: "100%", width: "100%", position: "absolute" }} />
        <div className="text-xs z-10" style={{ color: "var(--text-muted)" }}>正在加载地图...</div>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl overflow-hidden relative"
      style={{ height: 400, background: "var(--bg-card)", border: "1px solid var(--border)", position: "relative" }}
    >
      {/* Leaflet 容器 - 必须设置 explicit 尺寸 */}
      <div
        ref={containerRef}
        style={{ height: "400px", width: "100%", position: "absolute", top: 0, left: 0 }}
      />

      {/* 地图控制按钮 */}
      <MapControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitBounds={handleFitBounds}
      />

      {/* 位置标签 */}
      <div className="absolute top-3 left-3 px-3 py-2 rounded-lg pointer-events-none" style={{ background: "rgba(0,0,0,0.7)", border: "1px solid var(--border)", zIndex: 1000 }}>
        <div className="text-xs font-mono" style={{ color: "var(--accent-amber)" }}>{LOCATION_NAME}</div>
      </div>

      {/* 图例 */}
      <div className="absolute bottom-3 right-3 px-3 py-2 rounded-lg pointer-events-none" style={{ background: "rgba(0,0,0,0.7)", border: "1px solid var(--border)", zIndex: 1000 }}>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: "#00E596" }} />
            飞行中
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: "#4A9EFF" }} />
            悬停
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: "#6B7280" }} />
            离线
          </div>
        </div>
      </div>
    </div>
  )
}
