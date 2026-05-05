// ═══════════════════════════════════════════════════════════════════════════
// Scenarios Section — 应用场景
// 基于《时空数据要素驱动的低空经济多场景应用研究》中期检查报告
// ═══════════════════════════════════════════════════════════════════════════

interface ScenariosSectionProps {
  inView: boolean
}

// 五大应用领域（来源：中期检查报告）
const SCENARIOS = [
  {
    id: "smart-city",
    icon: "🏙",
    label: "低空+智慧城市",
    desc: "城市空间管理与规划",
    color: "var(--accent-amber)",
    details: "城市三维建模、违章建筑监测、市容环境巡查"
  },
  {
    id: "emergency",
    icon: "🚨",
    label: "低空+应急监测",
    desc: "灾害预警与响应",
    color: "var(--accent-green)",
    details: "自然灾害监测、应急救援指挥、灾后评估"
  },
  {
    id: "logistics",
    icon: "📦",
    label: "低空+物流配送",
    desc: "末端物流效率提升",
    color: "var(--accent-blue)",
    details: "无人机配送路径规划、末端配送监控"
  },
  {
    id: "energy",
    icon: "⚡",
    label: "低空+能源安全",
    desc: "能源设施巡检监测",
    color: "var(--accent-purple)",
    details: "输电线路巡检、油气管道监测、光伏电站检查"
  },
  {
    id: "beidou",
    icon: "🛰",
    label: "低空+北斗应用",
    desc: "精准定位与服务",
    color: "var(--accent-amber)",
    details: "高精度定位服务、北斗+无人机融合应用"
  },
]

export default function ScenariosSection({ inView }: ScenariosSectionProps) {
  return (
    <section id="scenarios" className={`about-section${inView ? " in-view" : ""}`}>
      <div className="about-tag">SCENARIOS</div>
      <h2 className="about-title">五大应用场景</h2>
      <div className="about-bar" style={{ background: "var(--accent-purple)" }} />
      <p className="about-desc">
        围绕五大应用领域，完成了场景应用的技术需求分析。无人机泛在定位终端已完成方案设计和核心算法研发。
      </p>
      <div className="about-scenarios-grid">
        {SCENARIOS.map((s) => (
          <div key={s.id} className="about-scenario-card">
            <div className="about-scenario-icon">{s.icon}</div>
            <div className="about-scenario-label" style={{ color: s.color }}>{s.label}</div>
            <div className="about-scenario-desc">{s.desc}</div>
            <div className="about-scenario-details">{s.details}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
