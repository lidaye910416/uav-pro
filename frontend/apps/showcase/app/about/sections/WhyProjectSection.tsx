// ═══════════════════════════════════════════════════════════════════════════
// Why Project Section — 为何选择低空+应急监测
// ═══════════════════════════════════════════════════════════════════════════

interface WhyProjectSectionProps {
  inView: boolean
}

export default function WhyProjectSection({ inView }: WhyProjectSectionProps) {
  const scenarios = [
    {
      icon: "◇",
      title: "大型基础设施安全",
      desc: "桥梁、隧道、高速公路等关键基础设施的结构监测与安全预警",
      color: "var(--accent-amber)",
    },
    {
      icon: "◆",
      title: "应急响应与灾害监测",
      desc: "突发事件快速响应，灾害现场的实时态势感知与辅助决策",
      color: "var(--accent-green)",
    },
  ]
  const challenges = [
    { label: "监管能力不足", icon: "▸" },
    { label: "安全隐患突出", icon: "▸" },
    { label: "空域管理复杂", icon: "▸" },
    { label: "数据孤岛严重", icon: "▸" },
  ]
  const solutions = [
    { label: "空天地一体化感知", icon: "◎" },
    { label: "AI 智能决策引擎", icon: "◎" },
    { label: "RAG 知识增强", icon: "◎" },
    { label: "实时预警响应", icon: "◎" },
  ]
  return (
    <section id="why-project" className={`about-section${inView ? " in-view" : ""}`}>
      <div className="about-tag">WHY THIS PROJECT</div>
      <h2 className="about-title">为何选择低空+应急监测</h2>
      <div className="about-bar" style={{ background: "var(--accent-purple)" }} />
      
      {/* 目标场景 */}
      <div className="about-why-section-title">目标场景</div>
      <div className="about-why-scenarios">
        {scenarios.map((s) => (
          <div key={s.title} className="about-why-scenario">
            <div className="about-why-scenario-icon" style={{ color: s.color }}>{s.icon}</div>
            <div className="about-why-scenario-content">
              <div className="about-why-scenario-title" style={{ color: s.color }}>{s.title}</div>
              <div className="about-why-scenario-desc">{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 核心挑战 */}
      <div className="about-why-section-title">核心挑战</div>
      <div className="about-why-challenges">
        {challenges.map((c) => (
          <div key={c.label} className="about-why-challenge">
            <span style={{ color: "var(--accent-red)" }}>{c.icon}</span>
            <span>{c.label}</span>
          </div>
        ))}
      </div>

      {/* 项目定位 */}
      <div className="about-why-position">
        <div className="about-why-position-label">项目定位</div>
        <div className="about-why-position-content">
          <span className="about-why-position-tag">空天地一体化</span>
          <span className="about-why-position-arrow">+</span>
          <span className="about-why-position-tag">AI 智能决策</span>
          <span className="about-why-position-arrow">→</span>
          <span className="about-why-position-tag highlight">低空安全预警系统</span>
        </div>
      </div>
    </section>
  )
}
