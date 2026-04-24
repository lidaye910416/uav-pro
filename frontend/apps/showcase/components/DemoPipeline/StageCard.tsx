"use client"
import { useState, useEffect, useRef } from "react"

export type StageStatus = "idle" | "running" | "done" | "error"

export interface StageCardData {
  stage: string
  label: string
  icon: string
  color: string
  status: StageStatus
  progress: number
  summary?: string
  detail?: string | Record<string, unknown>
  snippets?: string[]
  query?: string
  errorMsg?: string
  index: number
  revealed: boolean     // true = expand animation triggered
  revealDelay: number   // ms delay before content block reveals
}

// ── Keyword highlight ───────────────────────────────────────────────────────────

const VISION_KWS = ["车辆", "行人", "障碍物", "应急车道", "事故", "拥堵", "遗撒", "闯入", "违规", "异常"]
const RAG_KWS    = ["应急车道", "违规停车", "道路遗撒", "交通事故", "行人闯入", "交通拥堵", "处置", "规范", "通知"]

function highlight(text: string, kws: string[]): React.ReactNode {
  if (!text) return <>{text}</>
  const lower = text.toLowerCase()
  const matches: { k: string; start: number; end: number }[] = []
  for (const kw of kws) {
    let pos = 0
    while (true) {
      const idx = lower.indexOf(kw, pos)
      if (idx === -1) break
      matches.push({ k: kw, start: idx, end: idx + kw.length })
      pos = idx + 1
    }
  }
  matches.sort((a, b) => a.start - b.start)
  const filtered = matches.filter((m, i) => i === 0 || m.start >= matches[i - 1].end)
  const parts: React.ReactNode[] = []
  let last = 0
  for (const m of filtered) {
    if (m.start > last) parts.push(text.slice(last, m.start))
    parts.push(<mark key={`${m.start}`} style={{ background: "rgba(255,184,0,0.2)", color: "var(--accent-amber)", borderRadius: 2 }}>{text.slice(m.start, m.end)}</mark>)
    last = m.end
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

// ── Typewriter ────────────────────────────────────────────────────────────────

function useTypewriter(text: string, speed = 18, active = false) {
  const [displayed, setDisplayed] = useState("")
  const [done, setDone] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!active || !text) { setDisplayed(text || ""); setDone(true); return }
    setDisplayed("")
    setDone(false)
    let i = 0
    function tick() {
      i = Math.min(i + 2, text.length)
      setDisplayed(text.slice(0, i))
      if (i >= text.length) { setDone(true); return }
      timerRef.current = setTimeout(tick, speed)
    }
    timerRef.current = setTimeout(tick, speed)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [text, active, speed])
  return { displayed, done }
}

// ── Per-stage running renderers ───────────────────────────────────────────────

function PerceptionRunning({ detail }: { detail?: string | Record<string, unknown> }) {
  const d = (typeof detail === "object" && detail ? detail : {}) as Record<string, unknown>
  const frameIdx = d.frame_idx != null ? String(d.frame_idx) : "000"
  const ts = (d.timestamp as string) || "00:00.0"
  const res = (d.resolution as string) || "3840×2160"
  const fps = d.fps != null ? String(d.fps) : "25"
  const src = (d.stream_src as string) || "—"
  return (
    <div className="mt-3 font-mono text-xs space-y-1">
      {[
        { label: "FRAME_IDX",   value: String(frameIdx).padStart(5, "0") },
        { label: "TIMESTAMP",   value: ts },
        { label: "RESOLUTION",  value: res },
        { label: "FPS",         value: fps },
        { label: "STREAM_SRC",  value: src },
      ].map((item, i) => (
        <div key={item.label} className="flex gap-3" style={{ animation: `fadeUp 0.5s ease-out ${i * 0.15}s both` }}>
          <span style={{ color: "var(--accent-amber)", opacity: 0.6, minWidth: 110 }}>{item.label}:</span>
          <span style={{ color: "var(--accent-green)" }}>{item.value}_</span>
          <span style={{ color: "var(--accent-amber)", opacity: 0.5 }}>◈</span>
        </div>
      ))}
    </div>
  )
}

