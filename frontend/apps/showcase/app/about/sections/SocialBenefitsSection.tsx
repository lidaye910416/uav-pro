// ═══════════════════════════════════════════════════════════════════════════
// Social Benefits Section — 社会效益与意义总结
// 基于《时空数据要素驱动的低空经济多场景应用研究》中期检查报告
// ═══════════════════════════════════════════════════════════════════════════

interface SocialBenefitsSectionProps {
  inView: boolean
}

// 五大应用领域
const APPLICATION_FIELDS = [
  { icon: "🏙️", title: "低空+智慧城市", desc: "城市智能化管理服务" },
  { icon: "🚨", title: "低空+应急监测", desc: "快速响应与灾情评估" },
  { icon: "📦", title: "低空+物流配送", desc: "末端物流高效配送" },
  { icon: "⚡", title: "低空+能源安全", desc: "能源设施巡检保障" },
  { icon: "🛰️", title: "低空+北斗应用", desc: "精准定位服务融合" },
]

// 人才培养数据
const TALENT_TRAINING = [
  { label: "跨学科复合型人才", value: "5名" },
]

export default function SocialBenefitsSection({ inView }: SocialBenefitsSectionProps) {
  return (
    <section id="social-benefits" className={`about-section${inView ? " in-view" : ""}`}>
      <div className="about-tag">SOCIAL BENEFITS</div>
      <h2 className="about-title">社会效益与意义</h2>
      <div className="about-bar" style={{ background: "var(--accent-purple)" }} />

      {/* 对社会、行业发展的促进作用 */}
      <div className="about-benefits-section">
        <div className="about-benefits-section-title">🌐 对社会、行业发展的促进作用</div>
        <div className="about-benefits-highlight">
          <p>
            本项目围绕<span style={{ color: "var(--accent-purple)" }}>低空经济与时空数据要素融合</span>的理论空白，
            构建了低空经济时空数据要素驱动理论模型，填补相关研究理论空白，
            为<span style={{ color: "var(--accent-amber)" }}>湖北省乃至全国低空经济发展</span>提供了理论支撑。
          </p>
        </div>
        
        {/* 五大应用领域 */}
        <div className="about-application-fields">
          <div className="about-application-fields-title">📡 推动多场景应用领域</div>
          <div className="about-application-grid">
            {APPLICATION_FIELDS.map((field) => (
              <div key={field.title} className="about-application-card">
                <div className="about-application-icon">{field.icon}</div>
                <div className="about-application-title">{field.title}</div>
                <div className="about-application-desc">{field.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="about-benefits-goal">
          <span className="about-benefits-goal-icon">🎯</span>
          <span>助力湖北省打造具有<strong>全国重要影响力</strong>的低空经济发展高地和示范区</span>
        </div>
      </div>

      {/* 对公司发展的促进作用 */}
      <div className="about-benefits-section">
        <div className="about-benefits-section-title">🏢 对公司发展的促进作用</div>
        <div className="about-benefits-company">
          <div className="about-benefits-company-intro">
            <span style={{ color: "var(--accent-amber)", fontWeight: 600 }}>湖北省数字产业发展集团有限公司</span>
          </div>
          <div className="about-benefits-company-content">
            <div className="about-benefits-item">
              <span className="about-benefits-item-icon">⚡</span>
              <span>在低空经济、数字产业等新兴领域的业务拓展提供<strong>技术支撑和应用示范</strong></span>
            </div>
            <div className="about-benefits-item">
              <span className="about-benefits-item-icon">🚀</span>
              <span>提升在智慧城市、应急监测、物流配送、能源安全、北斗应用等领域的<strong>综合竞争力</strong></span>
            </div>
            <div className="about-benefits-item">
              <span className="about-benefits-item-icon">💰</span>
              <span>为获取更大的<strong>商业成功</strong>奠定基础</span>
            </div>
          </div>
        </div>

        {/* 人才培养 */}
        <div className="about-talent-section">
          <div className="about-talent-title">👥 人才培养成果</div>
          <div className="about-talent-cards">
            {TALENT_TRAINING.map((t) => (
              <div key={t.label} className="about-talent-card">
                <div className="about-talent-value" style={{ color: "var(--accent-green)" }}>{t.value}</div>
                <div className="about-talent-label">{t.label}</div>
              </div>
            ))}
          </div>
          <div className="about-talent-desc">
            通过项目培养了跨学科复合型人才，<strong>提升了团队整体科研能力</strong>
          </div>
        </div>
      </div>
    </section>
  )
}
