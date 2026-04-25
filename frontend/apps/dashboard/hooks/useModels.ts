"use client"
import useSWR from "swr"

interface OllamaModel {
  name: string
  modified_at: string
  size: number
}

interface ModelsData {
  models: OllamaModel[]
  error?: string
}

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
})

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

export function useOllamaModels() {
  const { data, error, isLoading } = useSWR<ModelsData>(
    `${API_BASE}/api/v1/ollama/models`,
    fetcher,
    { refreshInterval: 30000 }
  )
  return { models: data?.models ?? [], isLoading, error: !!error }
}
