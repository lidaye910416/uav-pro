// ═══════════════════════════════════════════════════════════════════════════
// Overview Section — 项目概览
// ═══════════════════════════════════════════════════════════════════════════

interface OverviewSectionProps {
  inView: boolean
}

export default function OverviewSection({ inView }: OverviewSectionProps) {
  const metrics = [
    { value: "94.2%", label: "预警准确率", color: "var(--accent-green)" },
    { value: "25 FPS", label: "帧处理速率", color: "var(--accent-amber)" },
    { value: "1,423", label: "知识库规模", color: "var(--accent-blue)" },
    { value: "230ms", label: "端到端延迟", color: "var(--accent-purple)" },
  ]
  return (
    <section id="overview" className={`about-section${inView ? " in-view" : ""}`}>
      <div className="about-tag">OVERVIEW</div>
      <h2 className="about-title">项目概览</h2>
      <div className="about-bar" style={{ background: "var(--accent-amber)" }} />
      <p className="about-desc">
        基于<span style={{ color: "var(--accent-amber)" }}>空天地一体化</span> +
        <span style={{ color: "var(--accent-green)" }}> 生成式 AI</span> 驱动的低空安全智能预警决策系统。
        融合低成本无人机航拍、计算机视觉、RAG 检索和大语言模型决策，
        实现<span style={{ color: "var(--accent-amber)", fontWeight: 600 }}>全天候 · 全链路</span>的低空安全风险感知与预警。
      </p>
      <div className="about-metrics">
        {metrics.map((m) => (
          <div key={m.label} className="about-metric">
            <div className="about-metric-value" style={{ color: m.color }}>{m.value}</div>
            <div className="about-metric-label">{m.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
