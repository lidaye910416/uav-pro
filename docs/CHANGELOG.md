# 修改记录 (CHANGELOG)

本文件记录所有代码与文档的修改，按时间倒序。

## [Unreleased]

### LLM Provider 抽象层 (后端)

- `feat(llm)`: add external Anthropic-compatible LLM provider with runtime switching (local Ollama / external API); admin endpoints `GET/POST /api/v1/admin/llm/provider` and `POST /api/v1/admin/llm/test`
- `backend/app/llm/external_client.py`: 新增 ExternalLLMClient (httpx 异步) — 支持 chat_text / chat_vision / test
- `backend/app/llm/llm_router.py`: 新增统一路由器 `get_llm_client()`, 支持运行时 override
- `backend/app/api/routes_llm.py`: 新增 admin 接口 (`/api/v1/admin/llm/provider`, `/test`)
- `backend/app/core/config.py`: 新增 `LLM_PROVIDER` / `EXTERNAL_LLM_BASE_URL` / `EXTERNAL_LLM_API_KEY` / `EXTERNAL_LLM_MODEL`
- `backend/main.py`: 注册 llm_router
- `backend/requirements.txt`: 新增 `anthropic>=0.30.0`
- `.env.example`: 新增 LLM Provider 段落

### 文档同步

- `CLAUDE.md`: §4 Dashboard 路由表补全 `/` 与 `/knowledge`
- `CLAUDE.md`: §7 新增「首次启动后」提示（种子管理员 + Ollama 模型手动拉取）
- `README.md`: 新增「项目历史」章节，链接 `docs/workflow/cleanup-2026-06.md`
- `docs/STARTUP_GUIDE.md`: §2 修正「Ollama 自动下载」为手动拉取；新增 §3「种子管理员」；删除 OLLAMA_MIRROR 假环境变量问答
- `docs/CHANGELOG.md`: 修正清理段「删除 `STARTUP_GUIDE.md`」自相矛盾的描述

### 首页 DemoPipeline 修复 (showcase)

- `VideoPlayer.tsx`: `aspectRatio` 由 `16/7` 改为 `16/9`；标注帧 `<img>` 改 `objectFit: contain` 避免压扁；新增 `AnnotatedFrame` 组件，在标注帧上叠加 `<svg viewBox>` 层，按 `detection_details.bbox` 与 `imageWidth/imageHeight` 像素坐标绘制类别矩形 + 置信度标签（颜色按后端 SAM 中文色名映射）
- `index.tsx`: `STAGE_DEFS` 标签改为清晰中文「感知 (YOLO+SAM) / 识别 (VLM) / 知识检索 (RAG) / 决策建议」；识别阶段不再硬编码 `Gemma4`（默认已切换为 minimax 多模态，识别/决策统一由其承担，见下文 Provider 选择段）；header subtitle + 空态提示同步更新
- `index.tsx`: `handleDemo` 移除 10s SSE 超时回退逻辑 — 仅在 `es.onerror` 触发时才回退 `LOCAL_DEMOS`，消除"先显示假数据再切真数据"的体验
- `index.tsx`: `ROIBox` 新增 `label/color` 字段；新增 `imageDims` state 把后端 `resolution` 透传给 VideoPlayer 用于 SVG viewBox


### 首页 Demo 演示帧黑屏修复 (showcase)

**问题**: 首页点击"启动"后，"YOLO + SAM + LLM Pipeline" 演示容器的"检测帧"区域显示为黑底，仅 bbox 矩形可见，没有真实标注帧图像。

**根因**: `AnnotatedFrame` / `frame_data` / `stage` 处理器用 `` `${API_BASE}${rawUrl}` `` 拼接 URL。
- `API_BASE` = `http://localhost:8888/api/v1`（已含 `/api/v1`）
- 后端 `_save_raw_frame` 返回 `rawUrl` = `/api/v1/demo/frames/demo_0_xxx.jpg`（已含 `/api/v1`）
- 拼接结果 = `http://localhost:8888/api/v1/api/v1/demo/frames/...` → 404
- `<img>` 加载失败 → 浏览器只显示 bbox SVG 叠加层覆盖在容器背景（黑底）上，正是用户截图所示的现象。