function PerceptionDone({ detail }: { detail?: string | Record<string, unknown> }) {
  const d = (typeof detail === "object" && detail ? detail : {}) as Record<string, unknown>
  const frameIdx = d.frame_idx != null ? String(d.frame_idx) : "—"
  const ts = (d.timestamp as string) || "—"
  const res = (d.resolution as string) || "—"
  const fps = d.fps != null ? String(d.fps) : "—"
  const lines = [
    { label: "FRAME_IDX",   value: frameIdx },
    { label: "TIMESTAMP",   value: ts },
    { label: "RESOLUTION",  value: res },
    { label: "FPS",         value: fps },
    { label: "STATUS",      value: "✓ CAPTURED" },
  ]
  // Force remount on detail change so CSS animations replay
  const [key, setKey] = useState(0)
  useEffect(() => { setKey((k) => k + 1) }, [detail])
  return (
    <div key={key} className="mt-3 font-mono text-xs space-y-1">
      {lines.map((item, i) => (
        <div key={item.label} className="flex gap-3 done-line" style={{ animationDelay: `${i * 0.18}s` }}>
          <span style={{ color: "var(--accent-amber)", opacity: 0.6, minWidth: 110 }}>{item.label}:</span>
          <span style={{ color: "var(--accent-green)" }}>{item.value}</span>
        </div>
      ))}
    </div>
  )
}

function VisionRunning({ progress }: { progress: number }) {
  const dots = ".".repeat(Math.floor(progress / 8) % 4)
  return (
    <div className="mt-3 font-mono text-xs">
      <div style={{ color: "var(--accent-green)", opacity: 0.5, fontSize: 10, marginBottom: 4 }}>
        {">"} LLM VISION ANALYSIS{dots} ◈
      </div>
      <div className="p-2 rounded" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--accent-green)" }} />
          <span style={{ color: "var(--text-muted)" }}>正在分析图像...</span>
        </div>
        <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-secondary)" }}>
          <div className="h-full rounded-full animate-pulse" style={{ width: `${Math.min(progress * 2, 95)}%`, background: "var(--accent-green)" }} />
        </div>
      </div>
    </div>
  )
}

// VisionDone: typewriter resets when detail changes (new scene)
function VisionDone({ detail, revealed }: { detail?: string | Record<string, unknown>; revealed: boolean }) {
  const text = typeof detail === "string" ? detail : ""
  // Key trick: remount on detail change so typewriter restarts on new scene
  const [key, setKey] = useState(0)
  useEffect(() => {
    setKey((k) => k + 1)
  }, [detail])
  const { displayed, done } = useTypewriter(text, 28, revealed)
  return (
    <div key={key} className="mt-3 font-mono text-xs leading-relaxed">
      <div className="done-line" style={{ animationDelay: "0s", marginBottom: 8 }}>
        <span style={{ color: "var(--accent-green)", opacity: 0.5, fontSize: 10 }}>
          {">"} LLM VISION OUTPUT {!done && " ◈"}
        </span>
      </div>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: "var(--text-secondary)",
          background: "var(--bg-primary)",
          padding: "8px",
          borderRadius: 6,
          border: "1px solid var(--border)",
          maxHeight: 160,
          overflowY: "auto",
          fontFamily: "var(--font-mono,monospace)",
          fontSize: 11,
        }}
        className={!done ? "tw-cursor" : undefined}
      >
        {highlight(displayed, VISION_KWS)}
      </pre>
    </div>
  )
}

function RagRunning() {
  return (
    <div className="mt-3 font-mono text-xs">
      <div style={{ color: "var(--accent-blue)", opacity: 0.5, fontSize: 10, marginBottom: 4 }}>
        {">"} RAG VECTOR SEARCH ◈
      </div>
      <div className="p-2 rounded" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--accent-blue)" }} />
          <span style={{ color: "var(--text-muted)" }}>正在检索 ChromaDB...</span>
        </div>
        <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-secondary)" }}>
          <div className="h-full rounded-full animate-pulse" style={{ width: "60%", background: "var(--accent-blue)" }} />
        </div>
      </div>
    </div>
  )
}

