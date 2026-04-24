"use client"
import { useState, useEffect } from "react"
import { useAuth } from "@/components/AuthContext"
import { fetchHealth, fetchStats, fetchOllamaStatus, fetchStreams } from "@/lib/api"

function HealthCard({ service, status, latency, detail }: {
  service: string; status: string; latency: number | null; detail: string | null
}) {
  const colors: Record<string, string> = {
    healthy: "var(--accent-green)", running: "var(--accent-green)",
    online: "var(--accent-green)", degraded: "var(--accent-amber)",
    down: "var(--accent-red)", error: "var(--accent-red)", idle: "var(--text-muted)",
  }
  const color = colors[status] || "var(--text-muted)"
  const labels: Record<string, string> = {
    ollama: "Ollama LLM", chromadb: "ChromaDB", database: "数据库",
  }
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: `1px solid ${color}30`, boxShadow: `0 0 12px ${color}10` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-sm font-bold uppercase" style={{ color }}>{labels[service] || service}</div>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
      <div className="text-2xl font-bold font-mono mb-1" style={{ color }}>
        {status === "healthy" || status === "running" || status === "online" ? "在线" : status === "degraded" ? "降级" : "异常"}
      </div>
      {latency !== null && <div className="text-xs font-mono mb-1" style={{ color: "var(--text-secondary)" }}>延迟 {latency}ms</div>}
      {detail && <div className="text-xs" style={{ color: "var(--text-muted)" }}>{detail}</div>}
    </div>
  )
}

