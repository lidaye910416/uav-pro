// ═══════════════════════════════════════════════════════════════════════════
// Results Section — 成果展示
// ═══════════════════════════════════════════════════════════════════════════

interface ResultsSectionProps {
  inView: boolean
}

export default function ResultsSection({ inView }: ResultsSectionProps) {
  const stats = [
    { value: "5+",    label: "试点区域",       color: "var(--accent-amber)" },
    { value: "99.1%", label: "系统可用率",   color: "var(--accent-green)" },
    { value: "8h+",   label: "日均运行时长",  color: "var(--accent-blue)" },
    { value: "120+",  label: "月均预警次数",  color: "var(--accent-purple)" },
  ]
  const outcomes = [
    { icon: "◆", title: "构建监测平台", desc: "建成低空活动监测平台，实现重点区域全覆盖" },
    { icon: "◇", title: "区域覆盖", desc: "实现重点区域全面覆盖，形成可复制推广模式" },
    { icon: "◎", title: "服务发展", desc: "服务低空经济高质量发展，推动行业规范化建设" },
  ]
  return (
    <section id="results" className={`about-section${inView ? " in-view" : ""}`}>
      <div className="about-tag">RESULTS</div>
      <h2 className="about-title">成果展示</h2>
      <div className="about-bar" style={{ background: "var(--accent-green)" }} />
      <div className="about-metrics">
        {stats.map((s) => (
          <div key={s.label} className="about-metric">
            <div className="about-metric-value" style={{ color: s.color }}>{s.value}</div>
            <div className="about-metric-label">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="about-section-title">预期成果</div>
      <div className="about-outcomes">
        {outcomes.map((o) => (
          <div key={o.title} className="about-outcome">
            <span className="about-outcome-icon" style={{ color: "var(--accent-amber)" }}>{o.icon}</span>
            <div className="about-outcome-content">
              <div className="about-outcome-title">{o.title}</div>
              <div className="about-outcome-desc">{o.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
