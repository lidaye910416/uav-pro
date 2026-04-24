# 前端重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 dashboard (3001) 合并到 showcase (3000) 子路由，统一所有页面暗色风格，更新技术架构图

**Architecture:** 监控看板迁移为 `/monitor` 子路由，复用 dashboard 的 ECharts 图表和 SSE hook，全站共享同一套暗色设计系统（CSS 变量）

**Tech Stack:** Next.js 14 / Tailwind / ECharts / SSE / CSS Variables

---

## 文件结构

```
showcase/
  app/
    globals.css          ← 重写：合并 dashboard 完整设计系统
    about/page.tsx       ← 重写：暗色风格
    architecture/page.tsx← 重写：暗色 + SVG 架构图
    achievements/page.tsx← 重写：暗色 + pipeline 演示集锦
    monitor/page.tsx     ← 新建：从 dashboard/page.tsx 迁移
  components/
    AlertCard/           ← 新建：从 dashboard 复制
  hooks/
    useAlertStream.ts    ← 新建：从 dashboard 复制
```

---

## Task 1: 重写 showcase globals.css — 完整暗色设计系统

**Files:**
- Modify: `frontend/apps/showcase/app/globals.css`

- [ ] **Step 1: 备份并重写 globals.css**

写入以下完整内容（合并 dashboard 的完整变量集 + showcase 的动画）：

```css
/* ═══════════════════════════════════════════════════════════
   UAV 低空检测系统 — 统一暗色设计系统
═══════════════════════════════════════════════════════════ */

@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Noto+Sans+SC:wght@300;400;500;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

/* ── CSS Custom Properties ─────────────────────────────────── */
:root {
  --bg-primary: #0A0A0A;
  --bg-secondary: #111111;
  --bg-tertiary: #1A1A1A;
  --bg-card: #141414;
  --accent-amber: #FFB800;
  --accent-green: #00E5A0;
  --accent-red: #FF3B3B;
  --accent-blue: #00B4FF;
  --accent-purple: #B47AFF;
  --text-primary: #E8E8E8;
  --text-secondary: #6B6B6B;
  --text-muted: #3D3D3D;
  --border: #252525;
  --border-active: #3A3A3A;
  --font-mono: 'JetBrains Mono', 'Consolas', 'SF Mono', monospace;
  --font-body: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
}

@layer base {
  * { box-sizing: border-box; }
  html { color-scheme: dark; }
  body {
    background-color: var(--bg-primary);
    color: var(--text-primary);
    font-family: var(--font-body);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    line-height: 1.6;
  }
}

/* ── 滚动条 ───────────────────────────────────────────────── */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: var(--bg-secondary); }
::-webkit-scrollbar-thumb { background: var(--border-active); border-radius: 2px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-secondary); }

/* ── 动画 ─────────────────────────────────────────────────── */
@keyframes pulse-amber {
  0%,100% { box-shadow: 0 0 4px var(--accent-amber), 0 0 8px rgba(255,184,0,0.3); }
  50% { box-shadow: 0 0 12px var(--accent-amber), 0 0 24px rgba(255,184,0,0.5); }
}
@keyframes pulse-green {
  0%,100% { box-shadow: 0 0 4px var(--accent-green); }
  50% { box-shadow: 0 0 10px var(--accent-green); }
}
@keyframes pulse-red {
  0%,100% { box-shadow: 0 0 4px var(--accent-red); }
  50% { box-shadow: 0 0 10px var(--accent-red); }
}
@keyframes pulse-blue {
  0%,100% { box-shadow: 0 0 4px var(--accent-blue); }
  50% { box-shadow: 0 0 10px var(--accent-blue); }
}
@keyframes pulse-purple {
  0%,100% { box-shadow: 0 0 4px var(--accent-purple); }
  50% { box-shadow: 0 0 10px var(--accent-purple); }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes gridScan {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}

/* ── Grid background ──────────────────────────────────────── */
.grid-lines {
  background-image:
    linear-gradient(var(--border) 1px, transparent 1px),
    linear-gradient(90deg, var(--border) 1px, transparent 1px);
  background-size: 40px 40px;
}

/* ── Scan overlay ─────────────────────────────────────────── */
.scan-overlay::after {
  content: '';
  position: fixed;
  inset: 0;
  background: linear-gradient(to bottom, transparent 0%, rgba(0,180,255,0.02) 50%, transparent 100%);
  height: 20%;
  animation: gridScan 8s linear infinite;
  pointer-events: none;
  z-index: 9999;
}

/* ── Utility Classes ───────────────────────────────────────── */
@layer utilities {
  .font-mono { font-family: var(--font-mono) !important; }
  .font-body  { font-family: var(--font-body) !important; }
  .animate-pulse-amber  { animation: pulse-amber  2s ease-in-out infinite; }
  .animate-pulse-green  { animation: pulse-green  2s ease-in-out infinite; }
  .animate-pulse-red    { animation: pulse-red    2s ease-in-out infinite; }
  .animate-pulse-blue   { animation: pulse-blue   2s ease-in-out infinite; }
  .animate-pulse-purple { animation: pulse-purple  2s ease-in-out infinite; }
  .animate-fade-in-up   { animation: fadeInUp 0.4s ease-out; }
  .glow-text            { text-shadow: 0 0 12px currentColor; }
  .glow-amber           { text-shadow: 0 0 16px rgba(255,184,0,0.5); }
  .glow-green           { text-shadow: 0 0 16px rgba(0,229,160,0.5); }
  .scrollbar-hide::-webkit-scrollbar { display: none; }
  .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
  .risk-critical { border-left: 3px solid var(--accent-red); }
  .risk-high     { border-left: 3px solid var(--accent-amber); }
  .risk-medium   { border-left: 3px solid var(--accent-blue); }
  .risk-low      { border-left: 3px solid var(--accent-green); }
}
```

