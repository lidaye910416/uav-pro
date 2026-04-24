// ═══════════════════════════════════════════════════════════════════════════
// Perception Section — 感知层详解
// ═══════════════════════════════════════════════════════════════════════════

interface PerceptionSectionProps {
  inView: boolean
}

export default function PerceptionSection({ inView }: PerceptionSectionProps) {
  const devices = [
    {
      name: "无人机巡检",
      desc: "低成本无人机 + 4K摄像头，实时采集高速路况视频流",
      color: "var(--accent-amber)",
      features: ["自动航线规划", "实时图传", "灵活部署"],
    },
    {
      name: "固定摄像头",
      desc: "关键区域全天候监控，支持多路并发接入",
      color: "var(--accent-green)",
      features: ["7×24 小时监控", "多路视频流", "云台控制"],
    },
    {
      name: "地面雷达",
      desc: "低空目标探测与跟踪，弥补视觉盲区",
      color: "var(--accent-blue)",
      features: ["全天候探测", "精确定位", "多目标跟踪"],
    },
    {
      name: "电子围栏",
      desc: "虚拟边界划定，入侵自动告警",
      color: "var(--accent-purple)",
      features: ["灵活划定", "实时告警", "自动触发"],
    },
  ]
  return (
    <section id="perception" className={`about-section${inView ? " in-view" : ""}`}>
      <div className="about-tag">PERCEPTION LAYER</div>
      <h2 className="about-title">感知层详解</h2>
      <div className="about-bar" style={{ background: "var(--accent-amber)" }} />
      <div className="about-devices-grid">
        {devices.map((d) => (
          <div key={d.name} className="about-device-card">
            <div className="about-device-header">
              <div className="about-device-dot" style={{ background: d.color }} />
              <h3 className="about-device-name" style={{ color: d.color }}>{d.name}</h3>
            </div>
            <p className="about-device-desc">{d.desc}</p>
            <div className="about-device-features">
              {d.features.map((f) => (
                <span key={f} className="about-device-feature">{f}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
