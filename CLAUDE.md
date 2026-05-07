# CLAUDE.md

AI 助手指南 - UAV 低空检测智能安全预警系统

## 1. 通用准则

### Think Before Coding
- 不确定时提问，不要假设
- 多个方案时列出，不要默默选择
- 不清楚时停止，说明问题

### Simplicity First
- 最少代码解决问题，不做多余抽象
- 如果 200 行能做 50 行的事，重写
- 无请求的功能不做

### Surgical Changes
- 只改必要的代码
- 不「改进」无关代码
- 格式风格跟随现有代码
- 自己产生的冗余代码要删除

### Goal-Driven Execution
- 定义可验证的成功标准
- 多步骤任务列出计划
- 循环验证直到通过

---

## 2. 项目架构

### 服务端口（从 .env 读取）

| 服务 | 端口 | 说明 |
|------|------|------|
| Backend API | BACKEND_PORT (默认 8888) | 后端 API 服务 |
| Ollama LLM | OLLAMA_PORT (默认 11434) | Gemma4 等模型 |
| Showcase | SHOWCASE_PORT (默认 3000) | 展示首页 |
| Dashboard | DASHBOARD_PORT (默认 3001) | 感知中心 |
| Admin | ADMIN_PORT (默认 3002) | 管理后台 |

### Pipeline 架构

```
感知层 (YOLO+SAM) → 识别层 (Gemma4) → RAG检索 (ChromaDB) → 决策层 (Gemma4)
```

### 置信度
- 使用 0-1 范围（不是 0-100）
- SOP 知识库：`backend/data/chromadb/`

---

## 3. 端口配置规则 ⚠️

**禁止在代码中硬编码端口！**

### 前端规范

```typescript
// ✅ 正确 - 使用环境变量
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8888"
fetch(`${API_BASE}/api/v1/demo/stream`)

// ❌ 错误 - 硬编码端口
fetch("http://localhost:8888/api/v1/demo/stream")
```

### 后端规范

```python
# ✅ 正确 - 使用 settings
from app.core.config import settings
url = settings.OLLAMA_BASE_URL

# ❌ 错误 - 硬编码端口
url = "http://localhost:11434"
```

---

## 4. 页面路由

| 应用 | 路由 |
|------|------|
| Showcase (3000) | `/` 首页, `/about` 项目概览 |
| Dashboard (3001) | `/monitor` 感知中心, `/brain` 智能决策, `/alerts` 预警, `/flight` 飞控 |
| Admin (3002) | `/streams` 感知流, `/alerts` 预警, `/rag` 知识库 |

---

## 5. 启动方式

**只需修改 `根目录 .env` 文件，然后使用 start.sh 启动。**

```bash
# 1. 修改端口
vim .env
# BACKEND_PORT=9999

# 2. 启动（自动同步配置到所有服务）
./start.sh start
```

### 配置文件说明

| 文件 | 作用 | 说明 |
|------|------|------|
| `.env` (根目录) | **统一端口配置** | 所有服务从这里读取 |
| `frontend/.env.local` | 手动调试用 | PM2 启动时会自动覆盖 |

**注意**：使用 `./start.sh start` 启动时，不需要修改 `frontend/.env.local`，PM2 会自动同步配置。

---

## 6. 服务检查

```bash
# 后端健康检查
curl http://localhost:8888/api/v1/admin/health

# Ollama 检查
curl http://localhost:11434/api/tags

# 检查端口占用
lsof -i :8888 -i :3000 -i :3001 -i :3002
```

---

## 7. 修改记录 📝

**所有代码修改必须记录在 `docs/CHANGELOG.md` 中。**

> ⚠️ **重要**：不要在此文件记录详细修改，统一写入 `docs/CHANGELOG.md`

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
