import { getApiBase } from "@uav/api";
"use client"
import { useState, useRef, useEffect } from "react"
import { useAuth } from "@/components/AuthContext"
import { ragSearch } from "@/lib/api"

// SOP 事件类型配置
const SOP_INCIDENT_TYPES = [
  { key: "collision", label: "碰撞事故", color: "var(--accent-red)", icon: "💥" },
  { key: "pothole", label: "道路坑洞", color: "var(--accent-amber)", icon: "🕳️" },
  { key: "obstacle", label: "道路障碍物", color: "var(--accent-orange)", icon: "🚧" },
  { key: "pedestrian", label: "行人闯入", color: "var(--accent-purple)", icon: "🚶" },
  { key: "congestion", label: "交通拥堵", color: "var(--accent-blue)", icon: "🚗" },
  { key: "none", label: "正常状态", color: "var(--accent-green)", icon: "✅" },
]

// 预设 SOP 数据（用于展示）
const PRESET_SOPS = [
  { id: "sop_1", incident_type: "none", severity: "none", title: "道路正常通行", desc: "道路畅通，无异常物体/人员/事件", action: "正常行驶" },
  { id: "sop_2", incident_type: "collision", severity: "mid", title: "轻微碰撞事故", desc: "两车近距离接触，单一碰撞点，无人员被困", action: "开启双闪，缓慢移至路边，联系保险公司" },
  { id: "sop_3", incident_type: "collision", severity: "high", title: "严重交通事故", desc: "车辆变形严重，多车连环追尾，有烟雾/火花", action: "立即报警，开启双闪，三角牌150m外，人员撤离" },
  { id: "sop_4", incident_type: "pothole", severity: "mid", title: "小型坑洞", desc: "单个小坑洞，直径<50cm，深度<10cm", action: "减速通过，记录位置，报告养护部门" },
  { id: "sop_5", incident_type: "pothole", severity: "high", title: "严重路面损坏", desc: "多个坑洞群，或单个大坑，直径>1m", action: "立即报告，设置警告标志，绕行" },
  { id: "sop_6", incident_type: "obstacle", severity: "mid", title: "小型障碍物", desc: "小物体，掉落物，可单人移动", action: "减速绕行，记录位置，联系清理" },
  { id: "sop_7", incident_type: "obstacle", severity: "high", title: "大型障碍物", desc: "大型障碍物，交通事故遗留物，严重影响通行", action: "开启危险报警，保持车距，报警处理" },
  { id: "sop_8", incident_type: "pedestrian", severity: "high", title: "行人闯入高危", desc: "行人进入车道，奔跑，异常聚集，逆行", action: "立即减速，停车避让，必要时报警" },
  { id: "sop_9", incident_type: "pedestrian", severity: "mid", title: "行人安全区域", desc: "行人在人行道或安全区域，无异常行为", action: "保持正常行驶，注意观察" },
  { id: "sop_10", incident_type: "congestion", severity: "low", title: "常规交通拥堵", desc: "车辆排队，但缓慢移动，无停滞", action: "保持车距，耐心等待" },
  { id: "sop_11", incident_type: "congestion", severity: "high", title: "严重交通拥堵", desc: "车辆停滞，完全堵塞，有紧急车辆需要通行", action: "配合疏导，紧急车辆让行，报告指挥中心" },
]

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
  const [sopCount, setSopCount] = useState<number | null>(null)
  const [filterType, setFilterType] = useState<string>("all")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 获取 SOP 统计
  useEffect(() => {
    async function fetchSOPCount() {
      try {
        const API_BASE = getApiBase()
        const res = await fetch(`${API_BASE}/api/v1/admin/chromadb`)
        const data = await res.json()
        if (data.status === "running" || data.collections?.length > 0) {
          // ChromaDB 返回 collection 列表，但无法直接获取文档数量
          // 使用预设数量 11
          setSopCount(11)
        }
      } catch {
        setSopCount(11) // 回退到预设数量
      }
    }
    fetchSOPCount()
  }, [])

  if (!user) return null

  const token = user.token

  // AI 加工 SOP
  async function handleGenerateFromRaw() {
    if (!docText.trim() || !user) return
    setGenerating(true); setGenMsg(""); setError("")

    try {
      const API_BASE = getApiBase()
      const res = await fetch(`${API_BASE}/api/v1/admin/sop/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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
      const API_BASE = getApiBase()
      await fetch(`${API_BASE}/api/v1/admin/rag/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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
      const API_BASE = getApiBase()
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

      {/* SOP 知识库总览 */}
      <div className="mb-6">
        <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(74,158,255,0.15)" }}>
                <span style={{ fontSize: "20px" }}>◫</span>
              </div>
              <div>
                <div className="font-mono text-base font-bold" style={{ color: "var(--text-primary)" }}>SOP 知识库</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>无人机道路异常处置规范 · ChromaDB 向量检索</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold font-mono" style={{ color: "var(--accent-amber)" }}>{sopCount ?? "—"}</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>SOP 文档</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold font-mono" style={{ color: "var(--accent-green)" }}>5</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>事件类型</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold font-mono" style={{ color: "var(--accent-purple)" }}>3</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>风险等级</div>
              </div>
            </div>
          </div>

          {/* 事件类型筛选 */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setFilterType("all")}
              className="px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
              style={{
                background: filterType === "all" ? "var(--accent-amber)" : "var(--bg-primary)",
                color: filterType === "all" ? "#000" : "var(--text-secondary)",
                border: `1px solid ${filterType === "all" ? "var(--accent-amber)" : "var(--border)"}`,
              }}
            >
              全部 ({PRESET_SOPS.length})
            </button>
            {SOP_INCIDENT_TYPES.map((t) => {
              const count = PRESET_SOPS.filter(s => s.incident_type === t.key).length
              return (
                <button
                  key={t.key}
                  onClick={() => setFilterType(t.key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5"
                  style={{
                    background: filterType === t.key ? t.color : "var(--bg-primary)",
                    color: filterType === t.key ? "#000" : "var(--text-secondary)",
                    border: `1px solid ${filterType === t.key ? t.color : "var(--border)"}`,
                  }}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                  <span>({count})</span>
                </button>
              )
            })}
          </div>

          {/* SOP 列表 */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {PRESET_SOPS.filter(s => filterType === "all" || s.incident_type === filterType).map((sop) => {
              const typeConfig = SOP_INCIDENT_TYPES.find(t => t.key === sop.incident_type) || SOP_INCIDENT_TYPES[5]
              const severityColor = sop.severity === "high" ? "var(--accent-red)" : sop.severity === "mid" ? "var(--accent-amber)" : "var(--accent-green)"
              return (
                <div
                  key={sop.id}
                  className="flex items-center gap-3 p-3 rounded-lg transition-all hover:brightness-110"
                  style={{ background: "var(--bg-primary)", border: `1px solid var(--border)` }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${typeConfig.color}20` }}>
                    <span style={{ fontSize: "16px" }}>{typeConfig.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{sop.title}</span>
                      <span className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: `${severityColor}20`, color: severityColor }}>
                        {sop.severity === "high" ? "高风险" : sop.severity === "mid" ? "中风险" : sop.severity === "low" ? "低风险" : "正常"}
                      </span>
                    </div>
                    <div className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{sop.desc}</div>
                  </div>
                  <div className="text-right shrink-0 max-w-48">
                    <div className="text-xs font-mono px-2 py-1 rounded" style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
                      {sop.action}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
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