- [ ] **Step 2: 验证构建**

Run: `pnpm --filter showcase build 2>&1 | tail -5`
Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add frontend/apps/showcase/app/globals.css
git commit -m "refactor: replace globals.css with complete dark design system"
```

---

## Task 2: 复制 useAlertStream hook

**Files:**
- Create: `frontend/apps/showcase/hooks/useAlertStream.ts`
- Source: `frontend/apps/dashboard/hooks/useAlertStream.ts` (全文复制)

- [ ] **Step 1: 复制文件**

从 dashboard 复制 `useAlertStream.ts` 到 showcase 同名路径：
```bash
cp frontend/apps/dashboard/hooks/useAlertStream.ts frontend/apps/showcase/hooks/
```

- [ ] **Step 2: TypeScript 检查**

Run: `pnpm --filter showcase exec tsc --noEmit 2>&1 | grep useAlertStream`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add frontend/apps/showcase/hooks/useAlertStream.ts
git commit -m "feat: copy useAlertStream hook from dashboard"
```

---

## Task 3: 复制 AlertCard 组件

**Files:**
- Create: `frontend/apps/showcase/components/AlertCard/index.tsx`
- Source: `frontend/apps/dashboard/components/AlertCard/index.tsx`

- [ ] **Step 1: 复制 AlertCard 组件**

```bash
cp -r frontend/apps/dashboard/components/AlertCard frontend/apps/showcase/components/
```

- [ ] **Step 2: TypeScript 检查**

Run: `pnpm --filter showcase exec tsc --noEmit 2>&1 | grep AlertCard`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add frontend/apps/showcase/components/AlertCard/
git commit -m "feat: copy AlertCard component from dashboard"
```

---

## Task 4: 创建 /monitor 监控看板页面

**Files:**
- Create: `frontend/apps/showcase/app/monitor/page.tsx`

- [ ] **Step 1: 创建目录和页面**

从 `dashboard/app/page.tsx` 提取核心逻辑，写入 `showcase/app/monitor/page.tsx`，包含：
- 顶部 LIVE 状态栏（四阶段状态）
- Pipeline 阶段卡片（4个，各含状态灯 + 指标）
- ECharts 图表（预警统计饼图 + 24h趋势折线图，从 dashboard/page.tsx 复制 option 函数）
- 实时预警流（`useAlertStream` hook + `AlertCard` 组件）
- 使用 showcase 的 CSS 变量（替换 dashboard 中的硬编码颜色）

关键 SSE 连接地址：`http://localhost:8000/api/v1/streams/alerts`

