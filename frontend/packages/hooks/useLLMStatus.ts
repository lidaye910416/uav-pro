"use client"

import { useCallback, useEffect, useState } from "react"
import { llmStatusApi, type LLMStatus } from "@uav/api"

/**
 * Polls /llm/status every `intervalMs` (default 10s) and returns the latest
 * known LLM provider snapshot. No SWR dependency is added on purpose.
 */
export interface UseLLMStatusResult {
  status: LLMStatus | null
  error: Error | null
  refresh: () => Promise<void>
}

export function useLLMStatus(intervalMs = 10000): UseLLMStatusResult {
  const [status, setStatus] = useState<LLMStatus | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    try {
      const s = await llmStatusApi.get()
      setStatus(s)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e : new Error(String(e)))
    }
  }, [])

  useEffect(() => {
    void refresh()
    const id = setInterval(() => {
      void refresh()
    }, intervalMs)
    return () => clearInterval(id)
  }, [refresh, intervalMs])

  return { status, error, refresh }
}
