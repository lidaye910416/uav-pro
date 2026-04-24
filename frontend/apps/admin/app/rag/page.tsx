"use client"
import { useState } from "react"
import { useAuth } from "@/components/AuthContext"
import { ragSearch, ragAddDoc } from "@/lib/api"

export default function RAGPage() {
  const { user } = useAuth()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [docText, setDocText] = useState("")
  const [addMsg, setAddMsg] = useState("")
  const [error, setError] = useState("")

  if (!user) return null

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
    try {
      await ragAddDoc(user.token, docText)
      setAddMsg("添加成功 ✓")
      setDocText("")
      setTimeout(() => setAddMsg(""), 3000)
    } catch { setAddMsg("添加失败 ✗") }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold font-mono tracking-wider">RAG 知识库</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>SOP 规范文档检索 · 知识库管理</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Search */}
        <div className="space-y-4">
          <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="font-mono text-base font-bold mb-3" style={{ color: "var(--text-secondary)" }}>SOP 知识检索</div>
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

        {/* Right: Add knowledge */}
        <div className="space-y-4">
          <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="font-mono text-base font-bold mb-3" style={{ color: "var(--text-secondary)" }}>添加 SOP 文档</div>
            <textarea
              value={docText}
              onChange={e => setDocText(e.target.value)}
              rows={6}
              placeholder="输入 SOP 文档内容，例如:\n根据道路交通安全法，应急车道行驶或停车的处理规定如下..."
              className="w-full px-3 py-2 rounded-lg text-sm font-mono resize-none"
              style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-sm" style={{ color: addMsg.includes("成功") ? "var(--accent-green)" : "var(--accent-red)" }}>{addMsg}</span>
              <button onClick={handleAdd} disabled={!docText}
                className="px-4 py-2 rounded-lg text-sm font-mono font-bold transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: "var(--accent-amber)", color: "#000" }}>
                添加文档
              </button>
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="font-mono text-base font-bold mb-3" style={{ color: "var(--text-secondary)" }}>内置 SOP 示例</div>
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
