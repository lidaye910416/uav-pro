# LLM Provider 配置说明

## 概览

本系统支持以下 6 种 LLM provider, 在 Admin → Settings → Provider 切换。

| Provider ID | 协议 | 多模态 | 推荐用途 | 默认 base_url |
|-------------|------|--------|----------|---------------|
| `ollama` | Ollama API | 是 | 离线 / 隐私 | `http://localhost:11434` |
| `anthropic` | Anthropic /v1/messages | 是 | 生产推理最强 | `https://api.anthropic.com` |
| `minimax` | Anthropic 兼容 | 是 | 多模态 + 中文友好 (默认外部) | `https://api.minimaxi.com/anthropic` |
| `openai` | (规划) OpenAI | 是 | GPT-4o | `https://api.openai.com/v1` |
| `deepseek` | (规划) OpenAI 兼容 | 否 | 深度推理 | `https://api.deepseek.com/v1` |
| `custom` | Anthropic 兼容 | 是 | 自部署网关 (如 one-api) | (留空由用户填) |

## 配置场景

1. **全部本地 (默认)**: `ollama` + `gemma4:e2b`, 不需 API key.
2. **全部外部 (multimodal 一把梭)**: `minimax` + `MiniMax-M3`, 一个 API key 解决识别与决策.
3. **混合 (识别用多模态, 决策用本地)**:`VISION_PROVIDER=minimax`, `DECISION_PROVIDER=ollama`, 在 Admin Settings per-stage 切换.
4. **中转网关**: `provider=custom`, `base_url=https://your-gateway.com/anthropic`, `model=any`.

## 持久化

管理员的 provider 选择写入 `backend/data/llm_provider.json`. 重启不会丢失. 该文件不入 git (`.gitignore` 已排除).

## 安全

- API key 仅在内存中持有用于实际调用; 持久化的 JSON 应确保文件权限 `chmod 600`.
- 公共端点 `/llm/status` 不返回 api_key, 仅返回显示用字段.
- 推荐在生产环境用环境变量 `EXTERNAL_LLM_API_KEY` 注入, UI 不应记录 key.

## 故障排查

| 症状 | 原因 |
|------|------|
| 422 on POST | provider id 拼错, 查上表 |
| `未授权` | admin token 缺失或过期 |
| `Test connection` 失败 | base_url 不可达, 或 api_key 无效 |
| 切换 provider 后无生效 | 检查 `backend/data/llm_provider.json` 是否被磁盘占满 / 权限错误 |
