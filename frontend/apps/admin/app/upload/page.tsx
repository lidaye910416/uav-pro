"use client"
import { useState, useRef } from "react"
import { useAuth } from "@/components/AuthContext"
import { analyzeImage } from "@/lib/api"

export default function UploadPage() {
  const { user } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  if (!user) return null

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f); setResult(null); setError("")
    const url = URL.createObjectURL(f)
    setPreview(url)
  }

  async function handleAnalyze() {
    if (!file || !user) return
    setLoading(true); setError("")
    try {
      setResult(await analyzeImage(user.token, file))
    } catch (e: any) { setError(e.message || "分析失败") }
    setLoading(false)
  }

  const riskColors: Record<string, string> = {
    critical: "var(--accent-red)", high: "var(--accent-amber)",
    medium: "var(--accent-blue)", low: "var(--accent-green)",
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold font-mono tracking-wider">图像分析测试</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>上传图像，调用视觉推理 + RAG + 决策链</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload */}
        <div>
          <div className="rounded-xl p-4 mb-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="font-mono text-base font-bold mb-3" style={{ color: "var(--text-secondary)" }}>上传图像</div>
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all"
              style={{ borderColor: "var(--border)" }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                const f = e.dataTransfer.files[0]
                if (f) { setFile(f); setPreview(URL.createObjectURL(f)) }
              }}>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              {preview ? (
                <img src={preview} alt="preview" className="max-h-64 mx-auto rounded-lg" />
              ) : (
                <div style={{ color: "var(--text-muted)" }}>
                  <div className="text-4xl mb-3 opacity-40">◉</div>
                  <div className="text-base">拖拽图像到这里，或点击选择</div>
                  <div className="text-sm mt-1">支持 JPG, PNG</div>
                </div>
              )}
            </div>
            {file && (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-mono truncate max-w-xs" style={{ color: "var(--text-secondary)" }}>{file.name}</span>
                <button onClick={handleAnalyze} disabled={loading}
                  className="px-4 py-2 rounded-lg text-sm font-mono font-bold transition-all hover:brightness-110 disabled:opacity-50"
                  style={{ background: "var(--accent-amber)", color: "#000" }}>
                  {loading ? "分析中…" : "开始分析"}
                </button>
              </div>
            )}
            {error && <p className="text-sm mt-2" style={{ color: "var(--accent-red)" }}>{error}</p>}
          </div>
        </div>

        {/* Result */}
        <div>
          {result ? (
            <div className="rounded-xl p-5 animate-fade-in" style={{ background: "var(--bg-card)", border: `1px solid ${riskColors[result.risk_level] || "var(--border)"}40` }}>
              <div className="flex items-center justify-between mb-4">
                <div className="font-mono text-base font-bold" style={{ color: "var(--text-secondary)" }}>分析结果</div>
                <span className="text-sm font-mono px-2 py-0.5 rounded"
                  style={{ background: result.should_alert ? "rgba(255,59,59,0.1)" : "rgba(0,229,160,0.1)", color: result.should_alert ? "var(--accent-red)" : "var(--accent-green)" }}>
                  {result.should_alert ? "触发预警" : "正常"}
                </span>
              </div>
              {result.risk_level && (
                <div className="text-center mb-6 p-4 rounded-xl" style={{ background: "var(--bg-primary)", borderLeft: `4px solid ${riskColors[result.risk_level]}` }}>
                  <div className="font-mono text-sm uppercase mb-2" style={{ color: riskColors[result.risk_level] }}>风险等级</div>
                  <div className="text-3xl font-bold font-mono" style={{ color: riskColors[result.risk_level] }}>{result.risk_level}</div>
                </div>
              )}
              {result.title && <div className="mb-3"><div className="text-sm font-mono mb-1" style={{ color: "var(--text-muted)" }}>标题</div><div className="font-bold text-base">{result.title}</div></div>}
              {result.description && <div className="mb-3"><div className="text-sm font-mono mb-1" style={{ color: "var(--text-muted)" }}>描述</div><div className="text-base" style={{ color: "var(--text-secondary)" }}>{result.description}</div></div>}
              {result.recommendation && (
                <div className="mb-4 p-3 rounded-lg" style={{ background: "rgba(255,184,0,0.08)", borderLeft: "3px solid var(--accent-amber)", color: "var(--accent-amber)" }}>
                  <div className="text-sm font-mono mb-1">处置建议</div>{result.recommendation}
                </div>
              )}
              {result.confidence !== undefined && result.confidence !== null && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-mono" style={{ color: "var(--text-muted)" }}>置信度</span>
                    <span className="font-mono" style={{ color: "var(--accent-amber)" }}>{(result.confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-primary)" }}>
                    <div className="h-full rounded-full" style={{ width: `${(result.confidence as number) * 100}%`, background: "var(--accent-amber)" }} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl text-center py-20" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="text-3xl mb-3 opacity-20">◎</div>
              <div className="font-mono text-base" style={{ color: "var(--text-muted)" }}>上传图像后点击分析</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
