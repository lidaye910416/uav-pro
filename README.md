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
- **◈ 实时预警** - 毫秒级识别，秒级响应

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
| 前端 | Next.js 14 + TypeScript + TailwindCSS | 响应式管理后台 |
| 后端 | FastAPI + Python 3.10+ | 高性能 API 服务 |
| 视觉 | YOLOv8-World + SAM | 目标检测与分割 |
| LLM | Gemma-4 E2B (Ollama) | 多模态视觉理解 |
| 向量库 | ChromaDB | RAG 知识检索 |
| 数据库 | SQLite | 预警数据存储 |

---

## 🚀 快速开始

### 环境要求

- Python 3.10+
- Node.js 18+
- Ollama (本地运行 LLM)
- macOS / Linux

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/lidaye910416/uav-pro.git
cd uav-pro/website

# 2. 安装后端依赖
cd backend
pip install -r requirements.txt

# 3. 安装前端依赖
cd ../frontend
pnpm install

# 4. 启动 Ollama (确保模型已下载)
ollama pull gemma4:e2b
ollama pull nomic-embed-text

# 5. 启动服务
cd ..
bash start.sh start
```

### 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 Showcase | 3000 | 项目展示首页 |
| 前端 Dashboard | 3001 | 感知中心监控 |
| 前端 Admin | 3002 | 管理后台 |
| 后端 API | 8000 | API 服务 |
| Ollama | 11434 | LLM 服务 |

---

## 📁 项目结构

```
website/
├── backend/                    # 后端服务
│   ├── app/
│   │   ├── api/              # API 路由
│   │   │   ├── routes_demo.py       # 演示接口 (SSE 流)
│   │   │   ├── routes_analyze.py   # 分析接口
│   │   │   └── routes_alerts.py   # 预警接口
│   │   ├── core/            # 核心配置
│   │   ├── models/          # 数据模型
│   │   └── services/        # 业务服务
│   ├── config/              # 配置文件
│   └── data/                # 数据目录
│       ├── streams/         # 视频流
│       ├── frames/          # 帧缓存
│       └── knowledge_base/  # RAG 知识库
├── frontend/                  # 前端应用 (Turborepo)
│   └── apps/
│       ├── showcase/        # 展示首页
│       ├── dashboard/       # 感知中心
│       └── admin/          # 管理后台
└── start.sh                 # 启动脚本
```

---

## 🔧 配置说明

### 环境变量 (.env)

```env
# Ollama 配置
OLLAMA_BASE_URL=http://localhost:11434

# Pipeline 模式
PIPELINE_MODE=single  # single: Gemma4 E2B | dual: llava + deepseek

# 模型配置
MODEL_GEMMA4=gemma4:e2b
```

### 启动脚本

```bash
# 启动所有服务
bash start.sh start

# 停止所有服务
bash start.sh stop

# 重启服务
bash start.sh restart

# 查看状态
bash start.sh status
```

---

## 📊 性能指标

| 指标 | 数值 |
|------|------|
| 预警准确率 | 94.2% |
| 帧处理速率 | 25 FPS |
| 端到端延迟 | 230ms |
| 知识库规模 | 1,423 条 |

---

## 🧪 测试

```bash
# 启动服务后访问
open http://localhost:3001/monitor   # 感知中心
open http://localhost:3000/about    # 项目介绍

# API 测试
curl http://localhost:8000/api/v1/alerts
curl http://localhost:8000/api/v1/demo/stream
```

---

## 📝 开发指南

### 添加新的 Pipeline Stage

1. 修改后端 `routes_demo.py` 中的处理逻辑
2. 更新前端 `useAlertStream.ts` 中的数据接口
3. 在 Dashboard 中添加对应的展示组件

### 自定义预警规则

编辑 `config/prompts.yaml` 中的异常检测规则

---

## 📄 许可证

MIT License

---

## 👨‍💻 作者

- GitHub: [@lidaye910416](https://github.com/lidaye910416)

---

<div align="center">

**Made with ❤️ for safer skies**

</div>
