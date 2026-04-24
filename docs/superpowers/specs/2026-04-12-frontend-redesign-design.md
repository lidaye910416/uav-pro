# 前端重构设计文档
**日期**: 2026-04-12
**状态**: 已批准
**范围**: showcase (3000) 子路由整合 + 风格统一 + 技术架构图更新

---

## 1. 背景与目标

**问题**:
- dashboard (localhost:3001) 是独立前端服务，与首页风格割裂，增加维护成本
- about / architecture / achievements 页面使用 light 样式（Tailwind 普通类），与主页暗色 CSS 变量风格完全不一致
- architecture 页面技术描述过时（仍写 YOLO 目标检测）
- 各页面设计语言不统一

**目标**:
- 将监控看板合并为 showcase 的 `/monitor` 子路由，统一在 localhost:3000
- 所有页面统一暗色 Command Center 风格
- 更新 architecture 页面为最新技术架构
- 用 pipeline 演示集锦丰富 achievements 页面

---

## 2. 架构决策

### 2.1 服务整合

| 当前 | 重构后 |
|---|---|
| showcase (3000) | showcase (3000) — 增加 `/monitor` 路由 |
| dashboard (3001) | **删除** — 合并到 showcase |
| admin (3002) | admin (3002) — 保持不变 |
| backend (8000) | backend (8000) — 保持不变 |

PM2 进程数：4 → 3

### 2.2 路由结构

```
localhost:3000 (showcase)
  /              首页 hero + pipeline 演示卡片 + 快速统计
  /monitor       完整监控看板：4阶段 pipeline + 图表 + 实时预警流
  /about         项目背景 + 核心功能 + 应用场景（暗色）
  /architecture  3阶段规划 + 最新技术架构 SVG 图（暗色）
  /achievements  成果展示：数据成就 + pipeline 演示集锦（暗色）
```

---

## 3. 各页面设计规范

### 3.1 统一设计系统

**CSS 变量**（复用现有 globals.css）:

```css
--bg-primary:    #0A0A0A   /* 背景 */
--bg-secondary:  #111111
--bg-tertiary:   #1A1A1A
--bg-card:       #141414
--accent-amber:  #FFB800   /* 感知层 / 主色调 */
--accent-green:  #00E5A0   /* 视觉识别 */
--accent-red:    #FF3B3B   /* 决策 / 紧急 */
--accent-blue:   #00B4FF   /* RAG 检索 */
--accent-purple: #B47AFF   /* 决策生成 */
--text-primary:  #E8E8E8
--text-secondary:#6B6B6B
--text-muted:    #3D3D3D
--border:        #252525
--font-mono:     'JetBrains Mono', monospace
--font-body:     'Noto Sans SC', sans-serif
```

**动画风格**:
- `animate-pulse-amber` / `pulse-green` / `pulse-red`: 脉冲呼吸灯
- `animate-fade-in-up`: 渐入上升
- 风险等级左边框: `risk-critical` / `risk-high` / `risk-medium` / `risk-low`

### 3.2 `/monitor` 监控看板

**页面布局**:

```
┌──────────────────────────────────────────────────────────┐
│  LIVE · 感知层 ● 运行中 · 视觉识别 ● 运行中               │
├────────────────┬────────────────┬──────────────────────┤
│  感知层 ◉      │ 视觉识别 ◆     │ RAG检索 ◫            │
│  ● 运行中      │ ● 运行中       │ ● 运行中              │
│  帧率: 25fps   │ 模型: Gemma 4  │ 向量库: 1423 条      │
│  视频源: rtsp  │ 推理: 边缘端   │ 检索延迟: 12ms       │
├────────────────┴────────────────┴──────────────────────┤
│  决策生成 ◈                                              │
│  ● 运行中   LLM: Ollama (qwen2.5)  响应: 230ms         │
├─────────────────────────────────────────────────────────┤
│  [预警统计 饼图 echarts]  │  [24h趋势 折线图 echarts]  │
├─────────────────────────────────────────────────────────┤
│  实时预警流 (SSE)                                        │
│  ┌────────────────────────────────────────────────────┐│
│  │ [critical] 应急车道违规停车   94%   2m ago         ││
│  │ [high]     道路遗撒物检测     88%   5m ago         ││
│  └────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

**组件清单**:
- `PipelineStageCard`: 4个，每个含状态灯/指标/颜色标识
- `RiskPieChart`: ECharts 饼图，复用 dashboard 现有代码
- `AlertTrendChart`: ECharts 折线图，24h 趋势
- `LiveAlertFeed`: SSE 实时预警流，滚动列表
- `useAlertStream` hook: 复用 dashboard 现有 SSE 逻辑

### 3.3 `/about` 项目介绍（暗色重写）

**内容结构**:
- 项目背景：空天地一体化 + 生成式AI驱动高速公路安全预警
- 核心功能：感知层 / 视觉识别 / RAG检索 / 决策生成（四宫格卡片）
- 应用场景：高速巡检 / 应急事件 / 拥堵预警 / 障碍物检测
- 技术亮点：边缘部署 / 本地LLM / SOP知识库 / 实时SSE推送

**样式**: 暗色卡片 + 琥珀色强调 + SVG图标，与主页完全一致

### 3.4 `/architecture` 技术架构（更新 + SVG图）

**内容**:
- 3阶段规划保留（基础功能 / 功能增强 / 产品交付）
- 更新各阶段技术描述为最新栈

**SVG 架构图**（内联 SVG，用 CSS 变量着色）:

```
物理层:  无人机 + 高挂摄像头 (感知数据采集)
    ↓
