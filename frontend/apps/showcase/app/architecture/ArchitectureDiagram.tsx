"use client"
import { useLLMStatus } from "@uav/hooks"

export default function ArchitectureDiagram() {
  const { status } = useLLMStatus()

  const visionLabel =
    status?.stages?.vision?.provider && status?.stages?.vision?.model
      ? `${status.stages.vision.provider} · ${status.stages.vision.model}`
      : status?.provider && status?.model
      ? `${status.provider} · ${status.model}`
      : "Gemma 4 E2B"

  const decisionLabel =
    status?.stages?.decision?.provider && status?.stages?.decision?.model
      ? `${status.stages.decision.provider} · ${status.stages.decision.model}`
      : status?.provider && status?.model
      ? `${status.provider} · ${status.model}`
      : "Ollama"

  return (
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

        {/* Vision box (label 动态来自 useLLMStatus) */}
        <rect x="50" y="145" width="220" height="110" rx="8"
          fill="var(--bg-card)" stroke="var(--accent-green)" strokeWidth="1.5"/>
        <text x="160" y="172" textAnchor="middle" fill="var(--accent-green)" fontSize="13" fontFamily="JetBrains Mono, monospace" fontWeight="bold">{visionLabel}</text>
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

        {/* Decision box (label 动态来自 useLLMStatus) */}
        <rect x="530" y="145" width="220" height="110" rx="8"
          fill="var(--bg-card)" stroke="var(--accent-purple)" strokeWidth="1.5"/>
        <text x="640" y="172" textAnchor="middle" fill="var(--accent-purple)" fontSize="13" fontFamily="JetBrains Mono, monospace" fontWeight="bold">{decisionLabel}</text>
        <text x="640" y="190" textAnchor="middle" fill="var(--text-secondary)" fontSize="10" fontFamily="JetBrains Mono, monospace">决策推理</text>
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
  )
}