导入路径（相对于 `app/monitor/page.tsx`）：
```tsx
import { useAlertStream, StreamAlert } from "../../hooks/useAlertStream"
import AlertCard from "../../components/AlertCard"
import ReactECharts from "echarts-for-react"
```

- [ ] **Step 2: 安装 echarts-for-react（如缺少）**

```bash
ls frontend/apps/showcase/node_modules/echarts-for-react 2>/dev/null && echo "exists" || \
  (cd frontend/apps/showcase && pnpm add echarts-for-react echarts)
```

- [ ] **Step 3: TypeScript 检查**

```bash
pnpm --filter showcase exec tsc --noEmit 2>&1 | grep -i "monitor\|error TS" | head -10
```
Expected: 无 error TS（warning 可忽略）

- [ ] **Step 4: Commit**

```bash
git add frontend/apps/showcase/app/monitor/
git commit -m "feat: add /monitor page — pipeline dashboard with SSE alerts"
```

---

## Task 5: 重写 /about 项目介绍（暗色风格）

**Files:**
- Modify: `frontend/apps/showcase/app/about/page.tsx`

- [ ] **Step 1: 重写页面**

使用 showcase globals.css 中的暗色 CSS 变量。内容结构：
- 项目背景（空天地一体化 + 生成式AI驱动高速公路安全预警）
- 核心功能四宫格（感知层/视觉识别/RAG检索/决策生成，各含 SVG icon）
- 应用场景四卡片（高速巡检/应急事件/拥堵预警/恶劣天气）

卡片样式规范：
```tsx
// 暗色卡片
style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
// 标题色
style={{ color: "var(--accent-amber)" }}
// 正文色
style={{ color: "var(--text-secondary)" }}
```

- [ ] **Step 2: TypeScript 检查**

```bash
pnpm --filter showcase exec tsc --noEmit 2>&1 | grep about
```
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add frontend/apps/showcase/app/about/page.tsx
git commit -m "refactor: rewrite /about with dark Command Center style"
```

---

## Task 6: 重写 /architecture 技术架构（含 SVG 图）

**Files:**
- Modify: `frontend/apps/showcase/app/architecture/page.tsx`

- [ ] **Step 1: 重写页面含内联 SVG 架构图**

页面包含两个部分：
1. SVG 系统架构图（四层：感知层→边缘基站→后端→前端），使用 CSS 变量着色
2. 开发阶段三卡片（基础功能/功能增强/产品交付）

SVG 架构图内容：
```
Layer 1 (amber): 无人机 + 高挂摄像头 (感知层)
Layer 2 (mixed): Gemma 4 E2B | ChromaDB | Ollama (边缘基站)
Layer 3 (amber): FastAPI 后端 (SSE/REST)
Layer 4 (amber): Next.js 前端 (/ · /monitor · /about · /architecture · /achievements)
```

SVG 使用内联 `fill="var(--accent-amber)"` 等，浏览器渲染时自动解析 CSS 变量。

- [ ] **Step 2: TypeScript 检查**

```bash
pnpm --filter showcase exec tsc --noEmit 2>&1 | grep architecture
```
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add frontend/apps/showcase/app/architecture/page.tsx
git commit -m "refactor: rewrite /architecture with dark style + SVG architecture diagram"
```

---

## Task 7: 重写 /achievements 成果展示

**Files:**
- Modify: `frontend/apps/showcase/app/achievements/page.tsx`

- [ ] **Step 1: 重写页面（暗色 + Pipeline 演示集锦）**

内容结构：
1. 顶部统计三卡片（检测事件 21+/最高置信度 94%/LLM响应 230ms）
2. Pipeline 演示集锦四卡片，每个含内联 SVG 占位图 + 描述文字：
   - 感知层：视频帧 SVG（1920×1080, 25fps）
   - 视觉识别：框选标注 SVG（违规停车 + 障碍物）
   - RAG检索：向量检索 SVG（相似案例匹配）
   - 决策生成：预警卡片 SVG（风险等级 + 置信度条）

SVG 占位图使用与页面相同的 CSS 变量着色（`var(--accent-amber)` 等）。

- [ ] **Step 2: TypeScript 检查**

