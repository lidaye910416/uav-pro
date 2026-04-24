// ═══════════════════════════════════════════════════════════════════════════
// Capabilities Section — 核心能力
// ═══════════════════════════════════════════════════════════════════════════

interface CapabilitiesSectionProps {
  inView: boolean
}

export default function CapabilitiesSection({ inView }: CapabilitiesSectionProps) {
  const caps = [
    {
      label: "实时监测",
      color: "var(--accent-amber)",
      features: [
        "多源视频流实时接入",
        "目标检测与跟踪",
        "异常行为实时识别",
        "态势一张图展示",
      ],
    },
    {
      label: "历史查询",
      color: "var(--accent-green)",
      features: [
        "轨迹回放与回溯",
        "告警记录查询",
        "数据统计分析",
        "报表导出打印",
      ],
    },
    {
      label: "智能预警",
      color: "var(--accent-red)",
      features: [
        "多级风险等级判定",
        "RAG 知识增强决策",
        "秒级预警推送",
        "处置建议自动生成",
      ],
    },
    {
      label: "数据分析",
      color: "var(--accent-blue)",
      features: [
        "趋势预测分析",
        "热力图可视化",
        "多维度统计",
        "智能报告生成",
      ],
    },
  ]
  return (
    <section id="capabilities" className={`about-section${inView ? " in-view" : ""}`}>
      <div className="about-tag">CAPABILITIES</div>
      <h2 className="about-title">核心能力</h2>
      <div className="about-bar" style={{ background: "var(--accent-blue)" }} />
      <div className="about-caps">
        {caps.map((cap) => (
          <div key={cap.label} className="about-cap">
            <div className="about-cap-header">
              <div className="about-cap-dot" style={{ background: cap.color }} />
              <div className="about-cap-label" style={{ color: cap.color }}>{cap.label}</div>
            </div>
            <div className="about-cap-features">
              {cap.features.map((f) => (
                <div key={f} className="about-cap-feature">
                  <span style={{ color: cap.color, fontSize: 10 }}>▸</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
