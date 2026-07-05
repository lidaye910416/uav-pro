"use client"

import { useCallback, useEffect, useState } from "react"
import { llmStagesPublicApi, type LLMPublicStages } from "@uav/api"

/**
 * Polls public /llm/stages every `intervalMs` (default 10s) and returns the
 * structured per-stage provider/model snapshot. No auth, no SWR.
 *
 * Used by badges and pipeline cards that need to render vision vs decision
 * provider separately. For unified-display pages, prefer useLLMStatus which
 * also carries description + display_name.
 */
export interface UseLLMPerStageResult {
  stages: LLMPublicStages | null
  error: Error | null
  refresh: () => Promise<void>
}

export function useLLMPerStage(intervalMs = 10000): UseLLMPerStageResult {
  const [stages, setStages] = useState<LLMPublicStages | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    try {
      const s = await llmStagesPublicApi.get()
      setStages(s)
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

  return { stages, error, refresh }
}