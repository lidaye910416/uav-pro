import { API_BASE } from "@uav/api"
import type { Alert } from "@uav/api/alert"

export type { Alert }

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
