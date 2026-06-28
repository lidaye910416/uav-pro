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

### 服务端口（默认值见 start.sh）

| 服务 | 默认端口 | 用途 |
|------|----------|------|
| Backend API | 8888 | FastAPI 后端 |
| Ollama LLM | 11434 | Gemma4 等模型 |
| ChromaDB | 9001 | RAG 向量库 |
| Showcase | 4000 | 展示首页 |
| Dashboard | 4001 | 感知中心 |
| Admin | 4002 | 管理后台 |

### Pipeline 架构

```
感知层 (YOLO+SAM) → 识别层 (Gemma4) → RAG检索 (ChromaDB) → 决策层 (Gemma4)
```

### 置信度
- 使用 0-1 范围（不是 0-100）
- SOP 知识库：`backend/data/chromadb/`

---

## 3. 端口配置规则 ⚠️

**端口配置只能修改 `start.sh`！禁止在 `.env` 中配置端口！**

### 修改端口
```bash
# 1. 编辑 start.sh 第 19-25 行的默认值
# 2. 重启服务
./start.sh restart
```

### 服务端口（start.sh 默认值，与 §2 表一致）

| 服务 | 端口 | 说明 |
|------|------|------|
| Backend API | 8888 | 后端 API |
| Ollama LLM | 11434 | 本地 LLM |
| ChromaDB | 9001 | RAG 向量库 |
| Showcase | 4000 | 展示首页 |
| Dashboard | 4001 | 感知中心 |
| Admin | 4002 | 管理后台 |

### 代码中禁止硬编码端口

```typescript
// ✅ 正确 - 使用共享包或环境变量
import { getApiBase } from "@uav/api"
fetch(`${getApiBase()}/api/v1/demo/stream`)

// ❌ 错误 - 硬编码
fetch("http://localhost:8888/api/v1/demo/stream")
```

```python
# ✅ 正确 - 使用 settings
from app.core.config import settings
url = settings.OLLAMA_BASE_URL

# ❌ 错误 - 硬编码端口
url = "http://localhost:11434"
```

---

## 4. 页面路由

| 应用 | 端口 | 路由 |
|------|------|------|
| Showcase | 4000 | `/` 首页, `/about` 项目概览, `/monitor` 实时预警 |
| Dashboard | 4001 | `/monitor` 感知中心, `/alerts` 预警, `/flight` 飞控, `/brain` 决策 |
| Admin | 4002 | `/` 概览, `/streams` 感知流, `/upload` 测试, `/alerts` 预警, `/rag` 知识库, `/settings` 配置 |

---

## 5. 启动方式

```bash
./start.sh start    # 构建并启动所有服务 (docker-compose)
./start.sh stop     # 停止所有容器
./start.sh restart  # 重启所有服务
./start.sh status   # 检查容器状态与端口健康
./start.sh logs     # 查看所有容器日志
./start.sh logs backend  # 仅查看后端日志
./start.sh clean    # 删除所有容器与数据卷（危险）
```

### 配置文件

| 文件 | 作用 | 说明 |
|------|------|------|
| `start.sh` | 端口配置 | 修改第 19-25 行默认值 |
| `.env` | 非端口配置 | SECRET_KEY / MODEL_GEMMA4 / PIPELINE_MODE / CORS 等 |
| `docker-compose.yml` | 容器编排 | 端口用 `${VAR:-default}` 引用 start.sh 注入 |

---

## 6. 服务检查

```bash
# 后端健康检查
curl http://localhost:8888/health

# Ollama 模型列表
curl http://localhost:11434/api/tags

# 容器状态
docker compose ps

# 端口占用
lsof -i :8888 -i :4000 -i :4001 -i :4002
```

---

## 7. 修改记录 📝

**所有代码修改必须记录在 `docs/CHANGELOG.md` 中。**

> ⚠️ **重要**：不要在此文件记录详细修改，统一写入 `docs/CHANGELOG.md`

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
