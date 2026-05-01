"use client"
import { useState, useEffect } from "react"
import { useAuth } from "@/components/AuthContext"
import { fetchPipeline, updatePipeline, fetchMotionParams, updateMotionParams, fetchYoloParams, updateYoloParams } from "@/lib/api"

interface PipelineModelInfo {
  name: string
  loaded: boolean
  size: number | null
}

interface PipelineStatus {
  mode: string
  gemma4_e2b: PipelineModelInfo
  vision: PipelineModelInfo
  decision: PipelineModelInfo
  all_available: string[]
}

function formatSize(bytes: number): string {
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes > 1e6) return `${(bytes / 1e6).toFixed(0)} MB`
  return `${(bytes / 1e3).toFixed(0)} KB`
}

function ModeCard({ mode, active, title, description, stages, color, onClick, disabled }: {
  mode: string; active: boolean; title: string; description: string; stages: string[]; color: string; onClick: () => void; disabled?: boolean
}) {
  return (
    <div
      className="relative rounded-2xl p-5 cursor-pointer transition-all"
      style={{
        background: active ? `${color}10` : "var(--bg-card)",
        border: `2px solid ${active ? color : "var(--border)"}`,
        boxShadow: active ? `0 0 24px ${color}25` : "none",
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      onClick={disabled ? undefined : onClick}
    >
      {active && (
        <div className="absolute top-3 right-3">
          <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: color, color: "#000" }}>
            ACTIVE
          </span>
        </div>
      )}
      <div className="text-sm font-bold mb-1" style={{ color: active ? color : "var(--text-secondary)" }}>
        {title}
      </div>
      <div className="text-xs leading-relaxed mb-3" style={{ color: "var(--text-secondary)" }}>
        {description}
      </div>
      <div className="space-y-1">
        {stages.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs" style={{ color: active ? color : "var(--text-muted)" }}>
            <span style={{ fontSize: 8 }}>▸</span>
            <span>{s}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ModelRow({ label, name, loaded, size, color }: {
  label: string; name: string; loaded: boolean; size: number | null; color: string
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
      style={{
        background: loaded ? `${color}10` : "var(--bg-primary)",
        border: `1px solid ${loaded ? color : "var(--border)"}`,
        boxShadow: loaded ? `0 0 12px ${color}15` : "none",
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center font-mono text-sm font-bold flex-shrink-0"
        style={{
          background: loaded ? color : "var(--bg-primary)",
          color: loaded ? "#000" : "var(--text-muted)",
          boxShadow: loaded ? `0 0 8px ${color}` : "none",
        }}
      >
        {loaded ? "◈" : "○"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-xs font-bold truncate" style={{ color: loaded ? color : "var(--text-secondary)" }}>
          {name}
        </div>
        <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
          {label} · {size ? formatSize(size) : "—"}
        </div>
      </div>
      <span className="text-xs font-mono px-2 py-1 rounded" style={{
        color: loaded ? "var(--accent-green)" : "var(--text-muted)",
        background: loaded ? "rgba(0,229,160,0.1)" : "var(--bg-primary)"
      }}>
        {loaded ? "已加载" : "未加载"}
      </span>
    </div>
  )
}

function OllamaStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: "var(--accent-green)",
    error: "var(--accent-red)",
    idle: "var(--text-muted)",
  }
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
      style={{ background: "var(--bg-card)", border: `1px solid ${colors[status] || "var(--border)"}` }}>
      <span className="w-2 h-2 rounded-full" style={{ background: colors[status] || "var(--text-muted)", boxShadow: `0 0 6px ${colors[status] || "transparent"}` }} />
      <span className="text-xs font-mono" style={{ color: colors[status] || "var(--text-muted)" }}>
        Ollama: {status === "running" ? "运行中" : status === "error" ? "异常" : "未知"}
      </span>
    </div>
  )
}

export default function SettingsPage() {
  const { user } = useAuth()
  const [pipeline, setPipeline] = useState<PipelineStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [tab, setTab] = useState<"pipeline" | "models" | "motion" | "yolo" | "guide">("pipeline")

  useEffect(() => {
    if (!user) return
    setLoading(true)
    fetchPipeline(user.token)
      .then((p: any) => setPipeline(p))
      .catch(() => setMsg({ type: "err", text: "加载失败" }))
      .finally(() => setLoading(false))
  }, [user])

  async function handleModeSwitch(newMode: string) {
    if (!user || !pipeline || pipeline.mode === newMode || updating) return
    setUpdating(true)
    setMsg(null)
    try {
      const r: any = await updatePipeline(user!.token, newMode)
      if (r.ok) {
        setPipeline(prev => prev ? { ...prev, mode: newMode } : prev)
        setMsg({ type: "ok", text: `✓ 已切换为 ${newMode === "single" ? "单模型模式" : "双模型模式"}，重启服务后生效` })
      } else {
        setMsg({ type: "err", text: `✗ ${r.error || "切换失败"}` })
      }
    } catch {
      setMsg({ type: "err", text: "✗ 请求失败，请检查后端服务" })
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-mono tracking-wider">系统设置</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Pipeline 配置 · 模型管理 · 模式切换
          </p>
        </div>
        {user && <OllamaStatusBadge status={pipeline ? (pipeline.all_available.length > 0 ? "running" : "idle") : "idle"} />}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 flex-wrap">
        {([
          { key: "pipeline", label: "Pipeline 模式" },
          { key: "models", label: "模型状态" },
          { key: "motion", label: "帧差法参数" },
          { key: "yolo", label: "YOLO检测", color: "var(--accent-blue)" },
          { key: "guide", label: "加载指南" },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-mono transition-all"
            style={{
              background: tab === t.key ? (t.color ?? "var(--accent-amber)") : "var(--bg-card)",
              color: tab === t.key ? "#000" : "var(--text-secondary)",
              border: `1px solid ${tab === t.key ? (t.color ?? "var(--accent-amber)") : "var(--border)"}`,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {!user ? null : loading ? (
        <div className="text-center py-20 text-base font-mono" style={{ color: "var(--text-muted)" }}>加载中…</div>
      ) : (
        <>
          {/* ── Pipeline Mode Tab ── */}
          {tab === "pipeline" && pipeline && (
            <div>
              <div className="text-sm font-bold mb-3 tracking-widest" style={{ color: "var(--text-muted)" }}>
                PIPELINE 运行模式
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <ModeCard
                  mode="single"
                  active={pipeline.mode === "single"}
                  title="◈ 单模型模式"
                  description="Gemma 4 E2B（本地 GGUF，多模态）一站式完成视觉识别 + 决策推理，配合 ChromaDB RAG 检索 SOP 规范。适合 6GB+ 显存或统一推理场景。"
                  stages={["Gemma 4 E2B（视觉识别 + 决策生成）", "ChromaDB RAG（规范检索）", "端到端延迟更低，资源占用更少"]}
                  color="var(--accent-amber)"
                  onClick={() => handleModeSwitch("single")}
                  disabled={updating}
                />
                <ModeCard
                  mode="dual"
                  active={pipeline.mode === "dual"}
                  title="◆ 双模型模式"
                  description="llava:7b 负责视觉理解 + deepseek-r1 负责决策推理，分工明确。适合需要精细分工或不同硬件加速的部署场景。"
                  stages={["llava:7b（视觉识别）", "ChromaDB RAG（规范检索）", "deepseek-r1:1.5b（决策生成）"]}
                  color="var(--accent-purple)"
                  onClick={() => handleModeSwitch("dual")}
                  disabled={updating}
                />
              </div>

              {msg && (
                <div className="mt-3 px-4 py-2 rounded-lg text-sm animate-fade-in"
                  style={{
                    background: msg.type === "ok" ? "rgba(0,229,160,0.08)" : "rgba(255,59,59,0.08)",
                    border: `1px solid ${msg.type === "ok" ? "var(--accent-green)" : "var(--accent-red)"}`,
                    color: msg.type === "ok" ? "var(--accent-green)" : "var(--accent-red)",
                  }}>
                  {msg.text}
                </div>
              )}
              {updating && <div className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>◈ 切换中...</div>}

              {/* Current pipeline status */}
              <div className="mt-6">
                <div className="text-sm font-bold mb-3 tracking-widest" style={{ color: "var(--text-muted)" }}>
                  当前 PIPELINE 状态
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-2xl p-4" style={{
                    background: "var(--bg-card)",
                    border: `1px solid ${pipeline.mode === "single" && pipeline.gemma4_e2b.loaded ? "var(--accent-amber)" : "var(--border)"}`,
                    boxShadow: pipeline.mode === "single" && pipeline.gemma4_e2b.loaded ? "0 0 16px rgba(255,184,0,0.15)" : "none",
                  }}>
                    <div className="text-sm mb-2" style={{ color: "var(--accent-amber)" }}>Gemma 4 E2B</div>
                    <div className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>{pipeline.gemma4_e2b.name}</div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: pipeline.gemma4_e2b.loaded ? "var(--accent-green)" : "var(--accent-red)", boxShadow: `0 0 6px ${pipeline.gemma4_e2b.loaded ? "var(--accent-green)" : "var(--accent-red)"}` }} />
                      <span className="text-sm font-mono" style={{ color: pipeline.gemma4_e2b.loaded ? "var(--accent-green)" : "var(--accent-red)" }}>
                        {pipeline.gemma4_e2b.loaded ? "已加载" : "未加载"}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl p-4" style={{
                    background: "var(--bg-card)",
                    border: `1px solid ${pipeline.mode === "dual" && pipeline.vision.loaded ? "var(--accent-green)" : "var(--border)"}`,
                    boxShadow: pipeline.mode === "dual" && pipeline.vision.loaded ? "0 0 16px rgba(0,229,160,0.15)" : "none",
                  }}>
                    <div className="text-sm mb-2" style={{ color: "var(--accent-green)" }}>视觉识别</div>
                    <div className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>{pipeline.vision.name}</div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: pipeline.vision.loaded ? "var(--accent-green)" : "var(--accent-red)", boxShadow: `0 0 6px ${pipeline.vision.loaded ? "var(--accent-green)" : "var(--accent-red)"}` }} />
                      <span className="text-sm font-mono" style={{ color: pipeline.vision.loaded ? "var(--accent-green)" : "var(--accent-red)" }}>
                        {pipeline.vision.loaded ? "已加载" : "未加载"}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl p-4" style={{
                    background: "var(--bg-card)",
                    border: `1px solid ${pipeline.mode === "dual" && pipeline.decision.loaded ? "var(--accent-purple)" : "var(--border)"}`,
                    boxShadow: pipeline.mode === "dual" && pipeline.decision.loaded ? "0 0 16px rgba(180,122,255,0.15)" : "none",
                  }}>
                    <div className="text-sm mb-2" style={{ color: "var(--accent-purple)" }}>决策推理</div>
                    <div className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>{pipeline.decision.name}</div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: pipeline.decision.loaded ? "var(--accent-green)" : "var(--accent-red)", boxShadow: `0 0 6px ${pipeline.decision.loaded ? "var(--accent-green)" : "var(--accent-red)"}` }} />
                      <span className="text-sm font-mono" style={{ color: pipeline.decision.loaded ? "var(--accent-green)" : "var(--accent-red)" }}>
                        {pipeline.decision.loaded ? "已加载" : "未加载"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Models Tab ── */}
          {tab === "models" && pipeline && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="text-sm font-bold tracking-widest" style={{ color: "var(--text-muted)" }}>
                  OLLAMA 模型库
                </div>
                <span className="text-sm px-2 py-0.5 rounded font-mono" style={{ background: "var(--bg-primary)", color: "var(--accent-blue)" }}>
                  {pipeline.all_available.length} 个可用
                </span>
              </div>
              <div className="space-y-2">
                {pipeline.all_available.length === 0 ? (
                  <div className="card text-center py-12">
                    <div className="text-3xl mb-3 opacity-20">◎</div>
                    <div className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
                      未检测到 Ollama 模型，请确保 Ollama 服务已启动
                    </div>
                  </div>
                ) : pipeline.all_available.map((name: string) => {
                  const roleColor = /gemma/i.test(name) ? "var(--accent-amber)"
                    : /llava|moondream|qwen-vl|bakllava/i.test(name) ? "var(--accent-green)"
                    : /deepseek|llama|qwen|mistral|phi/i.test(name) ? "var(--accent-purple)"
                    : /nomic|bge/i.test(name) ? "var(--accent-blue)"
                    : "var(--text-muted)"
                  const roleLabel = /gemma/i.test(name) ? "多模态 / 单模型"
                    : /llava|moondream|qwen-vl|bakllava/i.test(name) ? "视觉识别"
                    : /deepseek|llama|qwen|mistral|phi/i.test(name) ? "决策推理"
                    : /nomic|bge/i.test(name) ? "向量嵌入"
                    : "其他"
                  return (
                    <ModelRow key={name} label={roleLabel} name={name} loaded={true} size={null} color={roleColor} />
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Motion Params Tab ── */}
          {tab === "motion" && (
            <MotionParamsTab />
          )}

          {/* ── YOLO Params Tab ── */}
          {tab === "yolo" && (
            <YoloParamsTab />
          )}

          {/* ── Guide Tab ── */}
          {tab === "guide" && (
            <GuideContent />
          )}
        </>
      )}
    </div>
  )
}

// ── Motion Params Tab ─────────────────────────────────────────────────────────

const MOTION_DEFAULTS = {
  threshold: 25,
  min_area: 500,
  max_area: 50000,
  blur_size: 5,
  morph_size: 5,
}

type MotionParams = typeof MOTION_DEFAULTS

function SliderRow({ label, key_, value, min, max, step, onChange, desc }: {
  label: string; key_: keyof MotionParams; value: number; min: number; max: number; step: number; onChange: (v: number) => void; desc: string
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-mono font-bold" style={{ color: "var(--accent-amber)" }}>{label}</span>
        <span className="text-sm font-mono" style={{ color: "var(--accent-green)" }}>{value}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: "var(--accent-amber)" }}
      />
      <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{desc}</div>
    </div>
  )
}

function MotionParamsTab() {
  const [params, setParams] = useState<MotionParams>(MOTION_DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  useEffect(() => {
    fetchMotionParams()
      .then((p: any) => setParams({
        threshold: p.threshold ?? 25,
        min_area: p.min_area ?? 500,
        max_area: p.max_area ?? 50000,
        blur_size: p.blur_size ?? 5,
        morph_size: p.morph_size ?? 5,
      }))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    try {
      const r: any = await updateMotionParams(params)
      if (r.ok) {
        setMsg({ type: "ok", text: "✓ 参数已保存到 config/motion.yaml" })
      } else {
        setMsg({ type: "err", text: "✗ 保存失败" })
      }
    } catch {
      setMsg({ type: "err", text: "✗ 保存失败，请检查后端服务" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-center py-16 text-sm font-mono" style={{ color: "var(--text-muted)" }}>加载中…</div>

  return (
    <div>
      <div className="text-sm font-bold mb-4 tracking-widest" style={{ color: "var(--text-muted)" }}>
        帧差法运动检测参数
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="text-sm font-bold mb-4" style={{ color: "var(--accent-amber)" }}>◉ 检测阈值</div>
          <SliderRow
            label="帧差阈值 threshold"
            key_="threshold"
            value={params.threshold}
            min={10} max={100} step={1}
            onChange={(v) => setParams(p => ({ ...p, threshold: v }))}
            desc="两帧像素差异超过此值视为运动。值越小越敏感，噪点越多"
          />
          <SliderRow
            label="最小面积 min_area"
            key_="min_area"
            value={params.min_area}
            min={100} max={5000} step={50}
            onChange={(v) => setParams(p => ({ ...p, min_area: v }))}
            desc="过滤噪点。小于此面积的区域将被忽略"
          />
          <SliderRow
            label="最大面积 max_area"
            key_="max_area"
            value={params.max_area}
            min={10000} max={200000} step={1000}
            onChange={(v) => setParams(p => ({ ...p, max_area: v }))}
            desc="过滤全屏变化。超过此面积的区域将被忽略"
          />
        </div>
        <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="text-sm font-bold mb-4" style={{ color: "var(--accent-amber)" }}>◉ 预处理参数</div>
          <SliderRow
            label="模糊核 blur_size"
            key_="blur_size"
            value={params.blur_size}
            min={3} max={15} step={2}
            onChange={(v) => setParams(p => ({ ...p, blur_size: v }))}
            desc="高斯模糊核大小（必须是奇数）。越大去噪越强，但会丢失细节"
          />
          <SliderRow
            label="形态学核 morph_size"
            key_="morph_size"
            value={params.morph_size}
            min={3} max={15} step={2}
            onChange={(v) => setParams(p => ({ ...p, morph_size: v }))}
            desc="形态学核大小（必须是奇数）。用于开闭运算去噪和填孔"
          />
        </div>
      </div>
      <div className="mt-5 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 rounded-xl text-sm font-mono font-bold transition-all"
          style={{
            background: saving ? "var(--bg-card)" : "var(--accent-amber)",
            color: saving ? "var(--text-muted)" : "#000",
            border: saving ? "1px solid var(--border)" : "none",
            boxShadow: saving ? "none" : "0 0 16px rgba(255,184,0,0.2)",
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "◈ 保存中..." : "▶ 保存参数"}
        </button>
        <button
          onClick={() => setParams(MOTION_DEFAULTS)}
          className="px-4 py-2 rounded-xl text-sm font-mono transition-all"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" }}
        >
          ↺ 恢复默认
        </button>
        {msg && (
          <span className="text-sm font-mono" style={{ color: msg.type === "ok" ? "var(--accent-green)" : "var(--accent-red)" }}>
            {msg.text}
          </span>
        )}
      </div>
      <div className="mt-4 p-4 rounded-xl text-xs leading-relaxed" style={{ background: "rgba(255,184,0,0.05)", border: "1px solid rgba(255,184,0,0.15)", color: "var(--text-secondary)" }}>
        <div className="font-bold mb-2" style={{ color: "var(--accent-amber)" }}>💡 参数调优建议</div>
        <div>• threshold↑（阈值变大）：减少噪点误检，但可能漏掉细微运动</div>
        <div>• threshold↓（阈值变小）：更敏感，能检测微小运动，但噪点增多</div>
        <div>• min_area↑：过滤更多噪点，适合复杂场景</div>
        <div>• blur_size↑：去噪更强，但会模糊运动边缘，可能漏掉小目标</div>
      </div>
    </div>
  )
}

// ── YOLO Params Tab ────────────────────────────────────────────────────────────

interface YoloParams {
  model_name: string
  confidence_threshold: number
  max_age: number
  min_hits: number
  iou_threshold: number
  device: string
  enabled_categories: { vehicle: boolean; person: boolean; obstacle: boolean }
}

const YOLO_DEFAULTS: YoloParams = {
  model_name: "yolov8n.pt",
  confidence_threshold: 0.35,
  max_age: 30,
  min_hits: 3,
  iou_threshold: 0.3,
  device: "cpu",
  enabled_categories: { vehicle: true, person: true, obstacle: true },
}

function YoloSliderRow({ label, value, onChange, min, max, step = 1, unit = "", desc = "" }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string; desc?: string
}) {
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="w-32 text-sm font-mono" style={{ color: "var(--text-secondary)" }}>{label}</div>
      <div className="flex-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: "var(--accent-blue)" }}
        />
        {desc && <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{desc}</div>}
      </div>
      <div className="w-20 text-right text-sm font-mono font-bold" style={{ color: "var(--accent-blue)" }}>
        {typeof value === "number" ? (step < 1 ? value.toFixed(2) : value) : value}{unit}
      </div>
    </div>
  )
}

function YoloParamsTab() {
  const [params, setParams] = useState<YoloParams>(YOLO_DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  useEffect(() => {
    fetchYoloParams()
      .then((p: any) => setParams(p))
      .catch(() => setMsg({ type: "err", text: "加载失败" }))
  }, [])

  function update<K extends keyof YoloParams>(key: K, value: YoloParams[K]) {
    setParams(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    try {
      await updateYoloParams(params)
      setMsg({ type: "ok", text: "✓ YOLO 参数已保存" })
    } catch {
      setMsg({ type: "err", text: "✗ 保存失败" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-base font-bold" style={{ color: "var(--accent-blue)" }}>◈ YOLO 目标检测参数</div>
          <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>控制 YOLOv8 检测器和 Deep SORT 跟踪器行为</div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 rounded-xl text-sm font-bold transition-all"
          style={{
            background: saving ? "var(--bg-primary)" : "var(--accent-blue)",
            color: saving ? "var(--text-muted)" : "#000",
            border: `1px solid ${saving ? "var(--border)" : "var(--accent-blue)"}`,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "保存中…" : "💾 保存参数"}
        </button>
      </div>

      {msg && (
        <div
          className="mb-4 px-4 py-2 rounded-lg text-sm font-mono"
          style={{
            background: msg.type === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            color: msg.type === "ok" ? "var(--accent-green)" : "var(--accent-red)",
            border: `1px solid ${msg.type === "ok" ? "var(--accent-green)" : "var(--accent-red)"}30`,
          }}
        >
          {msg.text}
        </div>
      )}

      {/* Model info */}
      <div className="mb-5 p-3 rounded-xl" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
        <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          模型: <span style={{ color: "var(--accent-blue)" }}>{params.model_name}</span>
          {" · "}
          设备: <span style={{ color: "var(--accent-blue)" }}>{params.device}</span>
        </div>
      </div>

      {/* Detection params */}
      <div className="mb-5">
        <div className="text-xs font-bold mb-3 tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
          检测参数
        </div>
        <YoloSliderRow
          label="置信度阈值" value={params.confidence_threshold}
          onChange={v => update("confidence_threshold", v)} min={0.05} max={0.95} step={0.05}
          unit="" desc="高于此置信度的目标才被检出"
        />
        <YoloSliderRow
          label="IoU 阈值" value={params.iou_threshold}
          onChange={v => update("iou_threshold", v)} min={0.1} max={0.9} step={0.05}
          unit="" desc="NMS 去除重叠框的 IoU 阈值"
        />
      </div>

      {/* Tracking params */}
      <div className="mb-5">
        <div className="text-xs font-bold mb-3 tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
          跟踪参数
        </div>
        <YoloSliderRow
          label="最大保留帧" value={params.max_age}
          onChange={v => update("max_age", v)} min={10} max={60} step={5}
          unit="帧" desc="目标消失后保留的最大帧数"
        />
        <YoloSliderRow
          label="最小命中" value={params.min_hits}
          onChange={v => update("min_hits", v)} min={1} max={5} step={1}
          unit="帧" desc="确认跟踪所需的最小命中帧数"
        />
      </div>

      {/* Category toggles */}
      <div className="mb-5">
        <div className="text-xs font-bold mb-3 tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
          目标类别
        </div>
        <div className="flex gap-3">
          {(["vehicle", "person", "obstacle"] as const).map(cat => (
            <button
              key={cat}
              onClick={() => update("enabled_categories", { ...params.enabled_categories, [cat]: !params.enabled_categories[cat] })}
              className="px-4 py-2 rounded-xl text-sm font-mono transition-all"
              style={{
                background: params.enabled_categories[cat] ? "var(--accent-blue)" : "var(--bg-primary)",
                color: params.enabled_categories[cat] ? "#000" : "var(--text-muted)",
                border: `1px solid ${params.enabled_categories[cat] ? "var(--accent-blue)" : "var(--border)"}`,
              }}
            >
              {cat === "vehicle" ? "🚗 车辆" : cat === "person" ? "🚶 行人" : "🚧 障碍物"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 p-4 rounded-xl text-xs leading-relaxed" style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)", color: "var(--text-secondary)" }}>
        <div className="font-bold mb-2" style={{ color: "var(--accent-blue)" }}>💡 参数调优建议</div>
        <div>• confidence_threshold↓：检出更多目标，但可能增加误报</div>
        <div>• max_age↑：跟踪更持久，适合低帧率或遮挡场景</div>
        <div>• min_hits↑：过滤短暂的误检，但会增加跟踪启动延迟</div>
        <div>• 禁用不需要的类别可减少计算量，提升处理速度</div>
      </div>
    </div>
  )
}

// ── Guide Tab ──────────────────────────────────────────────────────────────────

function GuideContent() {
  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="text-base font-bold mb-4" style={{ color: "var(--accent-amber)" }}>⚡ 模型加载指南</div>
              <div className="space-y-6 text-sm" style={{ color: "var(--text-secondary)" }}>
                <div>
                  <div className="font-bold mb-2" style={{ color: "var(--accent-amber)" }}>1. Gemma 4 E2B（单模型模式）</div>
                  <div className="font-mono p-3 rounded-lg" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
                    <div># 创建模型</div>
                    <div className="mt-1">ollama create gemma4-e2b -f /Users/jasonlee/UAV_PRO/models/Modelfile.gemma-4-E2B</div>
                    <div className="mt-2"># 拉取（如果已有 GGUF）</div>
                    <div>ollama pull gemma4-e2b</div>
                  </div>
                </div>
                <div>
                  <div className="font-bold mb-2" style={{ color: "var(--accent-green)" }}>2. llava:7b（双模型模式 · 视觉识别）</div>
                  <div className="font-mono p-3 rounded-lg" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
                    ollama pull llava:7b
                  </div>
                </div>
                <div>
                  <div className="font-bold mb-2" style={{ color: "var(--accent-purple)" }}>3. deepseek-r1:1.5b（双模型模式 · 决策推理）</div>
                  <div className="font-mono p-3 rounded-lg" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
                    ollama pull deepseek-r1:1.5b
                  </div>
                </div>
                <div className="p-3 rounded-lg" style={{ background: "rgba(255,184,0,0.06)", border: "1px solid rgba(255,184,0,0.2)" }}>
                  <span style={{ color: "var(--accent-amber)" }}>💡</span> 切换 Pipeline 模式后需要重启后端服务（<code className="font-mono px-1" style={{ color: "var(--accent-amber)" }}>python -m app</code>）才能生效。
                </div>
              </div>
            </div>
  )
}
