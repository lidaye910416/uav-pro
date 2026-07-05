"use client"

import { useEffect, useRef, useState } from "react"
import { API_BASE } from "@uav/api"

export interface StreamAlert {
  id: number
  title: string
  risk_level: "low" | "medium" | "high" | "critical"
  status: "pending" | "confirmed" | "resolved" | "dismissed"
  description: string
  location_name?: string | null
  recommendation: string
  confidence: number
  created_at: string
  updated_at?: string | null
  source_path?: string
  scene_description?: string
  source_type?: string
  pipeline_mode?: string
  detection_details?: Array<{
    label: string
    color: string
    confidence: number
  }>
  ai_model?: string
}

// 导出连接管理器，用于外部控制连接
let esInstance: EventSource | null = null

export function closeAlertStream() {
  if (esInstance) {
    esInstance.close()
    esInstance = null
  }
}

export function useAlertStream(onAlert: (alert: StreamAlert) => void, enabled = false) {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onAlertRef = useRef(onAlert)
  const enabledRef = useRef(enabled)

  // 保持 onAlert 引用最新
  useEffect(() => {
    onAlertRef.current = onAlert
  }, [onAlert])

  // 保持 enabled 引用最新
  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  useEffect(() => {
    // 如果未启用，不创建任何连接
    if (!enabledRef.current) {
      setConnected(false)
      return
    }

    // 关闭已有连接
    closeAlertStream()

    const es = new EventSource(`${API_BASE}/demo/stream`)
    esInstance = es

    es.addEventListener("open", () => {
      if (enabledRef.current) {
        setConnected(true)
        setError(null)
      }
    })

    es.addEventListener("alert", (event) => {
      if (!enabledRef.current) return
      try {
        const data = JSON.parse(event.data) as StreamAlert
        onAlertRef.current(data)
      } catch (e) {
        console.error("[useAlertStream] Failed to parse alert:", e)
      }
    })

    es.addEventListener("error", () => {
      if (!enabledRef.current) return
      setConnected(false)
      es.close()
      setError("SSE 连接断开")
    })

    return () => {
      es.close()
      esInstance = null
      setConnected(false)
    }
  }, []) // 只在挂载时执行一次，enabled 通过 ref 控制

  return { connected, error }
}

