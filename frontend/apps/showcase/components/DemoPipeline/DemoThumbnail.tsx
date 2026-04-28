"use client"
import { useState, useEffect } from "react"

interface DemoThumbnailProps {
src?: string
}

<
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8888"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8888"
>

export default function DemoThumbnail({ src }: DemoThumbnailProps) {
const [imgSrc, setImgSrc] = useState<string>("")
const [loading, setLoading] = useState(true)
const [error, setError] = useState(false)

useEffect(() => {
const url = src || `${API_BASE}/api/v1/demo/thumbnail`
setLoading(true)
setError(false)
setImgSrc(url + "?t=" + Date.now())
}, [src])

return (
<div className="relative w-full rounded-xl overflow-hidden" style={{ aspectRatio: "16/9", background: "var(--bg-primary)" }}>
{loading && (
<div className="absolute inset-0 flex items-center justify-center">
<div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "var(--accent-amber)", borderTopColor: "transparent" }} />
</div>
)}
{error ? (
<div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
<svg width="32" height="32" viewBox="0 0 32 32" fill="none">
<circle cx="16" cy="16" r="14" stroke="var(--text-muted)" strokeWidth="1.5" fill="none" />
<path d="M8 20 L16 10 L24 20" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
<circle cx="16" cy="22" r="1.5" fill="var(--text-muted)" />
</svg>
<span className="text-xs" style={{ color: "var(--text-muted)" }}>视频预览不可用</span>
</div>
) : (
<img
src={imgSrc}
alt="演示视频帧预览"
className="w-full h-full object-cover"
style={{ opacity: loading ? 0 : 1, transition: "opacity 0.3s" }}
onLoad={() => setLoading(false)}
onError={() => { setLoading(false); setError(true) }}
/>
)}
{/* Overlay badge */}
<div
className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono"
style={{ background: "rgba(0,0,0,0.7)", color: "var(--accent-amber)", border: "1px solid var(--accent-amber)" }}
>
<span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--accent-amber)" }} />
T1-D2 · MiTra航拍
</div>
</div>
)
}
