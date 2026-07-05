"use client"
import Link from "next/link"
import { useLLMStatus } from "@uav/hooks"
import { buildAdminUrl } from "@uav/api"

/**
 * Per-stage LLM provider badge — supersedes LLMStatusBadge.
 * Same API as showcase/apps/showcase/components/PerStageProviderBadge.tsx;
 * duplicated to avoid pulling a shared @uav/ui dep that previously had 0 refs.
 */
export type PerStageBadgeMode = "auto" | "unified" | "per-stage"
export type PerStageBadgeVariant = "compact" | "inline" | "expanded"

export interface PerStageProviderBadgeProps {
  mode?: PerStageBadgeMode
  variant?: PerStageBadgeVariant
  showModel?: boolean
  deepLink?: string
  fallbackLabel?: string
}

const PROTOCOL_COLOR: Record<string, string> = {
  ollama: "var(--accent-amber)",
  anthropic: "var(--accent-purple)",
  openai: "var(--accent-blue)",
}

function colorFor(provider: string | undefined, fallback = "var(--accent-purple)"): string {
  if (!provider) return "var(--text-muted)"
  return PROTOCOL_COLOR[provider] ?? fallback
}

export default function PerStageProviderBadge({
  mode = "auto",
  variant = "compact",
  showModel = true,
  deepLink = "/settings?tab=provider",
  fallbackLabel = "LLM · 检测中...",
}: PerStageProviderBadgeProps) {
  const { status } = useLLMStatus()

  if (!status) {
    return (
      <Link
        href={buildAdminUrl(deepLink)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[11px] tracking-wide transition-all hover:brightness-110"
        style={{
          background: "rgba(16,16,16,0.7)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)",
        }}
        title="正在加载 LLM 提供商状态…"
      >
        <span>🤖</span>
        <span>{fallbackLabel}</span>
      </Link>
    )
  }

  const scope = mode === "auto" ? (status.scope ?? "unified") : mode
  const isUnified = scope === "unified"
  const stages = status.stages
  const visionProvider = stages?.vision?.provider ?? status.provider
  const decisionProvider = stages?.decision?.provider ?? status.provider
  const visionModel = stages?.vision?.model ?? status.model
  const decisionModel = stages?.decision?.model ?? status.model

  if (variant === "inline") {
    if (isUnified) {
      const c = colorFor(status.provider)
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[11px]"
          style={{ background: `${c}15`, color: c, border: `1px solid ${c}55` }}
          title={status.description ?? ""}
        >
          🤖 {status.display_name ?? status.provider}
          {showModel && status.model ? ` · ${status.model}` : ""}
        </span>
      )
    }
    return (
      <span
        className="inline-flex items-center gap-2 px-2 py-0.5 rounded font-mono text-[11px]"
        style={{
          background: "rgba(16,16,16,0.5)",
          border: "1px solid var(--border)",
          color: "var(--text-secondary)",
        }}
        title={status.description ?? ""}
      >
        <span style={{ color: colorFor(visionProvider) }}>vision={visionProvider}</span>
        <span style={{ color: "var(--text-muted)" }}>·</span>
        <span style={{ color: colorFor(decisionProvider) }}>decision={decisionProvider}</span>
      </span>
    )
  }

  if (variant === "expanded") {
    return (
      <div className="flex items-center gap-1.5 font-mono text-[11px]">
        <span
          className="flex items-center gap-1 px-2 py-1 rounded"
          style={{
            background: isUnified ? `${colorFor(status.provider)}12` : "rgba(0,229,160,0.08)",
            border: `1px solid ${isUnified ? colorFor(status.provider) : "rgba(0,229,160,0.3)"}`,
            color: isUnified ? colorFor(status.provider) : "var(--accent-green)",
          }}
          title="Vision / 识别层"
        >
          <span>👁</span>
          <span>
            vision={isUnified ? (status.display_name ?? status.provider) : visionProvider}
            {showModel && (
              <span style={{ color: "var(--text-muted)" }}>
                {" · "}
                {isUnified ? status.model : visionModel}
              </span>
            )}
          </span>
        </span>
        {!isUnified && <span style={{ color: "var(--text-muted)" }}>↳</span>}
        <span
          className="flex items-center gap-1 px-2 py-1 rounded"
          style={{
            background: isUnified ? `${colorFor(status.provider)}12` : "rgba(180,122,255,0.08)",
            border: `1px solid ${isUnified ? colorFor(status.provider) : "rgba(180,122,255,0.3)"}`,
            color: isUnified ? colorFor(status.provider) : "var(--accent-purple)",
          }}
          title="Decision / 决策层"
        >
          <span>◈</span>
          <span>
            decision={isUnified ? (status.display_name ?? status.provider) : decisionProvider}
            {showModel && (
              <span style={{ color: "var(--text-muted)" }}>
                {" · "}
                {isUnified ? status.model : decisionModel}
              </span>
            )}
          </span>
        </span>
      </div>
    )
  }

  const isExternal =
    !!status.provider && status.provider !== "ollama" && status.provider !== "unknown"
  const colorVar = isExternal ? "var(--accent-purple)" : "var(--accent-amber)"
  const label = isUnified
    ? status.display_name || "Unknown"
    : `V:${visionProvider}/${visionModel} · D:${decisionProvider}/${decisionModel}`
  const tooltip = isUnified
    ? `点击前往 Admin → Settings 切换 LLM 提供商 · ${status.description ?? ""}`
    : `Per-stage 配置 · 点击前往 Admin → Settings · vision=${visionProvider}:${visionModel}, decision=${decisionProvider}:${decisionModel}`

  return (
    <Link
      href={buildAdminUrl(deepLink)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[11px] tracking-wide transition-all hover:brightness-110"
      style={{
        background: "rgba(16,16,16,0.7)",
        border: `1px solid ${colorVar}55`,
        color: colorVar,
        boxShadow: `0 0 8px ${colorVar}22`,
      }}
      title={tooltip}
    >
      <span>🤖</span>
      <span>
        LLM: <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      </span>
    </Link>
  )
}