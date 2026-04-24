// ═══════════════════════════════════════════════════════════════════════════
// ResearchFrameworkSection — 研究思路
// ═══════════════════════════════════════════════════════════════════════════

interface ResearchFrameworkSectionProps {
  inView: boolean
}

export default function ResearchFrameworkSection({ inView }: ResearchFrameworkSectionProps) {
  const approaches = [
    {
      title: "理论模型构建",
      desc: "深入剖析低空经济发展规律，构建时空数据要素驱动的理论模型，揭示数据赋能产业发展的内在核心机理。",
      color: "var(--accent-amber)",
    },
    {
      title: "核心技术底座",
      desc: "打造低空经济时空数据要素底座，重点攻克数据的标准化治理、多源异构融合与智能化处理等关键技术难题。",
      color: "var(--accent-green)",
    },
    {
      title: "示范应用落地",
      desc: "聚焦物流、巡检、应急等「低空+」重点领域，开展全流程示范应用，充分验证理论模型与技术底座的有效性。",
      color: "var(--accent-blue)",
    },
  ]
  const innovations = [
    {
      title: "数据要素化",
      desc: "将卫星、无人机、地面传感器等多源时空数据，转化为可流通、可计量的高质量数据资产，确立其核心生产要素地位。",
      color: "var(--accent-purple)",
    },
    {
      title: "全链驱动机制",
      desc: "深度融合时空数据与低空产业链，探索在规划设计、运营管控、场景服务等核心环节的数据驱动模式与应用路径。",
      color: "var(--accent-amber)",
    },
    {
      title: "多维价值转化",
      desc: "构建数据要素市场化配置机制，将时空数据的潜在价值有效转化为具体的经济效益和社会服务价值，赋能低空经济可持续发展。",
      color: "var(--accent-green)",
    },
  ]
  return (
    <section id="research-framework" className={`about-section${inView ? " in-view" : ""}`}>
      <div className="about-tag">RESEARCH FRAMEWORK</div>
      <h2 className="about-title">研究思路</h2>
      <div className="about-bar" style={{ background: "var(--accent-green)" }} />

      {/* 模块一：总体研究思路 */}
      <div className="about-framework-module">
        <div className="about-framework-module-header">
          <span className="about-framework-module-label">模块一</span>
          <span className="about-framework-module-title">总体研究思路</span>
        </div>
        <p className="about-framework-intro">
          本研究遵循"理论创新引领、技术创新驱动、应用创新落地"的总体思路，构建一个闭环的研究与实践体系，
          旨在打通从理论模型到技术实现，再到场景应用的完整链路。
        </p>
        <div className="about-framework-cards">
          {approaches.map((a) => (
            <div key={a.title} className="about-framework-card">
              <div className="about-framework-card-dot" style={{ background: a.color }} />
              <div className="about-framework-card-title" style={{ color: a.color }}>{a.title}</div>
              <p className="about-framework-card-desc">{a.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 模块二：核心理论创新 */}
      <div className="about-framework-module">
        <div className="about-framework-module-header">
          <span className="about-framework-module-label">模块二</span>
          <span className="about-framework-module-title">核心理论创新</span>
        </div>
        <div className="about-framework-cards">
          {innovations.map((i) => (
            <div key={i.title} className="about-framework-card">
              <div className="about-framework-card-dot" style={{ background: i.color }} />
              <div className="about-framework-card-title" style={{ color: i.color }}>{i.title}</div>
              <p className="about-framework-card-desc">{i.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
