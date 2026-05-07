# AI 助手指南

## 端口配置规则 ⚠️

**禁止在代码中硬编码服务端口！**

### 环境变量说明

| 变量名 | 说明 | 默认端口 |
|--------|------|----------|
| `OLLAMA_BASE_URL` | Ollama LLM服务 | `http://localhost:11434` |
| `CHROMADB_URL` | ChromaDB向量库 | `http://localhost:8000` |
| `DATABASE_URL` | PostgreSQL数据库 | - |
| `PIPELINE_MODE` | Pipeline模式 | `single` / `dual` |

### 正确写法

```python
# ✅ 正确
from app.core.config import settings
url = settings.OLLAMA_BASE_URL

# ❌ 错误 - 硬编码端口！
url = "http://localhost:11434"
```

## 服务检查

开发前请确认服务状态：
```bash
# 检查 Ollama
curl http://localhost:11434/api/tags

# 检查 ChromaDB
curl http://localhost:8000/api/v2/heartbeat

# 运行测试
python -m tests.test_pipeline_anomaly_scenario
```

## Pipeline 架构

```
感知层 (YOLO+SAM) → 识别层 (Gemma4) → RAG检索 (ChromaDB) → 决策层 (Gemma4)
```

- 置信度使用 0-1 范围
- SOP 知识库路径：`data/chromadb/`