// RagDone: snippet staggered reveal; key trick resets on new scene
function RagDone({ snippets, query }: { snippets?: string[]; query?: string }) {
  // Force remount on snippets change so CSS animations replay
  const [key, setKey] = useState(0)
  useEffect(() => { setKey((k) => k + 1) }, [snippets])
  return (
    <div key={key} className="mt-3 font-mono text-xs">
      <div className="done-line" style={{ animationDelay: "0s", marginBottom: 8 }}>
        <span style={{ color: "var(--accent-blue)", opacity: 0.5, fontSize: 10 }}>
          {">"} RAG RETRIEVAL — {(snippets?.length || 0)} 条规范 ✓
        </span>
      </div>
      {query && (
        <div className="done-line" style={{ animationDelay: "0.08s", marginBottom: 8 }}>
          <span style={{ color: "var(--text-muted)", fontSize: 10 }}>
            查询: {highlight((query || "").slice(0, 60), RAG_KWS)}
          </span>
        </div>
      )}
      <div className="space-y-1.5">
        {(snippets || []).slice(0, 3).map((s, i) => (
          <div
            key={i}
            className="done-snippet"
            style={{
              animationDelay: `${0.3 + i * 0.35}s`,
              padding: "8px",
              borderRadius: 6,
              background: "var(--bg-primary)",
              border: "1px solid var(--border)",
              borderLeft: "2px solid var(--accent-blue)",
            }}
          >
            <div style={{ color: "var(--text-secondary)", lineHeight: 1.6, fontSize: 11 }}>
              {highlight(s, RAG_KWS)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DecisionRunning() {
  return (
    <div className="mt-3 font-mono text-xs">
      <div style={{ color: "var(--accent-purple)", opacity: 0.5, fontSize: 10, marginBottom: 4 }}>
        {">"} LLM DECISION INFERENCE ◈
      </div>
      <div className="p-2 rounded" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--accent-purple)" }} />
          <span style={{ color: "var(--text-muted)" }}>正在推理风险等级...</span>
        </div>
        <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-secondary)" }}>
          <div className="h-full rounded-full animate-pulse" style={{ width: "75%", background: "var(--accent-purple)" }} />
        </div>
      </div>
    </div>
  )
}

// DecisionDone: JSON fields reveal one by one; key trick resets on new scene
function DecisionDone({ detail }: { detail?: string | Record<string, unknown> }) {
  const d = (typeof detail === "object" && detail ? detail : {}) as Record<string, unknown>
  const RISK_COLOR: Record<string, string> = {
    critical: "var(--accent-red)",
    high:     "var(--accent-amber)",
    medium:   "var(--accent-blue)",
    low:      "var(--accent-green)",
  }
  const risk = String(d.risk_level || "low")
  const conf = typeof d.confidence === "number" ? `${(d.confidence * 100).toFixed(0)}%` : "—"

  const lines = [
    { label: "risk_level",    value: risk,                          color: RISK_COLOR[risk] || "var(--border)", delay: 0.0  },
    { label: "should_alert",  value: String(d.should_alert ?? false), color: "var(--accent-green)",              delay: 0.5 },
    { label: "confidence",    value: conf,                          color: "var(--accent-blue)",               delay: 1.0 },
    ...(d.title ? [{ label: "title", value: String(d.title), color: "var(--text-primary)" as string, delay: 1.5 as number }] : []),
    ...(d.recommendation ? [{ label: "recommendation", value: `${String(d.recommendation).slice(0, 30)}...`, color: "var(--text-secondary)" as string, delay: 2.0 as number }] : []),
  ]

  // Force remount on detail change so CSS animations replay
  const [key, setKey] = useState(0)
  useEffect(() => { setKey((k) => k + 1) }, [detail])

  return (
    <div key={key} className="mt-3 font-mono text-xs">
      <div className="done-line" style={{ animationDelay: "0s", marginBottom: 8 }}>
        <span style={{ color: "var(--accent-purple)", opacity: 0.5, fontSize: 10 }}>
          {">"} DECISION OUTPUT ✓
        </span>
      </div>
      <div
        style={{
          background: "var(--bg-primary)",
          padding: "10px 12px",
          borderRadius: 6,
          border: `1px solid ${RISK_COLOR[risk] || "var(--border)"}`,
          fontFamily: "var(--font-mono,monospace)",
          fontSize: 11,
          lineHeight: 1.8,
        }}
      >
        {lines.map((line) => (
          <div key={line.label} className="done-line" style={{ animationDelay: `${line.delay}s` }}>
            <span style={{ color: line.color, fontWeight: "bold" }}>{`"${line.label}": `}</span>
            <span style={{ color: line.color }}>{`"${line.value}"`}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main StageCard ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<StageStatus, string> = {
  idle:   "var(--text-muted)",
  running: "var(--accent-amber)",
  done:   "var(--accent-green)",
  error:  "var(--accent-red)",
}

export default function StageCard(props: StageCardData) {
  const { stage, label, icon, color, status, progress, detail, snippets, query, errorMsg, index, revealed } = props

  // Auto-expand when running → done, never collapse back to idle layout
  const expanded = status === "running" || (status === "done")

  return (
    <div
      className="rounded-xl transition-all duration-500 animate-fade-in"
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${
          status === "running" ? color
            : status === "done" ? "var(--accent-green)"
            : status === "error" ? "var(--accent-red)"
            : "var(--border)"
        }`,
        boxShadow: status === "running" ? `0 0 20px ${color}35` : "none",
        opacity: status === "idle" ? 0.5 : 1,
        animationDelay: `${index * 0.15}s`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-sm font-bold transition-all"
          style={{
            background: status === "running" ? color : status === "done" ? "var(--accent-green)" : status === "error" ? "var(--accent-red)" : "var(--bg-primary)",
            color: status === "idle" ? "var(--text-muted)" : "#000",
            boxShadow: status === "running" ? `0 0 10px ${color}` : "none",
          }}
        >
          {status === "done" ? "✓" : status === "running" ? icon : status === "error" ? "✗" : index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold" style={{ color }}>{label}</span>
            <span className="text-xs" style={{ color: STATUS_COLORS[status] }}>
              {status === "idle" ? "○ 等待中"
               : status === "running" ? "◈ 运行中"
               : status === "done" ? "✓ 完成"
               : "✗ 错误"}
            </span>
          </div>
          {errorMsg ? (
            <div className="text-xs mt-0.5 truncate" style={{ color: "var(--accent-red)" }}>{errorMsg}</div>
          ) : status === "running" ? (
            <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>◈ 实时分析中...</div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {status === "running" && (
            <div className="w-20 h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-primary)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(progress, 95)}%`, background: color, boxShadow: `0 0 4px ${color}` }} />
            </div>
          )}
          {expanded && (
            <span
              className="text-xs"
              style={{ color: "var(--text-muted)", transform: "rotate(180deg)", display: "inline-block" }}
            >
              ▾
            </span>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4" style={{ borderTop: `1px solid ${color}25` }}>
          {stage === "perception" && status === "running" && <PerceptionRunning detail={detail} />}
          {stage === "perception" && status === "done"    && <PerceptionDone    detail={detail} />}
          {stage === "vision"     && status === "running" && <VisionRunning      progress={progress} />}
          {stage === "vision"     && status === "done"    && <VisionDone         detail={detail} revealed={revealed} />}
          {stage === "rag"        && status === "running" && <RagRunning />}
          {stage === "rag"        && status === "done"    && <RagDone            snippets={snippets} query={query} />}
          {stage === "decision"   && status === "running" && <DecisionRunning />}
          {stage === "decision"   && status === "done"    && <DecisionDone       detail={detail} />}
        </div>
      )}
      {status === "error" && (
        <div className="px-4 pb-4 pt-2 text-xs" style={{ color: "var(--accent-red)" }}>{errorMsg || "处理失败"}</div>
      )}
    </div>
  )
}
