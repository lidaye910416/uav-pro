// ═══════════════════════════════════════════════════════════════════════════
// Background Section — 项目背景
// 基于《时空数据要素驱动的低空经济多场景应用研究》中期检查报告
// ═══════════════════════════════════════════════════════════════════════════

interface BackgroundSectionProps {
  inView: boolean
}

// 项目基本信息（来源：中期检查报告）
const PROJECT_BASIC = {
  name: "时空数据要素驱动的低空经济多场景应用",
  subtitle: "理论突破与实践创新研究",
  org: "湖北省数字产业发展集团有限公司",
  period: "2025年5月 — 2028年4月",
  funding: "480万元",
  type: '2025年湖北联投第一批"揭榜挂帅"项目',
  partners: ["湖北省数字产业发展集团有限公司", "武汉大学", "武汉理工大学"],
  team: { total: 11, senior: 5, mid: 6, phd: 5, master: 3 },
}

export default function BackgroundSection({ inView }: BackgroundSectionProps) {
  const highlights = [
    { icon: "◆", value: "480万", label: "项目经费", desc: '湖北联投"揭榜挂帅"项目' },
    { icon: "◇", value: "36月", label: "执行周期", desc: "2025.5 — 2028.4" },
    { icon: "◎", value: "3家", label: "参研单位", desc: "企业+高校协同" },
    { icon: "●", value: "11人", label: "课题团队", desc: "高级5人·博士5人" },
  ]

  return (
    <section id="background" className={`about-section${inView ? " in-view" : ""}`}>
      <div className="about-tag">BACKGROUND</div>
      <h2 className="about-title">项目背景</h2>
      <div className="about-bar" style={{ background: "var(--accent-amber)" }} />
      <p className="about-desc">
        <strong style={{ color: "var(--accent-amber)" }}>{PROJECT_BASIC.name}</strong>
        <br />
        <span style={{ color: "var(--text-muted)", fontSize: 14 }}>{PROJECT_BASIC.subtitle}</span>
        <br /><br />
        {PROJECT_BASIC.type}，执行周期{PROJECT_BASIC.period}，总经费{PROJECT_BASIC.funding}。
        参研单位{PROJECT_BASIC.partners.length}家（{PROJECT_BASIC.partners.join("、")}），
        课题团队共{PROJECT_BASIC.team.total}人（高级职称{PROJECT_BASIC.team.senior}人、中级职称{PROJECT_BASIC.team.mid}人，博士{PROJECT_BASIC.team.phd}人、硕士{PROJECT_BASIC.team.master}人）。
        <br /><br />
        项目负责人：<strong>李晓宇</strong>（联系电话：15629082897）
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
