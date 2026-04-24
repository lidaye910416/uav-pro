"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import Sidebar from "../../components/Layout/Sidebar"

// ── Types ─────────────────────────────────────────────────────────────────────

type Stage = "idle" | "perception" | "vision" | "rag" | "decision" | "done"

interface DetectedObject {
  label: string
  confidence: number
  bbox: [number, number, number, number]
}

interface PipelineResult {
  perception: string
  vision: DetectedObject[]
  rag: { title: string; snippet: string; score: number }[]
  decision: { risk: "low" | "medium" | "high" | "critical"; title: string; recommendation: string; confidence: number }
}

// ── Demo data ────────────────────────────────────────────────────────────────

const DEMO_SCENES: PipelineResult[] = [
  {
    perception: "画面显示为高速公路主路北行方向，视野开阔，车流正常通行，未发现异常事件。",
    vision: [
      { label: "vehicle", confidence: 0.97, bbox: [15, 55, 12, 18] },
      { label: "vehicle", confidence: 0.95, bbox: [38, 52, 14, 20] },
      { label: "vehicle", confidence: 0.93, bbox: [62, 58, 11, 16] },
      { label: "road_surface", confidence: 0.99, bbox: [0, 0, 100, 100] },
    ],
    rag: [
      { title: "高速公路正常通行管理 SOP", snippet: "1. 持续监控道路通行状态，记录车流密度与车速…", score: 0.91 },
      { title: "路面障碍物处置规范", snippet: "3. 发现异常立即通知指挥中心，启动联动处置流程…", score: 0.72 },
    ],
    decision: { risk: "low", title: "道路通行正常", recommendation: "持续监控，暂无预警处置建议。", confidence: 0.94 },
  },
  {
    perception: "画面中央偏右位置发现一辆白色轿车停靠在应急车道，开启双闪灯，人员未撤离至护栏外。",
    vision: [
      { label: "vehicle_stopped", confidence: 0.96, bbox: [55, 42, 18, 28] },
      { label: "hazard_light", confidence: 0.88, bbox: [58, 38, 4, 3] },
      { label: "person", confidence: 0.72, bbox: [62, 60, 6, 22] },
      { label: "emergency_lane", confidence: 0.95, bbox: [40, 30, 60, 70] },
    ],
    rag: [
      { title: "应急车道违规停车处置规范", snippet: "1. 开启警示灯、摆放三角牌，人员撤离至护栏外…", score: 0.96 },
      { title: "高速公路故障车辆安全操作规程", snippet: "2. 拍照取证，通知高速交警联合处置，防止二次事故…", score: 0.89 },
    ],
    decision: { risk: "medium", title: "应急车道违规停车", recommendation: "立即通知高速交警，建议派遣救援力量前往处置，同时发布路况预警信息。", confidence: 0.91 },
  },
  {
    perception: "主路应急车道发现散落物（疑似货车掉落的纸箱），后方车辆紧急绕行，存在追尾风险。",
    vision: [
      { label: "debris", confidence: 0.89, bbox: [45, 65, 8, 6] },
      { label: "vehicle_braking", confidence: 0.82, bbox: [68, 50, 12, 18] },
      { label: "vehicle", confidence: 0.94, bbox: [30, 55, 13, 19] },
      { label: "warning_sign", confidence: 0.76, bbox: [70, 45, 6, 8] },
    ],
    rag: [
      { title: "道路遗撒物清理操作流程", snippet: "1. 开启双闪，慢速行驶，设置作业区，报告指挥中心…", score: 0.94 },
      { title: "道路障碍物应急处置 SOP", snippet: "2. 评估风险等级，高风险立即通知交警，低风险拍照存档后清理…", score: 0.85 },
    ],
    decision: { risk: "high", title: "道路散落物险情", recommendation: "高风险！立即通知高速交警与路政部门，限制后方车辆通行速度，派遣养护人员前往清理。", confidence: 0.88 },
  },
  {
    perception: "应急车道发现行人正在翻越护栏进入高速公路主路，情况紧急，需立即处置。",
    vision: [
      { label: "person", confidence: 0.95, bbox: [52, 45, 8, 25] },
      { label: "fence_breach", confidence: 0.91, bbox: [48, 30, 16, 40] },
      { label: "vehicle", confidence: 0.88, bbox: [70, 55, 14, 20] },
      { label: "emergency_lane", confidence: 0.93, bbox: [40, 30, 60, 70] },
    ],
    rag: [
      { title: "行人闯入高危区域处置 SOP", snippet: "1. 立即通知交警，配合疏散，防止二次事故发生…", score: 0.97 },
      { title: "高速公路安全管理规范", snippet: "2. 设置警示区域，广播提醒过往车辆减速慢行…", score: 0.83 },
    ],
    decision: { risk: "critical", title: "行人闯入高危区域", recommendation: "紧急！立即通知高速交警与急救中心，限制相关路段通行，配合疏散行人，通知周边巡逻力量支援。", confidence: 0.93 },
  },
]

