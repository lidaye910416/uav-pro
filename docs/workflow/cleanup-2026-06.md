# 项目系统性整理 Workflow

> 创建: 2026-06-27  
> 目的: 把 vibe coding 出来的项目整理成「10 分钟启动 & 维护」的干净代码库  
> 分支: `refactor/cleanup` → main

---

## 1. 目标 (Definition of Done)

1. 一个新人在 10 分钟内 `./start.sh start` 后能在浏览器访问三个前端
2. 无悬挂引用、无死代码、无双实现
3. 端口 / 依赖 / 配置 / 文档完全自洽
4. git 历史压缩成 1-2 个语义化提交
5. 删除所有 `feature/*` 临时分支
6. 项目目录结构层次清晰（无遗弃的 `vision_service.py`、`backend/config/`、`package.json.bak` 等）

---

## 2. 整理原则 (Source of Truth)

- **CLAUDE.md** 是项目所有规则的源头 (端口、修改记录、风格)
- **端口配置统一**: `start.sh` + `ecosystem.config.js` 读取环境变量；`.env` 仅存非端口配置
- **主流程 = 4 阶段**: 感知(YOLO+SAM) → 识别(Gemma) → 检索(ChromaDB) → 决策
- **不使用的代码立即删除** — 不保留 "以防万一" 的双实现
- **路径优先于模块搜索** — 不用 `from config import` 这种隐式魔法

---

## 3. 已完成的清理 (阶段 A-E)

### A. 删除历史遗留与悬空服务 (38 个文件)
- 旧 `rag_service.py` / `rag_service_v2.py` / `decision_service.py` / `pipeline_config.py` / `llm/`
- 未接入主流程的 `services/pipeline.py` / `services/pipeline_manager.py` / `services/vision_service.py`
- 过期测试 (debug_* / final_test / create_final_visual / test_pipeline* / test_rag_service / 等)
- 过期文档 (`docs/prd/` `docs/superpowers/` `docs/notes/`)
- 环境/文档残留 (`.env.test`, `STARTUP_GUIDE.md`)

### B. 修复 routes_admin 引用
- 重写 import 块 (按字母序)
- 删除 chroma health check 中对 `pipeline_config` 的依赖
- 改用 `get_chroma_service().list_collections()` 统一接口

### C. main.py 清理
- 删除注释掉的 `routes_analyze` / `routes_streams` import
- 重整 import 顺序 (stdlib / 3rd-party / local)
- 函数加类型注解 + 私有前缀

### D. services/__init__.py 重新组织
- 按字母序分组导入 (alert/auth/chroma/perception/types/video)
- 删除对已删除模块的引用 (VisionService / Pipeline / PipelineManager)
- 补全 `ChromaService` 导出

### E. chroma_service.py 补全缺失方法
- 添加 `add_documents()` 方法 (RAG 写入)
- 添加 `list_collections()` 方法 (健康检查)
- 添加便捷函数 `add_documents()` / `init_sop_collection()` / `get_collection_info()`

---

## 4. 待办 (剩余步骤)

### F. 删除确认无引用的死文件
- `backend/config/` (llm.yaml / pipeline.yaml / prompts.yaml / loader.py / __init__.py)  
  → 已被 `app.core.config` 取代，且无 `from app.config` / `import config` 引用
- `frontend/apps/showcase/package.json.bak` (备份残留)
- `backend/scripts/import_sop_knowledge.py` (脚本未接入主流程，且未被任何 .sh 调用)
- `backend/scripts/init_chromadb.py` (改用 `/api/v1/admin/rag/init` 即可)
- `start-services.sh` (已被 `start.sh` 取代)
- `monitor.sh` (未被任何代码引用)
- `README.docker.md` (内容已被 `README.md` 取代)
- `data/` 根目录的 `frames/` `knowledge_base/` (是部署残留，看 gitignore)

### G. 端口配置统一
- `ecosystem.config.js`: backend 用 venv (避免依赖全局 Python)  
  → 创建 `backend/venv` 自动启动脚本
- `.env` 中端口与 start.sh 默认值保持一致: 8888 / 4000 / 4001 / 4002
- `docker-compose.yml` 对齐端口注释说明

### H. 重写 README.md
- 5 分钟快速启动 (复制 `.env.example` → `./start.sh start` → 打开浏览器)
- 端口说明表格 (默认值来自 start.sh)
- 项目结构图 (清掉 docs/prd / docs/superpowers / docs/notes)
- 文档章节链接到 `docs/CHANGELOG.md` 和 `docs/workflow/`

### I. 删除废弃分支
- `feature/chromadb-rag-integration` (已合并)
- `feature/dashboard-pipeline` (已合并)
- `feature/performance-optimization` (已合并)
- `fix/python312-compat` (已合并)

### J. 提交线压缩
- 当前: refactor/cleanup 分支有大量暂存的删除 + 4 个未暂存修改
- 目标: 在 main 上 squash 成 2 个提交:
  1. `chore: 项目系统性整理 — 删除死代码与历史遗留`
  2. `docs: 整理文档与启动脚本`

---

## 5. 验证清单

执行以下命令确认无错：

```bash
# Python 语法
cd backend && python3 -m py_compile main.py
cd backend && python3 -m py_compile app/services/chroma_service.py
cd backend && python3 -m py_compile app/api/routes_admin.py
cd backend && python3 -m py_compile app/services/__init__.py

# 启动后端
./start.sh start
curl http://localhost:8888/health
curl http://localhost:8888/api/v1/admin/health
curl http://localhost:8888/api/v1/admin/chromadb

# 启动后无 ERROR 日志
./start.sh logs | grep -i error

# 前端可访问
curl http://localhost:4000
curl http://localhost:4001/monitor
curl http://localhost:4002/streams
```

---

## 6. 不在本轮范围

- 重构 routes_demo.py 中的内联 YOLO/SAM 代码 → `PerceptionService` (需较大重构，留给后续)
- 把 `backend/config/` 的 yaml 配置迁移到 `app.core.config` (无引用，可直接删除)
- Docker 镜像优化 (目前能跑即可)
- 前端代码整理 (前端目录结构清晰，暂无死代码)

---

## 4. 执行结果 (2026-06-28)

按计划完成 8 个原子提交:

| # | Commit | 行数 |
|---|--------|------|
| 1 | 9185749 chore: 删除遗留服务、脚本、测试与文档 | -10,238 |
| 2 | c9fe770 chore: 默认端口改为 4000 系列 + ChromaService.add_documents | -140 |
| 3 | 6024860 refactor(routes_demo): 删除死代码与重复 SSE 事件 | -296 |
| 4 | 4179c68 refactor(deploy): start.sh 改为 docker-compose wrapper | -232 |
| 5 | 60b1c31 chore(config): 端口单一来源到 start.sh + 删除死配置 | -115 |
| 6 | faf2e6a docs: 重写 CLAUDE.md / README / 新增 STARTUP_GUIDE / 更新 CHANGELOG | +78 |
| 7 | 226f49c feat(frontend): 抽取 @uav/api 共享包 + 清理死组件与冗余依赖 | +8/-37 |
| 8 | 6ef7e8c chore(git): 清理 .gitignore 去重 + 移除已跟踪大文件 | +14/-11 |

合计: 107 文件, +839/-17058 行

启动方式: `./start.sh start` → 自动构建并启动 Ollama + ChromaDB + Backend + 3 个前端容器
