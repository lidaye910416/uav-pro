# 演示 Pipeline 可视化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在首页实现演示视频缩略图 + 4阶段卡片展开可视化，完整展示 Pipeline 每步输出

**Architecture:** 后端新增 `/thumbnail` 接口提供视频帧截图 + 扩展 SSE 事件携带 `summary`/`error` 字段；前端新增 `StageCard` + `PipelinePanel` 组件，通过 SSE 驱动展开/收起动画

**Tech Stack:** FastAPI (backend), Next.js App Router + Tailwind CSS (frontend), SSE

---

## 文件结构

```
backend/
  app/api/routes_demo.py          # 修改：thumbnail接口 + vision总结 + SSE扩展
  data/streams/.thumbnail_cache.jpg  # 自动生成，无需手动创建

frontend/apps/showcase/
  app/page.tsx                   # 修改：替换DemoSectionComponent
  app/globals.css                # 修改：pipeline动画类
  components/DemoPipeline/
    index.tsx                    # 创建：PipelinePanel主组件
    StageCard.tsx                # 创建：单张阶段卡片
    DemoThumbnail.tsx            # 创建：视频缩略图组件
```

---

## Task 1: 后端 — Thumbnail 接口

**Files:**
- Modify: `backend/app/api/routes_demo.py` — 新增 `@router.get("/thumbnail")` 和 `DEMO_THUMBNAIL_CACHE`

- [ ] **Step 1: 在 routes_demo.py 顶部 import 区添加**

```python
import tempfile
import os
```

- [ ] **Step 2: 在 `DEMO_VIDEO` 定义后添加缩略图缓存路径**

```python
DEMO_VIDEO = Path(__file__).resolve().parents[2] / "data" / "streams" / "DJI_0025_cut1.Mp4"
DEMO_THUMBNAIL_CACHE = DEMO_VIDEO.parent / ".thumbnail_cache.jpg"
```

- [ ] **Step 3: 在 SEED_ALERTS 定义前插入 thumbnail 接口**

```python
# ── GET /demo/thumbnail ───────────────────────────────────────────────────

@router.get("/thumbnail")
def get_demo_thumbnail():
    """从演示视频第10%帧提取缩略图，返回JPEG。首次调用生成并缓存。"""
    if DEMO_THUMBNAIL_CACHE.exists():
        return StreamingResponse(
            open(DEMO_THUMBNAIL_CACHE, "rb"),
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=3600"},
        )

    if not DEMO_VIDEO.exists():
        raise HTTPException(404, "演示视频不存在")

    cap = cv2.VideoCapture(str(DEMO_VIDEO))
    if not cap.isOpened():
        raise HTTPException(500, "无法读取视频")

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, total // 10))
    ret, frame = cap.read()
    cap.release()

    if not ret or frame is None:
        raise HTTPException(500, "无法提取帧")

    thumb = cv2.resize(frame, (640, 360))
    cv2.imwrite(str(DEMO_THUMBNAIL_CACHE), thumb, [cv2.IMWRITE_JPEG_QUALITY, 85])

    return StreamingResponse(
        open(DEMO_THUMBNAIL_CACHE, "rb"),
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=3600"},
    )
```

- [ ] **Step 4: 在文件顶部 import 添加 StreamingResponse**

确认 `from fastapi import APIRouter, HTTPException` 已有，`StreamingResponse` 已在现有 import 中

- [ ] **Step 5: 测试接口**

```bash
curl -s --max-time 5 http://localhost:8000/api/v1/demo/thumbnail -o /tmp/thumb_test.jpg
file /tmp/thumb_test.jpg
```
Expected: `/tmp/thumb_test.jpg: JPEG image data, JFIF standard, ...`

- [ ] **Step 6: 提交**

```bash
cd /Users/jasonlee/UAV_PRO/website
git add backend/app/api/routes_demo.py
git commit -m "feat(backend): add /demo/thumbnail endpoint for video frame preview"
```

---

## Task 2: 后端 — Vision 总结 + SSE 扩展

**Files:**
- Modify: `backend/app/api/routes_demo.py` — 修改 `_vision_describe` 和 `_demo_sse_stream` 中的 SSE 事件格式

- [ ] **Step 1: 在 `async def _vision_describe` 返回前添加总结逻辑**

找到当前返回语句：
```python
    # Fallback: pixel-based analysis
    return _pixel_analyze(frame_bgr)
```

在其后、文件末尾 `async def _rag_retrieve` 之前插入：

