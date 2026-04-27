"use client"
import useSWR from "swr"

// 从环境变量读取 API 地址
const getApiBase = () => process.env.NEXT_PUBLIC_API_BASE || "http://localhost:9000"

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

export function useOllamaModels() {
  const API_BASE = getApiBase()
  const { data, error, isLoading } = useSWR<ModelsData>(
    `${API_BASE}/api/v1/ollama/models`,
    fetcher,
    { refreshInterval: 30000 }
  )
  return { models: data?.models ?? [], isLoading, error: !!error }
}
