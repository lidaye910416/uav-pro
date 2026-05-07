# UAV 低空检测系统 - Claude AI 导引文档

## 项目概述

本项目是一个基于空天地一体化感知网络与生成式 AI 决策引擎的低空安全监测与智能决策系统。

## 服务架构

### 端口配置

所有服务端口统一在 `frontend/.env.local` 中配置：

```env
# API & Backend
NEXT_PUBLIC_API_BASE=http://localhost:8000  # 后端 API 端口

# Frontend Apps (for navigation links)
NEXT_PUBLIC_SHOWCASE_URL=http://localhost:3000  # 展示首页
NEXT_PUBLIC_DASHBOARD_URL=http://localhost:3001  # 感知中心/仪表盘
NEXT_PUBLIC_ADMIN_URL=http://localhost:3002       # 管理后台
```

### 服务列表

| 服务 | 端口 | 说明 |
|------|------|------|
| API Backend | 8000 | 后端 API 服务（实际运行在 8888，需同步修改） |
| Showcase | 3000 | 展示首页 |
| Dashboard | 3001 | 感知中心、飞控平台、智能决策 |
| Admin | 3002 | 管理后台 |

### 页面路由

#### Dashboard (感知中心) - http://localhost:3001
- `/` - 控制台首页
- `/monitor` - 感知中心（视频流监控）
- `/brain` - 智能决策（Gemma 多模态推理演示）
- `/alerts` - 预警列表
- `/flight` - 飞控平台

#### Showcase (展示首页) - http://localhost:3000
- `/` - 首页（系统概览 + Pipeline 演示）
- `/about` - 项目概览

#### Admin (管理后台) - http://localhost:3002
- `/` - 管理后台首页
- `/streams` - 感知流管理
- `/upload` - 图像测试
- `/alerts` - 预警历史
- `/settings` - 系统设置
- `/rag` - RAG 知识库

## 启动/停止服务

### 启动所有服务

```bash
cd /Users/jasonlee/UAV_PRO/website/frontend

# 启动后端 API
cd apps/api && npm run dev &
sleep 3

# 启动三个前端应用
cd apps/showcase && npm run dev &
cd apps/dashboard && npm run dev &
cd apps/admin && npm run dev &
```

### 停止所有服务

```bash
# 按端口停止
lsof -ti:8000 | xargs kill 2>/dev/null  # API
lsof -ti:3000 | xargs kill 2>/dev/null  # Showcase
lsof -ti:3001 | xargs kill 2>/dev/null  # Dashboard
lsof -ti:3002 | xargs kill 2>/dev/null  # Admin
```

### 检查服务状态

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000  # Showcase
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001  # Dashboard
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002  # Admin
```

## 修改指南

### 1. 修改端口配置

**重要**：修改端口后，必须同步更新以下位置：

#### a) 环境变量文件 `frontend/.env.local`
```env
NEXT_PUBLIC_API_BASE=http://localhost:新端口
NEXT_PUBLIC_SHOWCASE_URL=http://localhost:新端口
NEXT_PUBLIC_DASHBOARD_URL=http://localhost:新端口
NEXT_PUBLIC_ADMIN_URL=http://localhost:新端口
```

#### b) 各应用的 package.json 端口配置
```json
// apps/showcase/package.json
{
  "scripts": {
    "dev": "next dev -p 3000"  // 修改此端口
  }
}
```

#### c) 各应用的启动脚本（如果单独启动）

### 2. 修改导航链接

导航链接使用环境变量，不需要硬编码：

```typescript
// ✅ 正确方式 - 使用环境变量
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3001"
<a href={`${DASHBOARD_URL}/brain`}>智能决策</a>

// ❌ 错误方式 - 硬编码
<a href="http://localhost:3001/brain">智能决策</a>
```

#### 需要使用环境变量的文件
- `apps/showcase/app/page.tsx` - 首页 CTA 按钮
- `apps/showcase/components/Layout/Header.tsx` - 顶部导航
- `apps/dashboard/components/Layout/Sidebar.tsx` - 侧边栏导航
- `apps/dashboard/app/page.tsx` - 控制台底部链接
- `apps/admin/app/layout.tsx` - 管理后台布局

### 3. 修改 API 调用

API 调用统一使用 `API_BASE` 环境变量：

```typescript
// ✅ 正确方式
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"
fetch(`${API_BASE}/api/v1/demo/stream`)

