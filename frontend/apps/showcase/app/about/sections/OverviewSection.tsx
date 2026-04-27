// ═══════════════════════════════════════════════════════════════════════════
// Overview Section — 项目概览
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react"

interface OverviewSectionProps {
  inView: boolean
}

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
