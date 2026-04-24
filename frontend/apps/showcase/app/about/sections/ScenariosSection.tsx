// ═══════════════════════════════════════════════════════════════════════════
// Scenarios Section — 应用场景
// ═══════════════════════════════════════════════════════════════════════════

interface ScenariosSectionProps {
  inView: boolean
}

export default function ScenariosSection({ inView }: ScenariosSectionProps) {
  const scenarios = [
    { label: "高速公路", desc: "应急车道监测 · 障碍物检测 · 事故预警", color: "var(--accent-amber)" },
    { label: "桥梁隧道", desc: "结构巡检 · 异常振动 · 人车流监控", color: "var(--accent-green)" },
    { label: "园区厂区", desc: "周界安防 · 人员闯入 · 设备监测", color: "var(--accent-blue)" },
    { label: "铁路沿线", desc: "异物入侵检测 · 接触网状态监测", color: "var(--accent-purple)" },
    { label: "机场周边", desc: "无人机黑飞监测 · 净空区保护", color: "var(--accent-red)" },
    { label: "景区管理", desc: "低空旅游监管 · 游客安全保障", color: "var(--accent-green)" },
    { label: "物流配送", desc: "无人机物流监控 · 路径规划辅助", color: "var(--accent-amber)" },
    { label: "大型活动", desc: "禁飞区管控 · 人群安全监测", color: "var(--accent-blue)" },
  ]
  return (
    <section id="scenarios" className={`about-section${inView ? " in-view" : ""}`}>
      <div className="about-tag">SCENARIOS</div>
      <h2 className="about-title">应用场景</h2>
      <div className="about-bar" style={{ background: "var(--accent-purple)" }} />
      <div className="about-scenarios-grid">
        {scenarios.map((s) => (
          <div key={s.label} className="about-scenario-card">
            <div className="about-scenario-dot" style={{ background: s.color }} />
            <div className="about-scenario-label" style={{ color: s.color }}>{s.label}</div>
            <div className="about-scenario-desc">{s.desc}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
