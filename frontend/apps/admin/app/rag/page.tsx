"use client"
import { useState, useRef } from "react"
import { useAuth } from "@/components/AuthContext"
import { ragSearch } from "@/lib/api"
import { API } from "@frontend/config"

export default function RAGPage() {
  const { user } = useAuth()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [docText, setDocText] = useState("")
  const [addMsg, setAddMsg] = useState("")
  const [error, setError] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState("")
  const [generating, setGenerating] = useState(false)
  const [genMsg, setGenMsg] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!user) return null

  // AI 加工 SOP
  async function handleGenerateFromRaw() {
    if (!docText.trim() || !user) return
    setGenerating(true); setGenMsg(""); setError("")

    try {
      const API_BASE = API.BASE
      const res = await fetch(`${API_BASE}/api/v1/admin/sop/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ raw_text: docText }),
      })
      const data = await res.json()
      if (data.ok && data.standard_sop) {
        setDocText(data.standard_sop)
        setGenMsg("✓ AI 加工完成，已生成标准 SOP")
        // 自动导入到知识库
        await importSOP(data.standard_sop)
      } else {
        setError(data.error || "AI 加工失败")
      }
    } catch (err: any) {
      setError(err.message)
    }
    setGenerating(false)
  }

  // 导入 SOP 到知识库
  async function importSOP(text: string) {
    try {
      const API_BASE = API.BASE
      await fetch(`${API_BASE}/api/v1/admin/rag/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ text }),
      })
      setAddMsg("✓ 已导入知识库")
      setTimeout(() => setAddMsg(""), 3000)
    } catch {
      setAddMsg("导入失败")
    }
  }

  async function handleSearch() {
    if (!query) return
    setLoading(true); setError("")
    try {
      const r: any = await ragSearch(query)
      setResults(r.results || [])
      if (r.error) setError(r.error)
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  async function handleAdd() {
    if (!docText || !user) return
    setError("")
    try {
      await importSOP(docText)
    } catch { setError("添加失败") }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true); setUploadMsg(""); setError("")

    const formData = new FormData()
    formData.append("file", file)

    try {
      const API_BASE = API.BASE
      const res = await fetch(`${API_BASE}/api/v1/admin/sop/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${user.token}` },
        body: formData,
      })
      const data = await res.json()
      if (data.ok) {
        setUploadMsg(`✓ 上传成功: ${data.message}`)
      } else {
        setError(data.detail || data.error || "上传失败")
      }
    } catch (err: any) {
      setError(err.message)
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold font-mono tracking-wider">SOP 知识库管理</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>智能 SOP 导入 · AI 加工标准化 · 知识检索</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Search */}
        <div className="space-y-4">
          <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="font-mono text-base font-bold mb-3" style={{ color: "var(--text-secondary)" }}>🔍 SOP 知识检索</div>
            <div className="flex gap-2">
              <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder="例如: 应急车道停车如何处理"
                className="flex-1 px-3 py-2 rounded-lg text-sm font-mono"
                style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }} />
              <button onClick={handleSearch} disabled={loading}
                className="px-4 py-2 rounded-lg text-sm font-mono font-bold transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: "var(--accent-amber)", color: "#000" }}>
                {loading ? "检索中…" : "检索"}
              </button>
            </div>
            {error && <p className="text-sm mt-2" style={{ color: "var(--accent-red)" }}>{error}</p>}
          </div>

          {results.length > 0 ? (
            <div className="space-y-3">
              {results.map((r, i) => (
                <div key={i} className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderLeft: `3px solid var(--accent-green)"` }}>
                  <div className="font-mono text-sm mb-2" style={{ color: "var(--accent-green)" }}>结果 {i + 1}</div>
                  <div className="text-base" style={{ color: "var(--text-secondary)" }}>{r}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl text-center py-12" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="text-3xl mb-2 opacity-20">◫</div>
              <div className="text-base" style={{ color: "var(--text-muted)" }}>输入查询词检索知识库</div>
            </div>
          )}
        </div>

        {/* Right: SOP Editor + Upload */}
        <div className="space-y-4">
          {/* SOP 编辑器 - 统一入口 */}
          <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="font-mono text-base font-bold mb-3" style={{ color: "var(--text-secondary)" }}>📝 SOP 编辑器</div>
            <textarea
              value={docText}
              onChange={e => setDocText(e.target.value)}
              rows={8}
              placeholder="输入或粘贴原始内容...\n支持以下格式导入:\n- 原始文档文本\n- 未格式化的规范描述\n系统会自动识别并 AI 加工成标准 SOP"
              className="w-full px-3 py-2 rounded-lg text-sm font-mono resize-none"
              style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
            />
            <div className="flex items-center gap-2 mt-3">
              <button onClick={handleGenerateFromRaw} disabled={!docText.trim() || generating}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-mono font-bold transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: "var(--accent-purple)", color: "#fff" }}>
                {generating ? "✨ AI 加工中..." : "✨ AI 加工标准化"}
              </button>
              <button onClick={handleAdd} disabled={!docText.trim()}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-mono font-bold transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: "var(--accent-green)", color: "#000" }}>
                导入知识库
              </button>
            </div>
            {genMsg && <p className="text-sm mt-2" style={{ color: "var(--accent-purple)" }}>{genMsg}</p>}
            {addMsg && <p className="text-sm mt-2" style={{ color: "var(--accent-green)" }}>{addMsg}</p>}
          </div>

          {/* SOP 文件导入 */}
          <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="font-mono text-base font-bold mb-3" style={{ color: "var(--text-secondary)" }}>📁 批量导入 SOP 文件</div>
            <div className="border-2 border-dashed rounded-lg p-6 text-center transition-all"
              style={{ borderColor: "var(--border)" }}>
              <input ref={fileInputRef} type="file" accept=".json,.txt,.md" onChange={handleFileUpload}
                className="hidden" id="sop-file-upload" />
              <label htmlFor="sop-file-upload" className="cursor-pointer">
                <div className="text-2xl mb-2">📤</div>
                <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  点击选择文件 · 支持拖拽
                </div>
                <div className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                  .json / .txt / .md 格式
                </div>
              </label>
            </div>
            {uploading && <p className="text-sm mt-3 text-center" style={{ color: "var(--accent-amber)" }}>上传中...</p>}
            {uploadMsg && <p className="text-sm mt-3 text-center" style={{ color: "var(--accent-green)" }}>{uploadMsg}</p>}
            {error && <p className="text-sm mt-3 text-center" style={{ color: "var(--accent-red)" }}>{error}</p>}
          </div>

          {/* 快速示例 */}
          <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="font-mono text-base font-bold mb-3" style={{ color: "var(--text-secondary)" }}>💡 快速示例</div>
            <div className="space-y-2">
              {[
                "根据道路交通安全法，应急车道仅供故障车辆临时停靠使用，违者罚款200元扣6分。",
                "交通拥堵时无人机发现违规车辆，应立即记录车牌号和违规时间，上报指挥中心。",
                "无人机检测到交通事故后，应自动计算影响范围并生成处置建议。",
              ].map((sop, i) => (
                <button key={i} onClick={() => setDocText(sop)}
                  className="block w-full text-left text-sm px-3 py-2 rounded-lg transition-all hover:brightness-110"
                  style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  {sop}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
