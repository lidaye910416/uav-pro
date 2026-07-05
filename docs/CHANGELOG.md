# 修改记录 (CHANGELOG)

本文件记录所有代码与文档的修改，按时间倒序。

## [Unreleased]

### Per-stage LLM Provider 前端适配

让前端页面感知后端 `VISION_PROVIDER` / `DECISION_PROVIDER` 独立配置。

**Why**: 后端已支持识别层 / 决策层分别选用不同 LLM (e.g. vision=MiniMax-M3, decision=Gemma4)。但前端所有页面仍硬编码 "Gemma4:e2b"，管理员切换后 UI 不会反映，造成 demo 与实际配置脱节。

- **后端**:
  - `backend/app/llm/llm_router.py`: 扩展 `get_provider_status()` 的 `stages` 字典，新增 `protocol` / `multimodal` / `active_client` / `api_key_set` 字段
  - `backend/app/api/routes_llm.py`:
    - `GET /api/v1/llm/stages` (新增, 公开): 返回 `StagePublicInfo` (vision + decision) — 无 base_url / api_key
    - `GET /api/v1/admin/llm/per-stage` (新增): 返回完整 `PerStageResponse`，供 ProviderTab mount 时直接读取
    - `GET /api/v1/llm/status` 现返回 `scope` ("unified" | "per-stage") + 结构化 `stages` 字段
  - `backend/tests/test_routes_llm.py`: 补 8 个测试覆盖新端点 (public_stages_*, admin_per_stage_get_*)
  - `backend/tests/conftest.py`: 新增 `client` fixture (无 admin auth, 用于公共端点测试)
- **共享层**:
  - `frontend/packages/api/index.ts`:
    - 扩展 `LLMStatus`: 新增 `scope` + 结构化 `stages: { vision, decision }` 字段
    - 新增 `LLMPublicStageInfo` / `LLMPublicStages` 类型
    - 新增 `llmStagesPublicApi.get()` (公开, 无 auth)
    - 重构 `llmPerStageApi` → `llmPerStageAdminApi` 带类型 `get/update/clear`，旧名保留为 alias
  - `frontend/packages/hooks/useLLMPerStage.ts` (新增): 10s 轮询 `/llm/stages`
  - `frontend/packages/hooks/index.ts` + `package.json`: 注册新 hook
- **PerStageProviderBadge 组件** (showcase / dashboard 各一份，与现有 LLMStatusBadge 三副本模式一致):
  - 三种 variant: `compact` (默认, 单 pill + per-stage tooltip), `inline` (标题旁小标签), `expanded` (vision + decision 双 chip)
  - 模式: `unified` / `per-stage` / `auto`
- **页面改造**:
  - showcase: `Header.tsx` 改用 `PerStageProviderBadge`; `DemoPipeline/index.tsx` 替换 4 处硬编码 Gemma4:e2b (header 标题, pipeline label, 异常识别标题, 决策卡); `architecture/page.tsx` SVG 图重命名为 `ArchitectureDiagram.tsx` client 子组件, vision/decision 节点 label 动态化; `monitor/page.tsx` PIPELINE_STAGES 改为函数 `buildPipelineStages(status)`
  - dashboard: `Sidebar.tsx` 改用 PerStageProviderBadge; `brain/page.tsx` 替换 4 处硬编码 (副标题, 右上 pill, subText, Pipeline 列表); `monitor/page.tsx` 同 showcase 模式; `app/page.tsx` PipelineFlowchart legend 动态化
  - admin: `TopHeader.tsx` LLMPill 显示 per-stage label (V:X / D:Y) + tooltip; `upload/page.tsx` 新增 inline hint "本次分析将调用 vision=... + decision=..."; `rag/page.tsx` AI 加工按钮上方加 "决策引擎:" 标签; `alerts/page.tsx` 每条预警在 scope=per-stage 时附 V:D 小 tag
- **测试**:
  - `backend/tests/test_routes_llm.py`: 新增 8 测试 (public_stages_no_auth_required, public_stages_reflects_override, public_stages_protocol_and_active_client, llm_status_includes_stages_and_scope, admin_per_stage_get_requires_auth, admin_per_stage_get_returns_applied, admin_per_stage_get_matches_post, admin_per_stage_get_does_not_leak_key)

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
- `index.tsx`: `STAGE_DEFS` 标签改为清晰中文「感知 (YOLO+SAM) / 识别 (Gemma4) / 知识检索 (RAG) / 决策建议」；header subtitle + 空态提示同步更新
- `index.tsx`: `handleDemo` 移除 10s SSE 超时回退逻辑 — 仅在 `es.onerror` 触发时才回退 `LOCAL_DEMOS`，消除"先显示假数据再切真数据"的体验
- `index.tsx`: `ROIBox` 新增 `label/color` 字段；新增 `imageDims` state 把后端 `resolution` 透传给 VideoPlayer 用于 SVG viewBox

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

