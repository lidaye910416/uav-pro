import { StreamAlert } from "../../hooks/useAlertStream"

const RISK_CONFIG: Record<string, { label: string; borderClass: string; textVar: string; dotVar: string; glowClass: string }> = {
  low:      { label: "低风险", borderClass: "risk-low",      textVar: "var(--accent-green)",  dotVar: "var(--accent-green)", glowClass: "animate-pulse-green" },
  medium:   { label: "中风险", borderClass: "risk-medium",   textVar: "var(--accent-blue)",   dotVar: "var(--accent-blue)",  glowClass: "animate-pulse-amber" },
  high:     { label: "高风险", borderClass: "risk-high",     textVar: "var(--accent-amber)", dotVar: "var(--accent-amber)", glowClass: "animate-pulse-amber" },
  critical: { label: "严重",   borderClass: "risk-critical", textVar: "var(--accent-red)",  dotVar: "var(--accent-red)",  glowClass: "animate-pulse-red" },
}

interface AlertCardProps {
  alert: StreamAlert
  compact?: boolean
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function AlertCard({ alert, compact = false }: AlertCardProps) {
  const risk = RISK_CONFIG[alert.risk_level] || RISK_CONFIG.low

  return (
    <div
      className={`p-4 rounded-xl transition-all duration-200 ${risk.borderClass} ${risk.glowClass}`}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
      }}
    >
      {/* 头部：标题 + 风险标签 */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-medium text-sm leading-snug flex-1" style={{ color: "var(--text-primary)" }}>
          {alert.title}
        </h3>
        <span
          className="text-xs font-mono font-bold tracking-wider px-2 py-0.5 rounded"
          style={{ color: risk.textVar, background: "rgba(0,0,0,0.3)", border: "1px solid currentColor" }}
        >
          {risk.label}
        </span>
      </div>

      {/* 描述 */}
      {alert.description && (
        <p
          className={`text-xs mb-3 leading-relaxed ${compact ? "line-clamp-1" : "line-clamp-2"}`}
          style={{ color: "var(--text-secondary)" }}
        >
          {alert.description}
        </p>
      )}

      {/* AI 建议 */}
      {alert.recommendation && !compact && (
        <div
          className="mb-3 px-3 py-2 rounded-lg text-xs font-mono"
          style={{ background: "rgba(255,184,0,0.06)", border: "1px solid rgba(255,184,0,0.2)", color: "var(--accent-amber)" }}
        >
          <span className="opacity-60 mr-1">▶</span>
          {alert.recommendation}
        </div>
      )}

      {/* 置信度条 */}
      {alert.confidence != null && !compact && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>置信度</span>
            <span className="text-xs font-mono font-bold" style={{ color: risk.textVar }}>
              {(alert.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <div className="w-full rounded-full h-1" style={{ background: "var(--border)" }}>
            <div
              className="h-1 rounded-full transition-all"
              style={{ width: `${(alert.confidence ?? 0) * 100}%`, background: risk.dotVar }}
            />
          </div>
        </div>
      )}

      {/* 底部：时间 */}
      <div className="flex items-center mt-auto pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        <time className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          {formatTime(alert.created_at)}
        </time>
      </div>
    </div>
  )
}
