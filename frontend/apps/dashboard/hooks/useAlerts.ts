"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchAlerts, fetchAlertStats } from "../api/alerts"
import type { AlertStats } from "../api/alerts"

export function useAlerts(params?: {
  skip?: number
  limit?: number
  risk_level?: string
  status?: string
}) {
  return useQuery({
    queryKey: ["alerts", params],
    queryFn: () => fetchAlerts(params),
    refetchInterval: 30000, // Refresh every 30 seconds
  })
}

export function useAlertStats() {
  return useQuery<AlertStats>({
    queryKey: ["alert-stats"],
    queryFn: fetchAlertStats,
    refetchInterval: 60000, // Refresh every minute
  })
}
