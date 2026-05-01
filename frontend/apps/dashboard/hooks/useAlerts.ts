"use client"

import { useState, useEffect, useCallback } from "react"

// 从环境变量读取 API 地址
import { API } from "@frontend/config"
const getApiBase = () => API.BASE

export interface Alert {
  id: number
  title: string
  description: string
  risk_level: "low" | "medium" | "high" | "critical"
  status: "pending" | "confirmed" | "resolved" | "dismissed"
  scene_description?: string | null
  recommendation?: string | null
  confidence?: number | null
  source_type?: string | null
  source_path?: string | null
  pipeline_mode?: string | null
  created_at: string
  updated_at?: string | null
}

interface UseAlertsOptions {
  limit?: number
  autoRefresh?: boolean
  refreshInterval?: number
}

export function useAlerts(options: UseAlertsOptions = {}) {
  const { limit = 50, autoRefresh = true, refreshInterval = 10000 } = options
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAlerts = useCallback(async () => {
    try {
      const API_BASE = getApiBase()
      const res = await fetch(`${API_BASE}/api/v1/alerts?limit=${limit}`)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      setAlerts(data.alerts || [])
      setError(null)
    } catch (e) {
      console.error("[useAlerts] Fetch error:", e)
      setError("获取预警列表失败")
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    fetchAlerts()
    
    if (autoRefresh) {
      const interval = setInterval(fetchAlerts, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [fetchAlerts, autoRefresh, refreshInterval])

  const refetch = useCallback(() => {
    setLoading(true)
    fetchAlerts()
  }, [fetchAlerts])

  return { alerts, loading, error, refetch }
}
