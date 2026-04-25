"use client"
import React, { useState, useEffect, useRef } from "react"
import VideoPlayer, { pauseVideo, playVideo } from "./VideoPlayer"
import type { StageStatus } from "./StageCard"

interface StageCardData {
  stage: string
  label: string
  icon: string
  color: string
  status: StageStatus
  progress: number
  summary: string
  detail?: string | Record<string, unknown>
  snippets?: string[]
  query?: string
  errorMsg: string
  index: number
  revealed: boolean
  revealDelay: number
  combinedImageUrl?: string  // URL to annotated image from Stage 1
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"
const DEMO_STREAM_URL = `${API_BASE}/api/v1/demo/stream`
const DEMO_SEED_URL = `${API_BASE}/api/v1/demo/seed`

// ── ROI types ─────────────────────────────────────────────────────────────────

export interface ROIBox {
  x1: number; y1: number; x2: number; y2: number
  confidence: number
}

// ── Stage definitions (YOLO + SAM + Gemma4:e2b 多模态 Pipeline) ─────────────

const STAGE_DEFS = [
  { key: "perception",   label: "目标检测", icon: "◉", color: "var(--accent-amber)" },
  { key: "identify",    label: "异常识别", icon: "◆", color: "var(--accent-green)" },
  { key: "rag",         label: "RAG检索", icon: "◫", color: "var(--accent-blue)" },
  { key: "decision",    label: "决策输出", icon: "◈", color: "var(--accent-purple)" },
]

const RISK_COLORS: Record<string, string> = {
  critical: "var(--accent-red)",
  high:     "var(--accent-amber)",
  medium:   "var(--accent-blue)",
  low:      "var(--accent-green)",
}

// ── YOLO + SAM + Gemma4:e2b Pipeline ───────────────────────────────────────

// ── Detection Params (检测参数) ───────────────────────────────────────────────

interface DetectionParams {
  confidence_threshold: number  // YOLO 置信度阈值
  min_detection: number         // 最小检测数量
  sam_enabled: boolean         // SAM 分割是否启用
}

const DEFAULT_DETECTION_PARAMS: DetectionParams = {
  confidence_threshold: 0.35,
  min_detection: 0,
  sam_enabled: true,
}

// ── Local demo scenes (YOLO + SAM + Gemma4:e2b Pipeline) ────────────────────────────

const LOCAL_DEMOS = [
  {
    perception: {
      detail: { frame_idx: "00001", timestamp: "00:00.0", resolution: "1280×720", fps: "30", detections: "0", roi_count: "0" },
    },
    rois: [] as ROIBox[],
    identify: {
      detail: "无运动区域，检测到 2 辆正常行驶车辆，道路表面完好，无异常事件。",
    },
    rag: {
      query: "道路正常通行",
      snippets: [
        "持续监控道路通行状态，记录车流密度与车速，发现异常立即上报。",
        "道路障碍物处置规范：发现障碍物立即通知指挥中心。",
        "行人闯入处置规范：立即通知交警，记录行人特征，防止事故发生。",
      ],
    },
    decision: {
      detail: {
        risk_level: "low",
        has_incident: false,
        confidence: 0.94,
        title: "道路通行正常",
        recommendation: "持续监控，暂无预警处置建议。",
        incident_type: "none",
      },
    },
  },
  {
    perception: {
      detail: { frame_idx: "00048", timestamp: "00:01.6", resolution: "1280×720", fps: "30", detections: "2", roi_count: "2", roi_area: "2100" },
    },
    rois: [
      { x1: 20, y1: 35, x2: 42, y2: 60, confidence: 0.89 },
      { x1: 50, y1: 45, x2: 72, y2: 68, confidence: 0.82 },
    ] as ROIBox[],
    identify: {
      detail: "检测到道路散落物事件：1 处疑似货车掉落纸箱（置信度 89%），位于主路应急车道边缘，后方 1 辆轿车（置信度 82%）正在紧急制动绕行。异常类型: obstacle",
    },
    rag: {
      query: "道路障碍物 obstacle 处置规范",
      snippets: [
        "开启双闪警示灯，在来车方向150米外放置三角警示牌。",
        "如障碍物可移动且安全，在确保自身安全下移至路肩，通知路政或养护部门清理。",
        "如障碍物为危险品(化学品、玻璃等)，勿自行处理，协调专业部门进行清理。",
      ],
    },
    decision: {
      detail: {
        risk_level: "high",
        has_incident: true,
        confidence: 0.88,
        title: "道路散落物险情",
        recommendation: "高风险！立即通知高速交警与路政部门，限制后方车辆通行速度，派遣养护人员前往清理。",
        incident_type: "obstacle",
      },
    },
  },
  {
    perception: {
      detail: { frame_idx: "00072", timestamp: "00:02.4", resolution: "1280×720", fps: "30", detections: "1", roi_count: "1", roi_area: "890" },
    },
    rois: [
      { x1: 28, y1: 30, x2: 48, y2: 58, confidence: 0.95 },
    ] as ROIBox[],
    identify: {
      detail: "检测到行人闯入高危区域事件：1 名行人（置信度 95%）正在翻越护栏进入应急车道，距离主路约 15 米，后方 1 辆货车（置信度 88%）正快速接近。异常类型: pedestrian",
    },
    rag: {
      query: "行人闯入 pedestrian 处置规范",
      snippets: [
        "立即通知高速交警(12122)，开启双闪警示，提醒后方来车。",
        "持续跟踪行人位置，等待交警到达，切勿拦截或追逐行人，避免危险。",
        "记录行人外貌特征、位置、进入时间，配合应急响应联动规程。",
      ],
    },
    decision: {
      detail: {
        risk_level: "critical",
        has_incident: true,
        confidence: 0.93,
        title: "行人闯入高危区域",
        recommendation: "紧急！立即通知高速交警与急救中心，限制相关路段通行，配合疏散行人，通知周边巡逻力量支援。",
        incident_type: "pedestrian",
      },
    },
  },
  {
    perception: {
      detail: { frame_idx: "00096", timestamp: "00:03.2", resolution: "1280×720", fps: "30", detections: "3", roi_count: "3", roi_area: "3500" },
    },
    rois: [
      { x1: 22, y1: 38, x2: 46, y2: 62, confidence: 0.94 },
      { x1: 48, y1: 35, x2: 68, y2: 58, confidence: 0.87 },
      { x1: 60, y1: 50, x2: 80, y2: 72, confidence: 0.79 },
    ] as ROIBox[],
    identify: {
      detail: "检测到交通事故事件：主车道 3 辆车辆追尾（置信度 94%），有散落物占据 2 条车道，后方车辆排队约 200 米。异常类型: collision",
    },
    rag: {
      query: "交通事故 collision 处置规范",
      snippets: [
        "立即开启危险报警闪光灯(双闪)，在来车方向150米外放置三角警示牌。",
        "人员迅速撤离至路肩或应急车道安全地带，记录事故现场:车牌、位置、时间。",
        "通知高速交警(12122)和路政，勿自行拆卸、移动事故车辆和散落物。",
      ],
    },
    decision: {
      detail: {
        risk_level: "critical",
        has_incident: true,
        confidence: 0.95,
        title: "多车追尾事故",
        recommendation: "严重风险！立即启动交通事故应急预案，通知交警、路政、急救中心，封闭事故路段，疏导后方车辆。",
        incident_type: "collision",
      },
    },
  },
  {
    perception: {
      detail: { frame_idx: "00120", timestamp: "00:04.0", resolution: "1280×720", fps: "30", detections: "5", roi_count: "5", roi_area: "8500" },
    },
    rois: [
      { x1: 10, y1: 30, x2: 30, y2: 55, confidence: 0.91 },
      { x1: 32, y1: 25, x2: 52, y2: 50, confidence: 0.88 },
      { x1: 54, y1: 32, x2: 74, y2: 58, confidence: 0.85 },
      { x1: 18, y1: 55, x2: 38, y2: 78, confidence: 0.83 },
      { x1: 56, y1: 58, x2: 76, y2: 80, confidence: 0.80 },
    ] as ROIBox[],
    identify: {
      detail: "检测到交通拥堵事件：主车道车辆密集排列（置信度 91%），行驶速度明显降低，车流排队约 500 米，持续时间已超过 5 分钟。异常类型: congestion",
    },
    rag: {
      query: "交通拥堵 congestion 处置规范",
      snippets: [
        "持续监控拥堵状态，记录拥堵长度和持续时间，排查拥堵原因: 事故/施工/收费站。",
        "通知路网监控中心，协调交警疏导，配合发布路况信息和诱导提示。",
        "如拥堵持续超过30分钟，协调救援力量待命。",
      ],
    },
    decision: {
      detail: {
        risk_level: "medium",
        has_incident: true,
        confidence: 0.87,
        title: "交通拥堵预警",
        recommendation: "中等风险！持续监控拥堵状态，排查事故原因，通知路网中心协调交警疏导，适时发布路况信息。",
        incident_type: "congestion",
      },
    },
  },
]

// ── Helpers ─────────────────────────────────────────────────────────────────

function emptyStages(): Record<string, StageCardData> {
  return Object.fromEntries(
    STAGE_DEFS.map((d, i) => [
      d.key,
      {
        stage: d.key,
        label: d.label,
        icon: d.icon,
        color: d.color,
        status: "idle" as StageStatus,
        progress: 0,
        summary: "",
        detail: undefined,
        snippets: undefined,
        query: undefined,
        errorMsg: "",
        index: i,
        revealed: false,
        revealDelay: 0,
        combinedImageUrl: undefined,  // URL to annotated image
      },
    ])
  )
}

// ── PipelinePanel ──────────────────────────────────────────────────────────────

interface PipelinePanelProps {
  onRunningChange?: (running: boolean) => void
}

export default function PipelinePanel({ onRunningChange }: PipelinePanelProps) {
  const [running, setRunning]   = useState(false)
  const [done, setDone]         = useState(false)
  const [alert, setAlert]       = useState<Record<string, unknown> | null>(null)
  const [stages, setStages]     = useState<Record<string, StageCardData>>(emptyStages())
  const [currentRois, setCurrentRois] = useState<ROIBox[]>([])
  const [detectionParams, setDetectionParams] = useState<DetectionParams>(DEFAULT_DETECTION_PARAMS)
  const [sceneIdx, setSceneIdx] = useState(0)  // 用 state 而不是 ref，确保组件能响应更新
  const esRef = useRef<EventSource | null>(null)
  const localTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const revealTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  // 使用 ref 追踪每个 stage 的最新状态，避免被旧状态覆盖
  const stageStatusRef = useRef<Record<string, StageCardData>>(emptyStages())

  useEffect(() => {
    return () => {
      Object.values(revealTimersRef.current).forEach(clearTimeout)
      localTimersRef.current.forEach(clearTimeout)
    }
  }, [])

  // Notify parent when running state changes
  useEffect(() => {
    onRunningChange?.(running)
  }, [running, onRunningChange])

  function reset() {
    Object.values(revealTimersRef.current).forEach(clearTimeout)
    revealTimersRef.current = {}
    localTimersRef.current.forEach(clearTimeout)
    localTimersRef.current = []
    const empty = emptyStages()
    setStages(empty)
    stageStatusRef.current = empty  // 重置 ref
    setAlert(null)
    setCurrentRois([])
    setSceneIdx(0)
  }

  // ── Local demo orchestrator (no backend required) ────────────────────────
  function runLocalDemo(sceneIndex: number) {
    const scene = LOCAL_DEMOS[sceneIndex]
    if (!scene) { setRunning(false); playVideo(); return }

    // Use real ROI data from LOCAL_DEMOS (real algorithm results from Pipeline V2 tests)
    setCurrentRois(scene.rois || [])

    const t1 = 400, t2 = 2200, t3 = 4200, t4 = 6200, tNext = 8500

    // Frame Difference (帧差法)
    localTimersRef.current.push(setTimeout(() => {
      setStages((prev) => ({
        ...prev,
        perception: { ...prev.perception, status: "done", progress: 100, detail: scene.perception.detail },
      }))
    }, t1))

    // Anomaly Identification (异常识别)
    localTimersRef.current.push(setTimeout(() => {
      setStages((prev) => ({
        ...prev,
        identify: { ...prev.identify, status: "running", progress: 20 },
      }))
    }, t2 - 800))
    localTimersRef.current.push(setTimeout(() => {
      setStages((prev) => ({ ...prev, identify: { ...prev.identify, status: "done", progress: 100, detail: scene.identify.detail } }))
    }, t2))

    // RAG
    localTimersRef.current.push(setTimeout(() => {
      setStages((prev) => ({
        ...prev,
        rag: { ...prev.rag, status: "running", progress: 20 },
      }))
    }, t3 - 800))
    localTimersRef.current.push(setTimeout(() => {
      setStages((prev) => ({ ...prev, rag: { ...prev.rag, status: "done", progress: 100, snippets: scene.rag.snippets, query: scene.rag.query } }))
    }, t3))

    // Decision
    localTimersRef.current.push(setTimeout(() => {
      setStages((prev) => ({
        ...prev,
        decision: { ...prev.decision, status: "running", progress: 30 },
      }))
    }, t4 - 800))
    localTimersRef.current.push(setTimeout(() => {
      const decision = scene.decision.detail
      setStages((prev) => ({ ...prev, decision: { ...prev.decision, status: "done", progress: 100, detail: decision } }))
      setAlert({ ...decision, source_type: "demo", frame_idx: scene.perception.detail.frame_idx })
    }, t4))

    // Reveal all done stages with stagger
    ;[t1, t2, t3, t4].forEach((t, i) => {
      const keys = ["perception", "identify", "rag", "decision"]
      localTimersRef.current.push(setTimeout(() => {
        setStages((prev) => ({ ...prev, [keys[i]]: { ...prev[keys[i]], revealed: true } }))
      }, t + 200))
    })

    // 只运行一遍，完成后停止
    localTimersRef.current.push(setTimeout(() => {
      setRunning(false)
      setDone(true)
      playVideo()
      // 20秒后重置状态
      setTimeout(() => { setDone(false); setAlert(null) }, 20000)
    }, tNext))
  }

  async function handleDemo() {
    console.log("[Pipeline] handleDemo called")
    reset()
    setRunning(true)
    setDone(false)
    pauseVideo()
    setSceneIdx(0)

    // Try backend SSE first (with timeout fallback to local demo)
    if (esRef.current) esRef.current.close()

    let sseConnected = false
    // Give backend more time to process video (10 seconds for YOLO+SAM)
    const sseTimeout = setTimeout(() => {
      if (!sseConnected) {
        console.log("[Pipeline] SSE timeout - falling back to local demo")
        // SSE not connected within 10s → fall back to local demo
        esRef.current?.close()
        runLocalDemo(0)
      }
    }, 10000)

    console.log("[Pipeline] Connecting to SSE...")
    const es = new EventSource(DEMO_STREAM_URL)
    esRef.current = es

    es.onerror = (err) => {
      console.error("[Pipeline] SSE error:", err)
    }

    let completedCount = 0

    es.addEventListener("open", () => {
      console.log("[Pipeline] SSE open event received")
      sseConnected = true
      clearTimeout(sseTimeout)
      fetch(DEMO_SEED_URL).catch(() => {})
    })

    es.addEventListener("error", (e) => {
      console.error("[Pipeline] SSE error:", e)
    })

    let frameCounter = 0

    es.addEventListener("frame_data", (e: MessageEvent) => {
      sseConnected = true
      clearTimeout(sseTimeout)
      const data = JSON.parse(e.data) as Record<string, unknown>
      console.log("[Pipeline] frame_data received:", JSON.stringify(data))

      // Convert to absolute URL for image loading
      const rawUrl = data.combined_image_url as string | undefined
      let imageUrl: string | undefined = undefined
      if (rawUrl) {
        imageUrl = rawUrl.startsWith('http') ? rawUrl : `${API_BASE}${rawUrl}`
        console.log("[Pipeline] frame_data -> imageUrl:", imageUrl)
      }

      // Update ref first (immediately)
      const currentPerception = stageStatusRef.current.perception
      const updatedPerception: StageCardData = {
        ...currentPerception,
        status: "done" as const,
        progress: 100,
        detail: data,
        combinedImageUrl: imageUrl ?? currentPerception.combinedImageUrl,
        revealed: true,
      }
      stageStatusRef.current = {
        ...stageStatusRef.current,
        perception: updatedPerception,
      }

      // Update sceneIdx to trigger re-render
      frameCounter++
      setSceneIdx(frameCounter)

      // Also update currentRois from detection_details
      const detectionDetails = data.detection_details as Array<{label: string; bbox?: number[]; confidence?: number}> | undefined
      if (detectionDetails && detectionDetails.length > 0) {
        const resolution = (data.resolution as string)?.split('×')
        const imgW = resolution?.[0] ? parseInt(resolution[0]) : 1280
        const imgH = resolution?.[1] ? parseInt(resolution[1]) : 720
        const rois = detectionDetails
          .filter(d => d.bbox && d.bbox.length === 4)
          .map(d => ({
            x1: d.bbox![0] / imgW * 100,
            y1: d.bbox![1] / imgH * 100,
            x2: d.bbox![2] / imgW * 100,
            y2: d.bbox![3] / imgH * 100,
            confidence: d.confidence ?? 0.5,
          }))
        setCurrentRois(rois)
      }

      // Update React state
      setStages((prev) => ({
        ...prev,
        perception: updatedPerception,
      }))

      console.log("[Pipeline] frame_data setStages, perception.combinedImageUrl:", updatedPerception.combinedImageUrl)
    })

    es.addEventListener("stage", (e: MessageEvent) => {
      sseConnected = true
      clearTimeout(sseTimeout)
      const data = JSON.parse(e.data) as {
        stage: string; progress: number; status?: StageStatus
        summary?: string; detail?: string | Record<string, unknown>; snippets?: string[]; query?: string; error?: string
        rois?: ROIBox[]
        combined_image_url?: string  // URL to annotated image
      }
      if (!data.stage) return
      console.log("[Pipeline] stage event:", data.stage, "progress:", data.progress, "status:", data.status)

      // 使用 ref 中的最新状态，避免被旧状态覆盖
      const current = stageStatusRef.current[data.stage]
      if (!current) return

      const isDone = (data.status === "done") || (data.progress >= 100)
      const newStatus: StageStatus = isDone ? "done"
        : data.status === "running" ? "running" : current.status
      const newProgress = isDone ? 100 : data.progress
      const shouldReveal = isDone && current.status !== "done"

      // Get current URL from frame_data if available
      const existingUrl = stageStatusRef.current.perception?.combinedImageUrl
      const newUrlFromStage = data.combined_image_url
        ? (data.combined_image_url.startsWith('http') ? data.combined_image_url : `${API_BASE}${data.combined_image_url}`)
        : null
      const finalUrl = newUrlFromStage || existingUrl

      // 构建新状态
      const newStageData: StageCardData = {
        ...current,
        status: newStatus,
        progress: newProgress,
        summary: data.summary ?? current.summary,
        detail: data.detail ?? current.detail,
        snippets: data.snippets ?? current.snippets,
        query: data.query ?? current.query,
        errorMsg: data.error ?? current.errorMsg,
        combinedImageUrl: finalUrl,
        revealed: shouldReveal ? true : current.revealed,
      }

      // 同步更新 ref（立即生效）
      stageStatusRef.current = {
        ...stageStatusRef.current,
        [data.stage]: newStageData,
      }

      // 更新 React 状态（触发渲染）
      setStages((prev) => ({
        ...prev,
        [data.stage]: newStageData,
      }))
    })

    es.addEventListener("alert", (e: MessageEvent) => {
      clearTimeout(sseTimeout)
      sseConnected = true
      const data = JSON.parse(e.data) as Record<string, unknown>
      setAlert(data)
      setRunning(false)
      setDone(true)
      playVideo()
      es.close()
      setTimeout(() => { setDone(false); setAlert(null) }, 20000)
    })

    es.onerror = () => {
      if (!sseConnected) {
        clearTimeout(sseTimeout)
        es.close()
        // No backend → use local demo
        runLocalDemo(0)
      } else {
        clearTimeout(sseTimeout)
        setRunning(false)
        playVideo()
        setStages((prev) =>
          Object.fromEntries(
            STAGE_DEFS.map((d) => [
              d.key,
              {
                ...prev[d.key],
                status: prev[d.key].status === "running" ? ("error" as StageStatus) : prev[d.key].status,
                errorMsg: prev[d.key].status === "running" ? "SSE 连接中断" : prev[d.key].errorMsg,
              },
            ])
          )
        )
      }
    }
  }

  const activeCount = STAGE_DEFS.filter((d) => stages[d.key].status !== "idle").length
  const sceneKey = sceneIdx

  return (
    <div className="w-full animate-fade-in" style={{ animationDelay: "0.4s", minWidth: 0 }}>
      {/* Card wrapper */}
      <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", minWidth: 0 }}>

        {/* Header row */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs flex-shrink-0"
            style={{ background: "var(--accent-amber)", color: "#000" }}
          >
            AI
          </div>
          <div className="flex-1">
            <div className="font-bold text-sm" style={{ color: "var(--accent-amber)" }}>◈ YOLO + SAM + Gemma4:e2b Pipeline</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              目标检测 → 异常识别 → RAG检索 → 决策输出 &nbsp;·&nbsp;
              {running ? (
                <span style={{ color: "var(--accent-amber)" }}>运行中</span>
              ) : done ? (
                <span style={{ color: "var(--accent-green)" }}>完成</span>
              ) : (
                <span>{activeCount > 0 ? `${activeCount}/4 阶段已执行` : "点击启动完整 pipeline"}</span>
              )}
            </div>
          </div>

          {/* Launch button */}
          <button
            onClick={handleDemo}
            disabled={running}
            className="px-4 py-1.5 rounded-lg font-mono text-xs font-medium transition-all flex-shrink-0"
            style={{
              background: running ? "var(--bg-primary)" : "var(--accent-amber)",
              color: running ? "var(--text-muted)" : "#000",
              border: running ? "1px solid var(--border)" : "none",
              boxShadow: running ? "none" : "0 0 12px rgba(255,184,0,0.25)",
              cursor: running ? "not-allowed" : "pointer",
            }}
          >
            {running ? "◈ 运行中..." : "▶ 启动演示"}
          </button>
          <div className="text-xs font-mono px-2 py-1 rounded flex-shrink-0" style={{ background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.2)", color: "var(--accent-green)" }}>
            Gemma4:e2b
          </div>
        </div>

        {/* ── Top Row: Video (left) + Compact Pipeline Progress (right) ── */}
        <div className="flex gap-4 mb-4">

          {/* LEFT: Video */}
          <div className="flex-1 min-w-0">
            <VideoPlayer rois={currentRois} showROIBadge={currentRois.length > 0} />
          </div>

          {/* ── Right Sidebar: Pipeline Progress + Detection Stats (side by side) ── */}
          <div className="flex gap-3 flex-shrink-0">
            {/* Pipeline Progress */}
            <div
              className="w-36 rounded-xl overflow-hidden"
              style={{ background: "var(--bg-primary)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                <span style={{ color: "var(--accent-amber)" }}>◉</span>
                <span className="text-xs font-bold font-mono" style={{ color: "var(--accent-amber)" }}>PIPELINE</span>
                {running && (
                  <span className="ml-auto w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--accent-green)", boxShadow: "0 0 6px var(--accent-green)" }} />
                )}
                {running && <span className="text-xs font-mono" style={{ color: "var(--accent-green)" }}>F{sceneIdx + 1}</span>}
              </div>

              <div className="p-2 space-y-1.5">
                {STAGE_DEFS.map((def, idx) => {
                  const s = stages[def.key]
                  const isActive = s.status === "running"
                  const isDone = s.status === "done"
                  const isIdle = s.status === "idle"

                  return (
                    <div
                      key={def.key}
                      className="flex items-center gap-2 transition-all duration-500"
                      style={{ opacity: isIdle ? 0.4 : 1 }}
                    >
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-xs font-bold transition-all duration-500"
                        style={{
                          background: isDone ? "var(--accent-green)" : isActive ? def.color : "rgba(255,255,255,0.06)",
                          color: isDone || isActive ? "#000" : "var(--text-muted)",
                          fontSize: "10px",
                        }}
                      >
                        {isDone ? "✓" : def.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${s.progress}%`,
                              background: isDone ? "var(--accent-green)" : def.color,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Detection Stats Panel */}
            <div
              className="w-36 rounded-xl overflow-hidden"
              style={{ background: "var(--bg-primary)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                <span style={{ color: "var(--accent-amber)" }}>◉</span>
                <span className="text-xs font-bold font-mono" style={{ color: "var(--accent-amber)" }}>YOLO+SAM</span>
              </div>
              <div className="p-2 space-y-1.5">
                <StatRow label="检测目标" value={currentRois.length || "—"} color="var(--accent-amber)" />
                <StatRow label="SAM" value={detectionParams.sam_enabled ? "启用" : "禁用"} color="var(--accent-green)" />
                <StatRow label="置信度" value={`${(detectionParams.confidence_threshold * 100).toFixed(0)}%`} color="var(--accent-blue)" />
                <MiniSlider
                  label=""
                  value={detectionParams.confidence_threshold * 100}
                  min={10}
                  max={100}
                  color="var(--accent-purple)"
                  onChange={(v) => setDetectionParams(p => ({ ...p, confidence_threshold: v / 100 }))}
                />
              </div>
            </div>
          </div>
        </div>{/* end Top Row flex */}

        {/* ── Bottom: Unified Output Content Area ── */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: "var(--bg-primary)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: running ? "0 0 30px rgba(255,184,0,0.05)" : "none",
          }}
        >
          {/* Output header */}
          <div
            className="flex items-center gap-3 px-4 py-2.5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
          >
            <span style={{ color: "var(--accent-amber)" }}>◉</span>
            <span className="text-xs font-bold font-mono" style={{ color: "var(--accent-amber)" }}>实时输出</span>
            {running && (
              <span className="ml-2 w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--accent-green)", boxShadow: "0 0 6px var(--accent-green)" }} />
            )}
            {running && <span className="text-xs font-mono" style={{ color: "var(--accent-green)" }}>LIVE</span>}
            <span className="ml-auto text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              {running ? `F${sceneIdx + 1} · ${activeCount}/4 阶段` : "等待启动..."}
            </span>
          </div>

          {/* Content body */}
          <div className="p-4 space-y-3">
            {!running && activeCount === 0 && (
              <div className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>
                点击「启动演示」体验完整 pipeline — YOLO+SAM → Gemma识别 → RAG检索 → 决策输出
              </div>
            )}

            {/* Perception: YOLO + SAM Output Section */}
            {stages.perception.status !== "idle" && (
              <DetectionOutputSection
                detail={stages.perception.detail}
                running={stages.perception.status === "running"}
                sceneKey={sceneKey}
                combinedImageUrl={stages.perception.combinedImageUrl}
              />
            )}

            {/* Anomaly Identification output */}
            {stages.identify.status !== "idle" && stages.identify.detail && (
              <AnomalyOutputSection detail={stages.identify.detail} sceneKey={sceneKey} running={stages.identify.status === "running"} />
            )}

            {/* RAG output */}
            {stages.rag.status !== "idle" && stages.rag.snippets && (
              <RagOutputSection snippets={stages.rag.snippets} query={stages.rag.query} sceneKey={sceneKey} running={stages.rag.status === "running"} />
            )}

            {/* Decision output */}
            {stages.decision.status !== "idle" && stages.decision.detail && (
              <DecisionOutputSection detail={stages.decision.detail as Record<string, unknown>} sceneKey={sceneKey} running={stages.decision.status === "running"} />
            )}

            {/* Alert banner */}
            {(alert || done) && alert && !running && (
              <AlertBanner alert={alert} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Mini Slider (用于帧差法参数面板) ─────────────────────────────────────────

function MiniSlider({ label, value, min, max, color, onChange, step = 1 }: {
  label: string; value: number; min: number; max: number; color: string
  onChange: (v: number) => void; step?: number
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{label}</span>
        <span className="text-xs font-mono font-bold" style={{ color }}>{value}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: color }}
      />
    </div>
  )
}

// ── Stat Row (统计行) ─────────────────────────────────────────────────────────

function StatRow({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center justify-between py-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-xs font-mono font-bold" style={{ color }}>{value}</span>
    </div>
  )
}

// ── Detection Output Section (YOLO + SAM) ─────────────────────────────────────

// 颜色映射（与后端对齐）
const MASK_COLORS: Record<string, string> = {
  '绿色': '#00FF00',
  '蓝色': '#0064FF',
  '浅蓝色': '#6496FF',
  '黄绿色': '#C8C800',
  '红色': '#FF0000',
}

interface DetectionDetail {
  label: string
  color: string
  confidence: number
  bbox?: number[]
}

interface MaskDetail {
  label: string
  color: string
  pixel_count: number
  confidence: number
}

interface DetectionOutputProps {
  detail?: string | Record<string, unknown>
  running: boolean
  sceneKey: number
  combinedImageUrl?: string
}

function DetectionOutputSection({ detail, running, sceneKey, combinedImageUrl }: DetectionOutputProps) {
  // Handle detail as object (from SSE) or string (from local demo)
  const d: Record<string, unknown> = (typeof detail === "object" && detail !== null) ? detail as Record<string, unknown> : {}

  console.log("[DetectionOutput] PROPS:", {
    detail: !!detail,
    detailType: typeof detail,
    detailKeys: detail && typeof detail === 'object' ? Object.keys(detail) : 'N/A',
    running,
    sceneKey,
    combinedImageUrl: !!combinedImageUrl,
  })
  const frameIdx = d.frame_idx != null ? String(d.frame_idx) : "—"
  const ts = (d.timestamp as string) || "—"
  const res = (d.resolution as string) || "—"
  const detections = d.detections != null ? String(d.detections) : "—"
  const masksCount = d.segmentations != null ? String(d.segmentations) : "—"

  // 新格式：detection_details 和 mask_details
  const detectionDetails = (d.detection_details as DetectionDetail[] | undefined) || []
  const maskDetails = (d.mask_details as MaskDetail[] | undefined) || []

  // Fallback: try to get URL from detail if not provided via prop
  const detailImageUrl = (d.combined_image_url as string | undefined)

  // Build effective URL - check multiple sources
  let effectiveUrl: string | undefined = undefined
  if (combinedImageUrl) {
    effectiveUrl = combinedImageUrl.startsWith('http') ? combinedImageUrl : `${API_BASE}${combinedImageUrl}`
  } else if (detailImageUrl) {
    effectiveUrl = detailImageUrl.startsWith('http') ? detailImageUrl : `${API_BASE}${detailImageUrl}`
  }

  console.log("[DetectionOutput] render:", {
    detailKeys: Object.keys(d),
    combinedImageUrl,
    detailImageUrl,
    effectiveUrl,
    status: running ? "running" : "done"
  })

  // 使用 frameIdx 作为 key，确保每帧都正确更新
  const componentKey = `${sceneKey}-${frameIdx}`

  const [imgError, setImgError] = useState(false)
  const [imgLoading, setImgLoading] = useState(false)

  // 当 URL 变化时重置加载状态
  useEffect(() => {
    if (effectiveUrl) {
      setImgError(false)
      setImgLoading(true)
    }
  }, [effectiveUrl])

  return (
    <div
      key={componentKey}
      className="rounded-xl overflow-hidden animate-slide-in"
      style={{ border: "1px solid rgba(255,184,0,0.15)", background: "rgba(255,184,0,0.04)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid rgba(255,184,0,0.1)", background: "rgba(255,184,0,0.06)" }}>
        <span style={{ color: "var(--accent-amber)" }}>◉</span>
        <span className="text-xs font-bold font-mono" style={{ color: "var(--accent-amber)" }}>YOLO+SAM 目标检测</span>
        {running && <span className="animate-pulse text-xs font-mono" style={{ color: "var(--accent-amber)" }}>◈ 检测中...</span>}
        {!running && <span className="ml-auto text-xs font-mono" style={{ color: "rgba(255,184,0,0.5)" }}>✓ 完成</span>}
      </div>

      <div className="p-3 space-y-3">
        {/* Stats row */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            帧 {frameIdx} · {ts} · {res}
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "rgba(255,184,0,0.1)", color: "var(--accent-amber)" }}>
            检测: {detections}
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "rgba(255,184,0,0.08)", color: "var(--accent-amber)" }}>
            分割: {masksCount}
          </span>
        </div>

        {/* SAM 分割标注图（主图） */}
        {effectiveUrl && !imgError && (
          <div>
            <div className="text-xs font-mono mb-2" style={{ color: "var(--accent-amber)" }}>
              ▶ YOLO+SAM 分割结果（喂给 Gemma 的图像）
              {imgLoading && <span className="animate-pulse ml-2">◈ 加载中...</span>}
            </div>
            <div className="rounded-lg overflow-hidden relative" style={{ border: "1px solid rgba(255,184,0,0.2)" }}>
              <img
                src={effectiveUrl}
                alt="YOLO+SAM 分割标注图"
                className="w-full h-auto"
                style={{ maxHeight: "280px", objectFit: "contain" }}
                onLoad={() => setImgLoading(false)}
                onError={() => { setImgError(true); setImgLoading(false); console.error("[Pipeline] Image load error:", effectiveUrl) }}
              />
              {/* Loading overlay */}
              {imgLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full" />
                </div>
              )}
            </div>
            {/* 颜色图例（动态） */}
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded" style={{ background: "#00FF00" }}></span>
                <span style={{ color: "var(--text-muted)" }}>行人</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded" style={{ background: "#0064FF" }}></span>
                <span style={{ color: "var(--text-muted)" }}>车辆</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded" style={{ background: "#6496FF" }}></span>
                <span style={{ color: "var(--text-muted)" }}>自行车/摩托</span>
              </span>
            </div>
          </div>
        )}

        {/* Fallback when no image */}
        {!effectiveUrl && !running && (
          <div className="rounded-lg p-4 text-xs text-center" style={{ background: "rgba(255,184,0,0.05)", color: "var(--text-muted)" }}>
            等待检测图像...
          </div>
        )}

        {/* 检测详情表格（对齐 stage4_gemma_prompt.txt 格式） */}
        {(detectionDetails.length > 0 || maskDetails.length > 0) && (
          <div>
            <div className="text-xs font-mono mb-2" style={{ color: "var(--accent-green)" }}>
              ▶ 【当前画面检测摘要】
            </div>
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(0,229,160,0.15)" }}>
              <div className="px-3 py-2 text-xs font-mono" style={{ background: "rgba(0,229,160,0.06)", color: "var(--accent-green)" }}>
                检测到 {detectionDetails.length} 个目标：
              </div>
              <div className="p-2 space-y-1">
                {detectionDetails.map((det, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-3 h-3 rounded flex-shrink-0"
                      style={{ background: MASK_COLORS[det.color] || '#888' }}
                    />
                    <span style={{ color: "var(--text-secondary)" }}>
                      {det.label}（{det.color}掩膜，置信度 {det.confidence}%）
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SAM 分割详细信息 */}
        {maskDetails.length > 0 && (
          <div>
            <div className="text-xs font-mono mb-2" style={{ color: "var(--accent-blue)" }}>
              ▶ 【SAM分割详细信息】
            </div>
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(74,158,255,0.15)" }}>
              <div className="p-2 space-y-1">
                {maskDetails.map((mask, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                    <span
                      className="w-3 h-3 rounded flex-shrink-0"
                      style={{ background: MASK_COLORS[mask.color] || '#888' }}
                    />
                    <span>
                      {mask.label}: {mask.color}掩膜 {mask.pixel_count.toLocaleString()} 像素, SAM置信度 {(mask.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Gemma Prompt 预览（完整的提示词模板） */}
        <div>
          <div className="text-xs font-mono mb-1" style={{ color: "var(--accent-purple)" }}>
            ▶ 发送给 Gemma 的完整 Prompt
          </div>
          <div
            className="rounded-lg p-3 text-xs leading-relaxed"
            style={{
              background: "var(--bg-primary)",
              border: "1px solid rgba(180,122,255,0.15)",
              fontFamily: "var(--font-mono, monospace)",
              color: "var(--text-secondary)",
              maxHeight: "180px",
              overflow: "auto",
            }}
          >
            <div className="mb-2" style={{ color: "var(--accent-amber)" }}>请分析这张航拍图像，判断是否存在以下5类道路异常之一：</div>
            <div className="mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
              1. collision - 交通事故/碰撞<br/>
              2. pothole - 路面塌陷/坑洞<br/>
              3. obstacle - 道路障碍物<br/>
              4. pedestrian - 行人闯入<br/>
              5. congestion - 交通拥堵
            </div>
            <div className="mb-2" style={{ color: "var(--accent-blue)" }}>【颜色图例】</div>
            <div className="mb-2 text-xs px-2 py-1 rounded" style={{ background: "rgba(74,158,255,0.1)" }}>
              绿色掩膜 → 行人 | 蓝色掩膜 → 车辆 | 浅蓝色掩膜 → 自行车/摩托车
            </div>
            <div className="mb-2" style={{ color: "var(--accent-green)" }}>【当前画面检测摘要】</div>
            <div className="mb-2 px-2 py-1 rounded text-xs" style={{ background: "rgba(0,229,160,0.1)", color: "var(--accent-green)" }}>
              {detectionDetails.length > 0
                ? detectionDetails.map((d, i) => `${d.label}（${d.color}掩膜，置信度 ${d.confidence}%）`).join('\n')
                : "检测到 N 个目标..."
              }
            </div>
            <div className="mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ color: "var(--text-muted)" }}>请按JSON格式输出：</div>
              <div className="mt-1 p-2 rounded text-xs" style={{ background: "rgba(0,0,0,0.3)" }}>
                {"{"}"has_incident": true/false, "incident_type": "...", "confidence": 0.0-1.0, "description": "...", "recommendation": "..."{"}"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Anomaly Identification Output Section ─────────────────────────────────────

function AnomalyOutputSection({ detail, sceneKey, running }: { detail?: string | Record<string, unknown>; sceneKey: number; running: boolean }) {
  const text = typeof detail === "string" ? detail : ""
  const [displayed, setDisplayed] = useState("")
  const [done, setDone] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setDisplayed("")
    setDone(false)
    if (!text) return
    let i = 0
    function tick() {
      i = Math.min(i + 3, text.length)
      setDisplayed(text.slice(0, i))
      if (i >= text.length) { setDone(true); return }
      timerRef.current = setTimeout(tick, 18)
    }
    timerRef.current = setTimeout(tick, 50)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [sceneKey, detail])

  const VISION_KWS = ["车辆", "行人", "障碍物", "应急车道", "事故", "拥堵", "追尾", "闯入", "违规", "制动", "散落物", "护栏", "双闪", "碰撞", "塌陷", "异常类型"]

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
      parts.push(<mark key={`${m.start}`} style={{ background: "rgba(0,229,160,0.2)", color: "var(--accent-green)", borderRadius: 2 }}>{text.slice(m.start, m.end)}</mark>)
      last = m.end
    }
    if (last < text.length) parts.push(text.slice(last))
    return <>{parts}</>
  }

  return (
    <div
      key={sceneKey}
      className="rounded-xl overflow-hidden animate-slide-in"
      style={{ border: "1px solid rgba(0,229,160,0.15)", background: "rgba(0,229,160,0.04)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid rgba(0,229,160,0.1)", background: "rgba(0,229,160,0.06)" }}>
        <span style={{ color: "var(--accent-green)" }}>◆</span>
        <span className="text-xs font-bold font-mono" style={{ color: "var(--accent-green)" }}>Gemma4:e2b 异常识别</span>
        {running && !done && <span className="animate-pulse text-xs font-mono" style={{ color: "var(--accent-green)" }}>◈ 分析中...</span>}
        {done && <span className="ml-auto text-xs font-mono" style={{ color: "rgba(0,229,160,0.5)" }}>✓ 完成</span>}
      </div>
      {/* Body */}
      <div className="p-3">
        <pre
          className="text-xs leading-relaxed"
          style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--text-secondary)", fontFamily: "var(--font-mono,monospace)" }}
        >
          {highlight(displayed, VISION_KWS)}
          {!done && <span className="animate-pulse"> ▌</span>}
        </pre>
      </div>
    </div>
  )
}

// ── RAG Output Section ───────────────────────────────────────────────────────

function RagOutputSection({ snippets, query, sceneKey, running }: { snippets?: string[]; query?: string; sceneKey: number; running: boolean }) {
  const RAG_KWS = ["应急车道", "道路散落物", "交通事故", "行人闯入", "交警", "报警", "护栏", "二次事故", "处置", "规范", "通知", "预警", "路政", "拥堵"]

  function highlight(text: string, kws: string[]): React.ReactNode {
    if (!text) return <>{text}</>
    const lower = text.toLowerCase()
    const matches: { start: number; end: number }[] = []
    for (const kw of kws) {
      let pos = 0
      while (true) {
        const idx = lower.indexOf(kw, pos)
        if (idx === -1) break
        matches.push({ start: idx, end: idx + kw.length })
        pos = idx + 1
      }
    }
    matches.sort((a, b) => a.start - b.start)
    const filtered = matches.filter((m, i) => i === 0 || m.start >= matches[i - 1].end)
    const parts: React.ReactNode[] = []
    let last = 0
    for (const m of filtered) {
      if (m.start > last) parts.push(text.slice(last, m.start))
      parts.push(<mark key={`${m.start}`} style={{ background: "rgba(74,158,255,0.2)", color: "var(--accent-blue)", borderRadius: 2 }}>{text.slice(m.start, m.end)}</mark>)
      last = m.end
    }
    if (last < text.length) parts.push(text.slice(last))
    return <>{parts}</>
  }

  return (
    <div
      key={sceneKey}
      className="rounded-xl overflow-hidden animate-slide-in"
      style={{ border: "1px solid rgba(74,158,255,0.15)", background: "rgba(74,158,255,0.04)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid rgba(74,158,255,0.1)", background: "rgba(74,158,255,0.06)" }}>
        <span style={{ color: "var(--accent-blue)" }}>◫</span>
        <span className="text-xs font-bold font-mono" style={{ color: "var(--accent-blue)" }}>RAG SOP 知识库检索</span>
        {running && <span className="animate-pulse text-xs font-mono" style={{ color: "var(--accent-blue)" }}>◈ 检索中...</span>}
        {!running && query && <span className="ml-auto text-xs font-mono truncate max-w-48" style={{ color: "rgba(74,158,255,0.5)" }}>查询: {query}</span>}
      </div>
      {/* Snippet cards */}
      <div className="p-3 space-y-2">
        {(snippets || []).slice(0, 3).map((s, i) => (
          <div
            key={`${sceneKey}-${i}`}
            className="p-3 rounded-lg text-xs leading-relaxed"
            style={{
              animation: `slideIn 0.4s ease-out ${i * 0.3}s both`,
              background: "var(--bg-primary)",
              border: "1px solid rgba(74,158,255,0.1)",
              borderLeft: "3px solid rgba(74,158,255,0.35)",
            }}
          >
            {highlight(s, RAG_KWS)}
          </div>
        ))}
      </div>
    </div>
  )
}

// Decision Output Section

function DecisionOutputSection({ detail, sceneKey, running }: { detail?: Record<string, unknown>; sceneKey: number; running: boolean }) {
  const d = (typeof detail === "object" && detail ? detail : {}) as Record<string, unknown>
  const risk: string = String(d.risk_level || "low")
  const RISK_COLOR_MAP: Record<string, string> = {
    critical: "var(--accent-red)",
    high: "var(--accent-amber)",
    medium: "var(--accent-blue)",
    low: "var(--accent-green)",
  }
  const RISK_LABEL_MAP: Record<string, string> = {
    critical: "严重",
    high: "高风险",
    medium: "中风险",
    low: "低风险",
  }
  const color: string = RISK_COLOR_MAP[risk] ?? "var(--border)"
  const riskLabel: string = RISK_LABEL_MAP[risk] ?? "低风险"
  const hasIncident = d.has_incident !== false

  const containerStyle = { border: "1px solid " + color + "25", background: color + "06" }
  const headerStyle = { borderBottom: "1px solid " + color + "15", background: color + "0a" }

  return (
    <div key={sceneKey} className="rounded-xl overflow-hidden animate-slide-in" style={containerStyle}>
      <div className="flex items-center gap-2 px-3 py-2" style={headerStyle}>
        <span style={{ color }}>◈</span>
        <span className="text-xs font-bold font-mono" style={{ color }}>决策输出</span>
        {running ? <span className="animate-pulse text-xs font-mono" style={{ color }}>◈ 推理中...</span> : null}
        {!running ? <span className="ml-auto px-2 py-0.5 rounded text-xs font-bold font-mono" style={{ background: color + "20", color }}>{riskLabel}</span> : null}
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-4">
          <div className="text-2xl font-bold font-mono" style={{ color }}>{riskLabel}</div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>置信度</span>
              <span className="text-sm font-mono font-bold" style={{ color }}>
                {typeof d.confidence === "number" ? ((d.confidence as number) * 100).toFixed(1) + "%" : "—"}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: typeof d.confidence === "number" ? ((d.confidence as number) * 100) + "%" : "0%",
                  background: color,
                  boxShadow: "0 0 6px " + color,
                }}
              />
            </div>
          </div>
          <div className="px-3 py-1 rounded text-xs font-mono font-bold" style={{ background: color + "15", color }}>
            {hasIncident ? "⚠ 需预警" : "✓ 正常"}
          </div>
        </div>
        {d.incident_type && d.incident_type !== "none" ? (
          <div className="rounded-lg p-3" style={{ background: "var(--bg-primary)", border: "1px solid " + color + "20" }}>
            <div className="text-xs font-mono mb-1" style={{ color: "var(--text-muted)" }}>异常类型</div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded text-xs font-mono font-bold" style={{ background: color + "15", color }}>
                {INCIDENT_TYPE_NAMES[String(d.incident_type)] ?? String(d.incident_type)}
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>({String(d.incident_type)})</span>
            </div>
          </div>
        ) : null}
        {d.title ? (
          <div className="rounded-lg p-3" style={{ background: "var(--bg-primary)", border: "1px solid " + color + "20" }}>
            <div className="text-xs font-mono mb-1" style={{ color: "var(--text-muted)" }}>事件标题</div>
            <div className="font-bold" style={{ color: "var(--text-primary)" }}>{String(d.title)}</div>
          </div>
        ) : null}
        {d.recommendation ? (
          <div className="rounded-lg p-3" style={{ background: color + "08", border: "1px solid " + color + "20" }}>
            <div className="flex items-center gap-1.5 mb-1">
              <span style={{ color: "var(--accent-amber)" }}>▶</span>
              <span className="text-xs font-mono font-bold" style={{ color: "var(--accent-amber)" }}>处置建议</span>
            </div>
            <div className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{String(d.recommendation)}</div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ── Alert Banner ─────────────────────────────────────────────────────────────

const RISK_LABELS: Record<string, string> = {
  critical: "严重",
  high: "高风险",
  medium: "中风险",
  low: "低风险",
}

function getRiskLabel(risk: string): string {
  return RISK_LABELS[risk] ?? risk
}

const INCIDENT_TYPE_NAMES: Record<string, string> = {
  collision: "交通事故",
  pothole: "路面塌陷",
  obstacle: "道路障碍物",
  pedestrian: "行人闯入",
  congestion: "交通拥堵",
}

function AlertBanner({ alert }: { alert: Record<string, unknown> }) {
  const RISK_COLORS2: Record<string, string> = {
    critical: "var(--accent-red)",
    high: "var(--accent-amber)",
    medium: "var(--accent-blue)",
    low: "var(--accent-green)",
  }
  const color = RISK_COLORS2[String(alert.risk_level)] ?? "var(--border)"
  return (
    <div
      className="rounded-xl p-4 animate-fade-in-up"
      style={{ background: `${color}08`, border: `1px solid ${color}30` }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
        <span className="font-bold text-sm" style={{ color }}>{String(alert.title)}</span>
        {!!alert.incident_type && String(alert.incident_type) !== "none" && (
          <span className="px-2 py-0.5 rounded text-xs font-mono" style={{ background: `${color}15`, color }}>
            {INCIDENT_TYPE_NAMES[String(alert.incident_type)] ?? String(alert.incident_type)}
          </span>
        )}
        <span className="ml-auto text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          {(typeof alert.confidence === "number" ? `${((alert.confidence as number) * 100).toFixed(0)}%` : "—")} 置信
        </span>
      </div>
      {!!alert.recommendation && (
        <div className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{String(alert.recommendation)}</div>
      )}
    </div>
  )
}
