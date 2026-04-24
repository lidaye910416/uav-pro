// ═══════════════════════════════════════════════════════════════════════════
// Solution Section — 解决方案
// ═══════════════════════════════════════════════════════════════════════════

interface SolutionSectionProps {
  inView: boolean
}

export default function SolutionSection({ inView }: SolutionSectionProps) {
  const features = [
    {
      icon: "◎",
      title: "空天地一体化感知",
      desc: "整合无人机航拍、地面摄像头、雷达等多源感知设备，构建全域覆盖的感知网络",
    },
    {
      icon: "◆",
      title: "AI 智能决策引擎",
      desc: "基于多模态大模型，实现目标识别、轨迹跟踪、风险评估全流程智能化",
    },
    {
      icon: "◈",
      title: "RAG 知识增强",
      desc: "融合行业规范、SOP 流程、安全标准等知识库，提升决策的专业性与合规性",
    },
    {
      icon: "◇",
      title: "实时预警响应",
      desc: "毫秒级风险识别，秒级预警推送，实现从发现到处置的端到端闭环",
    },
  ]
  return (
    <section id="solution" className={`about-section${inView ? " in-view" : ""}`}>
      <div className="about-tag">SOLUTION</div>
      <h2 className="about-title">解决方案</h2>
      <div className="about-bar" style={{ background: "var(--accent-green)" }} />
      <p className="about-desc">
        构建<strong style={{ color: "var(--accent-amber)" }}>低空安全监测与智能决策系统</strong>，
        面向低空经济场景提供安全监测与智能决策解决方案，实现全域感知、智能分析、精准预警、高效处置。
      </p>
      <div className="about-features-grid">
        {features.map((f) => (
          <div key={f.title} className="about-feature-card">
            <div className="about-feature-icon" style={{ color: "var(--accent-amber)" }}>{f.icon}</div>
            <h3 className="about-feature-title">{f.title}</h3>
            <p className="about-feature-desc">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
