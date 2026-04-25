"use client"
import "./globals.css"
import { AuthProvider, useAuth } from "@/components/AuthContext"
import TopHeader from "@/components/TopHeader"
import LoginPage from "@/components/LoginPage"
import { usePathname } from "next/navigation"

const NAV_ITEMS = [
  { href: "/", label: "系统概览", icon: "◈", section: "overview" },
  { href: "/streams", label: "感知流管理", icon: "◇", section: "monitor" },
  { href: "/upload", label: "图像测试", icon: "◉", section: "monitor" },
  { href: "/alerts", label: "预警历史", icon: "◆", section: "data" },
  { href: "/settings", label: "系统设置", icon: "⚙", section: "system" },
  { href: "/rag", label: "RAG 知识库", icon: "◫", section: "system" },
]

const SECTIONS = [
  { key: "overview", label: "概览" },
  { key: "monitor", label: "感知监控" },
  { key: "data", label: "数据管理" },
  { key: "system", label: "系统设置" },
]

function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="w-56 min-h-screen fixed top-0 left-0 z-50 flex flex-col"
      style={{ background: "var(--bg-secondary)", borderRight: "1px solid var(--border)" }}
    >
      {/* Logo */}
      <div className="px-5 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--accent-amber)", boxShadow: "0 0 12px rgba(255,184,0,0.3)" }}
          >
            <span className="text-black font-bold text-sm font-mono">AI</span>
          </div>
          <div>
            <div className="font-mono text-sm font-bold tracking-widest" style={{ color: "var(--accent-amber)" }}>
              ADMIN
            </div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              系统管理后台
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 px-3 py-1.5 rounded-lg" style={{ background: "rgba(0,229,160,0.06)", border: "1px solid rgba(0,229,160,0.2)" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent-green)", boxShadow: "0 0 6px var(--accent-green)" }} />
          <span className="text-xs font-mono" style={{ color: "var(--accent-green)" }}>系统正常</span>
        </div>
      </div>

      {/* Nav sections */}
      <nav className="flex flex-col gap-4 p-3 flex-1 overflow-y-auto">
        {SECTIONS.map((section) => {
          const sectionItems = NAV_ITEMS.filter((i) => i.section === section.key)
          return (
            <div key={section.key}>
              <div className="text-sm font-mono font-bold px-3 mb-1.5 tracking-widest" style={{ color: "var(--text-muted)" }}>
                {section.label}
              </div>
              {sectionItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 mb-0.5"
                    style={{
                      background: isActive ? `${isActive ? "var(--accent-amber)" : "transparent"}10` : "transparent",
                      border: isActive ? `1px solid rgba(255,184,0,0.3)` : "1px solid transparent",
                      color: isActive ? "var(--accent-amber)" : "var(--text-secondary)",
                      boxShadow: isActive ? "0 0 12px rgba(255,184,0,0.1)" : "none",
                    }}
                  >
                    <span
                      className="font-mono text-lg transition-opacity"
                      style={{ color: isActive ? "var(--accent-amber)" : "var(--text-muted)" }}
                    >
                      {item.icon}
                    </span>
                    <span className="font-medium text-base">{item.label}</span>
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent-amber)", boxShadow: "0 0 6px var(--accent-amber)" }} />
                    )}
                  </a>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="px-3 py-2 rounded-lg" style={{ background: "var(--bg-tertiary)" }}>
          <div className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>v1.0.0</div>
          <div className="text-sm font-mono mt-0.5" style={{ color: "var(--accent-green)" }}>● ALL SYSTEMS OK</div>
        </div>
        const SHOWCASE_URL = process.env.NEXT_PUBLIC_SHOWCASE_URL || "http://localhost:3000"

        <a
          href={SHOWCASE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center mt-2 text-sm py-2 rounded-lg transition-all hover:brightness-110"
          style={{ color: "var(--accent-amber)", background: "var(--bg-tertiary)", border: "1px solid rgba(255,184,0,0.3)", boxShadow: "0 0 8px rgba(255,184,0,0.1)" }}
        >
          ← 返回首页
        </a>
      </div>
    </aside>
  )
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-4 animate-pulse" style={{ background: "var(--accent-amber)" }} />
          <div className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>加载中…</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <>
      <Sidebar />
      <TopHeader />
      <main
        className="ml-56 min-h-screen"
        style={{ background: "var(--bg-primary)", paddingTop: "56px" }}
      >
        <div className="p-6">{children}</div>
      </main>
    </>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <AuthProvider>
          <AdminShell>{children}</AdminShell>
        </AuthProvider>
      </body>
    </html>
  )
}
