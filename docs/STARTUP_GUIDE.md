# UAV-PRO 启动与调试指南

> 最后更新: 2026-06-28

## 1. 环境要求

| 依赖 | 版本 | 用途 |
|------|------|------|
| Docker | 20.10+ | 容器运行时 |
| Docker Compose | v2 (内置) | 多容器编排 |
| 内存 | 16GB+ | Ollama 加载 Gemma4:e2b |
| 磁盘 | 20GB+ | 镜像 + Ollama 模型 + ChromaDB 数据 |

macOS / Linux 原生支持。Windows 需 WSL2 + Docker Desktop。

---

## 2. 首次启动

```bash
# 1. 复制环境配置
cp .env.example .env
# 按需修改 SECRET_KEY 等

# 2. 一键启动（首次需 1-3 分钟）
./start.sh start

# 3. 跟踪日志
./start.sh logs
# Ctrl+C 退出（日志继续在后台写入）
```

启动过程：
1. 拉取基础镜像 (ollama, chromadb, python, node)
2. 构建 backend 与 frontend 镜像（首次约 2-5 分钟）
3. 启动 6 个容器
4. 等待 healthcheck 通过
5. 首次启动后 Ollama 会自动下载 `gemma4:e2b` 与 `nomic-embed-text`（约 5-10 分钟）

---

## 3. 访问入口

| 应用 | URL | 说明 |
|------|-----|------|
| Showcase | http://localhost:4000 | 项目展示首页 |
| Dashboard | http://localhost:4001 | 感知中心 + 实时预警 |
| Admin | http://localhost:4002 | 管理后台 + RAG 知识库 |
| API 文档 | http://localhost:8888/docs | FastAPI Swagger |
| Ollama | http://localhost:11434 | LLM API |

---

## 4. 修改端口

⚠️ **端口只在 `start.sh` 第 19-25 行配置，勿在 `.env` 中设置**

```bash
# 1. 编辑 start.sh
nano start.sh   # 找到 export BACKEND_PORT=8888 等行

# 2. 重启
./start.sh restart
```

`docker-compose.yml` 通过 `${BACKEND_PORT:-8888}` 形式读取 start.sh 注入的环境变量。

---

## 5. 常用命令

```bash
# 查看容器状态
./start.sh status
docker compose ps

# 查看日志
./start.sh logs                  # 所有服务
./start.sh logs backend          # 仅后端
docker compose logs -f --tail=200 backend

# 进入容器调试
docker compose exec backend bash
docker compose exec ollama bash

# 手动调用 Ollama
docker compose exec ollama ollama list
docker compose exec ollama ollama pull gemma4:e2b

# 重启单个服务
docker compose restart backend
docker compose up -d --build backend   # 重新构建

# 清理（⚠️ 删除 ChromaDB 数据）
./start.sh clean
```

---

## 6. 常见问题

### Q: 启动后前端 502 Bad Gateway

通常是 Next.js 还在编译。等待 30-60 秒后刷新。

### Q: `/monitor` 页面报 "无法连接到 Ollama"

```bash
# 1. 检查 ollama 容器
docker compose ps ollama

# 2. 手动验证
curl http://localhost:11434/api/tags

# 3. 检查模型是否下载
docker compose exec ollama ollama list
# 应该有 gemma4:e2b 与 nomic-embed-text
```

### Q: ChromaDB 连接失败

```bash
# 检查 chroma 容器
docker compose ps chromadb
docker compose logs chromadb

# 验证端口
curl http://localhost:9001/api/v1/heartbeat
```

### Q: 端口被占用

```bash
# 查看占用
lsof -i :8888

# 杀掉占用进程
lsof -ti:8888 | xargs kill -9
```

### Q: 模型下载慢/失败

```bash
# 配置 Ollama 镜像 (国内)
docker compose down
# 在 docker-compose.yml 的 ollama service 添加:
#   environment:
#     OLLAMA_MIRROR: "https://your-mirror.com"
docker compose up -d
```

### Q: 容器启动失败

```bash
# 强制重建
docker compose down
docker compose up -d --build --force-recreate
```

---

## 7. 性能调优

### Ollama GPU 加速

macOS: Docker Desktop → Settings → Resources → 启用 GPU passthrough  
Linux: 安装 nvidia-container-toolkit 后 docker compose 自动启用

### 减少内存占用

修改 `docker-compose.yml` 中 ollama 的 `deploy.resources.limits.memory`。

---

## 8. 目录位置速查

| 内容 | 路径 |
|------|------|
| 后端代码 | `backend/app/` |
| 前端代码 | `frontend/apps/{showcase,dashboard,admin}/` |
| 共享前端包 | `frontend/packages/api/` |
| 后端依赖 | `backend/requirements.txt` |
| 前端依赖 | `frontend/pnpm-lock.yaml` |
| 数据库 | backend 容器内 `/app/data/uav.db` |
| ChromaDB 数据 | `./backend/data/chromadb/` |
| 演示视频 | `./backend/data/streams/` |
| 配置 | `start.sh` + `.env` |
| 容器编排 | `docker-compose.yml` |
| 修改日志 | `docs/CHANGELOG.md` |
