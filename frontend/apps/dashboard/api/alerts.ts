// 从环境变量读取 API 地址，或使用 services.json 中的默认配置
const getApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_BASE) {
    return process.env.NEXT_PUBLIC_API_BASE
  }
  // 从 services.json 读取默认配置
  return 'http://localhost:8000'
}

const API_BASE = `${getApiBase()}/api/v1`

export interface Alert {
  id: number
  title: string
  description: string | null
  risk_level: "low" | "medium" | "high" | "critical"
  status: "pending" | "confirmed" | "resolved" | "dismissed"
  latitude: number | null
  longitude: number | null
  location_name: string | null
  created_at: string
  updated_at: string | null
  // AI 决策新增字段
  scene_description?: string | null
  recommendation?: string | null
  confidence?: number | null
  source_type?: string | null
  source_path?: string | null
}

export interface AlertListResponse {
  total: number
  items: Alert[]
}

export async function fetchAlerts(params?: {
  skip?: number
  limit?: number
  risk_level?: string
  status?: string
}): Promise<AlertListResponse> {
  const url = new URL(`${API_BASE}/alerts`)
  if (params?.skip !== undefined) url.searchParams.set("skip", String(params.skip))
  if (params?.limit !== undefined) url.searchParams.set("limit", String(params.limit))
  if (params?.risk_level) url.searchParams.set("risk_level", params.risk_level)
  if (params?.status) url.searchParams.set("status", params.status)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Failed to fetch alerts: ${res.status}`)
  return res.json()
}

export interface AlertStats {
  total: number
  risk_critical: number
  risk_high: number
  risk_medium: number
  risk_low: number
  status_pending: number
  status_confirmed: number
  status_resolved: number
  status_dismissed: number
}

export async function fetchAlertStats(): Promise<AlertStats> {
  const res = await fetch(`${API_BASE}/alerts/stats`)
  if (!res.ok) throw new Error(`Failed to fetch stats: ${res.status}`)
  return res.json()
}
