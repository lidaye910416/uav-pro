// UAV 设备类型（预留扩展字段用于后期接入真实数据）
export interface UAVDevice {
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
  // 预留扩展字段（前端暂时不用，后期可接入真实数据）
  manufacturer?: string   // 制造商: DJI
  serialNo?: string       // 序列号
  firmwareVersion?: string // 固件版本
  heading?: number        // 朝向角度
  flightTime?: number     // 累计飞行时长(小时)
  totalDistance?: number  // 累计飞行里程(公里)
}

// 轨迹点类型（预留扩展）
export interface TrackPoint {
  lat: number
  lng: number
  timestamp: number
  altitude?: number
  speed?: number
  // 预留扩展: heading, signal, battery
}
