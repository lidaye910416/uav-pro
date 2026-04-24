
export const metadata = { title: "技术架构 | UAV-Safety" }

export default function ArchitecturePage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-5xl mx-auto px-6 py-16">

        {/* Page title */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--accent-amber)" }}>技术架构</h1>
          <div className="h-px" style={{ background: "var(--border)" }} />
        </div>

        {/* SVG Architecture Diagram */}
        <section className="mb-16">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-4 h-px" style={{ background: "var(--accent-amber)" }} />
            <span className="font-mono text-xs font-bold" style={{ color: "var(--accent-amber)" }}>01 · 系统架构</span>
          </div>
          <div className="rounded-xl p-6 overflow-x-auto" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <svg viewBox="0 0 800 440" className="w-full" style={{ minWidth: 600 }}>
              {/* Layer 1: Perception */}
              <rect x="250" y="10" width="300" height="65" rx="8"
                fill="var(--bg-tertiary)" stroke="var(--accent-amber)" strokeWidth="1.5"/>
              <text x="400" y="38" textAnchor="middle" fill="var(--accent-amber)" fontSize="13" fontFamily="JetBrains Mono, monospace" fontWeight="bold">无人机 + 高挂摄像头</text>
              <text x="400" y="56" textAnchor="middle" fill="var(--text-muted)" fontSize="11" fontFamily="JetBrains Mono, monospace">感知层 · 视频数据采集</text>

              {/* Arrow 1 */}
              <line x1="400" y1="75" x2="400" y2="100" stroke="var(--border)" strokeWidth="1.5" strokeDasharray="4,3"/>
              <polygon points="400,105 395,98 405,98" fill="var(--border)"/>

              {/* Layer 2: Edge Base Station */}
              <rect x="30" y="110" width="740" height="160" rx="10"
                fill="var(--bg-tertiary)" stroke="var(--border)" strokeWidth="1"/>
              <text x="400" y="132" textAnchor="middle" fill="var(--text-muted)" fontSize="11" fontFamily="JetBrains Mono, monospace">边缘基站（无人机停机坪 / 路边单元）</text>

              {/* Gemma box */}
              <rect x="50" y="145" width="220" height="110" rx="8"
                fill="var(--bg-card)" stroke="var(--accent-green)" strokeWidth="1.5"/>
              <text x="160" y="172" textAnchor="middle" fill="var(--accent-green)" fontSize="13" fontFamily="JetBrains Mono, monospace" fontWeight="bold">Gemma 4 E2B</text>
              <text x="160" y="190" textAnchor="middle" fill="var(--text-secondary)" fontSize="10" fontFamily="JetBrains Mono, monospace">视觉推理</text>
              <text x="160" y="206" textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontFamily="JetBrains Mono, monospace">边缘端部署 · 基站内推理</text>
              <text x="160" y="222" textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontFamily="JetBrains Mono, monospace">毫秒级响应</text>

              {/* ChromaDB box */}
              <rect x="290" y="145" width="220" height="110" rx="8"
                fill="var(--bg-card)" stroke="var(--accent-blue)" strokeWidth="1.5"/>
              <text x="400" y="172" textAnchor="middle" fill="var(--accent-blue)" fontSize="13" fontFamily="JetBrains Mono, monospace" fontWeight="bold">ChromaDB</text>
              <text x="400" y="190" textAnchor="middle" fill="var(--text-secondary)" fontSize="10" fontFamily="JetBrains Mono, monospace">向量数据库</text>
              <text x="400" y="206" textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontFamily="JetBrains Mono, monospace">SOP 知识检索</text>
              <text x="400" y="222" textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontFamily="JetBrains Mono, monospace">边缘嵌入存储</text>

              {/* Ollama box */}
              <rect x="530" y="145" width="220" height="110" rx="8"
                fill="var(--bg-card)" stroke="var(--accent-purple)" strokeWidth="1.5"/>
              <text x="640" y="172" textAnchor="middle" fill="var(--accent-purple)" fontSize="13" fontFamily="JetBrains Mono, monospace" fontWeight="bold">Ollama</text>
              <text x="640" y="190" textAnchor="middle" fill="var(--text-secondary)" fontSize="10" fontFamily="JetBrains Mono, monospace">本地 LLM 决策</text>
              <text x="640" y="206" textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontFamily="JetBrains Mono, monospace">风险等级判定</text>
              <text x="640" y="222" textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontFamily="JetBrains Mono, monospace">处置建议生成</text>

              {/* Arrows between edge modules */}
              <line x1="270" y1="200" x2="290" y2="200" stroke="var(--border)" strokeWidth="1" strokeDasharray="3,2"/>
              <line x1="510" y1="200" x2="530" y2="200" stroke="var(--border)" strokeWidth="1" strokeDasharray="3,2"/>

              {/* Arrow 2 */}
              <line x1="400" y1="270" x2="400" y2="300" stroke="var(--border)" strokeWidth="1.5" strokeDasharray="4,3"/>
              <polygon points="400,305 395,298 405,298" fill="var(--border)"/>

              {/* Layer 3: Backend */}
              <rect x="250" y="310" width="300" height="55" rx="8"
                fill="var(--bg-tertiary)" stroke="var(--accent-amber)" strokeWidth="1.5"/>
              <text x="400" y="333" textAnchor="middle" fill="var(--accent-amber)" fontSize="12" fontFamily="JetBrains Mono, monospace" fontWeight="bold">FastAPI 后端服务</text>
              <text x="400" y="350" textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontFamily="JetBrains Mono, monospace">SSE 实时推送 · REST API · 数据聚合</text>

              {/* Arrow 3 */}
              <line x1="400" y1="365" x2="400" y2="390" stroke="var(--border)" strokeWidth="1.5" strokeDasharray="4,3"/>
              <polygon points="400,395 395,388 405,388" fill="var(--border)"/>

              {/* Layer 4: Frontend */}
              <rect x="250" y="400" width="300" height="35" rx="8"
                fill="var(--bg-tertiary)" stroke="var(--accent-amber)" strokeWidth="1.5"/>
              <text x="400" y="422" textAnchor="middle" fill="var(--accent-amber)" fontSize="11" fontFamily="JetBrains Mono, monospace">Next.js 统一前端 · / · /monitor · /about · /architecture · /achievements</text>
            </svg>
          </div>
        </section>

        {/* Phase plan */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-4 h-px" style={{ background: "var(--accent-amber)" }} />
            <span className="font-mono text-xs font-bold" style={{ color: "var(--accent-amber)" }}>02 · 开发阶段</span>
          </div>
          <div className="space-y-4">
            {[
              {
                phase: "第一阶段：基础功能",
                color: "var(--accent-green)",
                items: [
                  "感知层 — 无人机 + 高挂摄像头",
                  "视觉识别 — Gemma 4 E2B 边缘推理",
                  "项目网站 — Next.js 前后端分离",
                  "预警基础 — 风险等级判定",
                ],
              },
              {
                phase: "第二阶段：功能增强",
                color: "var(--accent-blue)",
                items: [
                  "ChromaDB RAG — SOP 知识库检索",
                  "Ollama 本地 LLM — 决策生成",
                  "多源数据融合 — 时空同步处理",
                  "SSE 实时推送 — 前端 Live Feed",
                ],
              },
              {
                phase: "第三阶段：产品交付",
                color: "var(--accent-purple)",
                items: [
                  "系统集成与优化",
                  "Docker 容器化部署",
                  "完整文档与用户手册",
                ],
              },
            ].map((phase) => (
              <div
                key={phase.phase}
                className="rounded-xl p-5"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderLeft: `3px solid ${phase.color}`,
                }}
              >
                <div className="font-mono font-bold mb-3" style={{ color: phase.color }}>{phase.phase}</div>
                <div className="grid grid-cols-2 gap-2">
                  {phase.items.map((item) => (
                    <div key={item} className="text-sm flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                      <span style={{ color: phase.color }}>·</span> {item}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
