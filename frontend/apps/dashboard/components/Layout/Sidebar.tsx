"use client"
import Link from "next/link"

const SHOWCASE_URL = process.env.NEXT_PUBLIC_SHOWCASE_URL || "http://localhost:3000"
const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3002"

const navItems = [
  { href: "/", label: "◉ 控制台", icon: "◉" },
  { href: "/monitor", label: "感知中心", icon: "◉" },
  { href: "/alerts", label: "预警列表", icon: "◆" },
  { href: "/flight", label: "飞控平台", icon: "▲" },
]

export default function Sidebar() {
  return (
    <aside
      className="w-60 min-h-screen fixed top-0 left-0 z-50 flex flex-col"
      style={{ background: "var(--bg-secondary)", borderRight: "1px solid var(--border)" }}
    >
      <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="4" fill="var(--accent-amber)" opacity="0.9"/>
            <line x1="14" y1="2" x2="14" y2="10" stroke="var(--accent-amber)" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="14" y1="18" x2="14" y2="26" stroke="var(--accent-amber)" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="2" y1="14" x2="10" y2="14" stroke="var(--accent-amber)" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="18" y1="14" x2="26" y2="14" stroke="var(--accent-amber)" strokeWidth="1.5" strokeLinecap="round"/>
            <rect x="8" y="8" width="12" height="12" rx="2" stroke="var(--accent-amber)" strokeWidth="1.5" fill="none" opacity="0.4"/>
          </svg>
          <div>
            <div className="font-mono text-sm font-bold tracking-widest" style={{ color: "var(--accent-amber)" }}>UAV CENTER</div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>低空检测系统</div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--accent-green)", boxShadow: "0 0 6px var(--accent-green)" }} />
          <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>SYSTEM ONLINE</span>
        </div>
      </div>
      <nav className="flex flex-col gap-1 p-4 flex-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 hover:bg-tertiary group"
            style={{ color: "var(--text-secondary)" }}
          >
            <span className="font-mono text-base opacity-60 group-hover:opacity-100 transition-opacity" style={{ color: "var(--accent-amber)" }}>
              {item.icon}
            </span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="px-4 py-4" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="font-mono text-xs px-3 py-2 rounded" style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
          <div>ver 1.0.0</div>
          <div className="mt-1" style={{ color: "var(--accent-green)" }}>● ALL SYSTEMS OK</div>
        </div>
        <a href={SHOWCASE_URL} target="_blank" rel="noopener noreferrer" className="block text-center mt-3 text-xs py-2 transition-colors" style={{ color: "var(--text-muted)" }}>
          ← 展示首页
        </a>
        <a href={ADMIN_URL} target="_blank" rel="noopener noreferrer" className="block text-center mt-2 text-xs py-2 transition-colors" style={{ color: "var(--text-muted)" }}>
          ⚙ 管理后台
        </a>
      </div>
    </aside>
  )
}