```python
async def _summarize_description(scene_desc: str, model: str | None, timeout: float) -> str:
    """将场景描述总结为40-60字摘要。"""
    if not scene_desc or not model:
        return scene_desc[:60] if scene_desc else "场景描述为空"

    system_prompt = "你是一个高速公路安全监控助手。请严格按要求输出。"
    user_prompt = f"""请将以下航拍场景描述总结为40-60字的中文摘要，保留关键信息（如场景类型、异常情况）：
{scene_desc}
直接输出摘要，不要添加解释，不要加引号。"""

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "stream": False,
    }
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(f"{settings.OLLAMA_BASE_URL}/api/chat", json=payload)
            r.raise_for_status()
            raw = r.json().get("message", {}).get("content", "").strip()
            if raw:
                return raw[:80]  # 安全截断
    except Exception:
        pass
    return scene_desc[:60]
```

- [ ] **Step 2: 修改 `_demo_sse_stream` 中的 vision 阶段 SSE 事件**

找到 vision 阶段代码块：
```python
                # Stage 2: 视觉识别
                events.append(f"event: stage\ndata: {json.dumps({'stage': 'vision', 'progress': idx * 33 + 8})}\n\n".encode())
```

替换为：
```python
                # Stage 2: 视觉识别
                events.append(f"event: stage\ndata: {json.dumps({'stage': 'vision', 'progress': idx * 33 + 8, 'status': 'running'})}\n\n".encode())
```

找到 vision 完成后的 RAG 事件：
```python
                events.append(f"event: stage\ndata: {json.dumps({'stage': 'rag', 'progress': idx * 33 + 16, 'scene': scene_desc[:80]})}\n\n".encode())
```

替换为：
```python
                # 总结视觉描述
                vision_summary = await _summarize_description(scene_desc, vision_model, timeout=30.0)
                events.append(f"event: stage\ndata: {json.dumps({'stage': 'vision', 'progress': idx * 33 + 8, 'status': 'done', 'summary': vision_summary})}\n\n".encode())

                # Stage 3: RAG检索
                events.append(f"event: stage\ndata: {json.dumps({'stage': 'rag', 'progress': idx * 33 + 16, 'status': 'running'})}\n\n".encode())
```

- [ ] **Step 3: 确认 _summarize_description 在 _demo_sse_stream 调用处之前定义**

将 `_summarize_description` 函数放在 `_demo_sse_stream` 函数定义之前（在 `_extract_demo_frames` 之后）

- [ ] **Step 4: 语法验证**

```bash
cd /Users/jasonlee/UAV_PRO/website/backend
python3 -c "import app.api.routes_demo; print('ok')"
```
Expected: `ok`

- [ ] **Step 5: 提交**

```bash
cd /Users/jasonlee/UAV_PRO/website
git add backend/app/api/routes_demo.py
git commit -m "feat(backend): add vision summarization and extend SSE stage events with summary field"
```

---

## Task 3: 前端 — DemoThumbnail 组件

**Files:**
- Create: `frontend/apps/showcase/components/DemoPipeline/DemoThumbnail.tsx`
- Create: `frontend/apps/showcase/components/DemoPipeline/index.tsx`（先创建空壳）

- [ ] **Step 1: 创建 DemoThumbnail.tsx**

```tsx
"use client"
import { useState, useEffect } from "react"

interface DemoThumbnailProps {
  videoName: string
  tags?: string[]
}

export default function DemoThumbnail({ videoName, tags = ["4K航拍", "DJI无人机", "高速公路"] }: DemoThumbnailProps) {
  const [src, setSrc] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    const img = new window.Image()
    img.onload = () => {
      setSrc("http://localhost:8000/api/v1/demo/thumbnail?t=" + Date.now())
      setLoading(false)
    }
    img.onerror = () => {
      setLoading(false)
      setError(true)
    }
    img.src = "http://localhost:8000/api/v1/demo/thumbnail"
  }, [])

  return (
    <div className="relative w-24 h-16 rounded-lg overflow-hidden flex-shrink-0" style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent-amber)", borderTopColor: "transparent" }} />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-xs" style={{ color: "var(--text-muted)" }}>
          无缩略图
        </div>
      )}
      {src && !error && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={videoName} className="w-full h-full object-cover" />
      )}
    </div>
  )
}
```

- [ ] **Step 2: 创建 index.tsx 空壳**

```tsx
// Placeholder — full PipelinePanel implemented in Task 5
export default function PipelinePanel() {
  return null
}
```

- [ ] **Step 3: 提交**

