"use client"
import { useState, useEffect, useRef } from "react"

// ═══════════════════════════════════════════════════════════════════════════
// 📋 SECTIONS CONFIGURATION — 15 sections
// To add a new section:
// 1. Add an entry to SECTIONS array below
// 2. Create a new section component in ./sections/ directory
// 3. Import and add to the SECTION_COMPONENTS map
// ═══════════════════════════════════════════════════════════════════════════

const SECTIONS = [
  { id: "hero",               label: "项目封面" },
  { id: "background",         label: "项目背景" },
  { id: "research-significance", label: "研究意义" },
  { id: "research-framework",  label: "研究思路" },
  { id: "problems",            label: "核心问题" },
  { id: "why-project",         label: "为何选择" },
  { id: "solution",            label: "解决方案" },
  { id: "overview",            label: "项目概览" },
  { id: "architecture",        label: "技术架构" },
  { id: "perception",          label: "感知层" },
  { id: "data-platform",        label: "数据平台" },
  { id: "capabilities",        label: "核心能力" },
  { id: "scenarios",           label: "应用场景" },
  { id: "results",             label: "成果展示" },
  { id: "partners",            label: "合作伙伴" },
  // ─── Add new sections below ───────────────────────────────────────────────
] as const

type SectionId = typeof SECTIONS[number]["id"]

// ═══════════════════════════════════════════════════════════════════════════
// 📦 SECTION COMPONENTS MAP
// ═══════════════════════════════════════════════════════════════════════════

import HeroSection from "./sections/HeroSection"
import BackgroundSection from "./sections/BackgroundSection"
import ResearchSignificanceSection from "./sections/ResearchSignificanceSection"
import ResearchFrameworkSection from "./sections/ResearchFrameworkSection"
import ProblemsSection from "./sections/ProblemsSection"
import WhyProjectSection from "./sections/WhyProjectSection"
import SolutionSection from "./sections/SolutionSection"
import OverviewSection from "./sections/OverviewSection"
import ArchitectureSection from "./sections/ArchitectureSection"
import PerceptionSection from "./sections/PerceptionSection"
import DataPlatformSection from "./sections/DataPlatformSection"
import CapabilitiesSection from "./sections/CapabilitiesSection"
import ScenariosSection from "./sections/ScenariosSection"
import ResultsSection from "./sections/ResultsSection"
import PartnersSection from "./sections/PartnersSection"
// ─── Import new section components below ────────────────────────────────────

const SECTION_COMPONENTS: Record<SectionId, React.ComponentType<{ inView: boolean }>> = {
  hero: HeroSection,
  background: BackgroundSection,
  "research-significance": ResearchSignificanceSection,
  "research-framework": ResearchFrameworkSection,
  problems: ProblemsSection,
  "why-project": WhyProjectSection,
  solution: SolutionSection,
  overview: OverviewSection,
  architecture: ArchitectureSection,
  perception: PerceptionSection,
  "data-platform": DataPlatformSection,
  capabilities: CapabilitiesSection,
  scenarios: ScenariosSection,
  results: ResultsSection,
  partners: PartnersSection,
  // ─── Add new section components below ─────────────────────────────────────
}

