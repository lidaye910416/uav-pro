// ═══════════════════════════════════════════════════════════════════════════
// Partners Section — 合作伙伴
// ═══════════════════════════════════════════════════════════════════════════

interface PartnersSectionProps {
  inView: boolean
}

export default function PartnersSection({ inView }: PartnersSectionProps) {
  const partners = [
    "某省交通运输厅",
    "某市交警支队",
    "某高速公路集团",
    "某智能交通研究院",
    "某无人机科技公司",
    "某通信设备厂商",
    "某地理信息企业",
    "某高校科研团队",
  ]
  const models = [
    { name: "联投集团", role: "项目牵头单位" },
    { name: "合作企业 A", role: "技术支撑单位" },
    { name: "合作企业 B", role: "应用落地单位" },
    { name: "高校院所", role: "科研合作单位" },
  ]
  return (
    <section id="partners" className={`about-section${inView ? " in-view" : ""}`}>
      <div className="about-tag">PARTNERS</div>
      <h2 className="about-title">合作伙伴</h2>
      <div className="about-bar" style={{ background: "var(--accent-purple)" }} />
      <div className="about-section-title">合作单位</div>
      <div className="about-partners-grid">
        {partners.map((p) => (
          <div key={p} className="about-partner">{p}</div>
        ))}
      </div>
      <div className="about-section-title">合作模式</div>
      <div className="about-models">
        {models.map((m) => (
          <div key={m.name} className="about-model">
            <div className="about-model-name">{m.name}</div>
            <div className="about-model-role">{m.role}</div>
          </div>
        ))}
      </div>
      <div className="about-cta">
        <a href="/" className="about-btn-primary">← 返回首页演示</a>
        <a href="http://localhost:3002" target="_blank" rel="noopener noreferrer" className="about-btn-secondary">⚙ 管理后台 →</a>
      </div>
    </section>
  )
}
