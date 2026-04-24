"use client"
import { useState, useEffect } from "react"
import { useAuth } from "./AuthContext"

interface LoginPageProps {
  title?: string
  subtitle?: string
}

export default function LoginPage({ title, subtitle }: LoginPageProps) {
  const { login: authLogin, loading, error } = useAuth()
  const [username, setUsername] = useState("admin")
  const [password, setPassword] = useState("admin123")
  const [localError, setLocalError] = useState("")
  const [loggingIn, setLoggingIn] = useState(false)

  async function handleLogin() {
    if (!username || !password) {
      setLocalError("请输入用户名和密码")
      return
    }
    setLocalError("")
    setLoggingIn(true)
    try {
      await authLogin(username, password)
    } catch {
      setLocalError(error || "登录失败，请检查用户名密码")
    } finally {
      setLoggingIn(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
      {/* Background grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <div key={`h${i}`} className="absolute w-full h-px" style={{ top: `${i * 8}%`, background: "rgba(255,184,0,0.03)" }} />
        ))}
        {[...Array(12)].map((_, i) => (
          <div key={`v${i}`} className="absolute h-full w-px" style={{ left: `${i * 8}%`, background: "rgba(255,184,0,0.03)" }} />
        ))}
      </div>

      <div
        className="relative w-full max-w-md rounded-2xl p-8 animate-fade-in-up"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          boxShadow: "0 0 60px rgba(255,184,0,0.08)",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "var(--accent-amber)", boxShadow: "0 0 24px rgba(255,184,0,0.3)" }}
          >
            <span className="text-black font-bold text-2xl font-mono">AI</span>
          </div>
          <h1 className="text-xl font-bold font-mono tracking-wider" style={{ color: "var(--text-primary)" }}>
            {title || "管理员登录"}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {subtitle || "UAV 低空检测系统 · 管理后台"}
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-mono mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
              用户名
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="admin"
              className="w-full px-4 py-2.5 rounded-xl text-base font-mono"
              style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                outline: "none",
              }}
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-mono mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl text-base font-mono"
              style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
          </div>

          {(localError || error) && (
            <div
              className="px-4 py-2.5 rounded-xl text-sm font-mono"
              style={{ background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.3)", color: "var(--accent-red)" }}
            >
              {localError || error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loggingIn || loading}
            className="w-full py-2.5 rounded-xl text-base font-mono font-bold transition-all hover:brightness-110 disabled:opacity-50"
            style={{ background: "var(--accent-amber)", color: "#000" }}
          >
            {loggingIn || loading ? "登录中…" : "登录"}
          </button>

          <div className="text-center text-sm font-mono" style={{ color: "var(--text-muted)" }}>
            默认账号: <span style={{ color: "var(--accent-amber)" }}>admin</span> / <span style={{ color: "var(--accent-amber)" }}>admin123</span>
          </div>
        </div>

        {/* Features */}
        <div className="mt-6 grid grid-cols-3 gap-2">
          {[
            { icon: "⚙", label: "系统配置" },
            { icon: "◆", label: "预警管理" },
            { icon: "◫", label: "知识库" },
          ].map((f) => (
            <div key={f.label} className="text-center p-2 rounded-lg" style={{ background: "var(--bg-primary)" }}>
              <div className="text-base mb-0.5">{f.icon}</div>
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>{f.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