// ❌ 错误方式
fetch("http://localhost:8888/api/v1/demo/stream")
```

#### 需要使用环境变量的文件
- `apps/showcase/components/DemoPipeline/index.tsx`
- `apps/dashboard/app/monitor/page.tsx`
- `apps/dashboard/app/brain/page.tsx`
- `apps/dashboard/hooks/*.ts`
- `apps/admin/lib/api.ts`
- `apps/admin/app/rag/page.tsx`

### 4. 重启服务使配置生效

修改配置后，必须重启服务：

```bash
# 重启特定服务
lsof -ti:3000 | xargs kill 2>/dev/null
cd apps/showcase && npm run dev &
```

## 调试命令

### 检查服务是否运行
```bash
lsof -i :3000 -i :3001 -i :3002 -i :8888 2>/dev/null
```

### 查看服务日志
```bash
# Next.js 开发模式日志会直接输出到终端
# 或查看临时日志文件
tail -f /tmp/showcase.log
tail -f /tmp/dashboard.log
```

### 检查环境变量是否生效
```bash
curl -s http://localhost:3000 2>/dev/null | grep -o "NEXT_PUBLIC" || echo "检查 HTML 中是否包含正确的环境变量"
```

## 常见问题

### Q: 首页样式不显示
A: 可能是 Next.js 构建缓存损坏，尝试：
```bash
lsof -ti:3000 | xargs kill 2>/dev/null
cd apps/showcase && rm -rf .next && npm run dev &
```

### Q: 按钮点击无响应
A: 检查环境变量配置和页面路由是否正确

### Q: API 调用失败
A: 确认后端 API 服务是否运行，检查端口配置

## 环境变量使用规范

1. **前端可访问的变量**：必须以 `NEXT_PUBLIC_` 开头
2. **后端专用变量**：不能以 `NEXT_PUBLIC_` 开头
3. **Fallback 策略**：始终提供 fallback 值作为后备

```typescript
// 环境变量声明
// .env.local
NEXT_PUBLIC_API_BASE=http://localhost:8000

// 代码使用
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"
```

## 关键文件清单

```
frontend/
├── .env.local                    # 环境变量配置（所有端口在此定义）
├── claude.md                    # 本文档
├── apps/
│   ├── showcase/                 # 展示首页
│   │   ├── app/
│   │   │   ├── page.tsx       # 首页（CTA 按钮）
│   │   │   └── layout.tsx     # 布局
│   │   └── components/
│   │       ├── Layout/Header.tsx    # 顶部导航
│   │       └── DemoPipeline/        # Pipeline 演示组件
│   ├── dashboard/               # 感知中心
│   │   ├── app/
│   │   │   ├── page.tsx       # 控制台
│   │   │   ├── monitor/page.tsx   # 感知中心
│   │   │   ├── brain/page.tsx     # 智能决策
│   │   │   └── flight/page.tsx    # 飞控平台
│   │   └── components/
│   │       └── Layout/Sidebar.tsx  # 侧边栏导航
│   └── admin/                  # 管理后台
│       ├── app/
│       │   └── layout.tsx     # 管理后台布局
│       └── lib/
│           └── api.ts         # API 调用封装
```

## 更新日志

### 2026-05-06
- 创建 claude.md 文档
- 修复 .env.local 中 API_BASE 端口配置（8000 → 8888）
- 修复 dashboard/api/alerts.ts 中的硬编码端口
- 统一所有 API 调用使用 NEXT_PUBLIC_API_BASE 环境变量

## 端口一致性检查

确保以下端口配置一致：

```bash
# 检查 .env.local
grep "localhost:" frontend/.env.local

# 检查 API 实际运行端口
curl -s http://localhost:8888/ | head -1  # 应返回 API 响应

# 检查代码中的 fallback 值
grep -rn "localhost:8888\|localhost:8000" frontend/apps/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | grep -v ".env"
# 应无输出或仅有 fallback 默认值
```
