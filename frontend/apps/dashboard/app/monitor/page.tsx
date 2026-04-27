"use client"
import { useState, useEffect, useCallback } from "react"
import Sidebar from "../../components/Layout/Sidebar"
import { useAlertStream, StreamAlert } from "../../hooks/useAlertStream"
import { PipelineStageCard } from "../../components/PipelineStageCard"

type VideoId = "d1" | "d2" | "d3" | "d4" | "d5" | "d6" | "default"
type PipelineMode = "single" | "dual"

interface VideoConfig {
  id: VideoId
  label: string
  device: string
  desc: string
  color: string
  videoUrl: string
  active: boolean
}

const VIDEOS: VideoConfig[] = [
  { id: "d1", label: "T1-D1 · 1号机", device: "UAV-01", desc: "主路北行",     color: "var(--accent-amber)", videoUrl: "", active: true },
  { id: "d2", label: "T1-D2 · 2号机", device: "UAV-02", desc: "主路南行",     color: "var(--accent-green)", videoUrl: "", active: true },
  { id: "d3", label: "T1-D3 · 3号机", device: "UAV-03", desc: "应急车道",     color: "var(--accent-blue)",  videoUrl: "", active: true },
  { id: "d4", label: "T1-D4 · 4号机", device: "UAV-04", desc: "桥梁区域",     color: "var(--accent-purple)",videoUrl: "", active: false },
  { id: "d5", label: "T1-D5 · 5号机", device: "UAV-05", desc: "弯道区域",     color: "var(--accent-amber)", videoUrl: "", active: false },
  { id: "d6", label: "T1-D6 · 6号机", device: "UAV-06", desc: "分流合流区",   color: "var(--accent-green)", videoUrl: "", active: false },
]

function buildVideoUrls() {
  // 本地演示视频 - 使用 public/videos 目录下的视频
  // 映射: d1->gal_1, d2->gal_2, d3->gal_3, d4-d6 循环使用
  const localVideos = ["/videos/gal_1.mp4", "/videos/gal_2.mp4", "/videos/gal_3.mp4"]
  return VIDEOS.map((v, idx) => ({
    ...v,
    // 循环使用本地视频
    videoUrl: localVideos[idx % localVideos.length],
  }))
}

const VIDEOS_WITH_URLS = buildVideoUrls()

const RISK_COLORS: Record<string, string> = {
  critical: "var(--accent-red)",
  high:     "var(--accent-amber)",
  medium:   "var(--accent-blue)",
  low:      "var(--accent-green)",
}

// Pipeline 4 个 Stage 定义
const PIPELINE_STAGES = [
  { key: "detection",  label: "目标检测", icon: "◉", color: "var(--accent-amber)", desc: "YOLOv8 + SAM 分割" },
  { key: "identify",   label: "异常识别", icon: "◆", color: "var(--accent-green)", desc: "Gemma4:e2b 多模态" },
  { key: "rag",       label: "RAG检索",   icon: "◫", color: "var(--accent-blue)",   desc: "ChromaDB 向量检索" },
  { key: "decision",  label: "决策输出", icon: "◈", color: "var(--accent-purple)",desc: "Ollama 风险判定" },
]

// ── YOLO+SAM Params ───────────────────────────────────────────────────────────

interface YOLOParams {
  confidence_threshold: number
  sam_enabled: boolean
  model_name: string
}

const DEFAULT_YOLO_PARAMS: YOLOParams = {
  confidence_threshold: 35,
  sam_enabled: true,
  model_name: "yolov8n.pt",
}

// ── Pipeline Stage State ─────────────────────────────────────────────────────

interface StageState {
  status: "idle" | "running" | "done" | "error"
  progress: number
  summary: string
  detail?: string
}

interface PipelineState {
  detection: StageState
  identify: StageState
  rag: StageState
  decision: StageState
}

function createEmptyPipelineState(): PipelineState {
  return {
    detection:  { status: "idle", progress: 0, summary: "" },
    identify:  { status: "idle", progress: 0, summary: "" },
    rag:       { status: "idle", progress: 0, summary: "" },
    decision:  { status: "idle", progress: 0, summary: "" },
  }
}

// ── Video Card with Pipeline Stage Progress ──────────────────────────────────