function RiskBar({ level, count, total, color }: { level: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-mono uppercase" style={{ color }}>{level}</span>
        <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{count} ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-primary)" }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function QuickLink({ href, icon, label, desc, color }: { href: string; icon: string; label: string; desc: string; color: string }) {
  return (
    <a href={href} className="flex items-center gap-3 p-3 rounded-xl transition-all hover:brightness-110"
      style={{ background: "var(--bg-card)", border: `1px solid ${color}30` }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg" style={{ background: `${color}15`, color }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-base font-bold" style={{ color: "var(--text-primary)" }}>{label}</div>
        <div className="text-sm truncate" style={{ color: "var(--text-muted)" }}>{desc}</div>
      </div>
      <span className="text-base" style={{ color }}>›</span>
    </a>
  )
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [health, setHealth] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [ollama, setOllama] = useState<any>(null)
  const [streams, setStreams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function loadData() {
    if (!user) return
    try {
      const [h, s, o, st] = await Promise.all([
        fetchHealth(),
        fetchStats(),
        fetchOllamaStatus(),
        fetchStreams(user.token).catch(() => []),
      ])
      setHealth(h); setStats(s); setOllama(o); setStreams(st)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { if (user) loadData() }, [user])
  useEffect(() => {
    if (!user) return
    const id = setInterval(loadData, 15000)
    return () => clearInterval(id)
  }, [user])

  if (!user) return null

  const riskColors: Record<string, string> = {
    critical: "var(--accent-red)", high: "var(--accent-amber)",
    medium: "var(--accent-blue)", low: "var(--accent-green)",
  }

  return (
    <div>
      {/* Welcome header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-mono tracking-wider" style={{ color: "var(--text-primary)" }}>
          欢迎回来，<span style={{ color: "var(--accent-amber)" }}>{user.username}</span>
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          UAV 低空检测 · 管理控制台 · {new Date().toLocaleString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
        </p>
      </div>

      {loading ? (
        <div className="text-center py-24 text-sm font-mono" style={{ color: "var(--text-muted)" }}>◈ 加载中…</div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "总预警数", value: stats?.total_alerts ?? 0, color: "var(--accent-amber)" },
              { label: "处理帧数", value: stats?.total_records ?? 0, color: "var(--accent-blue)" },
              { label: "注册感知流", value: streams.length, color: "var(--accent-purple)" },
              { label: "待处理", value: stats?.alerts_by_status?.pending ?? 0, color: "var(--accent-green)" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl p-4 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="text-3xl font-bold font-mono" style={{ color: item.color }}>{item.value}</div>
                <div className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Service health */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {health.map((h) => (
                  <HealthCard key={h.service} service={h.service} status={h.status} latency={h.latency_ms} detail={h.detail} />
                ))}
              </div>

              {/* Risk distribution */}
              {stats && (
                <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <div className="font-mono text-base font-bold mb-4" style={{ color: "var(--text-secondary)" }}>预警风险分布</div>
                  <div className="space-y-4">
                    {(["critical", "high", "medium", "low"] as const).map((level) => (
                      <RiskBar key={level} level={level} count={stats.alerts_by_risk?.[level] ?? 0} total={stats.total_alerts || 1} color={riskColors[level]} />
                    ))}
                  </div>
                </div>
              )}

              {/* Ollama models */}
              {ollama && (
                <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-mono text-base font-bold" style={{ color: "var(--text-secondary)" }}>已加载模型</div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--accent-green)", boxShadow: "0 0 6px var(--accent-green)" }} />
                      <span className="text-sm font-mono" style={{ color: "var(--accent-green)" }}>
                        {ollama.status === "running" ? "运行中" : "离线"}
                      </span>
                    </div>
                  </div>
                  {ollama.models?.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {ollama.models.map((m: string) => (
                        <div key={m} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--bg-primary)" }}>
                          <span style={{ color: "var(--accent-green)" }}>●</span>
                          <span className="font-mono text-sm flex-1 truncate">{m}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-base" style={{ color: "var(--text-muted)" }}>{ollama.error ? `错误: ${ollama.error}` : "无模型"}</div>
                  )}
                </div>
              )}
            </div>

            {/* Right column */}
            <div className="space-y-4">
              {/* Quick links */}
              <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="font-mono text-base font-bold mb-3" style={{ color: "var(--text-secondary)" }}>快捷入口</div>
                <div className="space-y-2">
                  <QuickLink href="/streams" icon="◇" label="感知流管理" desc="配置和管理视频感知流" color="var(--accent-purple)" />
                  <QuickLink href="/alerts" icon="◆" label="预警历史" desc="查看所有预警记录" color="var(--accent-amber)" />
                  <QuickLink href="/settings" icon="⚙" label="系统设置" desc="Pipeline 模型配置" color="var(--accent-blue)" />
                  <QuickLink href="/rag" icon="◫" label="RAG 知识库" desc="SOP 文档检索与添加" color="var(--accent-green)" />
                  <QuickLink href="/upload" icon="◉" label="图像测试" desc="上传图像触发分析" color="var(--accent-red)" />
                </div>
              </div>

              {/* Active streams */}
              {streams.length > 0 && (
                <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <div className="font-mono text-base font-bold mb-3" style={{ color: "var(--text-secondary)" }}>感知流状态</div>
                  <div className="space-y-2">
                    {streams.slice(0, 5).map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "var(--bg-primary)" }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.status === "running" ? "var(--accent-green)" : "var(--text-muted)" }} />
                          <span className="text-sm font-mono truncate">{s.name}</span>
                        </div>
                        <span className="text-sm font-mono ml-2 flex-shrink-0" style={{ color: s.status === "running" ? "var(--accent-green)" : "var(--text-muted)" }}>
                          {s.status === "running" ? "运行" : "停止"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* System info */}
              <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="font-mono text-base font-bold mb-3" style={{ color: "var(--text-secondary)" }}>系统信息</div>
                <div className="space-y-2 text-sm">
                  {[
                    ["版本", "v1.0.0"],
                    ["Next.js", "14.x"],
                    ["Tailwind", "3.x"],
                    ["Ollama 模型", `${ollama?.models?.length ?? 0} 个`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span style={{ color: "var(--text-muted)" }}>{k}</span>
                      <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
