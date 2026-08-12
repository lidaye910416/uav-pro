/**
 * UAV-PRO 前端共享 API 配置
 *
 * 所有 URL 都通过环境变量注入，避免硬编码端口。
 * 端口配置单一来源: 项目根 start.sh
 */

const FALLBACK_BACKEND = "http://localhost:8888"

/** 后端 API 根地址 (如 http://localhost:8888) */
export const getApiBase = (): string =>
  process.env.NEXT_PUBLIC_API_BASE || FALLBACK_BACKEND;

/** 后端 API v1 根地址 (如 http://localhost:8888/api/v1) */
export const API_BASE = `${getApiBase()}/api/v1`;

/**
 * Resolve a backend-relative URL to an absolute URL usable by the browser.
 *
 * The backend returns paths like "/api/v1/demo/frames/abc.jpg" with the
 * full /api/v1 prefix already included. Concatenating them onto API_BASE
 * (which itself ends in "/api/v1") would produce a double prefix and 404.
 * So this helper attaches the URL to the **host** (getApiBase()) instead,
 * keeping the /api/v1 segment exactly once.
 *
 *   - returns absolute URLs unchanged
 *   - prefixes the host when missing
 *   - handles both "/api/v1/..." and "/..." inputs
 */
export function toAbsoluteApiUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined
  if (/^https?:\/\//i.test(url)) return url
  const origin = getApiBase().replace(/\/+$/, "")
  const path = url.startsWith("/") ? url : "/" + url
  return `${origin}${path}`
}

/** Showcase 应用 URL */
export const getShowcaseUrl = (): string =>
  process.env.NEXT_PUBLIC_SHOWCASE_URL || "http://localhost:4000";

/** Dashboard 应用 URL */
export const getDashboardUrl = (): string =>
  process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:4001";

/** Admin 应用 URL */
export const getAdminUrl = (): string =>
  process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:4002";

/**
 * Cross-port deep-link helper. Anchors in another app (Dashboard / Showcase)
 * can target the Admin settings page without hardcoding a port.
 * Honors NEXT_PUBLIC_ADMIN_BASE_URL when set, otherwise falls back to
 * getAdminUrl() so the link is always anchored to the admin origin.
 */
export function buildAdminUrl(path: string): string {
  const envBase =
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_ADMIN_BASE_URL) ||
    ""
  const base = envBase || getAdminUrl()
  const normalized = base.replace(/\/$/, "")
  return `${normalized}${path.startsWith("/") ? path : "/" + path}`
}

// LLM public status (no auth required)
export interface LLMStatus {
  provider: string
  model: string
  base_url: string
  display_name: string
  description: string
}

const FALLBACK_LLM_STATUS: LLMStatus = {
  provider: "unknown",
  model: "unknown",
  base_url: "",
  display_name: "Unknown",
  description: "",
}

export const llmStatusApi = {
  async get(): Promise<LLMStatus> {
    try {
      const res = await fetch(`${API_BASE}/llm/status`)
      if (!res.ok) return FALLBACK_LLM_STATUS
      return (await res.json()) as LLMStatus
    } catch {
      return FALLBACK_LLM_STATUS
    }
  },
}

// LLM provider
export type LLMStageStatus = {
  provider: string
  model: string
  override_active: boolean
}

export type LLMProviderStatus = {
  provider: string
  provider_label: string
  external_base_url: string
  external_model: string
  external_api_key_set: boolean
  override_active: boolean
  ollama_model: string
  ollama_base_url: string
  stages: { vision: LLMStageStatus; decision: LLMStageStatus }
}

export const llmProviderApi = {
  async get(token: string): Promise<LLMProviderStatus> {
    const res = await fetch(`${API_BASE}/admin/llm/provider`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error()
    return res.json()
  },
  async update(token: string, body: { provider: string; base_url?: string; api_key?: string; model?: string }): Promise<LLMProviderStatus> {
    const res = await fetch(`${API_BASE}/admin/llm/provider`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },
  async test(token: string, body: { base_url: string; api_key: string; model: string }): Promise<Record<string, unknown>> {
    const res = await fetch(`${API_BASE}/admin/llm/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },
};

// LLM provider catalog (admin-auth)
export interface LLMProvider {
  id: string
  label: string
  default_base_url: string
  default_model: string
  protocol: "ollama" | "anthropic" | "openai"
  multimodal: boolean
  models: string[]
}

export const llmProviderCatalogApi = {
  async get(token: string): Promise<LLMProvider[]> {
    const res = await fetch(`${API_BASE}/admin/llm/providers`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error(`providers ${res.status}`)
    return res.json()
  },
}

export interface LLMModelListResult {
  provider: string
  models: string[]
}

export const llmModelListApi = {
  async list(
    token: string,
    params: { provider: string; base_url?: string; api_key?: string },
  ): Promise<LLMModelListResult> {
    const q = new URLSearchParams({ provider: params.provider })
    if (params.base_url) q.set("base_url", params.base_url)
    if (params.api_key) q.set("api_key", params.api_key)
    const res = await fetch(`${API_BASE}/admin/llm/models?${q.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error(`models ${res.status}`)
    return res.json()
  },
}

// Per-stage (vision / decision) LLM configuration
export interface LLMStageConfig {
  provider: string
  base_url?: string
  api_key?: string
  model?: string
}

export const llmPerStageApi = {
  async update(
    token: string,
    body: { vision?: LLMStageConfig; decision?: LLMStageConfig },
  ): Promise<Record<string, unknown>> {
    const res = await fetch(`${API_BASE}/admin/llm/per-stage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`per-stage ${res.status}`)
    return res.json()
  },
  async get(token: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${API_BASE}/admin/llm/per-stage`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error(`per-stage ${res.status}`)
    return res.json()
  },
};