function VideoCard({ config, pipelineState, alerts, yoloParams }: {
  config: VideoConfig
  pipelineState: PipelineState
  alerts: StreamAlert[]
  yoloParams: YOLOParams
}) {
  const [failed, setFailed] = useState(false)
  
  const latestAlert = alerts.find(a => 
    String(a.title || "").includes(config.device) || 
    String(a.description || "").includes(config.label.split("·")[1]?.trim() || "")
  )

  const statusColor = latestAlert && config.active
    ? RISK_COLORS[String(latestAlert.risk_level)] || "var(--border)"
    : "var(--border)"

  // 当前 Stage 的进度
  const currentStage = PIPELINE_STAGES.find(s => {
    const state = pipelineState[s.key as keyof PipelineState]
    return state.status === "running" || (state.status === "idle" && s.key === "detection")
  })
  const currentState = currentStage ? pipelineState[currentStage.key as keyof PipelineState] : null

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${statusColor}${config.active ? "" : "40"}`,
        boxShadow: latestAlert && config.active ? `0 0 16px ${statusColor}20` : "none",
        opacity: config.active ? 1 : 0.5,
      }}
    >
      {/* Card header */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${statusColor}30` }}>
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: config.active ? config.color : "var(--text-muted)", color: config.active ? "#000" : "var(--text-muted)" }}
        >
          {config.id.replace("d", "")}
        </div>
        <div>
          <div className="text-xs font-bold" style={{ color: config.active ? config.color : "var(--text-muted)" }}>{config.label}</div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>{config.desc}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>{config.device}</span>
          {config.active && (
            latestAlert ? (
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
            ) : (
              <span className="w-2 h-2 rounded-full" style={{ background: "var(--accent-green)", boxShadow: "0 0 4px var(--accent-green)" }} />
            )
          )}
        </div>
      </div>

      {/* Video area */}
      <div className="relative" style={{ aspectRatio: "16/9", background: "var(--bg-primary)" }}>
        {!config.active ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>未启用感知</div>
            <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{config.label}</div>
          </div>
        ) : failed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>视频加载失败</div>
          </div>
        ) : (
          <video
            src={config.videoUrl}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full"
            style={{ objectFit: "cover" }}
            onError={() => setFailed(true)}
          />
        )}

        {/* Pipeline Stage Badge */}
        {config.active && currentStage && currentState?.status === "running" && (
          <div
            className="absolute top-2 left-2 px-2 py-1 rounded text-xs font-mono font-bold animate-pulse"
            style={{ background: `${currentStage.color}cc`, color: "#000", backdropFilter: "blur(4px)" }}
          >
            {currentStage.icon} {currentStage.label}
          </div>
        )}

        {/* SAM Badge */}
        {config.active && (
          <div
            className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-xs font-mono"
            style={{ background: "rgba(0,0,0,0.6)", color: yoloParams.sam_enabled ? "var(--accent-green)" : "var(--text-muted)", backdropFilter: "blur(4px)" }}
          >
            SAM:{yoloParams.sam_enabled ? "ON" : "OFF"}
          </div>
        )}

        {/* Alert Badge */}
        {latestAlert && config.active && (
          <div
            className="absolute top-2 left-2 px-2 py-1 rounded text-xs font-mono font-bold"
            style={{ background: `${RISK_COLORS[String(latestAlert.risk_level)]}cc`, color: "#000", backdropFilter: "blur(4px)", left: currentStage && currentState?.status === "running" ? "auto" : "8px", right: currentStage && currentState?.status === "running" ? "8px" : "auto" }}
          >
            {String(latestAlert.risk_level).toUpperCase()}
          </div>
        )}
      </div>

      {/* Detection Summary */}
      <div className="px-3 py-2" style={{ minHeight: 48 }}>
        {latestAlert && config.active ? (
          <div>
            <div className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>
              {String(latestAlert.title)}
            </div>
            <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
              {String(latestAlert.description).slice(0, 50)}
            </div>
          </div>
        ) : config.active ? (
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            ◈ YOLO+SAM 感知中 · 置信度 {yoloParams.confidence_threshold}%
          </div>
        ) : (
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            ○ 感知未启用
          </div>
        )}
      </div>

      {/* Mini Pipeline Progress Bar */}
      <div className="px-3 pb-2">
        <div className="flex gap-1">
          {PIPELINE_STAGES.map((stage, i) => {
            const state = pipelineState[stage.key as keyof PipelineState]
            const isActive = state.status === "running"
            const isDone = state.status === "done"
            
            return (
              <div
                key={stage.key}
                className="flex-1 h-1 rounded-full overflow-hidden"
                style={{ background: "var(--border)" }}
              >
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: isDone ? "100%" : isActive ? `${state.progress}%` : "0%",
                    background: isDone ? "var(--accent-green)" : stage.color,
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Pipeline Progress Panel ──────────────────────────────────────────────────

function PipelineProgressPanel({ pipelineState, onStageClick }: {
  pipelineState: PipelineState
  onStageClick: (key: string) => void
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <span style={{ color: "var(--accent-amber)" }}>◉</span>
        <span className="text-xs font-bold" style={{ color: "var(--accent-amber)" }}>Pipeline 4阶段</span>
        <span className="ml-auto text-xs font-mono" style={{ color: "var(--text-muted)" }}>YOLO+SAM+Gemma</span>
      </div>
      
      <div className="p-3 space-y-2">
        {PIPELINE_STAGES.map((stage, i) => {
          const state = pipelineState[stage.key as keyof PipelineState]
          const isActive = state.status === "running"
          const isDone = state.status === "done"
          const isError = state.status === "error"
          
          return (
            <div
              key={stage.key}
              className="flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all hover:bg-white/5"
              onClick={() => onStageClick(stage.key)}
              style={{
                border: `1px solid ${isActive ? stage.color : isDone ? "var(--accent-green)" : "var(--border)"}40`,
                opacity: state.status === "idle" ? 0.5 : 1,
              }}
            >
              {/* Icon */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-sm font-bold"
                style={{
                  background: isDone ? "var(--accent-green)" : isActive ? stage.color : "var(--bg-primary)",
                  color: isDone || isActive ? "#000" : "var(--text-muted)",
                  boxShadow: isActive ? `0 0 8px ${stage.color}` : isDone ? "0 0 8px var(--accent-green)" : "none",
                }}
              >
                {isDone ? "✓" : stage.icon}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold" style={{ color: isDone ? "var(--accent-green)" : isActive ? stage.color : "var(--text-muted)" }}>
                    {stage.label}
                  </span>
                  <span className="text-xs font-mono" style={{ color: isDone ? "var(--accent-green)" : isActive ? stage.color : "var(--text-muted)" }}>
                    {isDone ? "✓" : isActive ? `${state.progress}%` : "○"}
                  </span>
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>{stage.desc}</div>
                
                {/* Progress bar */}
                <div className="h-1 rounded-full overflow-hidden mt-1" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${state.progress}%`,
                      background: isDone ? "var(--accent-green)" : stage.color,
                      boxShadow: isActive ? `0 0 4px ${stage.color}` : "none",
                    }}
                  />
                </div>
                
                {/* Summary */}
                {state.summary && (
                  <div className="text-xs mt-1 truncate" style={{ color: "var(--text-secondary)" }}>
                    {state.summary}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── YOLO Params Panel ────────────────────────────────────────────────────────

function YOLOParamsPanel({ params, onChange }: { params: YOLOParams; onChange: (p: YOLOParams) => void }) {
  function update(key: keyof YOLOParams, value: number | string | boolean) {
    onChange({ ...params, [key]: value })
  }

  const activeCount = VIDEOS_WITH_URLS.filter(v => v.active).length

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <span style={{ color: "var(--accent-amber)" }}>◉</span>
        <span className="text-xs font-bold" style={{ color: "var(--accent-amber)" }}>YOLO+SAM 参数</span>
      </div>
      <div className="p-4 space-y-4">
        {/* 置信度阈值 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>置信度阈值</span>
            <span className="text-xs font-mono font-bold" style={{ color: "var(--accent-amber)" }}>{params.confidence_threshold}%</span>
          </div>
          <input
            type="range"
            min={10} max={100} step={1}
            value={params.confidence_threshold}
            onChange={(e) => update("confidence_threshold", Number(e.target.value))}
            className="w-full"
            style={{ accentColor: "var(--accent-amber)" }}
          />
        </div>

        {/* SAM 分割开关 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>SAM 分割</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => update("sam_enabled", true)}
              className="flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition-all"
              style={{
                background: params.sam_enabled ? "var(--accent-green)" : "var(--bg-primary)",
                color: params.sam_enabled ? "#000" : "var(--text-muted)",
                border: `1px solid ${params.sam_enabled ? "var(--accent-green)" : "var(--border)"}`,
              }}
            >
              启用 ●
            </button>
            <button
              onClick={() => update("sam_enabled", false)}
              className="flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition-all"
              style={{
                background: !params.sam_enabled ? "var(--accent-red)" : "var(--bg-primary)",
                color: !params.sam_enabled ? "#000" : "var(--text-muted)",
                border: `1px solid ${!params.sam_enabled ? "var(--accent-red)" : "var(--border)"}`,
              }}
            >
              禁用 ○
            </button>
          </div>
        </div>

        {/* 模型选择 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>模型选择</span>
          </div>
          <select
            value={params.model_name}
            onChange={(e) => update("model_name", e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-xs font-mono"
            style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          >
            <option value="yolov8n.pt">yolov8n.pt (轻量)</option>
            <option value="yolov8s.pt">yolov8s.pt (标准)</option>
            <option value="yolov8m.pt">yolov8m.pt (精度)</option>
          </select>
        </div>

        {/* 检测统计 */}
        <div className="pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="text-xs font-mono mb-2" style={{ color: "var(--text-muted)" }}>检测统计</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg p-2 text-center" style={{ background: "var(--bg-primary)", border: "1px solid var(--accent-amber)20" }}>
              <div className="text-lg font-bold font-mono" style={{ color: "var(--accent-amber)" }}>{activeCount}</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>活跃通道</div>
            </div>
            <div className="rounded-lg p-2 text-center" style={{ background: "var(--bg-primary)", border: "1px solid var(--accent-green)20" }}>
              <div className="text-lg font-bold font-mono" style={{ color: "var(--accent-green)" }}>24</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>ROI总数</div>
            </div>
            <div className="rounded-lg p-2 text-center" style={{ background: "var(--bg-primary)", border: "1px solid var(--accent-blue)20" }}>
              <div className="text-lg font-bold font-mono" style={{ color: "var(--accent-blue)" }}>30</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>FPS</div>
            </div>
            <div className="rounded-lg p-2 text-center" style={{ background: "var(--bg-primary)", border: "1px solid var(--accent-red)20" }}>
              <div className="text-lg font-bold font-mono" style={{ color: "var(--accent-red)" }}>2</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>预警数</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Alert Stream Panel ───────────────────────────────────────────────────────

function AlertStreamPanel({ alerts }: { alerts: StreamAlert[] }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--accent-green)", boxShadow: "0 0 6px var(--accent-green)" }} />
        <span className="text-xs font-bold" style={{ color: "var(--accent-amber)" }}>实时预警流</span>
        <span className="ml-auto text-xs font-mono" style={{ color: "var(--text-muted)" }}>{alerts.length} 条</span>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 600px)" }}>
        {alerts.length === 0 ? (
          <div className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>暂无实时预警</div>
        ) : alerts.map((a, i) => {
          const color = RISK_COLORS[String(a.risk_level)] || "var(--border)"
          return (
            <div key={a.id ?? i} className="px-4 py-3 transition-all"
              style={{ borderBottom: "1px solid var(--border)", background: i === 0 ? `${color}08` : "transparent", borderLeft: `3px solid ${color}` }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold" style={{ color }}>{String(a.risk_level).toUpperCase()}</span>
                {a.confidence != null && (
                  <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{(a.confidence * 100).toFixed(0)}%</span>
                )}
                <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>{new Date().toLocaleTimeString("zh-CN")}</span>
              </div>
              <div className="text-xs font-bold mb-0.5" style={{ color: "var(--text-primary)" }}>{String(a.title)}</div>
              {a.description && <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{String(a.description).slice(0, 80)}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Stats Row ────────────────────────────────────────────────────────────────

function StatsRow({ pipelineState, yoloParams }: { pipelineState: PipelineState; yoloParams: YOLOParams }) {
  const [stats, setStats] = useState<Record<string, number>>({})

  useEffect(() => {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:9000"
    fetch(`${API_BASE}/api/v1/admin/stats`)
      .then((r) => r.json())
      .then((d) => setStats(d.alerts_by_risk || {}))
      .catch(() => {})
  }, [])

  const total = Object.values(stats).reduce((a, b) => a + b, 0)
  const activeCount = VIDEOS_WITH_URLS.filter(v => v.active).length
  const completedStages = PIPELINE_STAGES.filter(s => pipelineState[s.key as keyof PipelineState].status === "done").length

  return (
    <div className="grid grid-cols-8 gap-3">
      {[
        { label: "总预警", value: total, color: "var(--accent-amber)" },
        { label: "严重", value: stats.critical || 0, color: "var(--accent-red)" },
        { label: "高危", value: stats.high || 0, color: "var(--accent-amber)" },
        { label: "中等", value: stats.medium || 0, color: "var(--accent-blue)" },
        { label: "低危", value: stats.low || 0, color: "var(--accent-green)" },
        { label: "感知中", value: activeCount, color: "var(--accent-purple)" },
        { label: "阶段", value: `${completedStages}/4`, color: "var(--accent-green)" },
        { label: "FPS", value: 30, color: "var(--accent-amber)" },
      ].map((item) => (
        <div key={item.label} className="p-3 rounded-xl text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="text-xl font-bold" style={{ color: item.color }}>{item.value}</div>
          <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{item.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Monitor Page ────────────────────────────────────────────────────────────

export default function MonitorPage() {
  const [alerts, setAlerts] = useState<StreamAlert[]>([])
  const [yoloParams, setYoloParams] = useState<YOLOParams>(DEFAULT_YOLO_PARAMS)
  const [pipelineState, setPipelineState] = useState<PipelineState>(createEmptyPipelineState())

  const onAlert = useCallback((alert: StreamAlert) => {
    setAlerts((prev) => [alert, ...prev].slice(0, 50))
  }, [])

  const { connected } = useAlertStream(onAlert)

  // 模拟 Pipeline 运行
  useEffect(() => {
    if (!connected) {
      setPipelineState(createEmptyPipelineState())
      return
    }

    // 模拟 4 阶段 Pipeline
    let timer: NodeJS.Timeout
    
    const runPipeline = () => {
      // Stage 1: Detection
      setPipelineState(prev => ({
        ...prev,
        detection: { status: "running", progress: 0, summary: "YOLOv8 检测中..." }
      }))
      
      let progress = 0
      timer = setInterval(() => {
        progress += 10
        if (progress >= 100) {
          clearInterval(timer)
          setPipelineState(prev => ({
            ...prev,
            detection: { status: "done", progress: 100, summary: "检测到 2 个目标（car, person）" }
          }))
          
          // Stage 2: Identify
          setTimeout(() => {
            setPipelineState(prev => ({
              ...prev,
              identify: { status: "running", progress: 0, summary: "Gemma 分析中..." }
            }))
            
            let idProgress = 0
            timer = setInterval(() => {
              idProgress += 15
              if (idProgress >= 100) {
                clearInterval(timer)
                setPipelineState(prev => ({
                  ...prev,
                  identify: { status: "done", progress: 100, summary: "道路通行正常，未检测到异常" }
                }))
                
                // Stage 3: RAG
                setTimeout(() => {
                  setPipelineState(prev => ({
                    ...prev,
                    rag: { status: "running", progress: 0, summary: "RAG 检索中..." }
                  }))
                  
                  let ragProgress = 0
                  timer = setInterval(() => {
                    ragProgress += 20
                    if (ragProgress >= 100) {
                      clearInterval(timer)
                      setPipelineState(prev => ({
                        ...prev,
                        rag: { status: "done", progress: 100, summary: "检索到 3 条相关知识" }
                      }))
                      
                      // Stage 4: Decision
                      setTimeout(() => {
                        setPipelineState(prev => ({
                          ...prev,
                          decision: { status: "running", progress: 0, summary: "决策生成中..." }
                        }))
                        
                        let decProgress = 0
                        timer = setInterval(() => {
                          decProgress += 25
                          if (decProgress >= 100) {
                            clearInterval(timer)
                            setPipelineState(prev => ({
                              ...prev,
                              decision: { status: "done", progress: 100, summary: "风险等级: 低 · 无预警" }
                            }))
                            
                            // 完成后重置
                            setTimeout(() => {
                              setPipelineState(createEmptyPipelineState())
                              // 延迟重新开始
                              setTimeout(runPipeline, 2000)
                            }, 3000)
                          }
                          setPipelineState(prev => ({
                            ...prev,
                            decision: { status: "running", progress: decProgress, summary: "决策生成中..." }
                          }))
                        }, 200)
                      }, 500)
                    }
                    setPipelineState(prev => ({
                      ...prev,
                      rag: { status: "running", progress: ragProgress, summary: "RAG 检索中..." }
                    }))
                  }, 200)
                }, 500)
              }
              setPipelineState(prev => ({
                ...prev,
                identify: { status: "running", progress: idProgress, summary: "Gemma 分析中..." }
              }))
            }, 150)
          }, 500)
        }
        setPipelineState(prev => ({
          ...prev,
          detection: { status: "running", progress, summary: "YOLOv8 检测中..." }
        }))
      }, 150)
    }
    
    // 延迟开始
    setTimeout(runPipeline, 1000)
    
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [connected])

  // Load YOLO params from backend
  useEffect(() => {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:9000"
    fetch(`${API_BASE}/api/v1/analyze/yolo-params`)
      .then(r => r.json())
      .then((p: any) => setYoloParams({
        confidence_threshold: Math.round((p.confidence_threshold ?? 0.35) * 100),
        sam_enabled: p.sam_enabled ?? true,
        model_name: p.model_name ?? "yolov8n.pt",
      }))
      .catch(() => {})
  }, [])

  const handleYoloParamsChange = useCallback((newParams: YOLOParams) => {
    setYoloParams(newParams)
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:9000"
    fetch(`${API_BASE}/api/v1/analyze/yolo-params`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confidence_threshold: newParams.confidence_threshold / 100,
        sam_enabled: newParams.sam_enabled,
        model_name: newParams.model_name,
      }),
    }).catch(() => {})
  }, [])

  const handleStageClick = (key: string) => {
    console.log("Stage clicked:", key)
  }

  return (
    <>
      <Sidebar />
      <div className="min-h-screen p-6 ml-60" style={{ fontFamily: "'JetBrains Mono', monospace" }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-widest" style={{ color: "var(--text-primary)" }}>感知中心</h1>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              YOLO+SAM → Gemma识别 → RAG检索 → 决策输出
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
              style={{ background: "var(--bg-card)", border: `1px solid ${connected ? "var(--accent-green)" : "var(--accent-red)"}` }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: connected ? "var(--accent-green)" : "var(--accent-red)", boxShadow: connected ? "0 0 6px var(--accent-green)" : "none" }} />
              <span style={{ color: connected ? "var(--accent-green)" : "var(--accent-red)" }}>
                {connected ? "◈ 实时感知" : "OFFLINE"}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6">
          <StatsRow pipelineState={pipelineState} yoloParams={yoloParams} />
        </div>

        {/* Main grid: video grid + right panel */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 6-video concurrent grid */}
          <div className="lg:col-span-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {VIDEOS_WITH_URLS.map((v, i) => (
                <VideoCard
                  key={v.id}
                  config={v}
                  pipelineState={pipelineState}
                  alerts={alerts}
                  yoloParams={yoloParams}
                />
              ))}
            </div>
            <div className="mt-4 p-3 rounded-xl text-xs" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <span style={{ color: "var(--accent-amber)" }}>◉</span> 视频源:{" "}
              <span style={{ color: "var(--text-secondary)" }}>T1_D1.mp4 ~ T1_D6.mp4</span>
              {" · "}
              <span style={{ color: "var(--accent-purple)" }}>◆</span> Pipeline:{" "}
              <span style={{ color: "var(--accent-amber)" }}>检测→识别→RAG→决策</span>
              {" · "}
              <span style={{ color: "var(--accent-green)" }}>✓</span> 4 阶段实时可视化
            </div>
          </div>

          {/* Right: pipeline progress + params + alert panel */}
          <div className="space-y-4">
            <PipelineProgressPanel pipelineState={pipelineState} onStageClick={handleStageClick} />
            <YOLOParamsPanel params={yoloParams} onChange={handleYoloParamsChange} />
            <AlertStreamPanel alerts={alerts} />
          </div>
        </div>
      </div>
    </>
  )
}