边缘基站层:
  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐
  │ Gemma 4  │  │  ChromaDB    │  │     Ollama       │
  │ E2B      │  │  (向量数据库)  │  │  (本地LLM决策)    │
  │ 视觉推理  │  │  SOP知识检索  │  │  风险等级判定     │
  └──────────┘  └──────────────┘  └──────────────────┘
    ↓
后端服务层: FastAPI (SSE推送 / 数据聚合)
    ↓
展示层: Next.js (localhost:3000 统一入口)
```

**SVG 规范**:
- 使用 CSS 变量着色（amber/green/blue/purple）
- 带连接线动画（虚线流动效果）
- 响应式宽度

### 3.5 `/achievements` 成果展示

**内容**:
- **数据成就区**: 3个统计卡片（检测事件数 / 准确率 / 响应时间）
- **Pipeline 演示集锦**: 4个阶段效果卡片，每个含 SVG 占位图 + 描述
  - 感知层效果: 视频帧截图占位 + "原始视频流采集"
  - 视觉识别效果: 框选标注占位 + "Gemma 4 E2B 多模态识别"
  - RAG检索效果: 知识匹配图占位 + "SOP 知识库检索"
  - 决策生成效果: 预警卡片占位 + "LLM 风险等级判定"
- **样例数据上传区**: 提供上传入口（管理员功能）

**样例数据**: SVG 占位图 + 描述性文字，用户上传真实截图后替换

---

## 4. 技术实现要点

### 4.1 迁移策略

1. 复制 `dashboard/app/page.tsx` → `showcase/app/monitor/page.tsx`
2. 复制 `dashboard/hooks/useAlertStream.ts` → `showcase/hooks/`
3. 复制 `dashboard/components/AlertCard.tsx` → `showcase/components/`
4. 合并 `dashboard/app/globals.css` 设计系统 → `showcase/app/globals.css`
5. 删除 `dashboard` 独立服务，更新 pm2 配置
6. 更新 Header 导航（去掉外部 localhost:3001 链接，改内部 `/monitor`）

### 4.2 SSE 重用

`/monitor` 的 SSE 连接: `http://localhost:8000/api/v1/streams/alerts`
（stream 路由已存在，复用现有 EventSource 连接）

### 4.3 样式复用

- `showcase/app/globals.css`: 补充完整的 CSS 变量 + 动画定义
- `Header` / `Footer`: 共用，无需修改
- `AlertCard`: 跨页面复用，修复样式后所有页面生效

---

## 5. 验收标准

- [ ] `http://localhost:3000/monitor` 完整显示4阶段 pipeline + 图表 + 实时预警流
- [ ] 首页 `/about` `/architecture` `/achievements` 均为暗色风格，与主页一致
- [ ] `/architecture` 展示最新技术栈（Gemma 4 E2B / ChromaDB / Ollama / 边缘部署）
- [ ] PM2 仅管理 3 个服务（backend / showcase / admin）
- [ ] 所有页面通过 `pnpm --filter showcase exec tsc --noEmit`
- [ ] PM2 restart 后所有服务正常启动
