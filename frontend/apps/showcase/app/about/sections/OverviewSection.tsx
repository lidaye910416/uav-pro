// ═══════════════════════════════════════════════════════════════════════════
// Overview Section — 项目概览
// 基于《时空数据要素驱动的低空经济多场景应用研究》中期检查报告
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react"

interface OverviewSectionProps {
  inView: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// 中期检查报告数据
// ═══════════════════════════════════════════════════════════════════════════

// 项目基本信息
const PROJECT_INFO = {
  name: "时空数据要素驱动的低空经济多场景应用",
  subtitle: "理论突破与实践创新研究",
  org: "湖北省数字产业发展集团有限公司",
  period: "2025年5月 — 2028年4月（36个月）",
  funding: "480万元",
  partners: ["湖北省数字产业发展集团有限公司", "武汉大学", "武汉理工大学"],
  team: { total: 11, senior: 5, mid: 6, phd: 5, master: 3 },
}

// 研究进展（四大方面）
const RESEARCH_PROGRESS = [
  {
    title: "前期调研与理论模型构建",
    items: [
      "系统梳理国内外低空经济、时空数据要素、数字孪生技术文献",
      "完成低空经济时空数据要素驱动理论模型框架设计（已形成初稿）",
      "调研北斗导航、5G通信、数字孪生、AI等关键技术应用现状",
    ],
  },
  {
    title: "时空数据要素底座建设",
    items: [
      "完成底座需求分析和技术架构设计",
      "核心功能模块（多源数据采集、存储、整合）已完成开发",
      "结合GIS、CIM构建时空数据模型，完成数据清洗融合基础算法",
    ],
  },
  {
    title: "多场景应用设计与终端研发",
    items: [
      "完成五大应用领域技术需求分析",
      "无人机泛在定位终端完成方案设计和核心算法研发",
    ],
  },
  {
    title: "知识产权成果",
    items: [
      "3篇SCI/EI论文已发表",
      "3项软件著作权已获授权",
      "1项发明专利已获授权（ZL 2024 1 1712175.5）",
      "湖北省科技进步三等奖（2024年度）",
    ],
  },
]

// 下一步工作计划
const NEXT_STEPS = [
  {
    period: "2026年5月—12月",
    title: "加快专利布局",
    desc: "围绕时空数据智能识别、数字孪生等核心技术，组织撰写并申报发明专利3-4项",
  },
  {
    period: "2026年5月—11月",
    title: "推进端侧硬件研发",
    desc: "协调硬件供应商，加快核心传感器集成和算法优化",
  },
  {
    period: "2026年6月—2027年4月",
    title: "完成场景应用示范",
    desc: '结合底座平台上线，同步开展不少于3个"低空+"场景应用的部署和验证',
  },
  {
    period: "持续进行",
    title: "加大软著申报力度",
    desc: "围绕底座平台和场景应用，持续申报软件著作权",
  },
]

// 经济/社会效益
const BENEFITS = {
  social: [
    "构建低空经济时空数据要素驱动理论模型，填补相关研究理论空白",
    '为湖北省乃至全国低空经济发展提供理论支撑',
    '推动"低空+智慧城市""低空+应急监测""低空+物流配送"等领域发展',
    "助力湖北省打造具有全国重要影响力的低空经济发展高地和示范区",
  ],
  corporate: [
    "为公司在低空经济、数字产业等新兴领域的业务拓展提供技术支撑",
    "提升公司在智慧城市、应急监测、物流配送、能源安全、北斗应用等领域的综合竞争力",
    "培养跨学科复合型人才5名，提升团队整体科研能力",
  ],
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

// Pipeline 四个 Stage 详细配置
const PIPELINE_STAGES = [
  {
    stage: "STAGE 1",
    name: "感知层",
    nameEn: "Perception",
    icon: "◉",
    color: "#FFB800",
    bgColor: "rgba(255, 184, 0, 0.1)",
    borderColor: "rgba(255, 184, 0, 0.3)",
    steps: [
      { label: "视频采集", desc: "无人机/摄像头 RTMP 流" },
      { label: "YOLO检测", desc: "YOLOv8-World 目标检测" },
      { label: "SAM分割", desc: "SAM-ViT-B 实例分割" },
    ],
  },
  {
    stage: "STAGE 2",
    name: "识别层",
    nameEn: "Identification",
    icon: "◆",
    color: "#A855F7",
    bgColor: "rgba(168, 85, 247, 0.1)",
    borderColor: "rgba(168, 85, 247, 0.3)",
    steps: [
      { label: "Gemma4 E2B", desc: "多模态视觉理解" },
      { label: "场景分析", desc: "异常类型判断" },
      { label: "置信评估", desc: "风险等级计算" },
    ],
  },
  {
    stage: "STAGE 3",
    name: "检索层",
    nameEn: "Retrieval",
    icon: "◫",
    color: "#3B82F6",
    bgColor: "rgba(59, 130, 246, 0.1)",
    borderColor: "rgba(59, 130, 246, 0.3)",
    steps: [
      { label: "向量嵌入", desc: "Nomic-Embed-Text" },
      { label: "相似度检索", desc: "ChromaDB 向量库" },
      { label: "上下文构建", desc: "SOP 规范匹配" },
    ],
  },
  {
    stage: "STAGE 4",
    name: "决策层",
    nameEn: "Decision",
    icon: "◈",
    color: "#EC4899",
    bgColor: "rgba(236, 72, 153, 0.1)",
    borderColor: "rgba(236, 72, 153, 0.3)",
    steps: [
      { label: "风险评估", desc: "多维度综合评分" },
      { label: "规则引擎", desc: "阈值判定" },
      { label: "预警输出", desc: "JSON + 数据库" },
    ],
  },
]

export default function OverviewSection({ inView }: OverviewSectionProps) {
  const [showPipeline, setShowPipeline] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  // 切换到 Pipeline（向上滑入）
  const switchToPipeline = () => {
    if (showPipeline || isAnimating) return
    setIsAnimating(true)
    setShowPipeline(true)
  }

  // 切换回概览（向下滑出）
  const switchToOverview = () => {
    if (!showPipeline || isAnimating) return
    setIsAnimating(true)
    setShowPipeline(false)
  }

  // 动画结束后重置状态
  useEffect(() => {
    if (isAnimating) {
      const timer = setTimeout(() => setIsAnimating(false), 600)
      return () => clearTimeout(timer)
    }
  }, [isAnimating])

  // State for expandable sections
  const [expandedProgress, setExpandedProgress] = useState<number | null>(null)
  const [showBenefits, setShowBenefits] = useState(false)

  const toggleProgress = (index: number) => {
    setExpandedProgress(expandedProgress === index ? null : index)
  }

  const features = [
    {
      icon: "◉",
      title: "空天地一体化感知",
      desc: "无人机 + 摄像头 + 雷达多源融合",
      color: "var(--accent-amber)",
    },
    {
      icon: "◆",
      title: "AI 智能分析",
      desc: "YOLO + SAM + Gemma 多模型协同",
      color: "var(--accent-green)",
    },
    {
      icon: "◫",
      title: "RAG 知识增强",
      desc: "行业规范 + SOP 流程检索",
      color: "var(--accent-blue)",
    },
    {
      icon: "◈",
      title: "实时预警",
      desc: "毫秒级识别 · 秒级响应",
      color: "var(--accent-purple)",
    },
  ]

  return (
    <section id="overview" className={`about-section${inView ? " in-view" : ""}`}>
      <div className="about-tag">OVERVIEW</div>
      <h2 className="about-title">项目概览</h2>
      <div className="about-bar" style={{ background: "var(--accent-amber)" }} />
      <p className="about-desc">
        基于<span style={{ color: "var(--accent-amber)" }}>空天地一体化</span> +
        <span style={{ color: "var(--accent-green)" }}> 生成式 AI</span> 驱动的低空安全智能预警决策系统。
        融合低成本无人机航拍、计算机视觉、RAG 检索和大语言模型决策，
        实现<span style={{ color: "var(--accent-amber)", fontWeight: 600 }}>全天候 · 全链路</span>的低空安全风险感知与预警。
      </p>

      {/* 查看 Pipeline 按钮 */}
      <button className="overview-pipeline-trigger" onClick={switchToPipeline}>
        <span className="overview-pipeline-trigger-icon">◆</span>
        <span>查看 Pipeline 流程详解</span>
        <span className="overview-pipeline-trigger-arrow">→</span>
      </button>

      {/* 核心能力 + 指标 */}
      <div className="about-overview-features">
        {features.map((f) => (
          <div key={f.title} className="about-overview-feature-card" style={{ borderColor: `${f.color}40` }}>
            <div className="about-overview-feature-icon" style={{ color: f.color }}>{f.icon}</div>
            <div className="about-overview-feature-title" style={{ color: f.color }}>{f.title}</div>
            <div className="about-overview-feature-desc">{f.desc}</div>
          </div>
        ))}
      </div>

      {/* 性能指标 */}
      <div className="about-metrics">
        <div className="about-metric">
          <div className="about-metric-value" style={{ color: "var(--accent-green)" }}>94.2%</div>
          <div className="about-metric-label">预警准确率</div>
        </div>
        <div className="about-metric">
          <div className="about-metric-value" style={{ color: "var(--accent-amber)" }}>25 FPS</div>
          <div className="about-metric-label">帧处理速率</div>
        </div>
        <div className="about-metric">
          <div className="about-metric-value" style={{ color: "var(--accent-blue)" }}>1,423</div>
          <div className="about-metric-label">知识库规模</div>
        </div>
        <div className="about-metric">
          <div className="about-metric-value" style={{ color: "var(--accent-purple)" }}>230ms</div>
          <div className="about-metric-label">端到端延迟</div>
        </div>
      </div>

      {/* ── 研究进展 ── */}
      <div className="about-overview-progress">
        <div className="about-overview-section-title">📊 研究进展</div>
        <div className="about-progress-list">
          {RESEARCH_PROGRESS.map((section, idx) => (
            <div key={idx} className="about-progress-item">
              <button
                className="about-progress-header"
                onClick={() => toggleProgress(idx)}
              >
                <span className="about-progress-title">{section.title}</span>
                <span className={`about-progress-arrow ${expandedProgress === idx ? "expanded" : ""}`}>▼</span>
              </button>
              {expandedProgress === idx && (
                <ul className="about-progress-items">
                  {section.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── 下一步工作计划 ── */}
      <div className="about-overview-next-steps">
        <div className="about-overview-section-title">📋 下一步工作计划</div>
        <div className="about-next-steps-grid">
          {NEXT_STEPS.map((step, idx) => (
            <div key={idx} className="about-next-step-card">
              <div className="about-next-step-period">{step.period}</div>
              <div className="about-next-step-title">{step.title}</div>
              <div className="about-next-step-desc">{step.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 经济/社会效益 ── */}
      <div className="about-overview-benefits">
        <button
          className="about-benefits-toggle"
          onClick={() => setShowBenefits(!showBenefits)}
        >
          <span>💡 经济/社会效益</span>
          <span className={`about-benefits-arrow ${showBenefits ? "expanded" : ""}`}>▶</span>
        </button>
        {showBenefits && (
          <div className="about-benefits-content">
            <div className="about-benefits-section">
              <div className="about-benefits-section-title">🌍 社会效益</div>
              <ul>
                {BENEFITS.social.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="about-benefits-section">
              <div className="about-benefits-section-title">🏢 企业效益</div>
              <ul>
                {BENEFITS.corporate.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* ── 考核指标对照 ── */}
      <div className="about-overview-targets">
        <div className="about-overview-section-title">🎯 任务书考核指标对照</div>
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

      {/* Pipeline 全屏覆盖层 */}
      <div
        className={`overview-pipeline-overlay ${showPipeline ? "active" : ""}`}
      >
        <div className="overview-pipeline-overlay-inner">
          {/* 返回按钮 */}
          <button className="overview-pipeline-back" onClick={switchToOverview}>
            <span>←</span>
            <span>返回概览</span>
          </button>

          {/* Pipeline 内容 */}
          <div className="pipeline-full-container">
            <div className="pipeline-full-header">
              <div className="pipeline-full-title">PIPELINE 算法流程</div>
              <div className="pipeline-full-subtitle">全链路智能分析 · 感知 → 识别 → 检索 → 决策</div>
            </div>

            {/* 四个 Stage */}
            <div className="pipeline-stages-row">
              {PIPELINE_STAGES.map((stage, stageIdx) => (
                <div key={stage.stage} className="pipeline-stage-card" style={{
                  background: stage.bgColor,
                  borderColor: stage.borderColor,
                }}>
                  <div className="pipeline-stage-header">
                    <span className="pipeline-stage-number" style={{ color: stage.color }}>{stage.stage}</span>
                    <span className="pipeline-stage-icon" style={{ color: stage.color }}>{stage.icon}</span>
                    <span className="pipeline-stage-name" style={{ color: stage.color }}>{stage.name}</span>
                    <span className="pipeline-stage-name-en">{stage.nameEn}</span>
                  </div>

                  <div className="pipeline-stage-steps">
                    {stage.steps.map((step, stepIdx) => (
                      <div key={step.label} className="pipeline-step">
                        <div className="pipeline-step-line">
                          <div className="pipeline-step-dot" style={{ background: stage.color }} />
                          {stepIdx < stage.steps.length - 1 && (
                            <div className="pipeline-step-connector" style={{ borderColor: stage.color }} />
                          )}
                        </div>
                        <div className="pipeline-step-content">
                          <div className="pipeline-step-label" style={{ color: stage.color }}>{step.label}</div>
                          <div className="pipeline-step-desc">{step.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {stageIdx < PIPELINE_STAGES.length - 1 && (
                    <div className="pipeline-arrow" style={{ color: stage.color }}>→</div>
                  )}
                </div>
              ))}
            </div>

            {/* 数据流 */}
            <div className="pipeline-data-flow">
              <div className="pipeline-data-flow-title">数据流转</div>
              <div className="pipeline-data-flow-items">
                <span className="pipeline-data-item" style={{ borderColor: "#FFB800", color: "#FFB800" }}>视频帧</span>
                <span className="pipeline-data-arrow">→</span>
                <span className="pipeline-data-item" style={{ borderColor: "#FFB800", color: "#FFB800" }}>检测框</span>
                <span className="pipeline-data-arrow">→</span>
                <span className="pipeline-data-item" style={{ borderColor: "#A855F7", color: "#A855F7" }}>语义特征</span>
                <span className="pipeline-data-arrow">→</span>
                <span className="pipeline-data-item" style={{ borderColor: "#3B82F6", color: "#3B82F6" }}>规范上下文</span>
                <span className="pipeline-data-arrow">→</span>
                <span className="pipeline-data-item" style={{ borderColor: "#EC4899", color: "#EC4899" }}>预警决策</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
