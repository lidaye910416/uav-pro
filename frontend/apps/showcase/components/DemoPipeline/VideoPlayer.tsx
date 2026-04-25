"use client"
import { useRef, useEffect } from "react"

interface ROIBox {
  x1: number; y1: number; x2: number; y2: number; confidence: number
}

interface VideoPlayerProps {
  onPlay?: () => void
  onPause?: () => void
  rois?: ROIBox[]
  showROIBadge?: boolean
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

export default function VideoPlayer({ onPlay, onPause, rois = [], showROIBadge = false }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  function pause() {
    videoRef.current?.pause()
  }

  function play() {
    videoRef.current?.play().catch(() => {})
  }

  // Expose pause/play via data attribute for PipelinePanel to control
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    const obs = new MutationObserver(() => {
      // triggered when parent signals pause/play via class or data
    })
    obs.observe(el.parentElement || el, { attributes: true, attributeFilter: ["data-paused"] })
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-xl overflow-hidden"
      style={{ aspectRatio: "16/7", background: "var(--bg-primary)" }}
    >
      <video
        ref={videoRef}
        src={`${API_BASE}/api/v1/demo/video`}
        autoPlay
        muted
        loop
        playsInline
        controls
        controlsList="nodownload nofullscreen"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        onPlay={onPlay}
        onPause={onPause}
      />

      {/* ROI overlay boxes */}
      {showROIBadge && rois.map((roi, i) => (
        <div
          key={i}
          className="absolute border-2 rounded pointer-events-none"
          style={{
            left: `${roi.x1}%`,
            top: `${roi.y1}%`,
            width: `${roi.x2 - roi.x1}%`,
            height: `${roi.y2 - roi.y1}%`,
            borderColor: "var(--accent-amber)",
            boxShadow: "0 0 8px var(--accent-amber)",
          }}
        />
      ))}

      {/* Overlay badge */}
      <div
        className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono"
        style={{ background: "rgba(0,0,0,0.75)", color: "var(--accent-amber)", border: "1px solid var(--accent-amber)" }}
      >
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--accent-amber)" }} />
        T1-D2 · MiTra航拍
      </div>

      {/* Scan line effect overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)",
        }}
      />
    </div>
  )
}

// Expose controller functions via module-level refs
export function pauseVideo() {
  const videos = document.querySelectorAll("video")
  videos.forEach((v) => v.pause())
}
export function playVideo() {
  const videos = document.querySelectorAll("video")
  videos.forEach((v) => v.play().catch(() => {}))
}
