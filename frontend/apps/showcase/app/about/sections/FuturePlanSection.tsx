// ═══════════════════════════════════════════════════════════════════════════
// FuturePlan Section — 存在问题与下一步工作计划
// 基于《时空数据要素驱动的低空经济多场景应用研究》中期检查报告
// ═══════════════════════════════════════════════════════════════════════════

interface FuturePlanSectionProps {
  inView: boolean
}

// 存在的问题（来源：中期检查报告）
const CURRENT_PROBLEMS = [
  {
    num: "01",
    title: "发明专利数量存在差距",
    desc: "任务书要求不少于5项发明专利，目前仅1项获授权，差距4项。专利申报周期较长，需从现在起加快布局。",
    color: "var(--accent-red)",
  },
  {
    num: "02",
    title: "无人机端侧硬件开发滞后",
    desc: "硬件研发受制于供应链和技术验证周期，进展慢于预期，需加快推进。",
    color: "var(--accent-amber)",
  },
  {
    num: "03",
    title: '"低空+"场景应用示范尚未落地',
    desc: "场景应用需以底座平台为基础，目前底座尚在测试阶段，场景应用同步推进存在一定难度。",
    color: "var(--accent-amber)",
  },
  {
    num: "04",
    title: "软件著作权完成数量与任务书总指标尚有差距",
    desc: "任务书要求不少于5项，目前完成3项，差2项需继续申报。",
    color: "var(--accent-blue)",
  },
  {
    num: "05",
    title: "省级科技进步奖申报推进较慢",
    desc: "尚处于材料准备阶段，尚未正式提交申报。",
    color: "var(--accent-purple)",
  },
]

// 下一步工作计划（来源：中期检查报告）
const NEXT_STEPS = [
  {
    period: "2026.5-12",
    title: "加快专利布局",
    desc: "整理项目技术成果，围绕时空数据智能识别、数字孪生等核心技术，组织撰写并申报发明专利3-4项，弥补专利数量缺口。",
    color: "var(--accent-red)",
  },
  {
    period: "2026.5-11",
    title: "推进端侧硬件研发",
    desc: "协调硬件供应商，加快核心传感器集成和算法优化，确保2026年11月中期节点前完成终端研发阶段性目标。",
    color: "var(--accent-amber)",
  },
  {
    period: "2026.6-2027.4",
    title: "完成场景应用示范",
    desc: "结合底座平台上线，同步开展不少于3个"低空+"场景应用的部署和验证，形成可展示的示范成果。",
    color: "var(--accent-green)",
  },
  {
    period: "持续进行",
    title: "加大软著申报力度",
    desc: "围绕底座平台和场景应用，持续申报软件著作权，确保完成不少于5项的考核指标。",
    color: "var(--accent-blue)",
  },
]

export default function FuturePlanSection({ inView }: FuturePlanSectionProps) {
  return (
    <section id="future-plan" className={`about-section${inView ? " in-view" : ""}`}>
      <div className="about-tag">FUTURE PLAN</div>
      <h2 className="about-title">问题与计划</h2>
      <div className="about-bar" style={{ background: "var(--accent-amber)" }} />

      {/* 存在的问题 */}
      <div className="about-future-section">
        <div className="about-future-section-title">⚠️ 存在的问题</div>
        <div className="about-future-problems">
          {CURRENT_PROBLEMS.map((p) => (
            <div key={p.num} className="about-future-problem-card">
              <div className="about-future-problem-num" style={{ color: p.color }}>{p.num}</div>
              <div className="about-future-problem-content">
                <div className="about-future-problem-title" style={{ color: p.color }}>{p.title}</div>
                <div className="about-future-problem-desc">{p.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 下一步工作计划 */}
      <div className="about-future-section">
        <div className="about-future-section-title">📋 下一步工作计划</div>
        <div className="about-future-steps">
          {NEXT_STEPS.map((step, idx) => (
            <div key={idx} className="about-future-step-card">
              <div className="about-future-step-header">
                <span className="about-future-step-period" style={{ color: step.color }}>{step.period}</span>
                <span className="about-future-step-connector">→</span>
              </div>
              <div className="about-future-step-content">
                <div className="about-future-step-title" style={{ color: step.color }}>{step.title}</div>
                <div className="about-future-step-desc">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
