"use client"
import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/components/AuthContext"
import { fetchAlerts } from "@/lib/api"

const RISK_COLORS: Record<string, string> = {
  critical: "var(--accent-red)", high: "var(--accent-amber)",
  medium: "var(--accent-blue)", low: "var(--accent-green)",
}
const RISK_LABELS: Record<string, string> = {
  critical: "严重", high: "高风险", medium: "中风险", low: "低风险",
}
const STATUS_LABELS: Record<string, string> = {
  pending: "待处理", confirmed: "已确认", resolved: "已解决", dismissed: "已忽略",
}

export default function AlertsPage() {
  const { user } = useAuth()
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("all")

  const load = useCallback(async () => {
    if (!user) return
    try {
      const params: Record<string, string> = {}
      if (filter !== "all") params.risk_level = filter
      const data = await fetchAlerts(user.token, params)
      setAlerts(data.items || [])
    } catch { /* */ }
    setLoading(false)
  }, [user, filter])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const id = setInterval(load, 8000)
    return () => clearInterval(id)
  }, [load])

  if (!user) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-mono tracking-wider">预警历史</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>所有预警记录 · 8秒自动刷新</p>
        </div>
        <div className="flex gap-2">
          {["all", "critical", "high", "medium", "low"].map((f) => (
            <button key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-2 rounded-lg text-sm font-mono transition-all"
              style={{
                background: filter === f ? "var(--accent-amber)" : "var(--bg-card)",
                color: filter === f ? "#000" : "var(--text-muted)",
                border: `1px solid ${filter === f ? "var(--accent-amber)" : "var(--border)"}`,
              }}>
              {f === "all" ? "全部" : RISK_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-sm font-mono" style={{ color: "var(--text-muted)" }}>◈ 加载中…</div>
      ) : alerts.length === 0 ? (
        <div className="rounded-xl text-center py-16" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="text-3xl mb-3 opacity-20">◎</div>
          <div className="font-mono text-sm" style={{ color: "var(--text-muted)" }}>暂无预警数据</div>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className="rounded-xl p-4 transition-all hover:brightness-110"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderLeft: `3px solid ${RISK_COLORS[alert.risk_level] || "var(--border)"}` }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-sm" style={{ color: RISK_COLORS[alert.risk_level] }}>{alert.title}</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded"
                    style={{ background: `${RISK_COLORS[alert.risk_level]}15`, color: RISK_COLORS[alert.risk_level] }}>
                    {RISK_LABELS[alert.risk_level] || alert.risk_level}
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded"
                    style={{ background: "rgba(74,158,255,0.1)", color: "var(--accent-blue)" }}>
                    {STATUS_LABELS[alert.status] || alert.status}
                  </span>
                </div>
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                  {new Date(alert.created_at).toLocaleString("zh-CN")}
                </span>
              </div>
              {alert.description && (
                <p className="text-base mb-2" style={{ color: "var(--text-secondary)" }}>{alert.description}</p>
              )}
              {alert.recommendation && (
                <div className="text-sm px-3 py-2 rounded-lg mb-2" style={{ background: "rgba(255,184,0,0.06)", borderLeft: "2px solid var(--accent-amber)", color: "var(--accent-amber)" }}>
                  建议: {alert.recommendation}
                </div>
              )}
              {alert.confidence !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono w-12" style={{ color: "var(--text-muted)" }}>置信度</span>
                  <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: "var(--bg-primary)" }}>
                    <div className="h-full rounded-full" style={{ width: `${(alert.confidence as number) * 100}%`, background: RISK_COLORS[alert.risk_level] }} />
                  </div>
                  <span className="text-sm font-mono w-12 text-right" style={{ color: RISK_COLORS[alert.risk_level] }}>{(alert.confidence * 100).toFixed(0)}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