```bash
cd /Users/jasonlee/UAV_PRO/website
git add frontend/apps/showcase/components/DemoPipeline/
git commit -m "feat(frontend): add DemoThumbnail component skeleton"
```

---

## Task 4: 前端 — StageCard 组件

**Files:**
- Modify: `frontend/apps/showcase/components/DemoPipeline/StageCard.tsx`

- [ ] **Step 1: 创建 StageCard.tsx**

```tsx
"use client"

export type StageStatus = "idle" | "running" | "done" | "error"

interface StageCardProps {
  index: number
  name: string
  status: StageStatus
  summary?: string
  error?: string
  accentColor: string
}

export default function StageCard({ index, name, status, summary, error, accentColor }: StageCardProps) {
  const isActive = status === "running"
  const isDone = status === "done"
  const isError = status === "error"

  const borderColor = isError ? "var(--accent-red)"
    : isDone ? "var(--accent-green)"
    : isActive ? accentColor
    : "var(--border)"

  return (
    <div
      className="flex-1 rounded-xl p-3 flex flex-col gap-2 transition-all duration-300"
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${borderColor}`,
        boxShadow: isActive ? `0 0 12px ${accentColor}40` : "none",
        minWidth: 0,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all"
          style={{
            background: isActive ? accentColor : isDone ? "var(--accent-green)" : isError ? "var(--accent-red)" : "var(--bg-tertiary)",
            color: (isActive || isDone || isError) ? "#000" : "var(--text-muted)",
            boxShadow: isActive ? `0 0 8px ${accentColor}` : "none",
          }}
        >
          {isDone ? "✓" : isError ? "✕" : index + 1}
        </div>
        <span className="text-xs font-mono font-bold truncate" style={{ color: isActive ? accentColor : "var(--text-secondary)" }}>
          {name}
        </span>
      </div>

      {/* Content area */}
      <div className="min-h-[40px]">
        {isActive && (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accentColor }} />
            <span className="text-xs animate-pulse" style={{ color: accentColor }}>
              运行中...
            </span>
          </div>
        )}
        {isError && error && (
          <div className="text-xs px-2 py-1 rounded" style={{ background: "rgba(255,59,59,0.1)", color: "var(--accent-red)", borderLeft: "2px solid var(--accent-red)" }}>
            ⚠ {error}
          </div>
        )}
        {isDone && summary && (
          <p className="text-xs leading-relaxed line-clamp-3" style={{ color: "var(--text-secondary)" }}>
            {summary}
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
cd /Users/jasonlee/UAV_PRO/website
git add frontend/apps/showcase/components/DemoPipeline/StageCard.tsx
git commit -m "feat(frontend): add StageCard component with idle/running/done/error states"
```

---

## Task 5: 前端 — PipelinePanel 主组件

**Files:**
- Modify: `frontend/apps/showcase/components/DemoPipeline/index.tsx`

- [ ] **Step 1: 实现完整 PipelinePanel**

替换 `frontend/apps/showcase/components/DemoPipeline/index.tsx` 全部内容：

```tsx
"use client"
import { useState, useEffect, useRef } from "react"
import StageCard from "./StageCard"
import DemoThumbnail from "./DemoThumbnail"

const STAGES = [
  { key: "perception", name: "感知层", color: "var(--accent-amber)" },
  { key: "vision",     name: "视觉识别", color: "var(--accent-green)" },
  { key: "rag",        name: "RAG检索",  color: "var(--accent-blue)" },
  { key: "decision",  name: "决策生成", color: "var(--accent-purple)" },
]

const RISK_COLORS: Record<string, string> = {
  critical: "var(--accent-red)",
  high: "var(--accent-amber)",
  medium: "var(--accent-blue)",
  low: "var(--accent-green)",
}

interface StageData {
  status: "idle" | "running" | "done" | "error"
  summary?: string
  error?: string
}

interface StreamAlert {
  id: number
  title: string
  description: string
  risk_level: string
  recommendation: string
  confidence: number
  scene_description?: string
  created_at: string
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
}

export default function PipelinePanel() {
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [alert, setAlert] = useState<StreamAlert | null>(null)
  const [stages, setStages] = useState<Record<string, StageData>>(() =>
    Object.fromEntries(STAGES.map(s => [s.key, { status: "idle" as const }]))
  )
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => () => { esRef.current?.close() }, [])

  async function handleDemo() {
    setRunning(true)
    setDone(false)
    setAlert(null)
    setStages(Object.fromEntries(STAGES.map(s => [s.key, { status: "idle" }])))

    // Start stages sequentially with a small delay
    for (let i = 0; i < STAGES.length; i++) {
      await new Promise(r => setTimeout(r, 200))
      setStages(prev => ({ ...prev, [STAGES[i].key]: { status: "running" } }))
    }

    if (esRef.current) esRef.current.close()
    const es = new EventSource("http://localhost:8000/api/v1/demo/stream")
    esRef.current = es

    es.addEventListener("stage", (e: MessageEvent) => {
      const data = JSON.parse(e.data) as {
        stage: string
        status?: string
        summary?: string
        error?: string
      }
      const stageKey = data.stage === "perception" ? "perception"
        : data.stage === "vision" ? "vision"
        : data.stage === "rag" ? "rag"
        : data.stage === "decision" ? "decision"
        : null
      if (!stageKey) return

      if (data.status === "done") {
        setStages(prev => ({
          ...prev,
          [stageKey]: { status: "done", summary: data.summary, error: data.error }
        }))
      } else if (data.error) {
        setStages(prev => ({
          ...prev,
          [stageKey]: { status: "error", error: data.error }
        }))
      } else {
        setStages(prev => ({
          ...prev,
          [stageKey]: { status: "running", summary: data.summary }
        }))
      }
    })

    es.addEventListener("alert", (e: MessageEvent) => {
      const data = JSON.parse(e.data) as StreamAlert
      setAlert(data)
      setRunning(false)
      setDone(true)
      setStages(Object.fromEntries(STAGES.map(s => [s.key, { status: "idle" }])))
      es.close()
      setTimeout(() => {
        setDone(false)
        setAlert(null)
      }, 15000)
    })

    es.onerror = () => {
      setRunning(false)
      setStages(Object.fromEntries(STAGES.map(s => [s.key, { status: "idle" }])))
      es.close()
    }

    fetch("http://localhost:8000/api/v1/demo/seed").catch(() => {})
  }

  return (
    <div className="w-full max-w-3xl mx-auto mb-12 animate-fade-in" style={{ animationDelay: "0.4s" }}>
      {/* Card container */}
      <div className="rounded-2xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-sm" style={{ background: "var(--accent-amber)", color: "#000" }}>
            AI
          </div>
          <div>
            <div className="font-bold text-sm" style={{ color: "var(--accent-amber)" }}>🚀 快速演示</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>感知 → 识别 → RAG → 决策 完整 pipeline 演示</div>
          </div>
        </div>

        {/* Control bar */}
        <div className="flex items-center gap-4 mb-5 p-3 rounded-xl" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
          <DemoThumbnail videoName="DJI_0025_cut1.Mp4" />
          <div className="flex-1 min-w-0">
            <div className="font-mono text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>DJI_0025_cut1.Mp4</div>
            <div className="flex gap-2 mt-1">
              {["4K航拍", "DJI无人机", "高速公路"].map(tag => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: "rgba(255,184,0,0.08)", color: "var(--accent-amber)", border: "1px solid rgba(255,184,0,0.2)" }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={handleDemo}
            disabled={running}
            className="px-5 py-2.5 rounded-lg font-mono text-sm font-medium transition-all flex-shrink-0"
            style={{
              background: running ? "var(--bg-tertiary)" : "var(--accent-amber)",
              color: running ? "var(--text-muted)" : "#000",
              cursor: running ? "not-allowed" : "pointer",
              boxShadow: running ? "none" : "0 0 16px rgba(255,184,0,0.3)",
            }}
          >
            {running ? "◈ 运行中..." : "▶ 启动演示"}
          </button>
        </div>

        {/* Pipeline stage cards */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {STAGES.map((stage, i) => (
            <StageCard
              key={stage.key}
              index={i}
              name={stage.name}
              status={stages[stage.key]?.status ?? "idle"}
              summary={stages[stage.key]?.summary}
              error={stages[stage.key]?.error}
              accentColor={stage.color}
            />
          ))}
        </div>

        {/* Alert result */}
        {(alert || done) && alert && (
          <div
            className="rounded-xl p-4 animate-fade-in-up"
            style={{
              background: "var(--bg-primary)",
              borderLeft: `4px solid ${RISK_COLORS[alert.risk_level] || "var(--border)"}`,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: RISK_COLORS[alert.risk_level] }} />
                <span className="font-mono text-xs font-bold uppercase" style={{ color: RISK_COLORS[alert.risk_level] }}>
                  {alert.risk_level} · {(alert.confidence * 100).toFixed(0)}% 置信度
                </span>
              </div>
              <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>实时分析</span>
            </div>
            <div className="font-bold text-sm mb-1" style={{ color: "var(--text-primary)" }}>{alert.title}</div>
            {alert.description && (
              <div className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>{alert.description}</div>
            )}
            {alert.recommendation && (
              <div className="text-xs px-3 py-2 rounded" style={{ background: "rgba(255,184,0,0.06)", borderLeft: "2px solid var(--accent-amber)", color: "var(--accent-amber)" }}>
                建议: {alert.recommendation}
              </div>
            )}
          </div>
        )}

        {!running && !done && !alert && (
          <div className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
            点击「启动演示」体验完整 pipeline — 感知 → 视觉识别 → RAG 检索 → LLM 决策
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 语法验证**

```bash
cd /Users/jasonlee/UAV_PRO/website/frontend
npx tsc --noEmit --filter showcase 2>&1 | head -20
```
Expected: 无 TypeScript 错误

- [ ] **Step 3: 提交**

```bash
cd /Users/jasonlee/UAV_PRO/website
git add frontend/apps/showcase/components/DemoPipeline/index.tsx
git commit -m "feat(frontend): implement full PipelinePanel with SSE-driven stage cards"
```

---

## Task 6: 前端 — 更新 page.tsx

**Files:**
- Modify: `frontend/apps/showcase/app/page.tsx`

- [ ] **Step 1: 删除旧的 DemoSectionComponent 并替换为 PipelinePanel**

删除从第 4 行 `const DEMO_STAGES` 到第 163 行 `</div>` 的全部旧 DemoSectionComponent 代码

在 `import { useState, useEffect, useRef } from "react"` 后添加：

```tsx
import PipelinePanel from "../components/DemoPipeline"
```

找到 `Hero` 区域中 `<DemoSectionComponent />` 的位置（约第 260 行），替换为：

```tsx
        {/* Pipeline Demo */}
        <PipelinePanel />
```

- [ ] **Step 2: 语法验证**

```bash
cd /Users/jasonlee/UAV_PRO/website/frontend
npx tsc --noEmit --filter showcase 2>&1 | head -20
```

- [ ] **Step 3: 构建验证**

```bash
cd /Users/jasonlee/UAV_PRO/website/frontend
pnpm --filter showcase build 2>&1 | tail -15
```
Expected: `✓ Compiled successfully`

- [ ] **Step 4: 提交**

```bash
cd /Users/jasonlee/UAV_PRO/website
git add frontend/apps/showcase/app/page.tsx
git commit -m "refactor(frontend): replace old DemoSection with new PipelinePanel component"
```

---

## Task 7: 集成验证

- [ ] **Step 1: 重启后端**

```bash
npx pm2 restart backend 2>&1 | tail -3
sleep 4
```

- [ ] **Step 2: 测试 thumbnail 接口**

```bash
curl -s --max-time 5 http://localhost:8000/api/v1/demo/thumbnail -o /tmp/t.jpg
file /tmp/t.jpg
# Expected: JPEG image data, JFIF standard
```

- [ ] **Step 3: 重启前端 + 清除缓存**

```bash
npx pm2 stop showcase && rm -rf /Users/jasonlee/UAV_PRO/website/frontend/apps/showcase/.next && npx pm2 start showcase 2>&1 | tail -3
sleep 5
```

- [ ] **Step 4: 测试 SSE 流完整输出**

```bash
curl -s --max-time 10 http://localhost:8000/api/v1/demo/stream | python3 -c "
import sys, json, re
data = sys.stdin.read()
# Find all stage events with summary
for m in re.finditer(r'\"stage\":\s*\"([^\"]+)\".*?\"summary\":\s*\"([^\"]+)\"', data):
    print(f'  [{m.group(1)}] summary: {m.group(2)[:50]}')
for m in re.finditer(r'\"title\":\s*\"([^\"]+)\"', data):
    print(f'  Alert: {m.group(1)}')
"
```

Expected: 看到各阶段的 summary 和最终 Alert title

- [ ] **Step 5: 浏览器验证**

访问 `http://localhost:3000`，按 Cmd+Shift+R 强制刷新，确认：
1. 控制栏显示视频缩略图
2. 4 张阶段卡片横向排列（待机态）
3. 点击"启动演示"，卡片依次展开显示内容
4. 最终 Alert 结果卡片弹出

---

## Task 8: 提交所有剩余文件

```bash
cd /Users/jasonlee/UAV_PRO/website
git status
git add -A
git commit -m "feat: complete demo pipeline visualization (thumbnail + stage cards + SSE alerts)"
```
