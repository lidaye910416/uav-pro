"use client"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"

const SECTIONS = [
  {
    href: "/monitor",
    label: "感知中心",
    desc: "实时视频流 + Pipeline 全链路监控 + 单/双模型切换",
    color: "var(--accent-amber)",
    icon: "◉",
  },
  {
    href: "/alerts",
    label: "预警列表",
    desc: "全量预警记录查询 + 状态流转 + 详情管理",
    color: "var(--accent-purple)",
    icon: "◆",
  },
  {
    href: "/flight",
    label: "飞控平台",
    desc: "无人机状态监控 + 飞行轨迹管理（后期扩展）",
    color: "var(--accent-green)",
    icon: "▲",
  },
]

/* ── Mouse glow background ─────────────────────────────────── */
function GlowBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: -1000, y: -1000 })
  const trailRef = useRef<{ x: number; y: number; vx: number; vy: number; life: number }[]>([])
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    function resize() {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener("resize", resize)

    function onMouseMove(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    window.addEventListener("mousemove", onMouseMove)

    function draw() {
      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)

      // Draw subtle grid
      ctx.strokeStyle = "rgba(255,255,255,0.022)"
      ctx.lineWidth = 1
      const step = 48
      for (let x = 0; x <= width; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke()
      }
      for (let y = 0; y <= height; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke()
      }

      // Mouse glow halo
      const mx = mouseRef.current.x
      const my = mouseRef.current.y
      const gradient = ctx.createRadialGradient(mx, my, 0, mx, my, 300)
      gradient.addColorStop(0, "rgba(255,184,0,0.09)")
      gradient.addColorStop(0.45, "rgba(180,122,255,0.04)")
      gradient.addColorStop(1, "transparent")
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)

      // Ripple rings
      const t = Date.now() / 1000
      for (let i = 0; i < 3; i++) {
        const phase = ((t * 0.7 + i * 0.34) % 1)
        const r = phase * 160
        ctx.beginPath()
        ctx.arc(mx, my, r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255,184,0,${(1 - phase) * 0.14})`
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Trail particles
      if (mx > 0 && Math.random() > 0.55) {
        const angle = Math.random() * Math.PI * 2
        const speed = 0.4 + Math.random() * 1.2
        trailRef.current.push({
          x: mx, y: my,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
        })
      }
      trailRef.current = trailRef.current.filter(p => p.life > 0.01)
      for (const p of trailRef.current) {
        p.x += p.vx; p.y += p.vy; p.life -= 0.016
        ctx.beginPath()
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,184,0,${p.life * 0.55})`
        ctx.fill()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      window.removeEventListener("resize", resize)
      window.removeEventListener("mousemove", onMouseMove)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
}

/* ── Star field ─────────────────────────────────────────────── */
function StarField() {
  const starsRef = useRef<{ x: number; y: number; size: number; speed: number; opacity: number }[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    function resize() {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      starsRef.current = Array.from({ length: 90 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: 0.5 + Math.random() * 1.5,
        speed: 0.08 + Math.random() * 0.25,
        opacity: 0.08 + Math.random() * 0.25,
      }))
    }
    resize()
    window.addEventListener("resize", resize)

    function draw() {
      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)
      for (const s of starsRef.current) {
        s.y += s.speed
        if (s.y > height) { s.y = 0; s.x = Math.random() * width }
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${s.opacity})`
        ctx.fill()
      }
      rafRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => {
      window.removeEventListener("resize", resize)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
}

/* ── Page ───────────────────────────────────────────────────── */
export default function DashboardHome() {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVisible(true), 60); return () => clearTimeout(t) }, [])

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: "#080808" }}>
      <StarField />
      <GlowBackground />

      <div
        className="relative z-10 min-h-screen flex flex-col px-8 py-12"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "none" : "translateY(14px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        {/* Header */}
        <div className="mb-14">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: "var(--accent-amber)", boxShadow: "0 0 10px var(--accent-amber)" }} />
            <span className="text-sm font-mono tracking-widest" style={{ color: "var(--accent-amber)" }}>SYSTEM ONLINE</span>
          </div>
          <h1
            className="font-bold tracking-widest mb-3"
            style={{ color: "var(--text-primary)", fontSize: "clamp(2rem, 4vw, 3.5rem)", lineHeight: 1.15 }}
          >
            UAV 控制台
          </h1>
          <p className="text-base leading-relaxed max-w-2xl" style={{ color: "var(--text-secondary)" }}>
            感知 → 识别 → RAG → 决策 — 全链路智能安全预警
          </p>
        </div>

        {/* Section grid — 3 cols, full width */}
        <div className="flex-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
            {SECTIONS.map((s, i) => (
              <Link
                key={s.href}
                href={s.href}
                className="group relative p-8 rounded-2xl transition-all duration-300 block"
                style={{
                  background: "rgba(16,16,16,0.88)",
                  backdropFilter: "blur(10px)",
                  border: `1px solid ${s.color}30`,
                  boxShadow: `0 0 0 1px rgba(255,255,255,0.03), 0 4px 24px rgba(0,0,0,0.4)`,
                  animationDelay: `${i * 0.12}s`,
                }}
              >
                {/* Hover inner glow */}
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ boxShadow: `inset 0 0 50px ${s.color}0D` }}
                />
                <div className="flex items-start gap-5">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 transition-all duration-300 group-hover:scale-110"
                    style={{
                      background: `${s.color}14`,
                      color: s.color,
                      boxShadow: `0 0 18px ${s.color}20`,
                    }}
                  >
                    {s.icon}
                  </div>
                  <div>
                    <div
                      className="font-bold mb-2"
                      style={{ color: "var(--text-primary)", fontSize: "1.2rem", lineHeight: 1.3 }}
                    >
                      {s.label}
                    </div>
                    <div className="leading-relaxed" style={{ color: "var(--text-secondary)", fontSize: "0.9375rem" }}>
                      {s.desc}
                    </div>
                  </div>
                </div>
                <div
                  className="mt-6 text-sm font-mono font-medium opacity-0 group-hover:opacity-100 transition-all duration-300"
                  style={{ color: s.color, transform: "translateX(0)" }}
                >
                  进入 →
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* External links */}
        <div className="mt-14 flex gap-4 flex-wrap">
          <a
            href="http://localhost:3000"
            className="px-5 py-2.5 rounded-xl text-sm font-mono transition-all hover:brightness-110"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}
          >
            ← 展示首页
          </a>
          <a
            href="http://localhost:3002"
            className="px-5 py-2.5 rounded-xl text-sm font-mono transition-all hover:brightness-110"
            style={{ background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.28)", color: "var(--accent-amber)" }}
          >
            ⚙ 管理后台 →
          </a>
        </div>
      </div>
    </div>
  )
}
