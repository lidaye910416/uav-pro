// ═══════════════════════════════════════════════════════════════════════════
// ResearchSignificanceSection — 研究意义（转盘式交互）
// ═══════════════════════════════════════════════════════════════════════════

"use client"
import { useState } from "react"

interface ResearchSignificanceSectionProps {
  inView: boolean
}

export default function ResearchSignificanceSection({ inView }: ResearchSignificanceSectionProps) {
  const policies = [
    "《关于「人工智能+交通运输」的实施意见》",
    "多部委联合发布政策文件",
  ]
  const layers = [
    {
      title: "理论层面",
      subtitle: "填补空白",
      desc: "填补国内在低空经济时空数据要素驱动领域的理论空白，构建系统化学术体系，为行业发展提供科学指引。",
      icon: "◇",
      color: "var(--accent-amber)",
    },
    {
      title: "技术层面",
      subtitle: "突破瓶颈",
      desc: "突破关键技术瓶颈，打造统一、高可用的时空数据底座，显著提升低空经济运行的智能化水平和安全保障能力。",
      icon: "◆",
      color: "var(--accent-green)",
    },
    {
      title: "应用层面",
      subtitle: "赋能百业",
      desc: "推动「低空+物流/巡检/文旅」等多场景应用落地，催生行业新业态、新模式，真正实现赋能千行百业。",
      icon: "◈",
      color: "var(--accent-blue)",
    },
  ]
  const [activeLayer, setActiveLayer] = useState(0)

  return (
    <section id="research-significance" className={`about-section${inView ? " in-view" : ""}`}>
      <div className="about-tag">RESEARCH SIGNIFICANCE</div>
      <h2 className="about-title">研究意义</h2>
      <div className="about-bar" style={{ background: "var(--accent-amber)" }} />
      <p className="about-desc about-significance-subtitle">
        研究意义：以<span style={{ color: "var(--accent-amber)" }}>时空数据要素</span>驱动低空经济创新发展
      </p>
      
      <div className="about-significance-layout">
        {/* 左侧：政策依据 */}
        <div className="about-significance-policy">
          <div className="about-significance-policy-label">政策依据</div>
          <div className="about-significance-policy-cards">
            {policies.map((p) => (
              <div key={p} className="about-significance-policy-card">
                <span className="about-significance-policy-icon">◇</span>
                <span>{p}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* 右侧：转盘式交互 */}
        <div className="about-carousel">
          {/* 转盘指示器 */}
          <div className="about-carousel-indicators">
            {layers.map((layer, i) => (
              <button
                key={layer.title}
                className={`about-carousel-indicator${activeLayer === i ? " active" : ""}`}
                style={{ 
                  "--indicator-color": layer.color 
                } as React.CSSProperties}
                onClick={() => setActiveLayer(i)}
              >
                <span className="about-carousel-indicator-dot" style={{ background: layer.color }} />
                <span className="about-carousel-indicator-label">{layer.title}</span>
              </button>
            ))}
          </div>
          
          {/* 转盘卡片 */}
          <div className="about-carousel-card" style={{ 
            "--card-color": layers[activeLayer].color 
          } as React.CSSProperties}>
            <div className="about-carousel-card-header">
              <span className="about-carousel-icon" style={{ color: layers[activeLayer].color }}>
                {layers[activeLayer].icon}
              </span>
              <div className="about-carousel-card-titles">
                <h3 className="about-carousel-card-title" style={{ color: layers[activeLayer].color }}>
                  {layers[activeLayer].title}
                </h3>
                <span className="about-carousel-card-subtitle" style={{ color: layers[activeLayer].color }}>
                  ·{layers[activeLayer].subtitle}
                </span>
              </div>
            </div>
            <p className="about-carousel-card-desc">{layers[activeLayer].desc}</p>
          </div>
          
          {/* 左右切换按钮 */}
          <div className="about-carousel-nav">
            <button
              className="about-carousel-nav-btn"
              onClick={() => setActiveLayer((prev) => (prev - 1 + layers.length) % layers.length)}
            >
              ←
            </button>
            <span className="about-carousel-nav-count">
              {activeLayer + 1} / {layers.length}
            </span>
            <button
              className="about-carousel-nav-btn"
              onClick={() => setActiveLayer((prev) => (prev + 1) % layers.length)}
            >
              →
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
