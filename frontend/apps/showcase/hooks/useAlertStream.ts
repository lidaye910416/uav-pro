"use client"

import { useEffect, useRef, useState, useCallback } from "react"

export interface StreamAlert {
  id: number
  title: string
  risk_level: "low" | "medium" | "high" | "critical"
  description: string
  recommendation: string
  confidence: number
  created_at: string
}

export function useAlertStream(onAlert: (alert: StreamAlert) => void) {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close()
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"
    const es = new EventSource(`${API_BASE}/api/v1/demo/stream`)
    esRef.current = es

    es.addEventListener("open", () => {
      setConnected(true)
      setError(null)
    })

    es.addEventListener("alert", (event) => {
      try {
        const data = JSON.parse(event.data) as StreamAlert
        onAlert(data)
      } catch {
        // ignore malformed events
      }
    })

    es.addEventListener("error", () => {
      setConnected(false)
      setError("SSE 连接断开，尝试重连…")
      es.close()
      // Reconnect after 5s
      setTimeout(connect, 5000)
    })

    return () => {
      es.close()
    }
  }, [onAlert])

  useEffect(() => {
    const cleanup = connect()
    return cleanup
  }, [connect])

  return { connected, error }
}
