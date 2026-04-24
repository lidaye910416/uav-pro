"use client"
import { useState, useEffect, useCallback } from "react"
import Sidebar from "../../components/Layout/Sidebar"
import { useAlertStream, StreamAlert } from "../../hooks/useAlertStream"
import { fetchAlerts, Alert } from "../../api/alerts"

const RISK_COLORS: Record<string, string> = {
  critical: "var(--accent-red)",
  high: "var(--accent-amber)",
  medium: "var(--accent-blue)",
  low: "var(--accent-green)",
}
const RISK_LABELS: Record<string, string> = {
  critical: "严重",
  high: "高风险",
  medium: "中风险",
  low: "低风险",
}
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:   { label: "待处理", color: "var(--accent-amber)" },
  confirmed: { label: "已确认", color: "var(--accent-blue)" },
  resolved:  { label: "已解决", color: "var(--accent-green)" },
  dismissed: { label: "已忽略", color: "var(--text-muted)" },
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

// ── Detail Modal ─────────────────────────────────────────────────────────────
function AlertDetailModal({ alert, onClose }: { alert: Alert | StreamAlert; onClose: () => void }) {
  const risk = RISK_COLORS[alert.risk_level] || "var(--border)"
  const statusCfg = STATUS_LABELS[alert.status] || STATUS_LABELS.pending
  const confidence = (alert as any).confidence

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden animate-fade-in-up"
        style={{ background: "var(--bg-card)", border: `1px solid ${risk}40`, boxShadow: `0 0 32px ${risk}20` }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5" style={{ borderBottom: `1px solid ${risk}30`, background: `${risk}08` }}>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: `${risk}20`, color: risk, border: `1px solid ${risk}50` }}>
                {RISK_LABELS[alert.risk_level] || alert.risk_level}
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.3)", color: statusCfg.color, border: "1px solid currentColor" }}>
                {statusCfg.label}
              </span>
            </div>
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{String(alert.title)}</h2>
          </div>
          <button onClick={onClose} className="ml-4 w-8 h-8 rounded-lg flex items-center justify-center text-lg" style={{ background: "var(--bg-primary)", color: "var(--text-muted)" }}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {alert.description && (
            <div>
              <div className="text-xs font-mono mb-1.5" style={{ color: "var(--text-muted)" }}>事件描述</div>
              <div className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{String(alert.description)}</div>
            </div>
          )}
          {alert.location_name && (
            <div>
              <div className="text-xs font-mono mb-1.5" style={{ color: "var(--text-muted)" }}>发生位置</div>
              <div className="text-sm" style={{ color: "var(--accent-amber)" }}>◎ {String(alert.location_name)}</div>
            </div>
          )}
          {(alert as any).scene_description && (
            <div>
              <div className="text-xs font-mono mb-1.5" style={{ color: "var(--text-muted)" }}>场景描述</div>
              <div className="text-sm" style={{ color: "var(--text-secondary)" }}>{String((alert as any).scene_description)}</div>
            </div>
          )}
          {(alert as any).recommendation && (
            <div className="p-3 rounded-xl" style={{ background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.2)" }}>
              <div className="text-xs font-mono mb-1.5" style={{ color: "var(--accent-amber)" }}>▶ 处置建议</div>
              <div className="text-sm" style={{ color: "var(--accent-amber)" }}>{String((alert as any).recommendation)}</div>
            </div>
          )}
          {confidence != null && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>置信度</div>
                <div className="text-sm font-mono font-bold" style={{ color: risk }}>{(confidence * 100).toFixed(1)}%</div>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${confidence * 100}%`, background: risk }} />
              </div>
            </div>
          )}
          <div className="flex gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
            <div>创建: {formatTime((alert as any).created_at)}</div>
            {((alert as any).updated_at) && <div>更新: {formatTime((alert as any).updated_at)}</div>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-5" style={{ borderTop: "1px solid var(--border)", background: "var(--bg-primary)" }}>
          <button
            className="px-4 py-2 rounded-lg text-xs font-mono transition-all"
            style={{ background: "var(--accent-blue)", color: "#000" }}
            onClick={() => {/* 确认 */}}
          >
            ✓ 确认预警
          </button>
          <button
            className="px-4 py-2 rounded-lg text-xs font-mono transition-all"
            style={{ background: "var(--accent-green)", color: "#000" }}
            onClick={() => {/* 解决 */}}
          >
            ✓ 已解决
          </button>
          <button
            className="px-4 py-2 rounded-lg text-xs font-mono transition-all"
            style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
            onClick={() => {/* 忽略 */}}
          >
            ✕ 忽略
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Alert Row ─────────────────────────────────────────────────────────────────
function AlertRow({ alert, onClick }: { alert: Alert | StreamAlert; onClick: () => void }) {
  const risk = RISK_COLORS[alert.risk_level] || "var(--border)"
  const statusCfg = STATUS_LABELS[alert.status] || STATUS_LABELS.pending
  const confidence = (alert as any).confidence

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 cursor-pointer transition-all hover:brightness-110"
      style={{
        background: "var(--bg-card)",
        borderBottom: "1px solid var(--border)",
        borderLeft: `3px solid ${risk}`,
      }}
      onClick={onClick}
    >
      {/* Risk indicator */}
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: risk, boxShadow: `0 0 6px ${risk}` }} />

      {/* Title + desc */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>{String(alert.title)}</div>
        {alert.description && (
          <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{String(alert.description).slice(0, 60)}</div>
        )}
      </div>

      {/* Location */}
      {alert.location_name && (
        <div className="text-xs font-mono hidden md:block" style={{ color: "var(--text-muted)" }}>
          ◎ {String(alert.location_name)}
        </div>
      )}

      {/* Confidence */}
      {confidence != null && (
        <div className="text-xs font-mono hidden lg:block" style={{ color: risk }}>
          {(confidence * 100).toFixed(0)}%
        </div>
      )}

      {/* Status */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono px-2 py-0.5 rounded hidden sm:block" style={{ color: statusCfg.color, background: `${statusCfg.color}15` }}>
          {statusCfg.label}
        </span>
        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          {formatTime((alert as any).created_at)}
        </span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>›</span>
      </div>
    </div>
  )
}

// ── Filter Bar ────────────────────────────────────────────────────────────────
function FilterBar({ riskFilter, statusFilter, search, onRisk, onStatus, onSearch, onClear, counts }: {
  riskFilter: string; statusFilter: string; search: string
  onRisk: (v: string) => void; onStatus: (v: string) => void; onSearch: (v: string) => void; onClear: () => void
  counts: Record<string, number>
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {/* Search */}
      <div className="relative flex-1 min-w-48">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--text-muted)" }}>🔍</span>
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="搜索标题、描述..."
          className="w-full pl-8 pr-3 py-2 rounded-lg text-xs font-mono"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        />
      </div>

      {/* Risk filter */}
      <select value={riskFilter} onChange={e => onRisk(e.target.value)}
        className="px-3 py-2 rounded-lg text-xs font-mono"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
        {[
          { value: "", label: `风险等级 ${counts.all ? `(${counts.all})` : ""}` },
          { value: "critical", label: `严重 ${counts.critical ? `(${counts.critical})` : ""}` },
          { value: "high", label: `高风险 ${counts.high ? `(${counts.high})` : ""}` },
          { value: "medium", label: `中风险 ${counts.medium ? `(${counts.medium})` : ""}` },
          { value: "low", label: `低风险 ${counts.low ? `(${counts.low})` : ""}` },
        ].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {/* Status filter */}
      <select value={statusFilter} onChange={e => onStatus(e.target.value)}
        className="px-3 py-2 rounded-lg text-xs font-mono"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
        {[
          { value: "", label: "所有状态" },
          { value: "pending", label: "待处理" },
          { value: "confirmed", label: "已确认" },
          { value: "resolved", label: "已解决" },
          { value: "dismissed", label: "已忽略" },
        ].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {(riskFilter || statusFilter || search) && (
        <button onClick={onClear}
          className="px-3 py-2 rounded-lg text-xs font-mono"
          style={{ border: "1px solid var(--accent-red)", color: "var(--accent-red)" }}>
          清除筛选
        </button>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AlertsPage() {
  const [riskFilter, setRiskFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [allAlerts, setAllAlerts] = useState<(Alert | StreamAlert)[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAlert, setSelectedAlert] = useState<Alert | StreamAlert | null>(null)
  const [liveAlerts, setLiveAlerts] = useState<StreamAlert[]>([])
  const limit = 20

  // Fetch paginated alerts
  const loadAlerts = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: Record<string, string> = {}
      if (riskFilter) params.risk_level = riskFilter
      if (statusFilter) params.status = statusFilter
      const data = await fetchAlerts({ skip: page * limit, limit, ...params })
      setAllAlerts(data.items)
      setTotal(data.total)
    } catch { /* */ }
    setIsLoading(false)
  }, [page, riskFilter, statusFilter])

  useEffect(() => { loadAlerts() }, [loadAlerts])
  useEffect(() => {
    const id = setInterval(loadAlerts, 30000)
    return () => clearInterval(id)
  }, [loadAlerts])

  // SSE live alerts
  const onAlert = useCallback((alert: StreamAlert) => {
    setLiveAlerts(prev => [alert, ...prev].slice(0, 10))
  }, [])

  const { connected } = useAlertStream(onAlert)

  // Merge live alerts with historical (deduped)
  const displayAlerts = (() => {
    const liveIds = new Set(liveAlerts.map(a => a.id ?? -1))
    const historical = allAlerts.filter(a => !liveIds.has((a as any).id))
    return [...liveAlerts, ...historical]
  })()

  // Filter by search
  const filteredAlerts = search
    ? displayAlerts.filter(a =>
        String(a.title).includes(search) ||
        String(a.description || "").includes(search)
      )
    : displayAlerts

  // Counts for filter badges
  const counts: Record<string, number> = {
    all: total,
    critical: (total > 0 && !riskFilter) ? 0 : 0,
    high: 0, medium: 0, low: 0,
  }

  return (
    <>
      <Sidebar />
      <div className="min-h-screen p-6 ml-60" style={{ fontFamily: "'JetBrains Mono', monospace" }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-widest" style={{ color: "var(--text-primary)" }}>
              预警列表
            </h1>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              全量预警记录 · 实时监控 · 状态管理
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Live indicator */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
              style={{ background: "var(--bg-card)", border: `1px solid ${connected ? "var(--accent-green)" : "var(--accent-red)"}` }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: connected ? "var(--accent-green)" : "var(--accent-red)", boxShadow: connected ? "0 0 6px var(--accent-green)" : "none" }} />
              <span style={{ color: connected ? "var(--accent-green)" : "var(--accent-red)" }}>
                {connected ? "◈ 实时接收" : "OFFLINE"}
              </span>
            </div>
            {/* Total count */}
            <div className="px-3 py-1.5 rounded-lg text-xs font-mono" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              共 {total} 条
            </div>
          </div>
        </div>

        {/* Live alerts strip */}
        {liveAlerts.length > 0 && (
          <div className="mb-4 p-3 rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--accent-amber)40" }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--accent-amber)", boxShadow: "0 0 6px var(--accent-amber)" }} />
              <span className="text-xs font-mono" style={{ color: "var(--accent-amber)" }}>实时新预警</span>
              <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{liveAlerts.length} 条</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {liveAlerts.map((a, i) => (
                <button key={a.id ?? i} onClick={() => setSelectedAlert(a)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono transition-all hover:brightness-110"
                  style={{ background: `${RISK_COLORS[a.risk_level]}20`, color: RISK_COLORS[a.risk_level], border: `1px solid ${RISK_COLORS[a.risk_level]}50` }}>
                  {RISK_LABELS[a.risk_level]} · {String(a.title).slice(0, 20)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filter bar */}
        <FilterBar
          riskFilter={riskFilter}
          statusFilter={statusFilter}
          search={search}
          counts={counts}
          onRisk={(v) => { setRiskFilter(v); setPage(0) }}
          onStatus={(v) => { setStatusFilter(v); setPage(0) }}
          onSearch={(v) => setSearch(v)}
          onClear={() => { setRiskFilter(""); setStatusFilter(""); setSearch(""); setPage(0) }}
        />

        {/* Alert list */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          {/* Column headers */}
          <div className="flex items-center gap-4 px-4 py-2 text-xs font-mono" style={{ background: "var(--bg-primary)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
            <div className="w-2 flex-shrink-0" />
            <div className="flex-1">标题 / 描述</div>
            <div className="hidden md:block w-28 flex-shrink-0">位置</div>
            <div className="hidden lg:block w-10 flex-shrink-0">置信</div>
            <div className="w-36 flex-shrink-0 text-right">时间 / 状态</div>
          </div>

          {isLoading && displayAlerts.length === 0 ? (
            <div className="text-center py-20 text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              ◈ 加载中...
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-4xl mb-3 opacity-20">◎</div>
              <div className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
                {search || riskFilter || statusFilter ? "无匹配预警" : "暂无预警数据"}
              </div>
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <AlertRow key={(alert as any).id ?? Math.random()} alert={alert} onClick={() => setSelectedAlert(alert)} />
            ))
          )}
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="flex justify-center gap-3 mt-6">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-4 py-2 rounded-lg text-xs font-mono disabled:opacity-40"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              ← 上一页
            </button>
            <div className="px-4 py-2 rounded-lg text-xs font-mono" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              第 {page + 1} 页 · 共 {Math.ceil(total / limit)} 页
            </div>
            <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * limit >= total}
              className="px-4 py-2 rounded-lg text-xs font-mono disabled:opacity-40"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              下一页 →
            </button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedAlert && (
        <AlertDetailModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      )}
    </>
  )
}
