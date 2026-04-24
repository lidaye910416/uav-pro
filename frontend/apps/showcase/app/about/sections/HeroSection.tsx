// ═══════════════════════════════════════════════════════════════════════════
// Hero Section — 项目封面
// ═══════════════════════════════════════════════════════════════════════════

interface HeroSectionProps {
  inView: boolean
}

export default function HeroSection({ inView }: HeroSectionProps) {
  return (
    <section id="hero" className={`about-section${inView ? " in-view" : ""}`}>
      <div className="about-hero-content">
        <div className="about-hero-badge">联投集团揭榜挂帅项目</div>
        <h1 className="about-hero-title">
          <span className="about-hero-title-main">时空数据要素驱动的</span>
          <span className="about-hero-title-sub">低空经济多场景应用</span>
        </h1>
        <div className="about-hero-divider" />
        <p className="about-hero-desc">
          基于空天地一体化感知网络与生成式 AI 决策引擎，<br />
          构建低空安全监测与智能决策系统，服务低空经济高质量发展
        </p>
        <div className="about-hero-tags">
          <span className="about-hero-tag">空天地一体化</span>
          <span className="about-hero-tag">生成式 AI</span>
          <span className="about-hero-tag">智能决策</span>
          <span className="about-hero-tag">实时预警</span>
        </div>
      </div>
    </section>
  )
}
