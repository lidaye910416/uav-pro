"use client"
import { usePathname } from "next/navigation"
import { useAuth } from "./AuthContext"

const BREADCRUMBS: Record<string, { label: string; parent?: string }> = {
  "/": { label: "系统概览" },
  "/streams": { label: "感知流管理", parent: "/" },
  "/upload": { label: "图像测试", parent: "/" },
  "/alerts": { label: "预警历史", parent: "/" },
  "/settings": { label: "系统设置", parent: "/" },
  "/rag": { label: "RAG 知识库", parent: "/" },
}

function HealthDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    healthy: "var(--accent-green)",
    running: "var(--accent-green)",
    online: "var(--accent-green)",
    degraded: "var(--accent-amber)",
    down: "var(--accent-red)",
    error: "var(--accent-red)",
    idle: "var(--text-muted)",
  }
  return (
    <span
      className="w-2 h-2 rounded-full inline-block"
      style={{
        background: colors[status] || "var(--text-muted)",
        boxShadow: `0 0 6px ${colors[status] || "transparent"}`,
      }}
    />
  )
}

export default function TopHeader() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const current = BREADCRUMBS[pathname] || { label: pathname }

  return (
    <header
      className="h-14 flex items-center justify-between px-6 fixed top-0 left-56 right-0 z-40"
      style={{
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm font-mono">
        {current.parent && (
          <>
            <span style={{ color: "var(--text-muted)" }}>{BREADCRUMBS[current.parent]?.label || "首页"}</span>
            <span style={{ color: "var(--text-muted)" }}>›</span>
          </>
        )}
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{current.label}</span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* System status */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-mono"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <HealthDot status="healthy" />
          <span style={{ color: "var(--accent-green)" }}>系统正常</span>
        </div>

        {/* User info */}
        {user && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ background: "var(--accent-amber)", color: "#000" }}>
                {user.username[0].toUpperCase()}
              </div>
              <span className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>
                {user.username}
              </span>
            </div>
            <button
              onClick={logout}
              className="px-3 py-1 rounded-lg text-sm font-mono transition-all hover:brightness-110"
              style={{ background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.3)", color: "var(--accent-red)" }}
              title="退出登录"
            >
              登出
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
