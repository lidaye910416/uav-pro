// ═══════════════════════════════════════════════════════════════════════════
// Results Section — 成果展示
// 基于《时空数据要素驱动的低空经济多场景应用研究》中期检查报告
// ═══════════════════════════════════════════════════════════════════════════

interface ResultsSectionProps {
  inView: boolean
}

// 知识产权成果（来源：中期检查报告）
const INTELLECTUAL_PROPERTY = {
  papers: [
    { title: "Static–Dynamic Analytical Framework for Urban Health Resilience Evaluation", journal: "ISPRS Int. J. Geo-Inf.", type: "SCI", date: "2025年4月" },
    { title: "Research on the resilience of ecological networks from the perspective of ecological security pattern", journal: "Scientific Reports", type: "SCI", date: "2025年" },
    { title: "Dynamic evaluation of comprehensive water environment carrying capacity in the Three Gorges Reservoir Area", journal: "Environ. Res. Commun.", type: "EI", date: "2026年2月" },
  ],
  software: [
    { title: "鄂小查（楚汇查）个人信息查询服务平台V1.0", code: "2025SR0933761" },
    { title: "大模型应用服务平台[U-MaaS] V1.0", code: "2025SR1186369" },
    { title: "智能问答助手软件V1.0", code: "2025SR1194792" },
  ],
  patent: {
    title: "基于动态过期容忍度的双令牌授权刷新方法、装置及系统",
    code: "ZL 2024 1 1712175.5",
    date: "2025年12月",
  },
  award: {
    title: "湖北省软件企业协会科技进步三等奖",
    level: "省级",
    year: "2024年度",
  },
}

// 考核指标对照
const TARGETS = [
  { name: "高水平论文", target: "≥3篇", current: "3篇已发表", status: "completed" },
  { name: "软件著作权", target: "≥5项", current: "3项已授权", status: "partial" },
  { name: "发明专利", target: "≥5项", current: "1项已授权", status: "partial" },
  { name: "科技进步奖", target: "≥1项", current: "1项(三等奖)", status: "completed" },
  { name: "时空数据底座", target: "≥1套", current: "核心模块完成", status: "partial" },
  { name: "场景示范应用", target: "≥3个", current: "需求分析完成", status: "partial" },
]

export default function ResultsSection({ inView }: ResultsSectionProps) {
  return (
    <section id="results" className={`about-section${inView ? " in-view" : ""}`}>
      <div className="about-tag">RESULTS</div>
      <h2 className="about-title">成果展示</h2>
      <div className="about-bar" style={{ background: "var(--accent-green)" }} />

      {/* 论文成果 */}
      <div className="about-results-section">
        <div className="about-results-section-title">📚 学术论文</div>
        <div className="about-results-list">
          {INTELLECTUAL_PROPERTY.papers.map((paper, i) => (
            <div key={i} className="about-result-card">
              <div className="about-result-type" style={{ color: "var(--accent-green)" }}>{paper.type}</div>
              <div className="about-result-title">{paper.title}</div>
              <div className="about-result-meta">
                <span>{paper.journal}</span>
                <span>·</span>
                <span>{paper.date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 软件著作权 */}
      <div className="about-results-section">
        <div className="about-results-section-title">💻 软件著作权</div>
        <div className="about-results-software">
          {INTELLECTUAL_PROPERTY.software.map((s, i) => (
            <div key={i} className="about-software-item">
              <span style={{ color: "var(--accent-amber)" }}>◆</span>
              <div>
                <div className="about-software-name">{s.title}</div>
                <div className="about-software-code">{s.code}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 专利与奖励 */}
      <div className="about-results-section">
        <div className="about-results-section-title">🏆 专利与奖励</div>
        <div className="about-results-grid">
          <div className="about-result-mini-card">
            <div className="about-result-mini-icon" style={{ color: "var(--accent-purple)" }}>🔗</div>
            <div className="about-result-mini-title">发明专利</div>
            <div className="about-result-mini-name">{INTELLECTUAL_PROPERTY.patent.title}</div>
            <div className="about-result-mini-meta">{INTELLECTUAL_PROPERTY.patent.code}</div>
          </div>
          <div className="about-result-mini-card">
            <div className="about-result-mini-icon" style={{ color: "var(--accent-amber)" }}>🏅</div>
            <div className="about-result-mini-title">科技进步奖</div>
            <div className="about-result-mini-name">{INTELLECTUAL_PROPERTY.award.title}</div>
            <div className="about-result-mini-meta">{INTELLECTUAL_PROPERTY.award.level} · {INTELLECTUAL_PROPERTY.award.year}</div>
          </div>
        </div>
      </div>

      {/* 任务书考核指标 */}
      <div className="about-results-section">
        <div className="about-results-section-title">🎯 任务书考核指标对照</div>
        <div className="about-targets-table">
          <div className="about-targets-header">
            <span>指标名称</span>
            <span>任务书要求</span>
            <span>当前完成</span>
            <span>状态</span>
          </div>
          {TARGETS.map((t, i) => (
            <div key={i} className="about-targets-row">
              <span>{t.name}</span>
              <span>{t.target}</span>
              <span>{t.current}</span>
              <span className={`about-targets-status status-${t.status}`}>
                {t.status === "completed" ? "✅ 完成" : "⏳ 进行中"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