const RISK_COLORS: Record<string, string> = {
  low: "var(--accent-green)",
  medium: "var(--accent-blue)",
  high: "var(--accent-amber)",
  critical: "var(--accent-red)",
}

const RISK_LABELS: Record<string, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
  critical: "严重",
}

// ── Stream text effect ───────────────────────────────────────────────────────

function useStreamText(text: string, active: boolean, speed = 30) {
  const [displayed, setDisplayed] = useState("")

  useEffect(() => {
    if (!active) { setDisplayed(""); return }
    setDisplayed("")
    let i = 0
    const id = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(id)
    }, speed)
    return () => clearInterval(id)
  }, [text, active, speed])

  return displayed
}

// ── Bounding box overlay ──────────────────────────────────────────────────────

function BboxOverlay({ objects }: { objects: DetectedObject[] }) {
  const colors = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#c77dff", "#ff9f43"]
  return (
    <div className="absolute inset-0">
      {objects.map((obj, i) => (
        <div
          key={i}
          className="absolute border-2 rounded"
          style={{
            left: `${obj.bbox[0]}%`,
            top: `${obj.bbox[1]}%`,
            width: `${obj.bbox[2]}%`,
            height: `${obj.bbox[3]}%`,
            borderColor: colors[i % colors.length],
            background: `${colors[i % colors.length]}15`,
          }}
        >
          <span
            className="absolute -top-5 left-0 text-xs px-1.5 py-0.5 rounded-t font-mono font-bold"
            style={{ background: colors[i % colors.length], color: "#000" }}
          >
            {obj.label} {(obj.confidence * 100).toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Pipeline stage row ────────────────────────────────────────────────────────

function PipelineStageRow({
  label,
  icon,
  color,
  active,
  completed,
  description,
  subText,
}: {
  label: string
  icon: string
  color: string
  active: boolean
  completed: boolean
  description: string
  subText?: string
}) {
  const pulseRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) return
    const el = pulseRef.current
    if (!el) return
    el.style.animation = "none"
    el.offsetHeight
    el.style.animation = "pulseRing 1.2s ease-out infinite"
  }, [active])

  return (
    <div
      className="relative flex items-start gap-4 p-4 rounded-2xl transition-all duration-500"
      style={{
        background: active ? `${color}0a` : completed ? `${color}06` : "rgba(255,255,255,0.02)",
        border: `1px solid ${active ? color : completed ? `${color}60` : "rgba(255,255,255,0.06)"}`,
        boxShadow: active ? `0 0 20px ${color}20, inset 0 0 20px ${color}08` : "none",
        opacity: completed ? 0.7 : active ? 1 : 0.4,
      }}
    >
      {active && (
        <div
          ref={pulseRef}
          className="absolute left-4 top-4 w-10 h-10 rounded-xl"
          style={{ background: `${color}20` }}
        />
      )}

      <div
        className="relative w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0 transition-all duration-500"
        style={{
          background: active ? color : `${color}20`,
          color: active ? "#000" : color,
          boxShadow: active ? `0 0 16px ${color}` : "none",
        }}
      >
        {completed ? "✓" : icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold font-mono" style={{ color: active ? color : completed ? `${color}cc` : "var(--text-muted)" }}>
            {label}
          </span>
          {active && (
            <span className="text-xs font-mono animate-pulse" style={{ color }}>RUNNING...</span>
          )}
          {completed && !active && (
            <span className="text-xs font-mono" style={{ color: `${color}99` }}>DONE</span>
          )}
        </div>
        <div className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {description}
        </div>
        {subText && (
          <div className="text-xs mt-1 font-mono" style={{ color: `${color}cc` }}>
            {subText}
          </div>
        )}
      </div>

      {active && (
        <div
          className="absolute bottom-0 left-0 h-0.5 rounded-b transition-all"
          style={{
            background: `linear-gradient(to right, ${color}, transparent)`,
            width: "100%",
            animation: "progressBar 4s linear forwards",
          }}
        />
      )}
    </div>
  )
}

// ── Streaming output panel ────────────────────────────────────────────────────

function StreamingPanel({ stage, result }: { stage: Stage; result: PipelineResult | null }) {
  const displayedPerception = useStreamText(
    result?.perception || "",
    stage === "perception" || stage === "vision" || stage === "rag" || stage === "decision" || stage === "done",
    25
  )
  const displayedTitle = useStreamText(
    result?.decision.title || "",
    stage === "decision" || stage === "done",
    40
  )
  const displayedRec = useStreamText(
    result?.decision.recommendation || "",
    stage === "decision" || stage === "done",
    18
  )
  const riskColor = result ? RISK_COLORS[result.decision.risk] : "var(--text-muted)"

  const stageLabel: Record<string, string> = {
    idle: "等待启动演示...",
    perception: "◉ 视觉感知中...",
    vision: "◆ 视觉识别中...",
    rag: "◫ RAG 检索中...",
    decision: "◈ 决策生成中...",
    done: "✓ 推理完成",
  }

  return (
    <div
      className="rounded-2xl overflow-hidden h-full flex flex-col"
      style={{
        background: "rgba(10,10,10,0.95)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 0 40px rgba(0,0,0,0.6)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: "var(--accent-amber)", color: "#000" }}>
          ◉
        </div>
        <div>
          <div className="text-xs font-bold font-mono" style={{ color: "var(--accent-amber)" }}>
            PIPELINE · 实时输出
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {stageLabel[stage]}
          </div>
        </div>
        {stage !== "idle" && (
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--accent-green)", boxShadow: "0 0 6px var(--accent-green)" }} />
            <span className="text-xs font-mono" style={{ color: "var(--accent-green)" }}>LIVE</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Perception */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span style={{ color: "var(--accent-green)" }}>◉</span>
            <span className="text-xs font-bold font-mono" style={{ color: "var(--accent-green)" }}>视觉感知</span>
          </div>
          {displayedPerception ? (
            <div className="p-3 rounded-xl text-xs leading-relaxed" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}>
              {displayedPerception}
              {stage === "perception" && <span className="animate-pulse"> ▌</span>}
            </div>
          ) : (
            <div className="p-3 rounded-xl text-xs" style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
              等待感知输出...
            </div>
          )}
        </div>

        {/* Vision */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span style={{ color: "var(--accent-purple)" }}>◆</span>
            <span className="text-xs font-bold font-mono" style={{ color: "var(--accent-purple)" }}>视觉识别</span>
          </div>
          {result?.vision.length ? (
            <div className="space-y-1.5">
              {result.vision.map((obj, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <span className="px-1.5 py-0.5 rounded text-xs font-bold font-mono" style={{ background: "rgba(139,92,246,0.15)", color: "var(--accent-purple)" }}>
                    {obj.label}
                  </span>
                  <span className="font-mono" style={{ color: "var(--text-muted)" }}>
                    {(obj.confidence * 100).toFixed(1)}% 置信
                  </span>
                  <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
                    坐标: ({obj.bbox[0].toFixed(0)}%, {obj.bbox[1].toFixed(0)}%)
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 rounded-xl text-xs" style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
              等待检测结果...
            </div>
          )}
        </div>

        {/* RAG */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span style={{ color: "var(--accent-blue)" }}>◫</span>
            <span className="text-xs font-bold font-mono" style={{ color: "var(--accent-blue)" }}>RAG 检索</span>
          </div>
          {result?.rag.length ? (
            <div className="space-y-2">
              {result.rag.map((r, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl text-xs transition-all"
                  style={{ background: "rgba(74,158,255,0.06)", border: `1px solid rgba(74,158,255,${0.15 + i * 0.1})` }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold" style={{ color: "var(--accent-blue)" }}>{r.title}</span>
                    <span className="ml-auto font-mono text-xs" style={{ color: "var(--accent-green)" }}>
                      {r.score >= 0.9 ? "强相关" : r.score >= 0.8 ? "相关" : "弱相关"} {(r.score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ color: "var(--text-secondary)" }}>{r.snippet}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 rounded-xl text-xs" style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
              等待检索结果...
            </div>
          )}
        </div>

        {/* Decision */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span style={{ color: riskColor }}>◈</span>
            <span className="text-xs font-bold font-mono" style={{ color: riskColor }}>决策生成</span>
          </div>
          {displayedTitle || result ? (
            <div className="rounded-xl p-4 text-xs" style={{ background: `${riskColor}08`, border: `1px solid ${riskColor}30` }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold font-mono" style={{ background: `${riskColor}20`, color: riskColor }}>
                  {result ? RISK_LABELS[result.decision.risk] : "处理中"}
                </span>
                <span className="font-bold" style={{ color: "var(--text-primary)" }}>
                  {displayedTitle}
                  {stage === "decision" && <span className="animate-pulse"> ▌</span>}
                </span>
                {result && (
                  <span className="ml-auto font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                    {(result.decision.confidence * 100).toFixed(1)}% 置信
                  </span>
                )}
              </div>
              <div className="leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {displayedRec}
                {stage === "decision" && !displayedRec && <span className="animate-pulse"> ▌</span>}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl text-xs" style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
              等待决策生成...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Video thumb strip ────────────────────────────────────────────────────────

function VideoThumbStrip({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(10,10,10,0.95)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="px-4 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="text-xs font-bold font-mono" style={{ color: "var(--accent-amber)" }}>◉ FRAME EXTRACTION</span>
      </div>
      <div className="flex gap-2 p-3">
        {DEMO_SCENES.map((_, i) => (
          <div
            key={i}
            className="relative flex-shrink-0 rounded-lg overflow-hidden transition-all duration-500"
            style={{
              width: 72,
              height: 54,
              background: i === activeIndex ? "var(--accent-amber)" : "rgba(255,255,255,0.05)",
              border: `2px solid ${i === activeIndex ? "var(--accent-amber)" : "rgba(255,255,255,0.1)"}`,
              boxShadow: i === activeIndex ? "0 0 12px var(--accent-amber)" : "none",
              opacity: i <= activeIndex ? 1 : 0.35,
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-mono font-bold" style={{ color: i === activeIndex ? "#000" : "var(--text-muted)" }}>
                F{i + 1}
              </span>
            </div>
            {i === activeIndex && (
              <div className="absolute inset-0 animate-pulse" style={{ background: "rgba(255,184,0,0.12)" }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Risk card ───────────────────────────────────────────────────────────────

function RiskCard({ risk, demoRunning }: { risk: string; demoRunning: boolean }) {
  const color = RISK_COLORS[risk] || "var(--text-muted)"
  const label = RISK_LABELS[risk] || "未知"
  const width = risk === "low" ? "25%" : risk === "medium" ? "50%" : risk === "high" ? "75%" : "100%"

  return (
    <div
      className="rounded-xl p-4 text-center transition-all duration-700"
      style={{
        background: `${color}08`,
        border: `1px solid ${color}40`,
        boxShadow: demoRunning ? `0 0 20px ${color}20` : "none",
      }}
    >
      <div className="text-xs font-mono mb-2" style={{ color: "var(--text-muted)" }}>综合风险等级</div>
      <div className="text-3xl font-bold font-mono mb-1" style={{ color }}>{label}</div>
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width, background: color, boxShadow: `0 0 8px ${color}` }}
        />
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function BrainPage() {
  const [demoRunning, setDemoRunning] = useState(false)
  const [stage, setStage] = useState<Stage>("idle")
  const [sceneIndex, setSceneIndex] = useState(0)
  const [result, setResult] = useState<PipelineResult | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const runDemo = useCallback(() => {
    if (demoRunning) {
      // Stop: clear all pending timers
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
      setDemoRunning(false)
      setStage("idle")
      setResult(null)
      setSceneIndex(0)
      return
    }
    // Start
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setDemoRunning(true)
    setSceneIndex(0)
    setStage("idle")
    setResult(null)
    const video = videoRef.current
    if (video) { video.currentTime = 0; video.play().catch(() => {}) }
  }, [demoRunning])

  // Demo sequence orchestrator — single stable effect, no sceneIndex dep
  useEffect(() => {
    if (!demoRunning) return

    let idx = 0

    function runScene(index: number) {
      // Clear previous timers for this orchestrator
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []

      const scene = DEMO_SCENES[index]
      if (!scene) { setDemoRunning(false); return }

      // Immediately set result so right panel has data
      setResult(scene)
      setSceneIndex(index)

      const t0 = 100
      const tVision = 3000
      const tRag = 5500
      const tDecision = 8000
      const tDone = 11000
      const tNext = 13000

      timersRef.current.push(setTimeout(() => setStage("perception"), t0))
      timersRef.current.push(setTimeout(() => setStage("vision"), tVision))
      timersRef.current.push(setTimeout(() => setStage("rag"), tRag))
      timersRef.current.push(setTimeout(() => setStage("decision"), tDecision))
      timersRef.current.push(setTimeout(() => setStage("done"), tDone))

      timersRef.current.push(setTimeout(() => {
        const next = index < DEMO_SCENES.length - 1 ? index + 1 : 0
        runScene(next)
      }, tNext))
    }

    runScene(0)

    return () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    }
  }, [demoRunning]) // intentionally stable — no sceneIndex dep

  // Reset UI when demo stops
  useEffect(() => {
    if (!demoRunning) {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
      setStage("idle")
      setResult(null)
      setSceneIndex(0)
    }
  }, [demoRunning])

  const isPerception = stage === "perception"
  const isVision = stage === "vision"
  const isRag = stage === "rag"
  const isDecision = stage === "decision"
  const isDone = stage === "done"

  return (
    <>
      {/* Hidden video element for frame extraction */}
      <video
        ref={videoRef}
        src="http://localhost:8000/api/v1/demo/video?video_id=d1"
        style={{ display: "none" }}
        muted
        loop={false}
      />

      <Sidebar />
      <div
        className="min-h-screen ml-60 flex flex-col"
        style={{ fontFamily: "'JetBrains Mono', monospace", background: "#080808" }}
      >
        <style>{`
          @keyframes pulseRing {
            0% { transform: scale(1); opacity: 0.8; }
            100% { transform: scale(1.6); opacity: 0; }
          }
          @keyframes progressBar {
            from { width: 0%; }
            to { width: 100%; }
          }
          @keyframes glowPulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
        `}</style>

        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.3)" }}
        >
          <div>
            <h1 className="text-2xl font-bold tracking-widest" style={{ color: "var(--text-primary)" }}>
              感知中心 · 智能推理演示
            </h1>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              ◈ 单模型 Pipeline · Gemma 4B E2B 多模态推理 · 实时视频流理解
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div
              className="px-4 py-2 rounded-xl text-xs font-mono font-bold"
              style={{ background: "rgba(255,184,0,0.1)", border: "1px solid rgba(255,184,0,0.3)", color: "var(--accent-amber)" }}
            >
              ◈ 单模型 · Gemma 4B E2B
            </div>
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  background: demoRunning ? "var(--accent-green)" : "var(--text-muted)",
                  boxShadow: demoRunning ? "0 0 6px var(--accent-green)" : "none",
                  animation: demoRunning ? "glowPulse 1.5s ease-in-out infinite" : "none",
                }}
              />
              <span style={{ color: demoRunning ? "var(--accent-green)" : "var(--text-muted)" }}>
                {demoRunning ? "PIPELINE RUNNING" : "IDLE"}
              </span>
            </div>
            <button
              onClick={runDemo}
              className="px-6 py-2.5 rounded-xl text-sm font-bold font-mono transition-all"
              style={{
                background: demoRunning ? "var(--accent-red)" : "var(--accent-amber)",
                color: demoRunning ? "#fff" : "#000",
                boxShadow: demoRunning ? "0 0 16px rgba(255,80,80,0.3)" : "0 0 16px rgba(255,184,0,0.3)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {demoRunning ? "■ 停止演示" : "▶ 启动演示"}
            </button>
          </div>
        </div>

        {/* Main area: left pipeline stages + right output */}
        <div className="flex-1 flex gap-4 p-4 overflow-hidden">
          {/* Left column */}
          <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
            <div
              className="rounded-xl px-4 py-2 text-xs font-mono"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-muted)" }}
            >
              当前场景: T1-D1 · 主路北行 · UAV-01
              {demoRunning && <span className="ml-2" style={{ color: "var(--accent-amber)" }}>帧 {sceneIndex + 1}/{DEMO_SCENES.length}</span>}
            </div>

            {/* 4 pipeline stages */}
            <div className="space-y-3">
              <PipelineStageRow
                label="感知层"
                icon="◉"
                color="var(--accent-green)"
                active={isPerception}
                completed={isVision || isRag || isDecision || isDone}
                description="接收视频帧流，通过多模态模型理解画面整体场景与上下文"
                subText={isPerception ? "Gemma 4B E2B 多模态推理中..." : isVision || isRag || isDecision || isDone ? `场景: ${result?.perception?.slice(0, 28)}...` : undefined}
              />
              <PipelineStageRow
                label="视觉识别"
                icon="◆"
                color="var(--accent-purple)"
                active={isVision}
                completed={isRag || isDecision || isDone}
                description="YOLO v8 目标检测，识别车辆、行人、障碍物等关键要素"
                subText={isVision ? "目标检测中..." : isRag || isDecision || isDone ? `${result?.vision.length} 个目标已识别` : undefined}
              />
              <PipelineStageRow
                label="RAG 检索"
                icon="◫"
                color="var(--accent-blue)"
                active={isRag}
                completed={isDecision || isDone}
                description="从 SOP 知识库检索相关规范，匹配当前场景"
                subText={isRag ? "知识库检索中..." : isDecision || isDone ? `${result?.rag.length} 条 SOP 规范已匹配` : undefined}
              />
              <PipelineStageRow
                label="决策生成"
                icon="◈"
                color={result ? RISK_COLORS[result.decision.risk] : "var(--accent-amber)"}
                active={isDecision}
                completed={isDone}
                description="综合感知 + 检测 + RAG，生成风险等级与处置建议"
                subText={isDecision ? "LLM 推理中..." : isDone ? `${result?.decision.title}` : undefined}
              />
            </div>

            {/* Frame extraction strip */}
            <VideoThumbStrip activeIndex={sceneIndex} />

            {/* Risk card */}
            <RiskCard risk={result?.decision.risk || "low"} demoRunning={demoRunning} />

            {/* Pipeline info */}
            <div
              className="rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="text-xs font-bold mb-3" style={{ color: "var(--text-muted)" }}>当前 Pipeline</div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span style={{ color: "var(--accent-green)" }}>◉</span>
                  <span style={{ color: "var(--text-secondary)" }}>Gemma 4B E2B</span>
                  <span className="ml-auto" style={{ color: "var(--text-muted)" }}>多模态感知</span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ color: "var(--accent-purple)" }}>◆</span>
                  <span style={{ color: "var(--text-secondary)" }}>YOLO v8</span>
                  <span className="ml-auto" style={{ color: "var(--text-muted)" }}>目标检测</span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ color: "var(--accent-blue)" }}>◫</span>
                  <span style={{ color: "var(--text-secondary)" }}>SOP 知识库</span>
                  <span className="ml-auto" style={{ color: "var(--text-muted)" }}>RAG 检索</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: animated output */}
          <div className="flex-1 min-w-0">
            <StreamingPanel stage={stage} result={result} />
          </div>
        </div>

        {/* Bottom: 6 video cards */}
        <div className="px-4 pb-4" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="flex items-center gap-2 mb-3 mt-3">
            <span style={{ color: "var(--accent-amber)" }}>◉</span>
            <span className="text-xs font-bold font-mono" style={{ color: "var(--text-muted)" }}>
              视频流输入 · T1_D1~T1_D6
            </span>
          </div>
          <div className="grid grid-cols-6 gap-3">
            {[
              { label: "T1-D1 · 1号机", device: "UAV-01", desc: "主路北行", color: "var(--accent-amber)", active: true, id: "d1" },
              { label: "T1-D2 · 2号机", device: "UAV-02", desc: "主路南行", color: "var(--accent-green)", active: true, id: "d2" },
              { label: "T1-D3 · 3号机", device: "UAV-03", desc: "应急车道", color: "var(--accent-blue)", active: true, id: "d3" },
              { label: "T1-D4 · 4号机", device: "UAV-04", desc: "桥梁区域", color: "var(--accent-purple)", active: true, id: "d4" },
              { label: "T1-D5 · 5号机", device: "UAV-05", desc: "弯道区域", color: "var(--accent-amber)", active: false, id: "d5" },
              { label: "T1-D6 · 6号机", device: "UAV-06", desc: "分流合流区", color: "var(--accent-green)", active: false, id: "d6" },
            ].map((v) => (
              <div
                key={v.id}
                className="relative rounded-xl overflow-hidden transition-all"
                style={{
                  background: "rgba(16,16,16,0.9)",
                  border: `1px solid ${v.active ? `${v.color}40` : "rgba(255,255,255,0.06)"}`,
                  opacity: v.active ? 1 : 0.4,
                  boxShadow: v.active && demoRunning && v.id === "d1" ? `0 0 12px ${v.color}30` : "none",
                }}
              >
                <div className="relative" style={{ aspectRatio: "16/9" }}>
                  {v.active ? (
                    <>
                      <video
                        src={`http://localhost:8000/api/v1/demo/video?video_id=${v.id}`}
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="w-full h-full"
                        style={{ objectFit: "cover" }}
                        onError={(e) => { (e.target as HTMLVideoElement).style.display = "none" }}
                      />
                      {v.id === "d1" && result && <BboxOverlay objects={result.vision} />}
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>未启用</span>
                    </div>
                  )}
                </div>
                <div className="px-2 py-1.5" style={{ borderTop: `1px solid ${v.color}20` }}>
                  <div className="text-xs font-bold" style={{ color: v.color }}>{v.label}</div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>{v.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