**修复**:
- `frontend/packages/api/index.ts`: 新增 `toAbsoluteApiUrl(url)` 工具：将后端返回的相对路径拼到 `getApiBase()`（主机根）而非 `API_BASE`，避免 `/api/v1` 双前缀；保留对已含协议头的绝对 URL 的透传
- `frontend/apps/showcase/components/DemoPipeline/VideoPlayer.tsx`: `AnnotatedFrame.fullUrl` 改用 `toAbsoluteApiUrl`
- `frontend/apps/showcase/components/DemoPipeline/index.tsx`: `frame_data` / `stage` 事件 / `DetectionOutputSection` 三处 URL 拼接全部改用 `toAbsoluteApiUrl`

### 置信度 0-1 范围一致性修复 (后端 + 评审清理)

**问题**: `routes_demo.py` 把 `detection_details[i].confidence` 从 `int (0-100)` 改为 `round(float, 3) (0-1)` 后，仍有两处残留不一致：
- 视觉 LLM prompt (line 797) 要求 `confidence: 0-100`，但 parser (line 841) 用 `max(0.0, min(1.0, ...))` clamp 到 0-1 — LLM 返回 85 被截断为 1.0，置信度失真
- scene_desc fallback (line 864) 用 f-string `f"置信度 {d.get('confidence', 0)}%"` 渲染，但 confidence 已是 0-1 → 输出"置信度 0.85%"误导下游 LLM

**修复**:
- `routes_demo.py:797`: vision prompt schema `"confidence": 0-100` → `0-1`，与 parser 一致
- `routes_demo.py:864`: f-string 改为 `round(float(d.get('confidence', 0)) * 100)`, 渲染时还原成 0-100 百分数, 显示与下游语义都正确

### Code review 清理 (showcase)

- `VideoPlayer.tsx:176`: 移除 `?? url` 兜底 (`toAbsoluteApiUrl` 在空串时返回 undefined, fallback 到同值 url 无意义); 折叠 4 行注释为 1 行
- `DemoPipeline/index.tsx`: 三处 `// 注意: API_BASE 已含 /api/v1...` 重复注释各折叠为 1 行 (`toAbsoluteApiUrl` 契约已在 packages/api JSDoc 说明)

### 文档同步

- `AGENTS.md`: 新增 (与 CLAUDE.md 同源, 面向 Codex/Cursor/Aider 等其他 AI 工具的 fallback 指引文件); 修正第 49 行误植的 `Codex-sonnet-4-5` → `claude-sonnet-4-5`
- `CLAUDE.md`: Pipeline 架构图 "Gemma4" → "LLM" (识别/决策层统一抽象为 provider-switchable LLM)
### LLM Provider 选择 (识别层 / 决策层独立可切换)

**Why**: 让管理员能在 UI 直观选择 LLM provider。MiniMax-M3 因具备多模态能力, 可同时承担识别和决策, 取代 Gemma4/DeepSeek-R1。

- 后端 (backend/app/llm/):
  - 新增 provider 目录 (ollama/anthropic/openai/minimax/deepseek/custom), 每个带默认 base_url + 默认模型 + 协议
  - 新增 阶段独立覆盖 (识别层 VISION_PROVIDER/VISION_MODEL, 决策层 DECISION_PROVIDER/DECISION_MODEL)
  - 管理员设置持久化到 backend/data/llm_provider.json (重启不丢失)
  - 新增 endpoints: GET /admin/llm/providers, GET /admin/llm/models, POST /admin/llm/per-stage
  - routes_demo.py 实际按阶段取 client; PIPELINE_MODE=dual 时识别/决策可独立用不同模型