/* ── Mouse glow background ─────────────────────────────────── */
function GlowCanvas() {
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

    function onMove(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    window.addEventListener("mousemove", onMove)

    function draw() {
      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)

      // Subtle grid
      ctx.strokeStyle = "rgba(255,255,255,0.02)"
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
      const halo = ctx.createRadialGradient(mx, my, 0, mx, my, 280)
      halo.addColorStop(0, "rgba(255,184,0,0.1)")
      halo.addColorStop(0.45, "rgba(180,122,255,0.04)")
      halo.addColorStop(1, "transparent")
      ctx.fillStyle = halo
      ctx.fillRect(0, 0, width, height)

      // Ripple rings
      const t = Date.now() / 1000
      for (let i = 0; i < 3; i++) {
        const phase = ((t * 0.65 + i * 0.33) % 1)
        const r = phase * 150
        ctx.beginPath()
        ctx.arc(mx, my, r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255,184,0,${(1 - phase) * 0.15})`
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Trail particles
      if (mx > 0 && Math.random() > 0.6) {
        const angle = Math.random() * Math.PI * 2
        const speed = 0.4 + Math.random() * 1.0
        trailRef.current.push({
          x: mx, y: my,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
        })
      }
      trailRef.current = trailRef.current.filter(p => p.life > 0.01)
      for (const p of trailRef.current) {
        p.x += p.vx; p.y += p.vy; p.life -= 0.015
        ctx.beginPath()
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,184,0,${p.life * 0.5})`
        ctx.fill()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      window.removeEventListener("resize", resize)
      window.removeEventListener("mousemove", onMove)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
}

/* ── Star field ─────────────────────────────────────────────── */
function StarCanvas() {
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
        speed: 0.06 + Math.random() * 0.25,
        opacity: 0.08 + Math.random() * 0.22,
      }))
    }
    resize()
    window.addEventListener("resize", resize)

    function draw() {
      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)
      for (const s of starsRef.current) {
        s.y += s.speed
        if (s.y > height) { s.y = 0; s.x = Math.random() * canvas.width }
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

// ── Progress Track ─────────────────────────────────────────────────────────────

function ProgressTrack({ active, onNavigate }: { active: SectionId; onNavigate: (idx: number) => void }) {
  const activeIdx = SECTIONS.findIndex((s) => s.id === active)
  return (
    <div className="about-progress-track">
      {SECTIONS.map((s, i) => {
        const isDone = i < activeIdx
        const isActive = s.id === active
        return (
          <div key={s.id} className="about-progress-step-wrapper">
            {i > 0 && (
              <div className={`about-progress-connector${isDone ? " done" : ""}`} />
            )}
            <button
              onClick={() => onNavigate(i)}
              className={`about-progress-step${isActive ? " active" : isDone ? " done" : ""}`}
              title={s.label}
            >
              <div className="about-progress-dot" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── About Page ────────────────────────────────────────────────────────────────

export default function AboutPage() {
  const [activeSection, setActiveSection] = useState<SectionId>("hero")
  const [inViewSections, setInViewSections] = useState<Set<SectionId>>(new Set(["hero"]))
  const [isNavExpanded, setIsNavExpanded] = useState(false)
  const [isScrolling, setIsScrolling] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Map<SectionId, HTMLElement>>(new Map())
  const scrollTimeoutRef = useRef<number>(0)
  const thumbnailTrackRef = useRef<HTMLDivElement>(null)

  // Close nav dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest(".about-header-nav") && isNavExpanded) {
        setIsNavExpanded(false)
      }
    }
    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [isNavExpanded])

  // Scroll to a specific section
  const scrollToSection = (index: number) => {
    const container = containerRef.current
    if (!container) return
    const clampedIndex = Math.max(0, Math.min(index, SECTIONS.length - 1))
    const sectionId = SECTIONS[clampedIndex].id
    // Try sectionRefs first, then fall back to DOM query
    const sectionEl = sectionRefs.current.get(sectionId) || document.getElementById(sectionId)
    if (sectionEl) {
      setIsScrolling(true)
      sectionEl.scrollIntoView({ behavior: "smooth", block: "start" })
      // Clear scrolling state after animation
      clearTimeout(scrollTimeoutRef.current)
      scrollTimeoutRef.current = window.setTimeout(() => {
        setIsScrolling(false)
      }, 600)
    }
  }

  // Track active section using IntersectionObserver
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      // Create intersection observer for sections
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const sectionId = entry.target.id as SectionId
            if (entry.isIntersecting) {
              setActiveSection(sectionId)
              setInViewSections((prev) => {
                if (prev.has(sectionId)) return prev
                return new Set([...prev, sectionId])
              })
            }
          })
        },
        {
          root: container,
          rootMargin: "-40% 0px -40% 0px",
          threshold: 0,
        }
      )

      // Observe all sections
      SECTIONS.forEach((s) => {
        const el = document.getElementById(s.id)
        if (el) {
          sectionRefs.current.set(s.id, el)
          observer.observe(el)
        }
      })
    }, 100)

    return () => {
      clearTimeout(timer)
    }
  }, [])

  // Handle wheel events for smooth section-by-section scrolling
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let accumulatedDelta = 0
    const threshold = 50

    const handleWheel = (e: WheelEvent) => {
      if (isScrolling) return
      e.preventDefault()

      accumulatedDelta += e.deltaY

      if (Math.abs(accumulatedDelta) > threshold) {
        const direction = accumulatedDelta > 0 ? 1 : -1
        const currentIndex = SECTIONS.findIndex((s) => s.id === activeSection)
        const newIndex = currentIndex + direction

        if (newIndex >= 0 && newIndex < SECTIONS.length) {
          scrollToSection(newIndex)
        }

        accumulatedDelta = 0
      }
    }

    container.addEventListener("wheel", handleWheel, { passive: false })
    return () => container.removeEventListener("wheel", handleWheel)
  }, [activeSection, isScrolling])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault()
        const currentIndex = SECTIONS.findIndex((s) => s.id === activeSection)
        if (currentIndex < SECTIONS.length - 1) {
          scrollToSection(currentIndex + 1)
        }
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault()
        const currentIndex = SECTIONS.findIndex((s) => s.id === activeSection)
        if (currentIndex > 0) {
          scrollToSection(currentIndex - 1)
        }
      } else if (e.key === "Home") {
        e.preventDefault()
        scrollToSection(0)
      } else if (e.key === "End") {
        e.preventDefault()
        scrollToSection(SECTIONS.length - 1)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeSection])

  // Auto-scroll thumbnail track to center active item
  useEffect(() => {
    const track = thumbnailTrackRef.current
    if (!track) return

    const activeIndex = SECTIONS.findIndex(s => s.id === activeSection)
    const activeItem = track.children[activeIndex] as HTMLElement
    if (activeItem) {
      const trackWidth = track.offsetWidth
      const itemLeft = activeItem.offsetLeft
      const itemWidth = activeItem.offsetWidth
      track.scrollTo({
        left: itemLeft - trackWidth / 2 + itemWidth / 2,
        behavior: 'smooth'
      })
    }
  }, [activeSection])

  return (
    <div className="about-root">
      {/* Animated background */}
      <StarCanvas />
      <GlowCanvas />
      {/* Top nav - Simplified */}
      <header className="about-header">
        <div className="about-header-brand">
          <div className="about-header-logo">AI</div>
          <div>
            <div className="about-header-title">UAV 安全预警系统</div>
            <div className="about-header-sub">空天地一体化 · 生成式 AI</div>
          </div>
        </div>
        <nav className="about-header-nav">
          <a href="/" className="about-nav-link">首页</a>
        </nav>
      </header>

      {/* YouTube-style progress bar */}
      <div className="about-progress-bar">
        <div
          className="about-progress-bar-fill"
          style={{
            width: `${((SECTIONS.findIndex(s => s.id === activeSection) + 1) / SECTIONS.length) * 100}%`
          }}
        />
      </div>

      {/* Right-side progress track */}
      <ProgressTrack active={activeSection} onNavigate={scrollToSection} />

      {/* Scroll container */}
      <main ref={containerRef} className="about-scroll-container">
        {SECTIONS.map((s) => {
          const Component = SECTION_COMPONENTS[s.id]
          if (!Component) return null
          return <Component key={s.id} inView={inViewSections.has(s.id)} />
        })}
      </main>

      {/* Footer */}
      <footer className="about-footer">
        <div className="about-footer-left">
          © 2026 时空数据要素驱动的低空经济多场景应用 · 空天地一体化 + 生成式AI驱动
        </div>
        <div className="about-footer-right">
          <span className="about-status-dot" />
          SYSTEM ONLINE
        </div>
      </footer>
    </div>
  )
}
