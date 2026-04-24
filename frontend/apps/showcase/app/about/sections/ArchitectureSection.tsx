// ═══════════════════════════════════════════════════════════════════════════
// Architecture Section — 技术架构（重点）
// ═══════════════════════════════════════════════════════════════════════════

interface ArchitectureSectionProps {
  inView: boolean
}

export default function ArchitectureSection({ inView }: ArchitectureSectionProps) {
  const layers = [
    {
      num: "05",
      label: "交互层",
      desc: "可视化大屏 · 移动端 · 告警推送",
      color: "var(--accent-amber)",
      items: ["Web 管理后台", "移动端 App", "短信/邮件告警"],
    },
    {
      num: "04",
      label: "应用层",
      desc: "实时监测 · 历史查询 · 智能预警 · 数据分析",
      color: "var(--accent-green)",
      items: ["实时监测大屏", "历史轨迹回放", "智能预警推送", "统计分析报表"],
    },
    {
      num: "03",
      label: "平台层",
      desc: "数据中台 · AI 中台",
      color: "var(--accent-blue)",
      items: ["数据采集清洗", "模型推理服务", "知识库管理", "API 网关"],
    },
    {
      num: "02",
      label: "数据层",
      desc: "时序数据 · 轨迹数据 · 告警数据",
      color: "var(--accent-purple)",
      items: ["时序数据库", "轨迹数据库", "告警数据库", "知识向量库"],
    },
    {
      num: "01",
      label: "感知层",
      desc: "无人机 · 摄像头 · 雷达 · 电子围栏",
      color: "var(--accent-amber)",
      items: ["无人机巡检", "固定摄像头", "地面雷达", "电子围栏"],
    },
  ]
  return (
    <section id="architecture" className={`about-section${inView ? " in-view" : ""}`}>
      <div className="about-tag">ARCHITECTURE ⭐</div>
      <h2 className="about-title">技术架构</h2>
      <div className="about-bar" style={{ background: "var(--accent-green)" }} />
      <div className="about-arch-layers">
        {layers.map((layer, i) => (
          <div key={layer.num} className="about-arch-layer">
            <div className="about-arch-layer-header">
              <span className="about-arch-num" style={{ color: layer.color }}>{layer.num}</span>
              <span className="about-arch-label" style={{ color: layer.color }}>{layer.label}</span>
              <span className="about-arch-desc">{layer.desc}</span>
            </div>
            <div className="about-arch-items">
              {layer.items.map((item) => (
                <span key={item} className="about-arch-item">{item}</span>
              ))}
            </div>
            {i < layers.length - 1 && <div className="about-arch-arrow" style={{ color: layer.color }}>↓</div>}
          </div>
        ))}
      </div>
    </section>
  )
}
