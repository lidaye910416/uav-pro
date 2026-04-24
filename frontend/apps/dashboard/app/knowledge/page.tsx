"use client"
import { useState } from "react"
import Sidebar from "../../components/Layout/Sidebar"

interface KBDoc {
  id: number
  title: string
  content: string
  created_at: string
  tags: string[]
}

const MOCK_DOCS: KBDoc[] = [
  { id: 1, title: "应急车道违规停车处置 SOP", content: "当检测到车辆在京港澳高速北行方向应急车道内违规停靠时，应立即记录车牌信息，开启双闪灯，通知高速交警处置...", created_at: "2026-01-15 10:23", tags: ["应急车道", "停车", "处置"] },
  { id: 2, title: "道路遗撒物清理流程", content: "发现行车道内有不明遗撒物时，应开启警示灯，开启双闪，摆放三角警示牌，通知路政部门清理，同步更新路况信息...", created_at: "2026-01-14 14:32", tags: ["遗撒物", "清理", "路政"] },
  { id: 3, title: "交通事故现场记录规范", content: "交通事故处置流程：开启双闪，人员撤离至护栏外，记录现场情况，通知交警和救援，记录车牌和现场照片...", created_at: "2026-01-13 09:15", tags: ["事故", "记录", "处置"] },
  { id: 4, title: "行人闯入高速公路处置", content: "发现行人在高速公路行车道内行走时，应立即通知高速交警和路政部门，防止事故发生，记录行人特征...", created_at: "2026-01-12 16:45", tags: ["行人", "闯入", "安全"] },
  { id: 5, title: "交通拥堵疏导方案", content: "当多辆车速度持续低于 30km/h 超过 5 分钟时，触发交通拥堵预警，持续监控，必要时触发交通诱导和信息发布...", created_at: "2026-01-11 11:20", tags: ["拥堵", "疏导", "诱导"] },
]

export default function KnowledgePage() {
  const [docs, setDocs] = useState<KBDoc[]>(MOCK_DOCS)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<KBDoc | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editDoc, setEditDoc] = useState<KBDoc | null>(null)
  const [formTitle, setFormTitle] = useState("")
  const [formContent, setFormContent] = useState("")
  const [formTags, setFormTags] = useState("")

  const filtered = docs.filter(
    (d) =>
      !search ||
      d.title.includes(search) ||
      d.content.includes(search) ||
      d.tags.some((t) => t.includes(search))
  )

  function openAdd() {
    setFormTitle("")
    setFormContent("")
    setFormTags("")
    setEditDoc(null)
    setAddOpen(true)
  }

  function openEdit(doc: KBDoc) {
    setFormTitle(doc.title)
    setFormContent(doc.content)
    setFormTags(doc.tags.join(", "))
    setEditDoc(doc)
    setAddOpen(true)
  }

  function handleSave() {
    const tags = formTags.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
    if (editDoc) {
      setDocs((prev) => prev.map((d) => d.id === editDoc.id ? { ...d, title: formTitle, content: formContent, tags } : d))
    } else {
      setDocs((prev) => [
        { id: Date.now(), title: formTitle, content: formContent, created_at: new Date().toLocaleString("zh-CN"), tags },
        ...prev,
      ])
    }
    setAddOpen(false)
  }

  function handleDelete(id: number) {
    setDocs((prev) => prev.filter((d) => d.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  return (
    <>
      <Sidebar />
      <div className="min-h-screen p-6 flex gap-6 ml-60" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Left: doc list */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-widest" style={{ color: "var(--text-primary)" }}>知识库</h1>
          <button
            onClick={openAdd}
            className="px-3 py-1.5 rounded-lg text-xs font-mono"
            style={{ background: "var(--accent-blue)", color: "#000" }}
          >
            + 添加
          </button>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索文档..."
          className="w-full px-3 py-2 rounded-lg text-xs font-mono"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        />

        <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          {filtered.length} 条文档
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              onClick={() => setSelected(doc)}
              className="p-3 rounded-xl cursor-pointer transition-all"
              style={{
                background: selected?.id === doc.id ? "var(--bg-card)" : "transparent",
                border: `1px solid ${selected?.id === doc.id ? "var(--accent-blue)" : "var(--border)"}`,
              }}
            >
              <div className="text-xs font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                {doc.title}
              </div>
              <div className="text-xs mb-2" style={{ color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {doc.content.slice(0, 60)}...
              </div>
              <div className="flex gap-1 flex-wrap">
                {doc.tags.map((t) => (
                  <span key={t} className="px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--bg-primary)", color: "var(--accent-blue)" }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: doc detail */}
      <div className="flex-1">
        {selected ? (
          <div className="p-6 rounded-2xl h-full" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold mb-1" style={{ color: "var(--text-primary)" }}>{selected.title}</h2>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>创建于 {selected.created_at}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(selected)}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(selected.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono"
                  style={{ border: "1px solid var(--accent-red)", color: "var(--accent-red)" }}
                >
                  删除
                </button>
              </div>
            </div>
            <div className="flex gap-1.5 mb-4 flex-wrap">
              {selected.tags.map((t) => (
                <span key={t} className="px-2 py-1 rounded text-xs" style={{ background: "rgba(74,158,255,0.1)", color: "var(--accent-blue)" }}>
                  {t}
                </span>
              ))}
            </div>
            <div
              className="text-xs leading-relaxed"
              style={{ color: "var(--text-secondary)", whiteSpace: "pre-wrap", fontFamily: "var(--font-mono, monospace)" }}
            >
              {selected.content}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
            <div className="text-center">
              <div className="text-4xl mb-3 opacity-20">◫</div>
              <div className="text-sm font-mono">选择左侧文档查看详情</div>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
          onClick={(e) => e.target === e.currentTarget && setAddOpen(false)}
        >
          <div className="w-full max-w-lg p-6 rounded-2xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="font-bold text-sm mb-4">{editDoc ? "编辑文档" : "添加文档"}</div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>标题</label>
                <input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs font-mono"
                  style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>内容</label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg text-xs font-mono resize-none"
                  style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>标签（逗号分隔）</label>
                <input
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="应急车道, 停车, 处置"
                  className="w-full px-3 py-2 rounded-lg text-xs font-mono"
                  style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAddOpen(false)} className="px-4 py-2 rounded-lg text-xs font-mono" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                取消
              </button>
              <button onClick={handleSave} className="px-4 py-2 rounded-lg text-xs font-mono" style={{ background: "var(--accent-blue)", color: "#000" }}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
