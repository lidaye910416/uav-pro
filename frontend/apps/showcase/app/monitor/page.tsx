"use client"
import { useState, useEffect, useRef } from "react"
import { useAlertStream, StreamAlert } from "../../hooks/useAlertStream"
import AlertCard from "../../components/AlertCard"
import ReactECharts from "echarts-for-react"

// ── Pipeline Stage Config ─────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { key: "perception", label: "感知层", icon: "◉", color: "var(--accent-amber)", desc: "无人机 + 高挂摄像头", metric: "帧率 25fps", detail: "视频流采集" },
  { key: "vision",     label: "视觉识别", icon: "◆", color: "var(--accent-green)", desc: "Gemma 4 E2B 边缘推理", metric: "模型已加载", detail: "多模态视觉理解" },
  { key: "rag",        label: "RAG检索", icon: "◫", color: "var(--accent-blue)", desc: "ChromaDB SOP 知识库", metric: "向量库 1423 条", detail: "相似案例检索" },
  { key: "decision",   label: "决策生成", icon: "◈", color: "var(--accent-purple)", desc: "Ollama 本地 LLM", metric: "响应 230ms", detail: "风险等级判定" },
]

// ── Chart Data Generators ────────────────────────────────────────────────────
function makeAlertTrendData() {
  const now = Date.now()
  return Array.from({ length: 24 }, (_, i) => ({
    time: new Date(now - (23 - i) * 3600 * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    alerts: Math.floor(Math.random() * 8) + (i > 18 ? 3 : 1),
  }))
}

function riskPieOption(data: Record<string, number>) {
  const map: Record<string, string> = {
    critical: "#FF3B3B", high: "#FFB800", medium: "#4A9EFF", low: "#00E5A0",
  }
  const items = Object.entries(data).filter(([, v]) => v > 0)
  return {
    backgroundColor: "transparent",
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { orient: "vertical" as const, right: 8, top: "center" as const, textStyle: { color: "#888", fontSize: 11, fontFamily: "JetBrains Mono" } },
    series: [{
      type: "pie" as const,
      radius: ["45%", "70%"],
      center: ["35%", "50%"],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 6, borderColor: "#1A1A1A", borderWidth: 2 },
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 14, fontWeight: "bold" as const, color: "#fff", fontFamily: "JetBrains Mono" },
        itemStyle: { shadowBlur: 20, shadowColor: "rgba(0,0,0,0.5)" },
      },
      data: items.map(([name, value]) => ({
        name, value,
        itemStyle: { color: map[name] || "#888" },
      })),
    }],
  }
}

function alertTrendOption(trend: { time: string; alerts: number }[]) {
  return {
    backgroundColor: "transparent",
    tooltip: { trigger: "axis" as const, backgroundColor: "#1A1A1A", borderColor: "#2A2A2A", textStyle: { color: "#f0f0f0", fontFamily: "JetBrains Mono" } },
    grid: { top: 20, right: 20, bottom: 30, left: 50 },
    xAxis: { type: "category" as const, data: trend.map(t => t.time), axisLine: { lineStyle: { color: "#2A2A2A" } }, axisLabel: { color: "#555", fontSize: 10, fontFamily: "JetBrains Mono" }, splitLine: { show: false } },
    yAxis: { type: "value" as const, axisLine: { show: false }, splitLine: { lineStyle: { color: "#1e1e1e" } }, axisLabel: { color: "#555", fontFamily: "JetBrains Mono" } },
    series: [{
      type: "line" as const,
      data: trend.map(t => t.alerts),
      smooth: true,
      lineStyle: { color: "#FFB800", width: 2 },
      areaStyle: { color: { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(255,184,0,0.25)" }, { offset: 1, color: "rgba(255,184,0,0)" }] } },
      symbol: "circle" as const, symbolSize: 4,
      itemStyle: { color: "#FFB800" },
    }],
  }
}

// ── Mock risk distribution ────────────────────────────────────────────────────
const RISK_DISTRIBUTION: Record<string, number> = { critical: 3, high: 5, medium: 7, low: 6 }

export default function MonitorPage() {
  const [alerts, setAlerts] = useState<StreamAlert[]>([])
  const [trend, setTrend] = useState<{ time: string; alerts: number }[]>([])
  const { connected } = useAlertStream((alert) => {
    setAlerts(prev => [alert, ...prev].slice(0, 50))
  })

  useEffect(() => {
    setTrend(makeAlertTrendData())
  }, [])

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* LIVE header */}
      <div
        className="sticky top-0 z-10 px-6 py-3 flex items-center gap-4 flex-wrap"
        style={{ background: "rgba(10,10,10,0.95)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--accent-red)" }} />
          <span className="font-mono text-xs font-bold" style={{ color: "var(--accent-red)" }}>LIVE</span>
        </div>
        {PIPELINE_STAGES.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span style={{ color: s.color }}>{s.icon}</span>
            <span className="font-mono text-xs" style={{ color: s.color }}>{s.label}</span>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent-green)", boxShadow: "0 0 6px var(--accent-green)" }} />
            <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>运行中</span>
          </div>
        ))}
        <div className="ml-auto font-mono text-xs" style={{ color: "var(--text-muted)" }}>
          SSE {connected ? "● 已连接" : "○ 已断开"}
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">

        {/* Pipeline stage cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {PIPELINE_STAGES.map((stage) => (
            <div
              key={stage.key}
              className="rounded-2xl p-5 transition-all duration-300"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                boxShadow: `0 0 20px ${stage.color}18`,
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{stage.icon}</span>
                <span className="font-mono font-bold text-sm" style={{ color: stage.color }}>{stage.label}</span>
              </div>
              <div className="w-2 h-2 rounded-full mb-3" style={{ background: "var(--accent-green)", boxShadow: "0 0 8px var(--accent-green)" }} />
              <div className="font-mono text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{stage.desc}</div>
              <div className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>{stage.metric}</div>
              <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>{stage.detail}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Risk distribution */}
          <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="font-mono text-xs font-bold mb-4" style={{ color: "var(--text-muted)" }}>预警风险分布</div>
            <ReactECharts option={riskPieOption(RISK_DISTRIBUTION)} style={{ height: 220 }} />
          </div>
          {/* 24h trend */}
          <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="font-mono text-xs font-bold mb-4" style={{ color: "var(--text-muted)" }}>24h 预警趋势</div>
            <ReactECharts option={alertTrendOption(trend)} style={{ height: 220 }} />
          </div>
        </div>

        {/* Live alert feed */}
        <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="font-mono text-xs font-bold" style={{ color: "var(--text-muted)" }}>
              实时预警流
              <span className="ml-2 inline-flex items-center gap-1">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: connected ? "var(--accent-green)" : "var(--text-muted)" }}
                />
                <span style={{ color: connected ? "var(--accent-green)" : "var(--text-muted)" }}>
                  {connected ? "已连接" : "已断开"}
                </span>
              </span>
            </div>
            <div className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
              共 {alerts.length} 条
            </div>
          </div>

          {alerts.length === 0 ? (
            <div className="text-center py-12">
              <div className="font-mono text-sm mb-2" style={{ color: "var(--text-muted)" }}>
                等待实时预警数据...
              </div>
              <div className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                点击首页「启动演示」触发 SSE 流
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {alerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} compact />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
