# 修改记录 (CHANGELOG)

本文件记录所有代码与文档的修改，按时间倒序。

## 2026-06-28 — refactor/cleanup

系统性清理 vibe coding 遗留问题。

### 删除

- 后端死代码: `vision_service.py` (broken import), `services/{perception,video}_service.py` (无调用方)
- 历史遗留服务: `rag_service{,_v2}.py`, `decision_service.py`, `pipeline{,_manager}.py`, `llm/`, `pipeline_config.py`
- 过期脚本: `import_sop_knowledge.py`, `init_chromadb.py`
- 后端配置: `backend/config/` 整个目录 (yaml/loader.py 无引用)
- 过期测试: 21 个 `test_pipeline_*` / `debug_*` / `final_test` 等
- 过期文档: `docs/notes/`, `docs/prd/`, `docs/superpowers/`, `README.docker.md`, `STARTUP_GUIDE.md`
- 杂项: `monitor.sh`, `start-services.sh`, `.env.test`
- 前端: 4 个零引用组件 (Footer, DemoThumbnail, AlertCard, devices page)
- 前端空包: `frontend/packages/ui/` (cn 工具 0 引用)
- 前端: 3 个 app 的 `package-lock.json` (项目用 pnpm)
- 已跟踪: `ecosystem.config.js` (PM2 不再使用)
- 已跟踪: `backend/fonts/Hiragino Sans GB.ttc` (~10MB 二进制字体)
- 已跟踪: `config/{services.json,index.ts,.gitignore}` (0 引用)

### 重构

- `start.sh` (295 → 152 行): 改为 docker-compose wrapper, 保留 start/stop/restart/status/logs/clean
- `docker-compose.yml`: 端口全用 `${VAR:-default}` 引用; 前端拆为 showcase/dashboard/admin 三个独立容器
- `backend/Dockerfile`: 容器内端口 8000 → 8888, 与 host 一致
- `frontend/Dockerfile`: 接收 `APP_NAME` 构建参数, 只启动指定子应用
- `routes_demo.py` (-296 行): 删除死代码 `_demo_sse_stream`, 修复 frame_data 事件重复发送

### 配置规范化

- `.env.example` / `.env`: 移除所有端口变量 (违反 CLAUDE.md §3)
- 端口单一来源: `start.sh` 第 19-25 行

### 文档

- `CLAUDE.md`: 修正 §2/§3 端口表矛盾, 删除 `website/` 路径, 端口统一为 4000 系列
- `README.md`: 重写 — 修正路径, 端口表, 删除 `cd website`, 删除性能数据 (无来源)
- 新建 `docs/STARTUP_GUIDE.md`: 详细启动 / 调试 / 常见问题

### 依赖

- `requirements.txt`: 移除 6 个未使用依赖 (alembic, llama-index×4, ollama, pytest-asyncio, python-jose)

### gitignore

- 去重: `.next/`, `*.pkl`, `.DS_Store`
- 补充: `.pm2/`, `backend/data/chromadb/`, `*.ttc`, `*.ttf`

## 2026-05-07

### 端口配置统一化 (历史)

#### 修改 1: `backend/main.py`

**修改内容：**
```python
# 添加端口读取函数和启动入口
import os

def get_backend_port() -> int:
    """从环境变量获取后端端口，默认使用 settings.BACKEND_PORT"""
    env_port = os.getenv("BACKEND_PORT")
