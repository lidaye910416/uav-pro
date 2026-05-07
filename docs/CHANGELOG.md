# 修改记录 (CHANGELOG)

> 所有代码修改都必须在此记录，以便追踪和回溯。

---

## 2026-05-07

### 端口配置统一化

#### 修改 1: `backend/main.py`

**修改内容：**
```python
# 添加端口读取函数和启动入口
import os

def get_backend_port() -> int:
    """从环境变量获取后端端口，默认使用 settings.BACKEND_PORT"""
    env_port = os.getenv("BACKEND_PORT")
    if env_port:
        try:
            return int(env_port)
        except ValueError:
            pass
    return settings.BACKEND_PORT

if __name__ == "__main__":
    import uvicorn
    port = get_backend_port()
    print(f"[启动] 后端服务端口: {port}")
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
```

**修改目的：**
- 支持从环境变量读取 `BACKEND_PORT`
- 与 `start.sh` 的启动方式保持一致
- 允许从根目录 `.env` 文件统一配置端口

---

#### 修改 2: `CLAUDE.md`

**修改内容：**
1. 重构 CLAUDE.md 结构，将端口配置规则整合到顶层
2. 添加「统一配置说明」章节
3. 添加「修改记录」表格

**CLAUDE.md 新增章节：**
- 第 6 节：统一配置说明（端口配置规则、配置文件位置、启动方式）

---

#### 修改 3: `start.sh`

**修改内容：**
1. 修复 `init_database()` 函数中的 Python 语法错误
2. 使用 `os.getcwd()` 替代 `__file__` 解决路径问题
3. 修改 `start_backend()` 使用 `pm2 start ecosystem.config.js`
4. 修改 `start_frontend()` 使用 `pm2 start ecosystem.config.js`

**修复的 Bug：**
- `NameError: name '__file__' is not defined`
- `except Exception as e:` 缩进错误

---

#### 修改 4: `ecosystem.config.js`

**修改内容：**
1. 将所有 `cwd` 路径从字符串 `./xxx` 改为 `path.join(__dirname, 'xxx')`
2. 修复 PM2 工作目录问题，确保从项目根目录读取配置

**修复的 Bug：**
- PM2 找不到 ecosystem.config.js

---

### 修改记录表

| 日期 | 修改文件 | 修改内容 | 原因/目的 |
|------|----------|----------|-----------|
| 2026-05-07 | `backend/main.py` | 添加 `get_backend_port()` 函数 | 支持从 `.env` 读取端口 |
| 2026-05-07 | `CLAUDE.md` | 重构 + 添加端口配置说明 | 统一 AI 开发规范 |
| 2026-05-07 | `docs/CHANGELOG.md` | 新建修改记录文档 | 统一记录所有代码修改 |
| 2026-05-07 | `start.sh` | 修复 Python 语法错误，修复 PM2 启动方式 | 修复启动脚本 |
| 2026-05-07 | `ecosystem.config.js` | 修复 cwd 路径问题 | 修复 PM2 工作目录 |
| 2026-05-07 | 删除 `backend/CLAUDE.md`, `frontend/CLAUDE.md` | 合并到顶层 CLAUDE.md | 简化 CLAUDE.md 结构，精简至 135 行 |
| 2026-05-07 | `CLAUDE.md` | 更新启动方式说明 | 明确使用 `.env` 统一配置 |
- 第 7 节：修改记录（日期、文件、内容、原因）

---

#### 修改 3: 删除过时文档

**删除文件：**
- `docs/superpowers/plans/2026-04-12-frontend-redesign.md`
- `docs/superpowers/plans/2026-04-13-demo-pipeline-plan.md`
- `docs/superpowers/plans/2026-04-21-yolo-implementation.md`
- `docs/superpowers/plans/2026-04-22-pipeline-problems.md`
- `docs/superpowers/specs/2026-04-18-pipeline-comparison.md`
- `docs/superpowers/specs/2026-04-18-flowchart-comparison.md`
- `docs/superpowers/specs/2026-04-18-final-comparison.md`
- `docs/superpowers/specs/2026-04-18-implementation-plan.md`
- `docs/superpowers/specs/2026-04-18-optimization-plan.md`
- `docs/superpowers/specs/2026-04-14-monitor-redesign-design.md`
- `docs/superpowers/specs/2026-04-12-frontend-redesign-design.md`
- `docs/superpowers/specs/2026-04-18-about-redesign.md`
- `docs/superpowers/specs/2026-04-18-about-header-refine.md`
- `docs/superpowers/specs/2026-04-18-prompt-design.md`
- `docs/superpowers/specs/gemma-pipeline-comparison.md`
- `docs/superpowers/specs/2026-04-13-demo-pipeline-design.md`
- `docs/prd/2026-04-24-gemma4-pipeline-integration.md`
- `.claude/skills/monitor-and-flight-redesign.md`

**删除原因：** 功能已完成，文档过时

---

### 修改记录表

| 日期 | 修改文件 | 修改内容 | 原因/目的 |
|------|----------|----------|-----------|
| 2026-05-07 | `backend/main.py` | 添加 `if __name__ == "__main__":` 从环境变量读取 `BACKEND_PORT` | 统一端口配置，支持从 `.env` 读取 |
| 2026-05-07 | `CLAUDE.md` | 重构 CLAUDE.md，整合端口配置规则到顶层，添加修改记录表 | 统一 AI 开发规范 |
| 2026-05-07 | `backend/CLAUDE.md` | 精简为 14 行，端口配置移至顶层 | 减少重复 |
| 2026-05-07 | `frontend/CLAUDE.md` | 精简为 55 行，端口配置移至顶层 | 减少重复 |
| 2026-05-07 | 删除 18 个 Markdown 文件 | 删除过时的 plan/spec/prd 文档 | 清理项目文档 |

---

## 使用说明

### 端口配置

所有服务端口统一在根目录 `.env` 文件中配置：

```bash
# 修改端口 → 编辑 .env
vim .env
# BACKEND_PORT=9999

# 启动服务 → 自动使用新端口
./start.sh start
```

### 添加修改记录

每次代码修改后，请在 CLAUDE.md 的「修改记录」表格中添加新行：

```markdown
| YYYY-MM-DD | `文件路径` | 修改内容 | 原因/目的 |
```

---

## 保留文件清单

### CLAUDE.md 文件

| 文件 | 行数 | 作用 |
|------|------|------|
| `CLAUDE.md` (顶层) | ~150 | AI 行为准则 + 端口配置 + 修改记录 |
| `backend/CLAUDE.md` | 14 | 后端特有说明（Pipeline 架构） |
| `frontend/CLAUDE.md` | 55 | 前端特有说明（路由、API 规范） |

### 文档文件

| 文件 | 作用 |
|------|------|
| `docs/prd/2026-04-24-pipeline-optimization.md` | PRD 参考模板 |
| `docs/superpowers/plans/2026-05-07-routes-demo-refactor-plan.md` | 最近完成的重构计划 |
| `docs/superpowers/specs/2026-04-21-yolo-pipeline-optimization.md` | YOLO Pipeline 优化规格 |
| `docs/superpowers/specs/2026-04-22-stage1-yolo-sam-pipeline.md` | YOLO+SAM 技术规格 |
| `docs/superpowers/specs/2026-05-07-routes-demo-refactor-design.md` | 重构设计文档 |
| `docs/superpowers/specs/tech-comparison.md` | 技术对比 |

### 技能模板

| 文件 | 作用 |
|------|------|
| `.claude/skills/ralph-prd.md` | PRD 生成技能模板 |
| `.claude/skills/karpathy-guidelines.md` | 编码准则模板 |

