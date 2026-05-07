// ═══════════════════════════════════════════════════════════════════════════
// Partners Section — 合作伙伴
// 基于《时空数据要素驱动的低空经济多场景应用研究》中期检查报告
// ═══════════════════════════════════════════════════════════════════════════

interface PartnersSectionProps {
  inView: boolean
}

// 合作单位（来源：中期检查报告）
const PARTNERS = {
  lead: {
    name: "湖北省数字产业发展集团有限公司",
    role: "项目牵头单位",
    desc: "负责项目整体统筹管理与成果转化",
  },
  research: [
    { name: "武汉大学", role: "参研单位", desc: "提供时空数据分析与GIS技术支持" },
    { name: "武汉理工大学", role: "参研单位", desc: "提供人工智能与计算机视觉技术支持" },
  ],
  leaders: [
    { name: "***", role: "项目负责人", contact: "***" },
  ],
}

export default function PartnersSection({ inView }: PartnersSectionProps) {
  return (
    <section id="partners" className={`about-section${inView ? " in-view" : ""}`}>
      <div className="about-tag">PARTNERS</div>
      <h2 className="about-title">合作伙伴</h2>
      <div className="about-bar" style={{ background: "var(--accent-purple)" }} />

      {/* 牵头单位 */}
      <div className="about-partner-lead">
        <div className="about-partner-lead-badge">项目牵头单位</div>
        <div className="about-partner-lead-name">{PARTNERS.lead.name}</div>
        <div className="about-partner-lead-desc">{PARTNERS.lead.desc}</div>
      </div>

      {/* 参研单位 */}
      <div className="about-partners-section">
        <div className="about-section-title">参研单位</div>
        <div className="about-partners-grid">
          {PARTNERS.research.map((p) => (
            <div key={p.name} className="about-partner-card">
              <div className="about-partner-card-role">{p.role}</div>
              <div className="about-partner-card-name">{p.name}</div>
              <div className="about-partner-card-desc">{p.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 项目负责人 */}
      <div className="about-partners-section">
        <div className="about-section-title">项目负责人</div>
        <div className="about-leader-info">
          {PARTNERS.leaders.map((l) => (
            <div key={l.name} className="about-leader-card">
              <div className="about-leader-avatar">👤</div>
              <div className="about-leader-details">
                <div className="about-leader-name">{l.name}</div>
                <div className="about-leader-role">{l.role}</div>
                <div className="about-leader-contact">📞 {l.contact}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="about-cta">
        <a href="/" className="about-btn-primary">← 返回首页演示</a>
      </div>
    </section>
  )
}
