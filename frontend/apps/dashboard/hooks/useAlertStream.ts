"use client"

import { useEffect, useRef, useState, useCallback } from "react"

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

export function useAlertStream(onAlert: (alert: StreamAlert) => void) {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close()
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"
    // 连接到 demo/stream 获取实时分析结果
    const es = new EventSource(`${API_BASE}/api/v1/demo/stream`)
    esRef.current = es

    es.addEventListener("open", () => {
      setConnected(true)
      setError(null)
      console.log("[useAlertStream] SSE connected")
    })

    es.addEventListener("alert", (event) => {
      try {
        const data = JSON.parse(event.data) as StreamAlert
        console.log("[useAlertStream] Alert received:", data.title)
        onAlert(data)
      } catch (e) {
        console.error("[useAlertStream] Failed to parse alert:", e)
      }
    })

    es.addEventListener("error", () => {
      setConnected(false)
      setError("SSE 连接断开，尝试重连…")
      es.close()
      // Reconnect after 5s
      reconnectTimerRef.current = setTimeout(() => {
        console.log("[useAlertStream] Attempting to reconnect...")
        connect()
      }, 5000)
    })

    return () => {
      es.close()
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
    }
  }, [onAlert])

  useEffect(() => {
    const cleanup = connect()
    return cleanup
  }, [connect])

  return { connected, error }
}