- 后端 (config / docker): docker-compose.yml backend 服务补全 LLM_PROVIDER / EXTERNAL_LLM_* / VISION_* / DECISION_* env 注入; .env.example 同步
- 前端 (Admin): Settings → Provider Tab 重写为 provider dropdown + 模型 dropdown + 可选 per-stage 配置
- 前端 (Badge): LLMStatusBadge 改为可点击链接 (→ Admin /settings?tab=provider); Admin 顶部新增 badge; 跨端 10s 轮询同步

**新增测试**: tests/test_llm_router.py, tests/test_routes_llm.py, tests/conftest.py

### Bug 修复: LLM Provider override 切换不可见

- 后端: get_provider_status() 与 /llm/status 修正为 override-first (原始终读 settings.EXTERNAL_LLM_*)
- 后端: ProviderStatus schema 增加 provider_label / ollama_model / ollama_base_url / stages 字段
- 后端: 启动日志输出 [llm-startup] active=... 让路由切换可见
- 后端: POST /admin/llm/provider 响应中 api_key 仅打码日志 (sk-***xxxx), 不入日志明文
- 前端 (Admin): ProviderTab handleSave 不再误判 r.ok, 改为响应 schema 判断 + Save 后 refetch + 显示'已保存并立即生效'
- 前端: 当前激活卡片显示真实 override 状态 (provider_label / base_url / api_key_set / stages)
- 新增回归测试覆盖上述行为

## 2026-06-28 — refactor/cleanup

系统性清理 vibe coding 遗留问题。

### 删除

- 后端死代码: `vision_service.py` (broken import), `services/{perception,video}_service.py` (无调用方)
- 历史遗留服务: `rag_service{,_v2}.py`, `decision_service.py`, `pipeline{,_manager}.py`, `llm/`, `pipeline_config.py`
- 过期脚本: `import_sop_knowledge.py`, `init_chromadb.py`
- 后端配置: `backend/config/` 整个目录 (yaml/loader.py 无引用)
- 过期测试: 21 个 `test_pipeline_*` / `debug_*` / `final_test` 等
- 过期文档: `docs/notes/`, `docs/prd/`, `docs/superpowers/`, `README.docker.md`, 根目录旧版 `STARTUP_GUIDE.md`（重建到 `docs/STARTUP_GUIDE.md`，见下）
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

## [Unreleased] - 2026-06-28 - refactor/cleanup

### 重大清理 (3 commits, 51 files, 521+ / 1312-)

**refactor(backend)** - 删 658 行死代码, 修 6 类质量问题
- 6 个从未调用的函数 + 4 个死文件 + 1 个废弃模型
- 33 处 print() → logger, 弃用 on_event/utcnow/Pydantic v1
- routes_demo.py: 1725 → 1129 行

**refactor(frontend)** - 抽 2 个共享包, 删 318 行重复
- 新 @uav/hooks (useAlertStream 唯一来源) + @uav/api/alert (Alert 共享)
- 删 6 个死文件, 13 个 console.log, 6+ 处散落的 API_BASE
- 替换 14 个 `any` 类型 → 明确 interface

**chore(deploy)** - 新人 5 分钟可启动
- 6 容器全加 healthcheck, depends_on 联动 healthy
- backend 端口联动 BACKEND_PORT env
- 新建 .dockerignore 阻止 800MB 模型进镜像
- start.sh 加 docker compose v1/v2 自动检测 + .env 预检

**docs** - 文档与代码完全对齐
- CLAUDE.md §4 补 /knowledge, §7 补 seed_admin 提示
- STARTUP_GUIDE.md §2 改"自动下载"为手动, §3 补种子管理员, 删虚构 OLLAMA_MIRROR
- README.md 补"项目历史"链接
- CHANGELOG.md 修历史自相矛盾, 加 [Unreleased] 段

