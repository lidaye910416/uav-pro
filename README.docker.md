# UAV-PRO Docker 部署

## 快速启动（需 NVIDIA GPU）

```bash
cd website
docker compose up --build
```

首次启动会自动拉取 `gemma4-e2b` 和 `nomic-embed-text` 模型，等待约 5–15 分钟。

启动后访问：
- 前端展示站：http://localhost:3000
- 监控仪表盘：http://localhost:3001
- 后端 API：http://localhost:8000
- Ollama API：http://localhost:11434
- ChromaDB：http://localhost:8001

## 前置要求

### GPU 支持（推荐）
- NVIDIA GPU + [nvidia-container-toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)
- 验证：`docker run --rm --gpus all nvidia/cuda:12.1.0 nvidia-smi`

### 仅 CPU 运行
删除 `docker-compose.yml` 中 `ollama` 服务的 `deploy.resources` 块：

```yaml
ollama:
  # ... 其他配置 ...
  deploy:
    resources:  # 删除这整个 block
      reservations:
        devices:
          - driver: nvidia
            count: all
            capabilities: [gpu]
```

## 服务说明

| 服务 | 端口 | 说明 |
|------|------|------|
| `ollama` | 11434 | Gemma 4 E2B 多模态模型 |
| `chromadb` | 8001 | ChromaDB 向量数据库（存储 SOP RAG） |
| `backend` | 8000 | FastAPI 后端（依赖 Ollama + ChromaDB 健康检查） |
| `frontend` | 3001 | Next.js 监控仪表盘开发服务器 |

## 本地开发（无需 Docker）

### 前端
```bash
cd website/frontend/apps/dashboard
pnpm install
pnpm dev
```

### 后端
```bash
cd website/backend
pip install -r requirements.txt
# 启动 Ollama（终端 1）
ollama serve
# 启动后端（终端 2）
uvicorn main:app --reload
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SECRET_KEY` | `change-me-in-production` | JWT 签名密钥 |
| `NEXT_PUBLIC_API_BASE` | `http://localhost:8001` | 前端连接后端的地址 |

## 停止
```bash
docker compose down
# 删除数据卷（清除模型和向量索引）
docker compose down -v
```

## 重新拉取模型
```bash
docker compose exec ollama ollama pull gemma4-e2b
```
