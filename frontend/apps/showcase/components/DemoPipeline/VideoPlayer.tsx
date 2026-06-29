"use client";
import { API_BASE } from "@uav/api"
import { useRef, useEffect, useState } from "react"

// 检测框后端格式: bbox = [x1, y1, x2, y2] 像素坐标
interface BoundingBox {
  x1: number; y1: number; x2: number; y2: number
  label?: string
  color?: string        // 中文颜色名, e.g. "绿色", "蓝色"
  confidence?: number   // 0-1
}

interface VideoPlayerProps {
  onPlay?: () => void
  onPause?: () => void
  rois?: BoundingBox[]
  showROIBadge?: boolean
  annotatedFrameUrl?: string  // 标注帧图片 URL (从后端 combined_image_url 来)
  imageWidth?: number        // 标注帧原始宽度 (用于 bbox 像素→百分比换算)
  imageHeight?: number       // 标注帧原始高度
}

export default function VideoPlayer({
  onPlay, onPause,
  rois = [],
  showROIBadge = false,
  annotatedFrameUrl,
  imageWidth = 1280,
  imageHeight = 720,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showAnnotated, setShowAnnotated] = useState(false)

  // 切换到标注帧显示
  useEffect(() => {
    if (annotatedFrameUrl) {
      setShowAnnotated(true)
    }
  }, [annotatedFrameUrl])

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
      style={{ aspectRatio: "16/9", background: "var(--bg-primary)" }}
    >
      {showAnnotated && annotatedFrameUrl ? (
        /* 标注帧图片 + bbox 叠加层 */
        <AnnotatedFrame
          url={annotatedFrameUrl}
          rois={rois}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
        />
      ) : (
        /* 原始视频 */
        <video
          ref={videoRef}
          src={`${API_BASE}/demo/video?video_id=gal_1`}
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
      )}

      {/* ROI overlay boxes - 原始视频时用 div 简单画框 (无具体类目信息时) */}
      {showROIBadge && !showAnnotated && rois.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          {rois.map((roi, i) => (
            <div
              key={i}
              className="absolute border-2 rounded"
              style={{
                left: `${(roi.x1 / imageWidth) * 100}%`,
                top: `${(roi.y1 / imageHeight) * 100}%`,
                width: `${((roi.x2 - roi.x1) / imageWidth) * 100}%`,
                height: `${((roi.y2 - roi.y1) / imageHeight) * 100}%`,
                borderColor: "var(--accent-amber)",
                boxShadow: "0 0 8px var(--accent-amber)",
              }}
            />
          ))}
        </div>
      )}

      {/* Overlay badge */}
      <div
        className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono"
        style={{ background: "rgba(0,0,0,0.75)", color: "var(--accent-amber)", border: "1px solid var(--accent-amber)" }}
      >
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--accent-amber)" }} />
        T1-D2 · MiTra航拍
      </div>

      {/* 标注帧标签 */}
      {showAnnotated && annotatedFrameUrl && (
        <div
          className="absolute top-3 right-3 px-2 py-1 rounded text-xs font-mono"
          style={{ background: "rgba(0,229,160,0.2)", color: "var(--accent-green)", border: "1px solid var(--accent-green)" }}
        >
          ◉ 检测帧 · {rois.length} 目标
        </div>
      )}

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

// ── AnnotatedFrame: 标注帧 + bbox SVG 叠加 ──────────────────────────────

// 与后端 SAM mask 颜色保持一致 (后端返回中文颜色名 → 前端映射为 SVG 颜色)
const BBOX_COLOR_MAP: Record<string, string> = {
  "绿色":   "#00E5A0",
  "蓝色":   "#4A9EFF",
  "浅蓝色": "#6496FF",
  "黄绿色": "#C8C800",
  "红色":   "#FF3B3B",
  "白色":   "#FFFFFF",
  "黄色":   "#FFB800",
}

function bboxStroke(name?: string): string {
  if (!name) return "#FFB800"
  return BBOX_COLOR_MAP[name] || "#FFB800"
}

interface AnnotatedFrameProps {
  url: string
  rois: BoundingBox[]
  imageWidth: number
  imageHeight: number
}

function AnnotatedFrame({ url, rois, imageWidth, imageHeight }: AnnotatedFrameProps) {
  // viewBox 与原图像素尺寸一致, 这样 (x1,y1,x2,y2) 直接当 SVG 坐标用
  const viewBox = `0 0 ${imageWidth} ${imageHeight}`
  return (
    <div className="relative w-full h-full">
      <img
        src={url}
        alt="检测帧"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",  // 关键: contain 而非 cover, 保留完整标注图像
        }}
      />
      {/* bbox 叠加层: 同样 contain, 通过 preserveAspectRatio 对齐 */}
      {rois.length > 0 && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
        >
          {rois.map((roi, i) => {
            const w = Math.max(roi.x2 - roi.x1, 1)
            const h = Math.max(roi.y2 - roi.y1, 1)
            const stroke = bboxStroke(roi.color)
            const label = roi.label || "目标"
            const conf = roi.confidence != null ? `${(roi.confidence * 100).toFixed(0)}%` : ""
            const labelText = conf ? `${label} ${conf}` : label
            // label 背景宽度估算 (按每字符 ~22px @ 1080 height)
            const labelW = Math.max(labelText.length * 22 + 12, 60)
            const labelH = 28
            return (
              <g key={i}>
                {/* 主矩形 */}
                <rect
                  x={roi.x1}
                  y={roi.y1}
                  width={w}
                  height={h}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={3}
                  style={{ filter: `drop-shadow(0 0 6px ${stroke})` }}
                />
                {/* 矩形左上角小实心方块, 更易识别 */}
                <rect
                  x={roi.x1}
                  y={roi.y1}
                  width={Math.min(w, 24)}
                  height={4}
                  fill={stroke}
                />
                {/* 类别标签背景 */}
                <rect
                  x={roi.x1}
                  y={Math.max(roi.y1 - labelH, 0)}
                  width={labelW}
                  height={labelH}
                  fill={stroke}
                  opacity={0.85}
                  rx={3}
                />
                {/* 类别标签文字 */}
                <text
                  x={roi.x1 + 6}
                  y={Math.max(roi.y1 - labelH, 0) + labelH - 8}
                  fontSize={18}
                  fontFamily="var(--font-mono, monospace)"
                  fontWeight="bold"
                  fill="#000"
                >
                  {labelText}
                </text>
              </g>
            )
          })}
        </svg>
      )}
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
  videos.forEach((v) => v.play().catch(() => {})
  )
}
