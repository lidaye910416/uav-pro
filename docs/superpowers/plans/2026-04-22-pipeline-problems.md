# Pipeline Stage 1-4 问题清单

> 日期：2026-04-22
> 测试视频：gal_1.mp4

---

## 问题汇总

| 优先级 | 问题 | 影响模块 | 状态 |
|--------|------|----------|------|
| **P0** | Ollama 500 Internal Privoxy Error | Stage 2 (Gemma) | 待解决 |
| **P1** | SSE Stage 事件 JSON 格式不一致 | SSE Stream | 待解决 |
| **P1** | `_check_ollama` 模型名称匹配问题 | Stage 2 | 待解决 |

---

## 问题详情

### P0-1: Ollama 500 Internal Privoxy Error

**描述**：Ollama 的 `/api/chat` 端点返回 500 Internal Server Error，通过 Privoxy 代理时出现。

**错误信息**：
```
httpx.HTTPStatusError: Server error '500 Internal Privoxy Error' 
for url 'http://localhost:11434/api/chat'
```

**影响**：
- Stage 2 (Gemma 异常识别) 无法执行
- SSE Stream 在处理 Stage 2 时中断
- 整个 Pipeline 无法完成端到端测试

**复现条件**：
- 调用 `AnomalyIdentifier.identify_from_array()` 时
- 通过 Privoxy 代理 (http://127.0.0.1:10887) 访问 localhost

**可能原因**：
1. Ollama 服务配置问题
2. Privoxy 代理对长请求处理问题
3. Gemma 模型加载失败
4. 代理环境变量设置冲突

**解决方向**：
- [ ] 检查 Ollama 服务日志
- [ ] 直接访问 Ollama（绕过代理）
- [ ] 检查 Ollama 模型是否正确加载
- [ ] 尝试使用 `OLLAMA_HOST=127.0.0.1` 环境变量

---

### P1-1: SSE Stage 事件 JSON 格式不一致

**描述**：SSE 事件中的 JSON 使用双引号，但测试脚本使用单引号匹配，导致事件统计不准确。

**现象**：
```
实际 SSE: "stage": "detection"
测试匹配: 'stage': 'detection'  (失败)
```

**影响**：
- 测试脚本无法正确统计事件
- Pipeline 功能正常，只是测试验证问题

**解决方向**：
- [ ] 修改测试脚本使用双引号正则匹配
- [ ] 或者统一 SSE 事件格式

---

### P1-2: `_check_ollama` 模型名称匹配问题

**描述**：`identify_from_array` 调用时使用的模型名称可能与 `_check_ollama` 返回的不一致。

**代码分析**：
```python
# routes_demo.py 中
models = await _check_ollama()
gemma = models.get("gemma4")  # 返回 "gemma4:e2b"

# anomaly_identifier.py 中
identifier = AnomalyIdentifier(ollama_url=..., model=gemma)
```

**问题**：
- `gemma4` key 返回的值是 `"gemma4:e2b"`
- 但实际 Ollama 模型名称是 `"gemma4:e2b"`
- 需要验证这个匹配是否正确

**解决方向**：
- [ ] 确认模型名称格式正确
- [ ] 添加模型名称验证日志

---

## 测试结果（当前状态）

```
✓ Stage 1: YOLO + SAM + MaskVisualization - 通过
  - 检测: 1 个目标
  - 分割: 1 个掩码
  - 合并图: 有 (260,088 base64 字符)
  - 耗时: ~170ms

⚠ Stage 2: Gemma 异常识别 - 跳过/失败
  - Ollama 500 Privoxy Error
  - 需要绕过代理或修复 Ollama 配置

✓ Stage 3: RAG SOP 检索 - 通过
  - SOP ID: collision_001
  - Title: 交通事故处置规范
  - ✓ 修复：`incidents` → `documents`

✓ Stage 4: 决策输出 - 通过（模拟数据）
  - should_alert: True
  - Alert 模型创建: 成功

⚠ SSE Stream: 部分通过
  - 生成 4 个事件（预期更多）
  - Stage 2 失败导致后续阶段中断
```

---

## 修复记录

### 2026-04-22

| 修复项 | 文件 | 改动 |
|--------|------|------|
| RAG SOP key 错误 | `rag_service_v2.py` | `incidents` → `documents` |
| numpy 未导入 | `routes_demo.py` | 添加 `import numpy as np` |
| base64 转换函数 | `routes_demo.py` | 修复 numpy array 处理 |

---

## 待解决（需要 ralph skill）

1. **Ollama 代理问题**：修复 Privoxy 500 错误，确保 Gemma 正常调用
2. **测试脚本**：更新正则匹配为双引号格式
3. **完整 Pipeline 验证**：修复 Ollama 后验证 Stage 2-4 完整流程

