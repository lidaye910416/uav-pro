"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import PipelinePanel from "../components/DemoPipeline"

/* ── Interactive Particle Globe ────────────────────────────── */
function Globe3D() {
const containerRef = useRef<HTMLDivElement>(null)
const rotRef = useRef({ x: 0, y: 0 })
const targetRef = useRef({ x: 0, y: 0 })
const rafRef = useRef<number>(0)
const timeRef = useRef(0)

// Build particle data — 3 orbit rings with N particles each
const RING_DEFS = [
{ count: 28, rx: 170, ry: 170, tiltX: 0,   tiltZ: 0,    speed: 0.28, color: "255,184,0",   size: 2.2 },
{ count: 20, rx: 195, ry: 70,  tiltX: 62,  tiltZ: 18,   speed: -0.18, color: "180,122,255", size: 1.8 },
{ count: 16, rx: 210, ry: 85,  tiltX: -42, tiltZ: -25,  speed: 0.14, color: "0,229,160",   size: 1.5 },
{ count:  8, rx: 160, ry: 160, tiltX: 90,  tiltZ: 0,    speed: 0.08, color: "74,158,255",  size: 2.5 },
]

const buildParticles = () => {
return RING_DEFS.map((ring, ri) =>
Array.from({ length: ring.count }, (_, pi) => ({
ring,
idx: pi,
angle: (pi / ring.count) * Math.PI * 2,
}))
).flat()
}

const particlesRef = useRef(buildParticles())

const onMouseMove = (e: MouseEvent) => {
const rect = containerRef.current?.getBoundingClientRect()
if (!rect) return
targetRef.current = {
x: ((e.clientY - rect.top - rect.height / 2) / rect.height) * 28,
y: ((e.clientX - rect.left - rect.width / 2) / rect.width) * 55,
}
}

useEffect(() => {
const el = containerRef.current
if (!el) return
el.addEventListener("mousemove", onMouseMove)
el.addEventListener("mouseleave", () => { targetRef.current = { x: 0, y: 0 } })
return () => el.removeEventListener("mousemove", onMouseMove)
}, [])

useEffect(() => {
const cx = 200, cy = 200, SIZE = 200
const particles = particlesRef.current

function animate(time: number) {
timeRef.current = time
if (!containerRef.current) { rafRef.current = requestAnimationFrame(animate); return }

const lerp = 0.04
rotRef.current.x += (targetRef.current.x - rotRef.current.x) * lerp
rotRef.current.y += (targetRef.current.y - rotRef.current.y) * lerp

const { x: rx, y: ry } = rotRef.current
const rxRad = (rx * Math.PI) / 180
const ryRad = (ry * Math.PI) / 180
const cosX = Math.cos(rxRad), sinX = Math.sin(rxRad)
const cosY = Math.cos(ryRad), sinY = Math.sin(ryRad)

// Sweep angle
const sweep = (time / 1000) * 1.6

const svg = containerRef.current.querySelector("svg") as SVGSVGElement | null
if (svg) {
svg.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`

// Sweep radar line
const sweepLine = svg.querySelector("#sweep") as SVGLineElement | null
if (sweepLine) {
const sx = 170 * Math.sin(sweep)
const sy = -170 * Math.cos(sweep)
sweepLine.setAttribute("x2", String(sx))
sweepLine.setAttribute("y2", String(sy))
const sweepGrad = svg.querySelector("#sweepGrad") as SVGLinearGradientElement | null
if (sweepGrad) {
sweepGrad.setAttribute("x1", String(-sx))
sweepGrad.setAttribute("y1", String(-sy))
sweepGrad.setAttribute("x2", String(sx))
sweepGrad.setAttribute("y2", String(sy))
}
}

// Draw all particles
const g = svg.querySelector("#particles") as SVGGElement | null
if (g) {
// Update or create particle circles
let existing = g.querySelectorAll<SVGElement>(".p")
const totalNeeded = particles.length

// Ensure enough circles exist in DOM
while (existing.length < totalNeeded) {
const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
circle.classList.add("p")
g.appendChild(circle)
existing = g.querySelectorAll<SVGElement>(".p")
}

// Update each particle position
particles.forEach(({ ring, idx, angle }) => {
const t = time / 1000
const a = angle + t * ring.speed
const cosTilt = Math.cos((ring.tiltX * Math.PI) / 180)
const sinTilt = Math.sin((ring.tiltX * Math.PI) / 180)
const cosTiltZ = Math.cos((ring.tiltZ * Math.PI) / 180)
const sinTiltZ = Math.sin((ring.tiltZ * Math.PI) / 180)

// Base position on tilted ellipse
let px = ring.rx * Math.cos(a)
let py = ring.ry * Math.sin(a)
let pz = 0

// Apply tiltX
const ty = py * cosTilt - pz * sinTilt
const tz = py * sinTilt + pz * cosTilt
py = ty; pz = tz

// Apply tiltZ
const tx = px * cosTiltZ - pz * sinTiltZ
const tz2 = px * sinTiltZ + pz * cosTiltZ
px = tx; pz = tz2

// Apply world rotation (rx, ry)
const rrx = px * cosY - pz * sinY
const rry = py * cosX - pz * sinX
const rrz = px * sinY + pz * cosY

const scale = SIZE / (SIZE + rrz)
const sx = rrx * scale
const sy = rry * scale

// Fade based on depth
const depth = (rrz + SIZE) / (SIZE * 2)
const alpha = Math.max(0, Math.min(1, 0.15 + depth * 0.85))
const opacity = alpha * (0.6 + 0.4 * Math.sin(a * 2 + t * 1.5))

// Sweep glow — particles near sweep angle glow brighter
const sweepDist = Math.abs(((a - sweep + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
const sweepGlow = Math.max(0, 1 - sweepDist / 1.2)

const circle = existing[idx] as SVGCircleElement
circle.setAttribute("cx", String(sx))
circle.setAttribute("cy", String(sy))
circle.setAttribute("r", String(ring.size * scale * (1 + sweepGlow * 0.8)))
circle.setAttribute("fill", `rgba(${ring.color},${(opacity + sweepGlow * 0.5).toFixed(2)})`)
})

// Hide unused circles
for (let i = totalNeeded; i < existing.length; i++) {
;(existing[i] as SVGCircleElement).setAttribute("r", "0")
}
}

// Constellation connection lines — connect nearby particles on sweep pass
const linesG = svg.querySelector("#lines") as SVGGElement | null
if (linesG) {
const t = time / 1000
const sweepAngle = (t * 1.6) % (Math.PI * 2)
let lineIdx = 0
const MAX_LINES = 12

for (let ri = 0; ri < RING_DEFS.length - 1; ri++) {
for (let rj = ri + 1; rj < RING_DEFS.length; rj++) {
const ringA = RING_DEFS[ri]
const ringB = RING_DEFS[rj]
for (let ai = 0; ai < ringA.count; ai += 3) {
for (let bj = 0; bj < ringB.count; bj += 3) {
if (lineIdx >= MAX_LINES) break
const aAngle = (ai / ringA.count) * Math.PI * 2 + t * ringA.speed
const bAngle = (bj / ringB.count) * Math.PI * 2 + t * ringB.speed
const cosA = Math.cos(aAngle), sinA = Math.sin(aAngle)
const cosB = Math.cos(bAngle), sinB = Math.sin(bAngle)
const cosTiltXA = Math.cos((ringA.tiltX * Math.PI) / 180), sinTiltXA = Math.sin((ringA.tiltX * Math.PI) / 180)
const cosTiltZA = Math.cos((ringA.tiltZ * Math.PI) / 180), sinTiltZA = Math.sin((ringA.tiltZ * Math.PI) / 180)
const cosTiltXB = Math.cos((ringB.tiltX * Math.PI) / 180), sinTiltXB = Math.sin((ringB.tiltX * Math.PI) / 180)
const cosTiltZB = Math.cos((ringB.tiltZ * Math.PI) / 180), sinTiltZB = Math.sin((ringB.tiltZ * Math.PI) / 180)

const rot3D = (px: number, py: number, pz: number, cx: number, sx: number, cy: number, sy: number) => {
const rx = px * cy - pz * sy; const ry = py * cx - pz * sx; const rz = px * sy + pz * cy
const rx2 = ry * cx - rz * sx; const rz2 = ry * sx + rz * cx
const sc = SIZE / (SIZE + rz2)
return [rx * sc, rx2 * sc]
}

const [ax1, ay1] = rot3D(ringA.rx * cosA, ringA.ry * sinA, 0, cosX, sinX, cosY, sinY)
const [bx1, by1] = rot3D(ringB.rx * cosB, ringB.ry * sinB, 0, cosX, sinX, cosY, sinY)

const sweepPhase = Math.abs(Math.sin((sweepAngle - aAngle + Math.PI * 2) % (Math.PI * 2)))
const lineAlpha = sweepPhase * 0.35

let lineEl = linesG.children[lineIdx] as SVGLineElement | undefined
if (!lineEl) {
lineEl = document.createElementNS("http://www.w3.org/2000/svg", "line")
linesG.appendChild(lineEl)
}
lineEl.setAttribute("x1", String(ax1))
lineEl.setAttribute("y1", String(ay1))
lineEl.setAttribute("x2", String(bx1))
lineEl.setAttribute("y2", String(by1))
lineEl.setAttribute("stroke", `rgba(255,184,0,${lineAlpha.toFixed(2)})`)
lineEl.setAttribute("stroke-width", "0.8")
lineIdx++
}
}
}
}
// Hide extras
for (let i = lineIdx; i < linesG.children.length; i++) {
;(linesG.children[i] as SVGLineElement).setAttribute("stroke", "transparent")
}
}
}

rafRef.current = requestAnimationFrame(animate)
}

rafRef.current = requestAnimationFrame(animate)
return () => cancelAnimationFrame(rafRef.current)
}, [])

return (
<div
ref={containerRef}
className="relative w-full h-full flex items-center justify-center cursor-crosshair select-none"
style={{ perspective: "900px" }}
>
{/* Ambient glow orbs */}
<div className="absolute rounded-full pointer-events-none" style={{
width: 360, height: 360,
background: "radial-gradient(circle, rgba(255,184,0,0.07) 0%, transparent 65%)",
filter: "blur(24px)",
}} />
<div className="absolute rounded-full pointer-events-none" style={{
width: 220, height: 220,
background: "radial-gradient(circle, rgba(180,122,255,0.05) 0%, transparent 65%)",
filter: "blur(32px)",
}} />

{/* SVG particle globe */}
<svg
width="400" height="400" viewBox="-200 -200 400 400"
style={{ transformStyle: "preserve-3d" }}
>
<defs>
<radialGradient id="core" cx="50%" cy="50%" r="50%">
<stop offset="0%" stopColor="rgba(255,184,0,0.9)" />
<stop offset="60%" stopColor="rgba(255,184,0,0.3)" />
<stop offset="100%" stopColor="rgba(255,184,0,0)" />
</radialGradient>
<linearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
<stop offset="0%" stopColor="rgba(255,184,0,0)" />
<stop offset="100%" stopColor="rgba(255,184,0,0.6)" />
</linearGradient>
<filter id="glow">
<feGaussianBlur stdDeviation="2" result="blur" />
<feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
</filter>
</defs>

{/* Sweep radar */}
<line id="sweep" x1="0" y1="0" x2="170" y2="0"
stroke="url(#sweepGrad)" strokeWidth="1.5"
strokeLinecap="round" opacity="0.7"
filter="url(#glow)" />

{/* Equator ring */}
<circle cx="0" cy="0" r="170" fill="none"
stroke="rgba(255,184,0,0.12)" strokeWidth="1" strokeDasharray="3 9" />

{/* Outer ring */}
<circle cx="0" cy="0" r="200" fill="none"
stroke="rgba(255,255,255,0.05)" strokeWidth="0.8" />

{/* Particle group */}
<g id="particles" />

{/* Constellation lines */}
<g id="lines" />

{/* Core glow */}
<circle cx="0" cy="0" r="18" fill="url(#core)" filter="url(#glow)" />
<circle cx="0" cy="0" r="6" fill="rgba(255,184,0,0.95)" />
<circle cx="0" cy="0" r="2.5" fill="#fff" />

{/* Cardinal dots on equator */}
{[0, 90, 180, 270].map((deg) => {
const rad = (deg * Math.PI) / 180
const ex = 170 * Math.cos(rad)
const ey = 170 * Math.sin(rad)
return <circle key={deg} cx={ex} cy={ey} r="3.5" fill="rgba(255,184,0,0.85)" filter="url(#glow)" />
})}
</svg>
</div>
)
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
if (!canvas || !ctx) return
canvas.width = canvas.offsetWidth
canvas.height = canvas.offsetHeight
}
resize()
window.addEventListener("resize", resize)

function onMove(e: MouseEvent) {
if (!canvas) return
const rect = canvas.getBoundingClientRect()
mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
}
window.addEventListener("mousemove", onMove)

function draw() {
if (!canvas || !ctx) return
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
if (!canvas || !ctx) return
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
if (!canvas || !ctx) return
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

/* ── Home Page ───────────────────────────────────────────────── */
export default function HomePage() {
const scrollRef = useRef<HTMLDivElement>(null)
const [activeSection, setActiveSection] = useState(0)
const [pipelineRunning, setPipelineRunning] = useState(false)
const [showFooter, setShowFooter] = useState(false)
const lastScrollTop = useRef(0)

useEffect(() => {
const el = scrollRef.current
if (!el) return

function onScroll() {
if (!el) return
const sectionHeight = el.clientHeight
const scrollTop = el.scrollTop
const maxScroll = el.scrollHeight - el.clientHeight
const newSection = Math.round(scrollTop / sectionHeight)
setActiveSection(Math.min(newSection, 1))

// Footer 显示逻辑
const isAtBottom = scrollTop >= maxScroll - 5
const isScrollingDown = scrollTop > lastScrollTop.current

if (isAtBottom && isScrollingDown) {
setShowFooter(true)
} else if (scrollTop < maxScroll - 50) {
setShowFooter(false)
}

lastScrollTop.current = scrollTop
}

el.addEventListener("scroll", onScroll, { passive: true })
return () => el.removeEventListener("scroll", onScroll)
}, [])

function scrollTo(i: number) {
const el = scrollRef.current
if (!el) return
el.scrollTo({ top: i * el.clientHeight, behavior: "smooth" })
}

return (
<div className="home-root">
{/* Animated background */}
<StarCanvas />
<GlowCanvas />

{/* Right progress dots */}
<div className="home-progress">
{[0, 1].map((i) => (
<div
key={i}
className={`home-progress-dot${activeSection === i ? " active" : ""}`}
onClick={() => scrollTo(i)}
title={i === 0 ? "系统概览" : "工作流演示"}
/>
))}
</div>

{/* Scroll container */}
<div ref={scrollRef} className="home-scroll">

{/* ── Section 1: Hero ─────────────────────────────────── */}
<section className="home-section">
<div className="home-section-inner">
{/* Two-column: text left, globe right */}
<div className="flex items-center gap-8 w-full" style={{ minHeight: "calc(100vh - 160px)" }}>

{/* Left: text content */}
<div className="flex-1" style={{ maxWidth: 560 }}>
{/* Eyebrow pill */}
<div
className="inline-flex items-center gap-2 px-5 py-2 rounded-full font-mono text-sm mb-10"
style={{
background: "rgba(16,16,16,0.9)",
border: "1px solid var(--accent-amber)",
color: "var(--accent-amber)",
backdropFilter: "blur(16px)",
animation: "fadeIn 0.6s ease-out 0.1s both",
}}
>
<span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--accent-amber)", boxShadow: "0 0 8px var(--accent-amber)" }} />
LIVE · AI-POWERED · REAL-TIME
</div>

{/* Headline */}
<div style={{ animation: "fadeIn 0.7s ease-out 0.2s both", marginBottom: 28 }}>
<h1
className="font-bold leading-tight"
style={{
color: "var(--text-primary)",
fontSize: "clamp(2rem, 4vw, 3.8rem)",
letterSpacing: "-0.02em",
marginBottom: 8,
}}
>
无人机低空检测
</h1>
<h1
className="font-bold leading-tight"
style={{
color: "var(--accent-amber)",
fontSize: "clamp(2rem, 4vw, 3.8rem)",
letterSpacing: "-0.02em",
textShadow: "0 0 40px rgba(255,184,0,0.35)",
}}
>
智能安全预警系统
</h1>
</div>

{/* Accent bar */}
<div style={{ width: 72, height: 3, background: "var(--accent-amber)", borderRadius: 2, marginBottom: 28, animation: "fadeIn 0.5s ease-out 0.35s both" }} />

{/* Description */}
<p
className="leading-loose"
style={{
color: "var(--text-secondary)",
fontSize: "1rem",
lineHeight: 1.85,
marginBottom: 36,
animation: "fadeIn 0.6s ease-out 0.4s both",
}}
>
基于空天地一体化和生成式 AI 驱动的高速公路智能安全预警决策关键技术研究
</p>

{/* CTA */}
<div className="flex items-center gap-3 flex-wrap mb-8" style={{ animation: "fadeIn 0.6s ease-out 0.5s both" }}>
<a
<
href={`${process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:4001"}/monitor`}

href={`${process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:4001"}/monitor`}
>
className="px-7 py-3 rounded-xl font-mono text-sm font-medium tracking-wider transition-all hover:brightness-110"
style={{ background: "var(--accent-amber)", color: "#000", boxShadow: "0 0 24px rgba(255,184,0,0.3)" }}
>
感知中心 →
</a>
<a
<
href={`${process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:4001"}/brain`}

href={`${process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:4001"}/brain`}
>
className="px-7 py-3 rounded-xl font-mono text-sm font-medium tracking-wider transition-all hover:brightness-110"
style={{ background: "rgba(0,229,160,0.1)", color: "var(--accent-green)", border: "1px solid rgba(0,229,160,0.3)" }}
>
视觉大脑 →
</a>
<a
<
href={`${process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:4001"}/knowledge`}

href={`${process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:4001"}/knowledge`}
>
className="px-7 py-3 rounded-xl font-mono text-sm font-medium tracking-wider transition-all hover:brightness-110"
style={{ background: "rgba(74,158,255,0.08)", color: "var(--accent-blue)", border: "1px solid rgba(74,158,255,0.25)" }}
>
知识库 →
</a>
</div>

{/* Status */}
<div className="flex items-center gap-3 flex-wrap" style={{ animation: "fadeIn 0.6s ease-out 0.6s both" }}>
{[
{ label: "API: 9000", color: "var(--accent-amber)" },
{ label: "感知层就绪", color: "var(--accent-green)" },
{ label: "识别层就绪", color: "var(--accent-blue)" },
{ label: "预警层就绪", color: "var(--accent-red)" },
].map((item) => (
<div
key={item.label}
className="flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-xs"
style={{
background: "rgba(16,16,16,0.88)",
border: "1px solid var(--border)",
color: item.color,
backdropFilter: "blur(10px)",
}}
>
<span className="w-1.5 h-1.5 rounded-full" style={{ background: item.color, boxShadow: `0 0 5px ${item.color}` }} />
{item.label}
</div>
))}
</div>
</div>

{/* Right: 3D Globe */}
<div style={{ width: 400, height: 400, flexShrink: 0, marginLeft: 24, animation: "fadeIn 0.8s ease-out 0.2s both" }}>
<Globe3D />
</div>
</div>
</div>
</section>

{/* ── Section 2: Pipeline + Features ─────────────────── */}
<section className="home-section">
<div className="home-section-inner items-center" style={{ padding: "40px 80px 48px" }}>
{/* Two-column: pipeline left, feature cards right */}
<div className="flex w-full gap-8 items-start">

{/* Left: Pipeline (takes ~58% width) */}
<div
className="flex-1 w-full transition-all duration-700"
style={{ animation: "fadeIn 0.7s ease-out 0.1s both", maxWidth: pipelineRunning ? "100%" : "58%", flexBasis: pipelineRunning ? "100%" : "58%" }}
>
<PipelinePanel
onRunningChange={(r: boolean) => setPipelineRunning(r)}
/>
</div>

{/* Right: Feature cards stacked (takes ~42%) */}
<div
className="flex flex-col gap-5 transition-all duration-700"
style={{
animation: pipelineRunning ? "none" : "fadeIn 0.7s ease-out 0.3s both",
flexBasis: pipelineRunning ? "0%" : "42%",
maxWidth: pipelineRunning ? "0%" : "42%",
opacity: pipelineRunning ? 0 : 1,
overflow: "hidden",
minWidth: 0,
}}
>
{/* Section label */}
<div className="font-mono text-xs font-bold tracking-widest mb-1" style={{ color: "var(--text-muted)", letterSpacing: "0.15em" }}>
核心能力
</div>

{[
{
title: "感知层",
desc: "YOLOv8目标检测 + SAM分割 + DeepSORT跟踪，精准捕获道路目标",
color: "var(--accent-amber)",
icon: (
<svg width="22" height="22" viewBox="0 0 28 28" fill="none">
<circle cx="14" cy="14" r="5" fill="var(--accent-amber)" opacity="0.9"/>
<circle cx="14" cy="14" r="10" stroke="var(--accent-amber)" strokeWidth="1.2" fill="none" opacity="0.3"/>
<line x1="14" y1="2" x2="14" y2="8" stroke="var(--accent-amber)" strokeWidth="1.5" strokeLinecap="round"/>
<line x1="14" y1="20" x2="14" y2="26" stroke="var(--accent-amber)" strokeWidth="1.5" strokeLinecap="round"/>
<line x1="2" y1="14" x2="8" y2="14" stroke="var(--accent-amber)" strokeWidth="1.5" strokeLinecap="round"/>
<line x1="20" y1="14" x2="26" y2="14" stroke="var(--accent-amber)" strokeWidth="1.5" strokeLinecap="round"/>
</svg>
),
},
{
title: "智能识别",
desc: "Gemma4:e2b 多模态视觉理解，自动识别6类道路异常事件",
color: "var(--accent-green)",
icon: (
<svg width="22" height="22" viewBox="0 0 28 28" fill="none">
<circle cx="14" cy="14" r="4" fill="var(--accent-green)" opacity="0.95"/>
<path d="M4 14 Q14 4 24 14 Q14 24 4 14Z" stroke="var(--accent-green)" strokeWidth="1.5" fill="none" opacity="0.4"/>
</svg>
),
},
{
title: "实时预警",
desc: "ChromaDB RAG + Ollama决策，WebSocket推送，多风险等级判定",
color: "var(--accent-blue)",
icon: (
<svg width="22" height="22" viewBox="0 0 28 28" fill="none">
<path d="M6 20 L10 12 L14 16 L18 8 L22 14" stroke="var(--accent-blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>
<circle cx="22" cy="14" r="2.5" fill="var(--accent-blue)"/>
</svg>
),
},
].map((f) => (
<div
key={f.title}
className="flex items-start gap-4 p-5 rounded-xl transition-all duration-300"
style={{
background: "rgba(16,16,16,0.88)",
border: `1px solid ${f.color}25`,
backdropFilter: "blur(10px)",
}}
>
<div
className="flex items-center justify-center rounded-lg flex-shrink-0"
style={{
width: 42, height: 42,
background: `${f.color}12`,
color: f.color,
}}
>
{f.icon}
</div>
<div>
<h3 className="font-bold mb-1" style={{ color: f.color, fontSize: "0.95rem" }}>{f.title}</h3>
<p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", lineHeight: 1.65 }}>{f.desc}</p>
</div>
</div>
))}
</div>
</div>
</div>
</section>

</div>

{/* Footer - 只在滚动到第二屏底部时显示 */}
<div
className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
style={{
transform: showFooter ? "translateY(0)" : "translateY(100%)",
transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
}}
>
<div
className="pointer-events-auto"
style={{ background: "rgba(17,17,17,0.95)", backdropFilter: "blur(8px)", borderTop: "1px solid var(--border)" }}
>
<div className="max-w-6xl mx-auto px-6 py-3">
<div className="flex items-center justify-between">
<div className="flex items-center gap-4">
<div className="font-mono text-xs font-bold tracking-widest" style={{ color: "var(--accent-amber)" }}>
UAV-SAFETY SYSTEM
</div>
<div className="h-3 w-px" style={{ background: "var(--border)" }} />
<p className="text-xs" style={{ color: "var(--text-secondary)" }}>
© 2026 无人机低空检测智能安全预警系统
</p>
</div>
<div className="flex items-center gap-2 font-mono text-xs" style={{ color: "var(--text-muted)" }}>
<span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent-green)", boxShadow: "0 0 6px var(--accent-green)" }} />
SYSTEM ONLINE
</div>
</div>
</div>
</div>
</div>
</div>
)
}
