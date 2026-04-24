// ═══════════════════════════════════════════════════════════════════════════
// Problems Section — 核心问题
// ═══════════════════════════════════════════════════════════════════════════

interface ProblemsSectionProps {
  inView: boolean
}

export default function ProblemsSection({ inView }: ProblemsSectionProps) {
  const problems = [
    {
      num: "01",
      title: "监管能力不足",
      desc: "低空飞行器活动日益频繁，传统监管手段难以实现全域覆盖，监管效率低下",
      color: "var(--accent-red)",
    },
    {
      num: "02",
      title: "安全隐患突出",
      desc: "无人机黑飞、违规飞行事件频发，缺乏有效的安全预警和应急处置机制",
      color: "var(--accent-amber)",
    },
    {
      num: "03",
      title: "空域管理复杂",
      desc: "低空空域结构复杂，多类型飞行器混合作业，传统管理方式难以适应",
      color: "var(--accent-purple)",
    },
    {
      num: "04",
      title: "数据孤岛严重",
      desc: "各系统数据分散，缺乏统一的数据融合平台，难以实现智能化分析决策",
      color: "var(--accent-blue)",
    },
  ]
  return (
    <section id="problems" className={`about-section${inView ? " in-view" : ""}`}>
      <div className="about-tag">PROBLEMS</div>
      <h2 className="about-title">核心问题</h2>
      <div className="about-bar" style={{ background: "var(--accent-red)" }} />
      <div className="about-problems-grid">
        {problems.map((p) => (
          <div key={p.num} className="about-problem-card">
            <div className="about-problem-num" style={{ color: p.color }}>{p.num}</div>
            <h3 className="about-problem-title" style={{ color: p.color }}>{p.title}</h3>
            <p className="about-problem-desc">{p.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
