# 🚀 UAV-PRO 启动指南（AI 友好版）

## 项目概述

UAV-PRO 是一个基于无人机航拍图像的智能安全预警系统，使用 YOLO + SAM + Gemma 多模型协同进行目标检测和风险预警。

## ⚠️ 重要：端口配置机制

**本项目所有服务端口均通过环境变量配置，无硬编码。**

### 配置方式

1. **创建 .env 文件**（在项目根目录）：
```bash
cp .env.example .env
```

2. **修改端口配置**：
```bash
# .env
BACKEND_PORT=8888
SHOWCASE_PORT=4000
DASHBOARD_PORT=4001
ADMIN_PORT=4002
OLLAMA_PORT=11434
CHROMADB_PORT=8001
NEXT_PUBLIC_API_BASE=http://localhost:8888
NEXT_PUBLIC_SHOWCASE_URL=http://localhost:4000
NEXT_PUBLIC_DASHBOARD_URL=http://localhost:4001
NEXT_PUBLIC_ADMIN_URL=http://localhost:4002
```

## 启动命令

### 一键启动（推荐）
```bash
./start.sh start
```

### 单独启动各服务

```bash
# 1. 启动 Ollama
ollama serve

# 2. 启动后端
cd backend
PYTHONPATH=./backend python3 -m uvicorn main:app --host 127.0.0.1 --port $BACKEND_PORT

# 3. 启动前端（需要在 frontend 目录）
cd frontend/apps/showcase && pnpm dev -- -p $SHOWCASE_PORT
cd frontend/apps/dashboard && pnpm dev -- -p $DASHBOARD_PORT
cd frontend/apps/admin && pnpm dev -- -p $ADMIN_PORT
```

## 服务端口对应关系

| 服务 | 环境变量 | 默认端口 |
|------|----------|----------|
| Backend API | `BACKEND_PORT` | 8888 |
| Showcase | `SHOWCASE_PORT` | 4000 |
| Dashboard | `DASHBOARD_PORT` | 4001 |
| Admin | `ADMIN_PORT` | 4002 |
| Ollama | `OLLAMA_PORT` | 11434 |
| ChromaDB | `CHROMADB_PORT` | 8001 |

## 前端环境变量

前端需要单独的配置（在各应用目录下）：

```
# frontend/apps/showcase/.env.local
NEXT_PUBLIC_API_BASE=http://localhost:8888

# frontend/apps/dashboard/.env.local
NEXT_PUBLIC_API_BASE=http://localhost:8888

# frontend/apps/admin/.env.local
NEXT_PUBLIC_API_BASE=http://localhost:8888
```

## PM2 启动配置

使用 PM2 管理服务时，端口从 .env 文件读取：

```javascript
// ecosystem.config.js
const backendPort = process.env.BACKEND_PORT || '8888';
const showcasePort = process.env.SHOWCASE_PORT || '4000';
// ...
```

## 故障排查

### 端口被占用
```bash
# 查看端口占用
lsof -i:8888

# 杀掉占用进程
lsof -ti:8888 | xargs kill -9
```

### CORS 跨域问题
后端会自动允许所有配置的 localhost 端口，无需手动配置 CORS。

### Ollama 模型未找到
```bash
# 确保模型已下载
ollama list
ollama pull gemma4:e2b
```
