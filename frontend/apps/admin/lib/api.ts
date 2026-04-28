// 从环境变量读取 API 地址
const getApiBase = () => process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8888"
const API_BASE = `${getApiBase()}/api/v1`

export interface StreamInfo {
  id: string
  name: string
  source_type: string
  source_path: string
  auto_analyze: boolean
  interval_sec: number
  status: string
  last_frame_ts: number | null
}

export interface HealthCheck {
  service: string
  status: string
  latency_ms: number | null
  detail: string | null
}

export interface SystemStats {
  total_alerts: number
  alerts_by_risk: Record<string, number>
  alerts_by_status: Record<string, number>
  total_records: number
  registered_streams: number
}

export interface OllamaStatus {
  status: string
  models: string[]
  error: string | null
}

export interface ChromaStatus {
  status: string
  collections: string[]
  error: string | null
}

export interface Alert {
  id: number; title: string; description: string | null
  risk_level: string; status: string; confidence: number | null
  recommendation: string | null; created_at: string
}

export async function login(username: string, password: string): Promise<string> {
  // OAuth2PasswordRequestForm requires form-encoded data, not JSON
  const params = new URLSearchParams({ username, password })
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  })
  if (!res.ok) throw new Error("登录失败")
  return (await res.json()).access_token
}

export async function fetchStreams(token: string): Promise<StreamInfo[]> {
  const res = await fetch(`${API_BASE}/streams`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error()
  return res.json()
}

export async function addStream(token: string, cfg: Partial<StreamInfo>): Promise<StreamInfo> {
  const res = await fetch(`${API_BASE}/streams`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(cfg),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function removeStream(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/streams/${id}`, {
    method: "DELETE", headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error()
}

export async function startStream(token: string, id: string): Promise<StreamInfo> {
  const res = await fetch(`${API_BASE}/streams/${id}/start`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error()
  return res.json()
}

export async function stopStream(token: string, id: string): Promise<StreamInfo> {
  const res = await fetch(`${API_BASE}/streams/${id}/stop`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error()
  return res.json()
}

export async function fetchHealth(): Promise<HealthCheck[]> {
  const res = await fetch(`${API_BASE}/admin/health`)
  if (!res.ok) throw new Error()
  return res.json()
}

export async function fetchStats(): Promise<SystemStats> {
  const res = await fetch(`${API_BASE}/admin/stats`)
  if (!res.ok) throw new Error()
  return res.json()
}

export async function fetchOllamaStatus(): Promise<OllamaStatus> {
  const res = await fetch(`${API_BASE}/admin/ollama`)
  if (!res.ok) throw new Error()
  return res.json()
}

export async function fetchChromaStatus(): Promise<ChromaStatus> {
  const res = await fetch(`${API_BASE}/admin/chromadb`)
  if (!res.ok) throw new Error()
  return res.json()
}

export async function analyzeImage(token: string, file: File): Promise<Record<string, unknown>> {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch(`${API_BASE}/analyze/image`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function ragSearch(query: string, k = 3): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/admin/rag/search?q=${encodeURIComponent(query)}&k=${k}`)
  if (!res.ok) throw new Error()
  return res.json()
}

export async function ragAddDoc(token: string, text: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/admin/rag/add`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error()
  return res.json()
}

export async function fetchAlerts(token: string, params?: Record<string, string>): Promise<{ items: Alert[]; total: number }> {
  const url = new URL(`${API_BASE}/alerts`)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error()
  return res.json()
}

export async function fetchPipeline(token: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/admin/pipeline`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error()
  return res.json()
}

export async function updatePipeline(token: string, mode: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/admin/pipeline`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mode }),
  })
  if (!res.ok) throw new Error()
  return res.json()
}
