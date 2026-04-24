import { Alert } from "../../api/alerts"

const RISK_CONFIG: Record<string, { label: string; borderClass: string; textClass: string; dotClass: string; glowClass: string }> = {
  low:      { label: "低风险", borderClass: "risk-low",      textClass: "text-green",  dotClass: "bg-green",  glowClass: "animate-pulse-green" },
  medium:   { label: "中风险", borderClass: "risk-medium",   textClass: "text-amber",  dotClass: "bg-amber",  glowClass: "animate-pulse-amber" },
  high:     { label: "高风险", borderClass: "risk-high",     textClass: "text-red",    dotClass: "bg-red",    glowClass: "animate-pulse-red" },
  critical: { label: "严重",   borderClass: "risk-critical", textClass: "text-purple", dotClass: "bg-purple", glowClass: "animate-pulse-purple" },
}

const STATUS_CONFIG: Record<string, { label: string; textClass: string }> = {
  pending:   { label: "待处理",   textClass: "text-secondary" },
  confirmed: { label: "已确认",   textClass: "text-blue" },
  resolved:  { label: "已解决",   textClass: "text-green" },
  dismissed: { label: "已忽略",   textClass: "text-muted" },
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

interface AlertCardProps {
  alert: Alert
  /** 最小化展示（用于 SSE 实时插入） */
  compact?: boolean
}

export default function AlertCard({ alert, compact = false }: AlertCardProps) {
  const risk = RISK_CONFIG[alert.risk_level] || RISK_CONFIG.low
  const status = STATUS_CONFIG[alert.status] || STATUS_CONFIG.pending

  return (
    <div
      className={`
        p-4 rounded-xl transition-all duration-200 cursor-pointer
        hover:scale-[1.01] hover:brightness-110
        ${risk.borderClass}
        ${risk.glowClass}
      `}
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
        <div className="flex items-center gap-2 shrink-0">
          {/* 风险标签 */}
          <span
            className={`text-xs font-mono font-bold tracking-wider px-2 py-0.5 rounded ${risk.textClass}`}
            style={{ background: "rgba(0,0,0,0.3)", border: `1px solid currentColor` }}
          >
            {risk.label}
          </span>
        </div>
      </div>

      {/* 位置信息 */}
      {alert.location_name && (
        <p
          className="text-xs mb-1.5 flex items-center gap-1.5 font-mono"
          style={{ color: "var(--text-secondary)" }}
        >
          <span aria-hidden="true">◎</span>
          {alert.location_name}
        </p>
      )}

      {/* 描述 */}
      {alert.description && (
        <p
          className={`text-xs mb-3 leading-relaxed ${compact ? "line-clamp-1" : "line-clamp-2"}`}
          style={{ color: "var(--text-secondary)" }}
        >
          {alert.description}
        </p>
      )}

      {/* AI 建议（来自 LLM） */}
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
            <span className="text-xs font-mono font-bold" style={{ color: risk.textClass.replace("text-", "") === "amber" ? "var(--accent-amber)" : risk.textClass.replace("text-", "") === "green" ? "var(--accent-green)" : "var(--accent-red)" }}>
              {(alert.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <div className="w-full rounded-full h-1" style={{ background: "var(--border)" }}>
            <div
              className="h-1 rounded-full transition-all"
              style={{ width: `${(alert.confidence ?? 0) * 100}%`, background: risk.dotClass === "bg-amber" ? "var(--accent-amber)" : risk.dotClass === "bg-green" ? "var(--accent-green)" : risk.dotClass === "bg-red" ? "var(--accent-red)" : "var(--accent-purple)" }}
            />
          </div>
        </div>
      )}

      {/* 底部：时间 + 状态 */}
      <div className="flex items-center justify-between mt-auto pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        <time className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          {formatTime(alert.created_at)}
        </time>
        <span className={`text-xs font-medium ${status.textClass}`}>
          {status.label}
        </span>
      </div>
    </div>
  )
}
