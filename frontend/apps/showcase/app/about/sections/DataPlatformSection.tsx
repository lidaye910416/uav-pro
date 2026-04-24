// ═══════════════════════════════════════════════════════════════════════════
// Data Platform Section — 数据与平台层
// ═══════════════════════════════════════════════════════════════════════════

interface DataPlatformSectionProps {
  inView: boolean
}

export default function DataPlatformSection({ inView }: DataPlatformSectionProps) {
  const dataStacks = [
    { label: "时序数据", desc: "飞行轨迹、环境参数、设备状态", color: "var(--accent-amber)" },
    { label: "轨迹数据", desc: "目标运动轨迹、历史回放分析", color: "var(--accent-green)" },
    { label: "告警数据", desc: "预警记录、处置流程、统计分析", color: "var(--accent-red)" },
    { label: "知识向量", desc: "SOP 规范、安全标准、行业知识", color: "var(--accent-blue)" },
  ]
  const platformStacks = [
    { label: "数据中台", desc: "数据采集、清洗、存储、分析", icon: "◇" },
    { label: "AI 中台", desc: "模型训练、推理服务、迭代优化", icon: "◆" },
    { label: "知识库", desc: "RAG 检索、向量匹配、智能问答", icon: "◎" },
  ]
  return (
    <section id="data-platform" className={`about-section${inView ? " in-view" : ""}`}>
      <div className="about-tag">DATA & PLATFORM</div>
      <h2 className="about-title">数据与平台</h2>
      <div className="about-bar" style={{ background: "var(--accent-blue)" }} />
      <div className="about-section-subtitle">数据资源</div>
      <div className="about-data-grid">
        {dataStacks.map((d) => (
          <div key={d.label} className="about-data-card">
            <div className="about-data-label" style={{ color: d.color }}>{d.label}</div>
            <div className="about-data-desc">{d.desc}</div>
          </div>
        ))}
      </div>
      <div className="about-section-subtitle">能力平台</div>
      <div className="about-platform-grid">
        {platformStacks.map((p) => (
          <div key={p.label} className="about-platform-card">
            <div className="about-platform-icon">{p.icon}</div>
            <div className="about-platform-label">{p.label}</div>
            <div className="about-platform-desc">{p.desc}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
