"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3001"
const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3002"

const navItems = [
  { href: "/",      label: "首页" },
  { href: "/about", label: "项目概览" },
]

export default function Header() {
  const pathname = usePathname()
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{ background: "rgba(8,8,16,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border)" }}
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="5" fill="var(--accent-amber)" opacity="0.9"/>
            <line x1="16" y1="2" x2="16" y2="11" stroke="var(--accent-amber)" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="16" y1="21" x2="16" y2="30" stroke="var(--accent-amber)" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="2" y1="16" x2="11" y2="16" stroke="var(--accent-amber)" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="21" y1="16" x2="30" y2="16" stroke="var(--accent-amber)" strokeWidth="1.5" strokeLinecap="round"/>
            <rect x="9" y="9" width="14" height="14" rx="2" stroke="var(--accent-amber)" strokeWidth="1.5" fill="none" opacity="0.35"/>
          </svg>
          <span className="font-mono text-base font-bold tracking-widest" style={{ color: "var(--accent-amber)" }}>
            UAV-SAFETY
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex gap-8 items-center">
          {navItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium transition-all duration-200 relative group"
                style={{ color: active ? "var(--accent-amber)" : "var(--text-secondary)" }}
              >
                {item.label}
                {active && (
                  <span
                    className="absolute -bottom-0.5 left-0 right-0 h-px"
                    style={{ background: "var(--accent-amber)", boxShadow: "0 0 8px var(--accent-amber)" }}
                  />
                )}
                {!active && (
                  <span
                    className="absolute -bottom-0.5 left-0 right-0 h-px scale-x-0 group-hover:scale-x-100 transition-transform duration-200"
                    style={{ background: "var(--accent-amber)", opacity: 0.4 }}
                  />
                )}
              </Link>
            )
          })}
          <a
            href={`${DASHBOARD_URL}/monitor`}
            className="text-sm font-medium px-5 py-2 rounded-lg transition-all duration-200 font-mono tracking-wider"
            style={{
              background: "var(--accent-amber)",
              color: "#000",
              boxShadow: "0 0 12px rgba(255,184,0,0.3)",
            }}
          >
            感知中心 →
          </a>
          <a
            href={ADMIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200 font-mono tracking-wider border"
            style={{
              background: "var(--bg-card)",
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            管理后台
          </a>
        </nav>
      </div>
    </header>
  )
}
