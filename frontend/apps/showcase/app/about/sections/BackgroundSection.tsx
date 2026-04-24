// ═══════════════════════════════════════════════════════════════════════════
// Background Section — 项目背景
// ═══════════════════════════════════════════════════════════════════════════

interface BackgroundSectionProps {
  inView: boolean
}

export default function BackgroundSection({ inView }: BackgroundSectionProps) {
  const highlights = [
    { icon: "▲", value: "45%", label: "年增长率", desc: "低空经济市场规模持续扩大" },
    { icon: "◇", value: "万亿级", label: "市场潜力", desc: "国家战略性新兴产业方向" },
    { icon: "◆", value: "100+", label: "试点城市", desc: "低空开放区域加速扩展" },
    { icon: "○", value: "智能+", label: "技术融合", desc: "AI赋能空域安全管理" },
  ]
  return (
    <section id="background" className={`about-section${inView ? " in-view" : ""}`}>
      <div className="about-tag">BACKGROUND</div>
      <h2 className="about-title">项目背景</h2>
      <div className="about-bar" style={{ background: "var(--accent-amber)" }} />
      <p className="about-desc">
        随着低空空域改革持续深化，无人机物流、城市空中交通、通用航空等新业态蓬勃发展。
        低空经济作为国家战略性新兴产业，正成为推动经济高质量发展的新引擎。
        国家陆续出台《无人驾驶航空器飞行管理暂行条例》等政策，为低空经济规范化发展奠定基础。
      </p>
      <div className="about-metrics">
        {highlights.map((h) => (
          <div key={h.label} className="about-metric">
            <div className="about-metric-value" style={{ color: "var(--accent-amber)" }}>{h.value}</div>
            <div className="about-metric-label">{h.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