```bash
pnpm --filter showcase exec tsc --noEmit 2>&1 | grep achievements
```
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add frontend/apps/showcase/app/achievements/page.tsx
git commit -m "refactor: rewrite /achievements with dark style + SVG pipeline gallery"
```

---

## Task 8: 更新 Header 导航

**Files:**
- Modify: `frontend/apps/showcase/components/Layout/Header.tsx`

- [ ] **Step 1: 更新 navItems 和按钮**

```tsx
const navItems = [
  { href: "/",            label: "首页" },
  { href: "/monitor",     label: "监控看板" },
  { href: "/about",       label: "项目介绍" },
  { href: "/architecture",label: "技术架构" },
  { href: "/achievements",label: "成果展示" },
]
```

监控看板按钮改为内部路由：
```tsx
href="/monitor"    // 改自 href="http://localhost:3001"
```
（管理后台按钮保留 `href="http://localhost:3002"` 因为是独立服务）

- [ ] **Step 2: TypeScript 检查**

```bash
pnpm --filter showcase exec tsc --noEmit 2>&1 | grep Header
```
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add frontend/apps/showcase/components/Layout/Header.tsx
git commit -m "refactor: update Header — add /monitor route, internal nav links"
```

---

## Task 9: 更新 PM2 配置 — 删除 dashboard 服务

**Files:**
- Modify: `website/ecosystem.config.js`

- [ ] **Step 1: 从 ecosystem.config.js 删除 dashboard 条目**

删除以下条目：
```js
{
  name: 'dashboard',
  script: './node_modules/next/dist/bin/next',
  args: 'dev -p 3001',
  cwd: '/Users/jasonlee/UAV_PRO/website/frontend/apps/dashboard',
  env: { NODE_ENV: 'development' },
  interpreter: 'none',
  autorestart: true,
},
```

保留：backend (8000) / showcase (3000) / admin (3002)

- [ ] **Step 2: PM2 更新**

```bash
pm2 delete dashboard 2>/dev/null
pm2 start ecosystem.config.js
pm2 save
```

- [ ] **Step 3: 验证 3 服务全部在线**

```bash
pm2 list
```
Expected: backend + showcase + admin 均为 `online`，无 `errored`

- [ ] **Step 4: HTTP 响应验证**

```bash
for port in 3000 3002 8000; do
  curl -s -o /dev/null -w "localhost:$port HTTP %{http_code}\n" http://localhost:$port
done
```
Expected: 全部 `HTTP 200`

- [ ] **Step 5: Commit**

```bash
git add website/ecosystem.config.js
git commit -m "chore: remove dashboard from pm2 — merged into showcase /monitor"
```

---

## Task 10: 最终验证

- [ ] **Step 1: TypeScript 干净**

```bash
pnpm --filter showcase exec tsc --noEmit 2>&1 | grep "error TS" | head -5
```
Expected: 无输出

- [ ] **Step 2: showcase 构建成功**

```bash
pnpm --filter showcase build 2>&1 | tail -3
```
Expected: `✓ Compiled successfully`

- [ ] **Step 3: /monitor 页面内容验证**

```bash
curl -s http://localhost:3000/monitor | grep -o "LIVE\|感知层\|monitor" | head -3
```
Expected: 输出 `LIVE` 和 `感知层`

- [ ] **Step 4: 页面风格验证（无 light 样式残留）**

```bash
grep -r "text-gray\|bg-sky\|bg-blue-100\|text-sky" frontend/apps/showcase/app/about/ frontend/apps/showcase/app/architecture/ frontend/apps/showcase/app/achievements/ 2>/dev/null
```
Expected: 无输出（已替换为暗色变量）

---

## 验收标准

- [ ] `http://localhost:3000/monitor` 完整显示 pipeline + 图表 + 实时预警流
- [ ] `/about` `/architecture` `/achievements` 均为暗色风格，与首页一致
- [ ] `/architecture` 展示最新技术栈（Gemma 4 E2B / ChromaDB / Ollama / 边缘部署）
- [ ] PM2 仅管理 3 个服务（backend / showcase / admin）
- [ ] 所有页面 `tsc --noEmit` 无 error
- [ ] PM2 restart 后所有服务正常启动
