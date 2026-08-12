"use client"
import { Suspense, useCallback, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/components/AuthContext"
import { fetchPipeline, updatePipeline, fetchMotionParams, updateMotionParams, fetchYoloParams, updateYoloParams } from "@/lib/api"
import { llmProviderApi, llmProviderCatalogApi, llmModelListApi, llmPerStageApi } from "@uav/api"
import type { LLMProvider, LLMProviderStatus } from "@uav/api"

type TabKey = "pipeline" | "provider" | "models" | "motion" | "yolo" | "guide"
const TAB_KEYS: TabKey[] = ["pipeline", "provider", "models", "motion", "yolo", "guide"]

function isTabKey(s: string | null): s is TabKey {
  return !!s && (TAB_KEYS as string[]).includes(s)
}

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
  return (
    <Suspense fallback={<div className="text-center py-16 text-sm font-mono" style={{ color: "var(--text-muted)" }}>加载中…</div>}>
      <SettingsPageInner />
    </Suspense>
  )
}

function SettingsPageInner() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams?.get("tab")
  const [pipeline, setPipeline] = useState<PipelineStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [tab, setTab] = useState<TabKey>(isTabKey(tabFromUrl) ? tabFromUrl : "pipeline")

  // React to URL ?tab= changes (e.g. when user clicks the LLMStatusBadge link)
  useEffect(() => {
    if (isTabKey(tabFromUrl)) setTab(tabFromUrl)
  }, [tabFromUrl])

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
          { key: "pipeline", label: "Pipeline 模式", color: "var(--accent-amber)" },
          { key: "provider", label: "LLM 提供商", color: "var(--accent-purple)" },
          { key: "models", label: "模型状态", color: "var(--accent-green)" },
          { key: "motion", label: "帧差法参数", color: "var(--accent-purple)" },
          { key: "yolo", label: "YOLO检测", color: "var(--accent-blue)" },
          { key: "guide", label: "加载指南", color: "var(--accent-amber)" },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-mono transition-all"
            style={{
              background: tab === t.key ? t.color : "var(--bg-card)",
              color: tab === t.key ? "#000" : "var(--text-secondary)",
              border: `1px solid ${tab === t.key ? t.color : "var(--border)"}`,
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
                  description="同一个 VLM 一站式完成视觉识别 + 决策推理，配合 ChromaDB RAG 检索 SOP 规范。适合资源紧张或统一推理的场景（provider 在下方 Provider Tab 选择）。"
                  stages={["VLM（视觉识别 + 决策生成）", "ChromaDB RAG（规范检索）", "端到端延迟更低，资源占用更少"]}
                  color="var(--accent-amber)"
                  onClick={() => handleModeSwitch("single")}
                  disabled={updating}
                />
                <ModeCard
                  mode="dual"
                  active={pipeline.mode === "dual"}
                  title="◆ 双模型模式"
                  description="Vision 与 Decision 阶段各用一个 LLM provider，分工明确。适合需要精细分工或不同硬件加速的部署场景（在 Provider Tab 设置 VISION_PROVIDER / DECISION_PROVIDER）。"
                  stages={["Vision VLM（视觉识别）", "ChromaDB RAG（规范检索）", "Decision LLM（决策生成）"]}
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

          {/* ── Provider Tab ── */}
          {tab === "provider" && user && (
            <ProviderTab token={user.token} />
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
            <GuideContent mode={pipeline?.mode} />
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

function SliderRowSimple({ label, value, onChange, min, max, step = 1, unit = "", desc = "" }: {
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
      await updateYoloParams({ ...params } as Record<string, unknown>)
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
        <SliderRowSimple
          label="置信度阈值" value={params.confidence_threshold}
          onChange={v => update("confidence_threshold", v)} min={0.05} max={0.95} step={0.05}
          unit="" desc="高于此置信度的目标才被检出"
        />
        <SliderRowSimple
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
        <SliderRowSimple
          label="最大保留帧" value={params.max_age}
          onChange={v => update("max_age", v)} min={10} max={60} step={5}
          unit="帧" desc="目标消失后保留的最大帧数"
        />
        <SliderRowSimple
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

function GuideContent({ mode }: { mode?: string }) {
  const isSingle = mode === "single"
  const isDual = mode === "dual"
  const sectionOpacity = (active: boolean) => active ? 1 : 0.5
  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="text-base font-bold mb-4" style={{ color: "var(--accent-amber)" }}>⚡ 模型加载指南</div>
              <div className="space-y-6 text-sm" style={{ color: "var(--text-secondary)" }}>
                <div style={{ opacity: sectionOpacity(isSingle || !isDual) }}>
                  <div className="font-bold mb-2" style={{ color: "var(--accent-amber)" }}>1. Gemma 4 E2B（单模型模式）{isSingle ? " · 当前" : ""}</div>
                  <div className="font-mono p-3 rounded-lg" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
                    <div># 创建模型</div>
                    <div className="mt-1">ollama create gemma4-e2b -f /Users/jasonlee/UAV_PRO/models/Modelfile.gemma-4-E2B</div>
                    <div className="mt-2"># 拉取（如果已有 GGUF）</div>
                    <div>ollama pull gemma4-e2b</div>
                  </div>
                </div>
                <div style={{ opacity: sectionOpacity(isDual || !isSingle) }}>
                  <div className="font-bold mb-2" style={{ color: "var(--accent-green)" }}>2. llava:7b（双模型模式 · 视觉识别）{isDual ? " · 当前" : ""}</div>
                  <div className="font-mono p-3 rounded-lg" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
                    ollama pull llava:7b
                  </div>
                </div>
                <div style={{ opacity: sectionOpacity(isDual || !isSingle) }}>
                  <div className="font-bold mb-2" style={{ color: "var(--accent-purple)" }}>3. deepseek-r1:1.5b（双模型模式 · 决策推理）{isDual ? " · 当前" : ""}</div>
                  <div className="font-mono p-3 rounded-lg" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
                    ollama pull deepseek-r1:1.5b
                  </div>
                </div>
                <div className="p-3 rounded-lg" style={{ background: "rgba(255,184,0,0.06)", border: "1px solid rgba(255,184,0,0.2)" }}>
                  <span style={{ color: "var(--accent-amber)" }}>💡</span> 当前默认 Provider 为 minimax（Anthropic 兼容），无需本地 Ollama 拉取模型。如切换到 ollama provider，请按上方对应模式加载模型后重启后端服务（<code className="font-mono px-1" style={{ color: "var(--accent-amber)" }}>python -m app</code>）。
                </div>
              </div>
            </div>
  )
}

// ── Provider Tab ───────────────────────────────────────────────────────────────

interface ProviderConfig {
  provider: string
  base_url?: string
  api_key?: string
  model?: string
}

type StageKey = "vision" | "decision"
type ScopeMode = "unified" | "per-stage"

const PROTOCOL_COLOR: Record<string, string> = {
  ollama: "var(--accent-amber)",
  anthropic: "var(--accent-purple)",
  openai: "var(--accent-blue)",
}

const LEGACY_TO_CATALOG: Record<string, string> = {
  local: "ollama",
  external: "anthropic",
}

function normalizeProviderId(raw: string | undefined | null): string {
  if (!raw) return "ollama"
  const r = raw.toLowerCase().trim()
  if (LEGACY_TO_CATALOG[r]) return LEGACY_TO_CATALOG[r]
  return r
}

function inferScopeFromConfig(p: any): ScopeMode {
  // If backend returns per_stage keys, default to per-stage when both filled in.
  if (p && (p.vision || p.decision)) return "per-stage"
  return "unified"
}

/**
 * Card-shaped editor for one pipeline stage (or the unified provider).
 * Reused by both the single-provider and per-stage configurations.
 */
function StageEditor({
  token,
  title,
  subtitle,
  color,
  initial,
  catalog,
  onSaved,
}: {
  token: string
  title: string
  subtitle: string
  color: string
  initial: ProviderConfig
  catalog: LLMProvider[]
  onSaved?: (status: LLMProviderStatus) => void
}) {
  const [cfg, setCfg] = useState<ProviderConfig>(initial)
  const [models, setModels] = useState<string[]>([])
  const [modelMode, setModelMode] = useState<"select" | "custom">("select")
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [fetchingModels, setFetchingModels] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [testMsg, setTestMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  // When provider or base_url change, refresh model list.
  useEffect(() => {
    if (!cfg.provider) return
    let cancelled = false
    setFetchingModels(true)
    llmModelListApi
      .list(token, {
        provider: cfg.provider,
        base_url: cfg.base_url || undefined,
        api_key: cfg.api_key || undefined,
      })
      .then((r) => {
        if (cancelled) return
        const list = Array.isArray(r.models) ? r.models : []
        setModels(list)
        // If existing model isn't in the list, present the select but allow custom.
        if (cfg.model && list.length > 0 && !list.includes(cfg.model)) {
          // Keep current value, leave mode as custom to avoid overwriting text input.
        }
        setModelMode(
          list.length === 0
            ? "custom"
            : cfg.model && !list.includes(cfg.model)
            ? "custom"
            : "select",
        )
      })
      .catch(() => {
        if (!cancelled) setModels([])
      })
      .finally(() => {
        if (!cancelled) setFetchingModels(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, cfg.provider, cfg.base_url])

  function handleProviderChange(providerId: string) {
    const meta = catalog.find((p) => p.id === providerId)
    setCfg((prev) => ({
      ...prev,
      provider: providerId,
      base_url: prev.base_url && prev.base_url.length > 0 ? prev.base_url : meta?.default_base_url ?? "",
      model: meta?.default_model ?? prev.model ?? "",
    }))
    setMsg(null)
    setTestMsg(null)
  }

  async function handleTest() {
    if (!cfg.base_url || !cfg.model) {
      setTestMsg({ type: "err", text: "✗ 请填写 base_url 和 model" })
      return
    }
    setTesting(true)
    setTestMsg(null)
    try {
      const r: any = await llmProviderApi.test(token, {
        base_url: cfg.base_url!,
        api_key: cfg.api_key || "",
        model: cfg.model!,
      })
      if (r.ok) {
        setTestMsg({ type: "ok", text: `✓ 连接成功 · 延迟 ${r.latency_ms ?? "—"}ms` })
      } else {
        setTestMsg({ type: "err", text: `✗ ${r.error || "连接失败"}` })
      }
    } catch (e: unknown) {
      setTestMsg({ type: "err", text: `✗ ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    try {
      // The api wrapper already throws on non-2xx; if await returns, save succeeded.
      await llmProviderApi.update(token, {
        provider: cfg.provider,
        base_url: cfg.base_url,
        api_key: cfg.api_key,
        model: cfg.model,
      })
      // Refetch status to get fresh provider_label, override_active, etc.
      const fresh = await llmProviderApi.get(token)
      onSaved?.(fresh)
      const label = fresh.provider_label || fresh.provider || cfg.provider
      const model = fresh.external_model || fresh.ollama_model || cfg.model || ""
      setMsg({
        type: "ok",
        text: `✓ 已保存并立即生效 · 当前激活: ${label} · ${model}`,
      })
    } catch (e: unknown) {
      setMsg({ type: "err", text: `✗ ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setSaving(false)
    }
  }

  const selectedProvider = catalog.find((p) => p.id === cfg.provider)

  return (
    <div className="rounded-2xl p-5 mb-6" style={{ background: "var(--bg-card)", border: `1px solid var(--border)` }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base font-bold" style={{ color }}>
          {title}
        </span>
        <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: "var(--bg-primary)", color: "var(--text-muted)" }}>
          {subtitle}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Provider select */}
        <div>
          <label className="text-xs font-mono font-bold mb-1 block" style={{ color: "var(--text-secondary)" }}>
            PROVIDER
          </label>
          <select
            value={cfg.provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm font-mono"
            style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
          >
            {catalog.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}{p.multimodal ? " · 多模态" : ""}
              </option>
            ))}
          </select>
          <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            protocol: {selectedProvider?.protocol ?? "—"}
            {selectedProvider?.default_base_url ? ` · 默认 ${selectedProvider.default_base_url}` : ""}
          </div>
        </div>

        {/* Base URL */}
        <div>
          <label className="text-xs font-mono font-bold mb-1 block" style={{ color: "var(--text-secondary)" }}>
            BASE URL
          </label>
          <input
            type="text"
            value={cfg.base_url ?? ""}
            onChange={(e) => setCfg((prev) => ({ ...prev, base_url: e.target.value }))}
            placeholder={selectedProvider?.default_base_url || ""}
            className="w-full px-3 py-2 rounded-lg text-sm font-mono"
            style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
          />
          <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>提供方 minimax / Anthropic / OpenAI / DeepSeek / Ollama 兼容端点</div>
        </div>

        {/* API key with toggle */}
        <div>
          <label className="text-xs font-mono font-bold mb-1 block" style={{ color: "var(--text-secondary)" }}>
            API KEY
          </label>
          <div className="flex items-center gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={cfg.api_key ?? ""}
              onChange={(e) => setCfg((prev) => ({ ...prev, api_key: e.target.value }))}
              placeholder={selectedProvider?.protocol === "ollama" ? "(ollama 通常不需要)" : "sk-..."}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-mono"
              style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="px-2 py-2 rounded-lg text-xs font-mono"
              style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
              title={showKey ? "隐藏" : "显示"}
            >
              {showKey ? "🙈" : "👁"}
            </button>
          </div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>密钥仅写入后端配置，不在响应中回显</div>
        </div>

        {/* Model select + custom */}
        <div>
          <label className="text-xs font-mono font-bold mb-1 block" style={{ color: "var(--text-secondary)" }}>
            MODEL
          </label>
          {modelMode === "select" && models.length > 0 ? (
            <>
              <select
                value={cfg.model ?? ""}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setModelMode("custom")
                  } else {
                    setCfg((prev) => ({ ...prev, model: e.target.value }))
                  }
                  setMsg(null)
                  setTestMsg(null)
                }}
                className="w-full px-3 py-2 rounded-lg text-sm font-mono"
                style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
              >
                <option value="">— 请选择 —</option>
                {models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
                <option value="__custom__">+ 自定义模型…</option>
              </select>
              <button
                type="button"
                onClick={() => setModelMode("custom")}
                className="text-xs mt-1 underline font-mono"
                style={{ color: "var(--text-muted)" }}
              >
                直接输入自定义模型
              </button>
            </>
          ) : (
            <>
              <input
                type="text"
                value={cfg.model ?? ""}
                onChange={(e) => setCfg((prev) => ({ ...prev, model: e.target.value }))}
                placeholder={selectedProvider?.default_model || "model-id"}
                className="w-full px-3 py-2 rounded-lg text-sm font-mono"
                style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
              />
              {models.length > 0 && (
                <button
                  type="button"
                  onClick={() => setModelMode("select")}
                  className="text-xs mt-1 underline font-mono"
                  style={{ color: "var(--text-muted)" }}
                >
                  从列表中选择
                </button>
              )}
            </>
          )}
          <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {fetchingModels ? "⟳ 拉取模型中…" : `${models.length} 个可用模型`}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <button
          onClick={handleTest}
          disabled={testing || !cfg.base_url || !cfg.model}
          className="px-4 py-2 rounded-xl text-sm font-mono font-bold transition-all"
          style={{
            background: testing ? "var(--bg-card)" : "var(--bg-primary)",
            color: testing ? "var(--text-muted)" : color,
            border: `1px solid ${testing ? "var(--border)" : color}`,
            cursor: testing ? "not-allowed" : "pointer",
            opacity: !cfg.base_url || !cfg.model ? 0.5 : 1,
          }}
        >
          {testing ? "◈ 测试中..." : "🔌 Test connection"}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !cfg.provider || !cfg.model}
          className="px-5 py-2 rounded-xl text-sm font-mono font-bold transition-all"
          style={{
            background: saving ? "var(--bg-card)" : color,
            color: saving ? "var(--text-muted)" : ["var(--accent-amber)"].includes(color) ? "#000" : "#fff",
            border: saving ? "1px solid var(--border)" : "none",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: !cfg.provider || !cfg.model ? 0.5 : 1,
          }}
        >
          {saving ? "◈ 保存中..." : "💾 Save"}
        </button>
        {testMsg && (
          <span className="text-sm font-mono" style={{ color: testMsg.type === "ok" ? "var(--accent-green)" : "var(--accent-red)" }}>
            {testMsg.text}
          </span>
        )}
      </div>
      {msg && (
        <div
          className="mt-3 px-4 py-2 rounded-lg text-sm animate-fade-in"
          style={{
            background: msg.type === "ok" ? "rgba(0,229,160,0.08)" : "rgba(255,59,59,0.08)",
            border: `1px solid ${msg.type === "ok" ? "var(--accent-green)" : "var(--accent-red)"}`,
            color: msg.type === "ok" ? "var(--accent-green)" : "var(--accent-red)",
          }}
        >
          {msg.text}
        </div>
      )}
    </div>
  )
}

function ProviderTab({ token }: { token: string }) {
  const [catalog, setCatalog] = useState<LLMProvider[]>([])
  const [scope, setScope] = useState<ScopeMode>("unified")
  const [unified, setUnified] = useState<ProviderConfig>({ provider: "ollama" })
  const [vision, setVision] = useState<ProviderConfig>({ provider: "ollama" })
  const [decision, setDecision] = useState<ProviderConfig>({ provider: "ollama" })
  const [loading, setLoading] = useState(true)
  const [savingPerStage, setSavingPerStage] = useState(false)
  const [pageMsg, setPageMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [lastStatus, setLastStatus] = useState<LLMProviderStatus | null>(null)

  // Fetch provider catalog and current config.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.allSettled([
      llmProviderCatalogApi.get(token).catch(() => []),
      llmProviderApi.get(token).catch(() => null),
      llmPerStageApi.get(token).catch(() => null),
    ])
      .then(([cat, cur, per]) => {
        if (cancelled) return
        if (cat.status === "fulfilled") {
          const list = (cat.value as LLMProvider[]) || []
          setCatalog(list.length > 0 ? list : [])
        } else {
          setCatalog([])
        }
        if (per.status === "fulfilled" && per.value) {
          setScope(inferScopeFromConfig(per.value))
          const p: any = per.value
          if (p.vision) {
            setVision({
              provider: normalizeProviderId(p.vision.provider),
              base_url: p.vision.base_url ?? "",
              api_key: "",
              model: p.vision.model ?? "",
            })
          }
          if (p.decision) {
            setDecision({
              provider: normalizeProviderId(p.decision.provider),
              base_url: p.decision.base_url ?? "",
              api_key: "",
              model: p.decision.model ?? "",
            })
          }
        }
        if (cur.status === "fulfilled" && cur.value) {
          const p: any = cur.value
          setLastStatus(p as LLMProviderStatus)
          setUnified({
            provider: normalizeProviderId(p.provider),
            base_url: p.base_url ?? "",
            api_key: p.api_key ?? "",
            model: p.model ?? "",
          })
        }
      })
      .catch(() => {
        if (!cancelled) setPageMsg({ type: "err", text: "✗ 加载失败" })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  // Re-fetch provider status (e.g. after external writes / background changes).
  const refreshStatus = useCallback(async () => {
    try {
      const fresh = await llmProviderApi.get(token)
      setLastStatus(fresh)
    } catch {
      // Silent: UI will fall back to local cfg.
    }
  }, [token])

  // If catalog finishes loading after initial state with default "ollama"
  // but no such provider exists, fall back to first catalog item.
  useEffect(() => {
    if (!catalog.length) return
    setUnified((prev) =>
      prev.provider && catalog.some((p) => p.id === prev.provider)
        ? prev
        : { ...prev, provider: catalog[0].id },
    )
    setVision((prev) =>
      prev.provider && catalog.some((p) => p.id === prev.provider)
        ? prev
        : prev.provider
        ? { ...prev, provider: catalog[0].id }
        : prev,
    )
    setDecision((prev) =>
      prev.provider && catalog.some((p) => p.id === prev.provider)
        ? prev
        : prev.provider
        ? { ...prev, provider: catalog[0].id }
        : prev,
    )
  }, [catalog])

  async function handleSavePerStage() {
    setSavingPerStage(true)
    setPageMsg(null)
    try {
      await llmPerStageApi.update(token, {
        vision: { provider: vision.provider, base_url: vision.base_url, api_key: vision.api_key, model: vision.model },
        decision: { provider: decision.provider, base_url: decision.base_url, api_key: decision.api_key, model: decision.model },
      })
      await refreshStatus()
      setPageMsg({ type: "ok", text: "✓ 识别层 / 决策层配置已保存并立即生效" })
    } catch (e: unknown) {
      setPageMsg({ type: "err", text: `✗ ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setSavingPerStage(false)
    }
  }

  if (loading) return <div className="text-center py-16 text-sm font-mono" style={{ color: "var(--text-muted)" }}>加载中…</div>

  return (
    <div>
      <div className="text-sm font-bold mb-3 tracking-widest" style={{ color: "var(--text-muted)" }}>
        LLM 提供商选择
      </div>

      {/* Scope toggle */}
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>配置方式</span>
        {(["unified", "per-stage"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className="px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition-all"
            style={{
              background: scope === s ? "var(--accent-purple)" : "var(--bg-card)",
              color: scope === s ? "#000" : "var(--text-secondary)",
              border: `1px solid ${scope === s ? "var(--accent-purple)" : "var(--border)"}`,
            }}
          >
            {s === "unified" ? "◈ 统一提供方" : "◆ 识别层 / 决策层 分别配置"}
          </button>
        ))}
      </div>

      {scope === "unified" ? (
        <StageEditor
          token={token}
          title="◈ 统一提供商"
          subtitle={unified.provider || "未设置"}
          color={PROTOCOL_COLOR[catalog.find((p) => p.id === unified.provider)?.protocol ?? "openai"] ?? "var(--accent-blue)"}
          initial={unified}
          catalog={catalog}
          onSaved={(s) => setLastStatus(s)}
        />
      ) : (
        <>
          <StageEditor
            token={token}
            title="◇ 识别层 (Vision)"
            subtitle={vision.provider || "未设置"}
            color={PROTOCOL_COLOR[catalog.find((p) => p.id === vision.provider)?.protocol ?? "openai"] ?? "var(--accent-green)"}
            initial={vision}
            catalog={catalog}
            onSaved={(s) => setLastStatus(s)}
          />
          <StageEditor
            token={token}
            title="◆ 决策层 (Decision)"
            subtitle={decision.provider || "未设置"}
            color={PROTOCOL_COLOR[catalog.find((p) => p.id === decision.provider)?.protocol ?? "openai"] ?? "var(--accent-purple)"}
            initial={decision}
            catalog={catalog}
            onSaved={(s) => setLastStatus(s)}
          />
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={handleSavePerStage}
              disabled={savingPerStage}
              className="px-5 py-2 rounded-xl text-sm font-mono font-bold transition-all"
              style={{
                background: savingPerStage ? "var(--bg-card)" : "var(--accent-purple)",
                color: savingPerStage ? "var(--text-muted)" : "#fff",
                border: savingPerStage ? "1px solid var(--border)" : "none",
                cursor: savingPerStage ? "not-allowed" : "pointer",
              }}
            >
              {savingPerStage ? "◈ 保存中..." : "💾 Save (vision + decision)"}
            </button>
          </div>
        </>
      )}

      {pageMsg && (
        <div
          className="mt-2 mb-6 px-4 py-2 rounded-lg text-sm animate-fade-in"
          style={{
            background: pageMsg.type === "ok" ? "rgba(0,229,160,0.08)" : "rgba(255,59,59,0.08)",
            border: `1px solid ${pageMsg.type === "ok" ? "var(--accent-green)" : "var(--accent-red)"}`,
            color: pageMsg.type === "ok" ? "var(--accent-green)" : "var(--accent-red)",
          }}
        >
          {pageMsg.text}
        </div>
      )}

      {/* Current status summary (pulled from GET /admin/llm/provider) */}
      <div className="rounded-2xl p-5 mb-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-bold tracking-widest" style={{ color: "var(--text-muted)" }}>
            当前激活
          </div>
          {lastStatus?.override_active && (
            <span
              className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ background: "rgba(180,122,255,0.12)", color: "var(--accent-purple)", border: "1px solid var(--accent-purple)" }}
              title="运行时覆盖已生效"
            >
              override active
            </span>
          )}
        </div>
        {!lastStatus ? (
          <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            等待加载…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="p-3 rounded-lg" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
                <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Provider</div>
                <div className="font-mono mt-1 truncate" style={{ color: "var(--text-primary)" }}>
                  {lastStatus.provider_label || lastStatus.provider}
                </div>
                <div className="text-xs font-mono mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                  id: {lastStatus.provider}
                </div>
              </div>
              <div className="p-3 rounded-lg" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
                <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Model</div>
                <div className="font-mono mt-1 truncate" style={{ color: "var(--text-primary)" }}>
                  {lastStatus.external_model || lastStatus.ollama_model || "—"}
                </div>
                <div className="text-xs font-mono mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                  {(lastStatus.external_base_url || lastStatus.ollama_base_url || "").slice(0, 60)}
                </div>
              </div>
              <div className="p-3 rounded-lg" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
                <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>API Key</div>
                <div className="font-mono mt-1">
                  {lastStatus.provider === "ollama" ? (
                    <span style={{ color: "var(--text-muted)" }}>n/a (ollama)</span>
                  ) : lastStatus.external_api_key_set ? (
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ background: "rgba(0,229,160,0.12)", color: "var(--accent-green)" }}
                    >
                      API Key configured
                    </span>
                  ) : (
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ background: "rgba(255,59,59,0.12)", color: "var(--accent-red)" }}
                    >
                      API Key not configured
                    </span>
                  )}
                </div>
                <div className="text-xs font-mono mt-1 truncate" style={{ color: "var(--text-muted)" }}>
                  scope: {scope}
                </div>
              </div>
            </div>
            {lastStatus.stages && (
              <div className="mt-3 text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                vision: {lastStatus.stages.vision.provider} / {lastStatus.stages.vision.model}
                {"  ·  "}
                decision: {lastStatus.stages.decision.provider} / {lastStatus.stages.decision.model}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
