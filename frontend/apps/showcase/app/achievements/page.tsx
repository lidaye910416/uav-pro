
export const metadata = { title: "成果展示 | UAV-Safety" }

export default function AchievementsPage() {
  const stats = [
    { value: "21+", label: "检测事件", sub: "已入库预警记录", color: "var(--accent-amber)" },
    { value: "94%", label: "最高置信度", sub: "应急车道违规检测", color: "var(--accent-green)" },
    { value: "230ms", label: "LLM响应", sub: "Ollama 本地推理", color: "var(--accent-blue)" },
  ]

  const stages = [
    {
      label: "感知层",
      color: "var(--accent-amber)",
      title: "原始视频流采集",
      desc: "无人机搭载4K摄像头实时采集路况画面，支持多路视频流并发接入，帧率稳定25fps，覆盖半径3km范围。",
      svg: (
        <svg viewBox="0 0 280 120" className="w-full rounded-lg">
          <rect width="280" height="120" fill="var(--bg-tertiary)" rx="6"/>
          <rect x="8" y="8" width="264" height="90" fill="var(--bg-primary)" rx="4"
            stroke="var(--accent-amber)" strokeWidth="0.5" opacity="0.5"/>
          <circle cx="140" cy="53" r="20" fill="none"
            stroke="var(--accent-amber)" strokeWidth="1" opacity="0.3"/>
          <line x1="140" y1="8" x2="140" y2="98"
            stroke="var(--accent-amber)" strokeWidth="0.5" opacity="0.2"/>
          <line x1="8" y1="53" x2="272" y2="53"
            stroke="var(--accent-amber)" strokeWidth="0.5" opacity="0.2"/>
          <circle cx="100" cy="40" r="8" fill="var(--accent-amber)" opacity="0.4"/>
          <circle cx="180" cy="65" r="6" fill="var(--accent-amber)" opacity="0.3"/>
          <text x="140" y="115" textAnchor="middle"
            fill="var(--text-muted)" fontSize="9" fontFamily="JetBrains Mono, monospace">
            视频帧 · 1920×1080 · 25fps
          </text>
        </svg>
      ),
    },
    {
      label: "视觉识别",
      color: "var(--accent-green)",
      title: "Gemma 4 E2B 多模态识别",
      desc: "边缘端部署 Gemma 4 E2B 多模态视觉大模型，无需传统目标检测器，直接输出场景语义理解结果，毫秒级推理。",
      svg: (
        <svg viewBox="0 0 280 120" className="w-full rounded-lg">
          <rect width="280" height="120" fill="var(--bg-tertiary)" rx="6"/>
          <rect x="8" y="8" width="264" height="90" fill="var(--bg-primary)" rx="4"
            stroke="var(--accent-green)" strokeWidth="0.5" opacity="0.5"/>
          <rect x="50" y="28" width="90" height="55" fill="none"
            stroke="var(--accent-red)" strokeWidth="2" rx="2"/>
          <text x="95" y="48" textAnchor="middle"
            fill="var(--accent-red)" fontSize="9" fontFamily="JetBrains Mono, monospace">违规停车</text>
          <text x="95" y="62" textAnchor="middle"
            fill="var(--accent-red)" fontSize="8" fontFamily="JetBrains Mono, monospace">置信度 94%</text>
          <rect x="155" y="40" width="70" height="35" fill="none"
            stroke="var(--accent-amber)" strokeWidth="1.5" rx="2"/>
          <text x="190" y="58" textAnchor="middle"
            fill="var(--accent-amber)" fontSize="8" fontFamily="JetBrains Mono, monospace">障碍物</text>
          <text x="190" y="72" textAnchor="middle"
            fill="var(--accent-amber)" fontSize="7" fontFamily="JetBrains Mono, monospace">置信度 82%</text>
          <text x="140" y="115" textAnchor="middle"
            fill="var(--text-muted)" fontSize="9" fontFamily="JetBrains Mono, monospace">
            Gemma 4 E2B 推理结果
          </text>
        </svg>
      ),
    },
    {
      label: "RAG检索",
      color: "var(--accent-blue)",
      title: "ChromaDB SOP 知识检索",
      desc: "将高速公路标准操作规程（SOP）向量化存入 ChromaDB，检索最相似的历史处置案例，辅助 LLM 生成精准处置建议。",
      svg: (
        <svg viewBox="0 0 280 120" className="w-full rounded-lg">
          <rect width="280" height="120" fill="var(--bg-tertiary)" rx="6"/>
          <rect x="8" y="8" width="120" height="90" fill="var(--bg-primary)" rx="4"
            stroke="var(--accent-blue)" strokeWidth="0.5" opacity="0.5"/>
          <text x="68" y="45" textAnchor="middle"
            fill="var(--text-secondary)" fontSize="9" fontFamily="JetBrains Mono, monospace">查询向量</text>
          <rect x="30" y="55" width="76" height="12" fill="var(--accent-blue)" opacity="0.5" rx="3"/>
          <line x1="128" y1="61" x2="152" y2="61"
            stroke="var(--accent-blue)" strokeWidth="1.5" strokeDasharray="4,2"/>
          <polygon points="152,61 146,57 146,65" fill="var(--accent-blue)"/>
          <rect x="152" y="8" width="120" height="90" fill="var(--bg-primary)" rx="4"
            stroke="var(--accent-blue)" strokeWidth="0.5" opacity="0.5"/>
          <text x="212" y="30" textAnchor="middle"
            fill="var(--accent-blue)" fontSize="9" fontFamily="JetBrains Mono, monospace">相似案例 #1</text>
          <text x="212" y="48" textAnchor="middle"
            fill="var(--text-muted)" fontSize="8" fontFamily="JetBrains Mono, monospace">相似度 0.94</text>
          <rect x="162" y="56" width="100" height="10" fill="var(--accent-blue)" opacity="0.3" rx="2"/>
          <text x="212" y="78" textAnchor="middle"
            fill="var(--text-muted)" fontSize="8" fontFamily="JetBrains Mono, monospace">处置：通知高速交警</text>
          <text x="140" y="115" textAnchor="middle"
            fill="var(--text-muted)" fontSize="9" fontFamily="JetBrains Mono, monospace">
            ChromaDB 向量检索
          </text>
        </svg>
      ),
    },
    {
      label: "决策生成",
      color: "var(--accent-purple)",
      title: "Ollama LLM 风险评估",
      desc: "基于视觉识别结果与 RAG 检索案例，Ollama 本地 LLM 生成结构化风险评估报告与处置建议，SSE 实时推送至前端。",
      svg: (
        <svg viewBox="0 0 280 120" className="w-full rounded-lg">
          <rect width="280" height="120" fill="var(--bg-tertiary)" rx="6"/>
          <rect x="8" y="8" width="264" height="90" fill="var(--bg-primary)" rx="4"
            stroke="var(--accent-purple)" strokeWidth="1.5" opacity="0.8"/>
          {/* Risk level badge */}
          <rect x="16" y="16" width="180" height="16" rx="3" fill="var(--accent-red)" opacity="0.85"/>
          <text x="22" y="28" fill="#000" fontSize="9" fontFamily="JetBrains Mono, monospace"
            fontWeight="bold">风险等级: CRITICAL</text>
          {/* Confidence bar */}
          <text x="16" y="52" fill="var(--text-secondary)" fontSize="8" fontFamily="JetBrains Mono, monospace">置信度</text>
          <rect x="16" y="56" width="240" height="8" fill="var(--border)" rx="2"/>
          <rect x="16" y="56" width="226" height="8" fill="var(--accent-green)" opacity="0.7" rx="2"/>
          <text x="16" y="76" fill="var(--text-secondary)" fontSize="8" fontFamily="JetBrains Mono, monospace">94%</text>
          {/* Recommendation */}
          <text x="16" y="90" fill="var(--text-secondary)" fontSize="8" fontFamily="JetBrains Mono, monospace">建议</text>
          <rect x="16" y="94" width="200" height="8" fill="var(--accent-purple)" opacity="0.25" rx="2"/>
          <text x="16" y="101" fill="var(--accent-amber)" fontSize="7" fontFamily="JetBrains Mono, monospace">
            立即通知高速交警处置
          </text>
          <text x="140" y="115" textAnchor="middle"
            fill="var(--text-muted)" fontSize="9" fontFamily="JetBrains Mono, monospace">
            LLM 决策生成 · SSE 推送
          </text>
        </svg>
      ),
    },
  ]

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-5xl mx-auto px-6 py-16">

        {/* Page title */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--accent-amber)" }}>成果展示</h1>
          <div className="h-px" style={{ background: "var(--border)" }} />
        </div>

        {/* Stats */}
        <section className="mb-16">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-4 h-px" style={{ background: "var(--accent-amber)" }} />
            <span className="font-mono text-xs font-bold" style={{ color: "var(--accent-amber)" }}>数据成就</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {stats.map(s => (
              <div
                key={s.label}
                className="rounded-xl p-6 text-center"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <div className="text-3xl font-bold font-mono mb-1" style={{ color: s.color }}>{s.value}</div>
                <div className="font-mono text-sm" style={{ color: "var(--text-primary)" }}>{s.label}</div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Pipeline demo gallery */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-4 h-px" style={{ background: "var(--accent-amber)" }} />
            <span className="font-mono text-xs font-bold" style={{ color: "var(--accent-amber)" }}>Pipeline 演示集锦</span>
          </div>
          <div className="space-y-4">
            {stages.map((stage, i) => (
              <div
                key={stage.label}
                className="rounded-xl overflow-hidden"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <div className="flex">
                  {/* Left: SVG placeholder */}
                  <div className="w-72 flex-shrink-0 p-4" style={{ background: "var(--bg-tertiary)" }}>
                    {stage.svg}
                  </div>
                  {/* Right: description */}
                  <div className="flex-1 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-4 h-px" style={{ background: stage.color }} />
                      <span className="font-mono text-xs" style={{ color: stage.color }}>STAGE {i + 1}</span>
                      <span className="w-4 h-px" style={{ background: stage.color }} />
                    </div>
                    <h3 className="font-mono font-bold mb-1" style={{ color: stage.color }}>{stage.label}</h3>
                    <p className="font-bold mb-2" style={{ color: "var(--text-primary)" }}>{stage.title}</p>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{stage.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
