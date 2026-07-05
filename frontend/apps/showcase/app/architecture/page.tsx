
import ArchitectureDiagram from "./ArchitectureDiagram"

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

        {/* SVG Architecture Diagram (client subcomponent; vision/decision labels 动态) */}
        <section className="mb-16">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-4 h-px" style={{ background: "var(--accent-amber)" }} />
            <span className="font-mono text-xs font-bold" style={{ color: "var(--accent-amber)" }}>01 · 系统架构</span>
          </div>
          <ArchitectureDiagram />
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
