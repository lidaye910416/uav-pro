# UAV-PRO 无人机低空检测智能安全预警系统

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Python](https://img.shields.io/badge/python-3.10+-orange.svg)
![Next.js](https://img.shields.io/badge/next.js-14-black.svg)

**空天地一体化 + 生成式 AI 驱动的低空安全智能预警决策系统**

</div>

---

## 🌟 项目简介

UAV-PRO 是一个基于无人机航拍图像的智能安全预警系统，融合计算机视觉、RAG 检索和大语言模型决策，实现全天候、全链路的低空安全风险感知与预警。

### 核心能力

- **◉ 空天地一体化感知** - 无人机 + 摄像头 + 雷达多源融合
- **◆ AI 智能分析** - YOLO + SAM + Gemma 多模型协同
- **◫ RAG 知识增强** - 行业规范 + SOP 流程检索
- **◈ 实时预警** - SSE 流式推送，毫秒级识别，秒级响应

---

## 🏗️ 系统架构

### Pipeline 算法流程

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ STAGE 1     │    │ STAGE 2     │    │ STAGE 3     │    │ STAGE 4     │
│ ◉ 感知层    │ →  │ ◆ 识别层    │ →  │ ◫ 检索层    │ →  │ ◈ 决策层    │
│ Perception  │    │Identificat. │    │ Retrieval   │    │ Decision    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
     ↓                  ↓                  ↓                  ↓
  视频采集          Gemma4 E2B         向量嵌入           风险评估
  YOLO检测          场景分析           相似度检索         规则引擎
  SAM分割           置信评估           上下文构建         预警输出
```

### 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Next.js 14 + TypeScript + TailwindCSS | 3 个独立应用 (showcase/dashboard/admin) |
| 后端 | FastAPI + Python 3.10+ | REST + SSE 流式 |
| 视觉 | YOLOv8 + MobileSAM | 目标检测与分割 |
| LLM | Gemma-4 E2B (Ollama) | 多模态视觉理解 |
| 向量库 | ChromaDB | RAG 知识检索 |
| 数据库 | SQLite | 预警数据存储 |
| 部署 | Docker Compose | 一键启动 |

---

## 🚀 快速开始

### 环境要求

- Docker 20+ & Docker Compose v2
- macOS / Linux / WSL2
- 16GB+ 内存（推荐 GPU 加速 Ollama）

### 启动

```bash
# 1. 克隆项目
git clone https://github.com/lidaye910416/uav-pro.git
cd uav-pro

# 2. 准备环境变量（可选，默认值开箱即用）
cp .env.example .env

# 3. 一键启动所有服务（Ollama + ChromaDB + Backend + 3 前端）
./start.sh start

# 4. 等待 1-3 分钟（首次启动需拉镜像、下载模型、构建前端）
#    浏览器访问:
#    - Showcase:  http://localhost:4000
#    - Dashboard: http://localhost:4001
#    - Admin:     http://localhost:4002
#    - API Docs:  http://localhost:8888/docs
```

> 详细启动说明、端口修改、常见问题见 [docs/STARTUP_GUIDE.md](docs/STARTUP_GUIDE.md)

---

## 📋 服务端口

| 服务 | 默认端口 | 说明 |
|------|----------|------|
| Backend API | 8888 | FastAPI 后端 + API 文档 |
| Ollama LLM | 11434 | 本地 LLM 推理 |
| ChromaDB | 9001 | SOP 知识库向量存储 |
| Showcase | 4000 | 项目展示首页 |
| Dashboard | 4001 | 感知中心 + 实时监控 |
| Admin | 4002 | 管理后台 + RAG 管理 |

> **修改端口**：编辑 `start.sh` 第 19-25 行的默认值，然后 `./start.sh restart`
> **不要在 .env 中配置端口**（详见 CLAUDE.md §3）

---

## 📁 项目结构

```
uav-pro/
├── backend/                    # FastAPI 后端
│   ├── app/
│   │   ├── api/              # API 路由 (demo/admin/auth/alerts/ollama/uav)
│   │   ├── core/             # 配置 / 数据库 / 安全
│   │   ├── models/           # SQLAlchemy 模型
│   │   ├── schemas/          # Pydantic 模式
│   │   └── services/         # 业务服务 (chroma/alert/auth)
│   ├── scripts/              # 运维脚本
│   ├── tests/                # 单元测试
│   ├── data/
│   │   ├── streams/          # 演示视频
│   │   ├── frames/           # 帧缓存
│   │   └── chromadb/         # RAG 向量库数据
│   ├── Dockerfile
│   ├── requirements.txt
│   └── main.py
├── frontend/                  # Next.js 14 Turborepo
│   ├── apps/
│   │   ├── showcase/         # 端口 4000
│   │   ├── dashboard/        # 端口 4001
│   │   └── admin/            # 端口 4002
│   ├── packages/
│   │   └── api/              # 共享 API base / 跨应用 URL
│   ├── pnpm-workspace.yaml
│   ├── turbo.json
│   └── Dockerfile
├── docs/                      # 项目文档
│   ├── STARTUP_GUIDE.md      # 启动与调试指南
│   └── CHANGELOG.md          # 修改记录
├── docker-compose.yml         # 容器编排
├── start.sh                   # 服务管理入口
├── .env.example               # 非端口配置模板
├── CLAUDE.md                  # AI 助手指南
└── README.md
```

---

## 🔧 配置说明

### 非端口配置 (.env)

```env
# JWT 签名密钥（生产环境必须修改）
SECRET_KEY=change-me-in-production

# AI 模型
MODEL_GEMMA4=gemma4:e2b
PIPELINE_MODE=single

# CORS
BACKEND_CORS_ORIGINS=http://localhost:4000,http://localhost:4001,http://localhost:4002
```

### 启动命令

```bash
./start.sh start    # 构建并启动所有服务
./start.sh stop     # 停止所有容器
./start.sh restart  # 重启所有服务
./start.sh status   # 容器状态 + 端口健康检查
./start.sh logs     # 查看日志 (可指定 service)
./start.sh clean    # 清理（删除数据卷）
```

---

## 🧪 测试

```bash
# 健康检查
curl http://localhost:8888/health

# 列出已下载的 Ollama 模型
curl http://localhost:11434/api/tags

# 触发 demo pipeline (SSE 流)
curl -N http://localhost:8888/api/v1/demo/stream

# 查询预警列表
curl http://localhost:8888/api/v1/alerts
```

---

## 📝 开发指南

### 添加新的 Pipeline Stage

1. 修改 `backend/app/api/routes_demo.py` 中的处理函数
2. 更新前端 `useAlertStream.ts` 中的数据接口
3. 在 Dashboard `/monitor` 页面添加对应展示组件

### 添加 SOP 文档到 RAG 知识库

```bash
# 通过 Admin UI: http://localhost:4002/rag
# 或 API:
curl -X POST http://localhost:8888/api/v1/admin/rag/add \
  -H "Content-Type: application/json" \
  -d '{"text": "...", "metadata": {"category": "construction"}}'
```

---

## 📄 许可证

MIT License

---

## 👨‍💻 作者

- GitHub: [@lidaye910416](https://github.com/lidaye910416)

---

## 📚 项目历史

- [docs/workflow/cleanup-2026-06.md](docs/workflow/cleanup-2026-06.md) — 2026-06 系统性清理执行记录

---

<div align="center">

**Made with ❤️ for safer skies**

</div>
