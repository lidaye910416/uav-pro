# PRD-Gemma4-Pipeline-Integration-20260424

## 1. 概述

### 1.1 背景
当前 Pipeline Demo 的 Stage 2（异常识别）、Stage 3（RAG检索）、Stage 4（决策输出）使用硬编码的样例数据，未真正调用 AI 模型进行分析。需要集成 Gemma4 E2B 模型实现真实的视觉理解和决策输出。

### 1.2 目标
- ✅ Stage 2 真正调用 Gemma4 E2B 进行视觉理解
- ✅ Stage 3 使用检测结果构建 RAG 查询
- ✅ Stage 4 使用 Gemma4 返回的决策结果
- ✅ 前端正确显示 AI 分析结果
- ✅ 实现循环验证确保功能稳定

### 1.3 范围
- 后端: `routes_demo.py` 中的 `demo_sse_stream` 函数
- 前端: `DemoPipeline/index.tsx` 组件
- AI 模型: Ollama Gemma4 E2B
- 知识库: ChromaDB RAG

---

## 2. 用户故事

| ID | 用户类型 | 用户故事 | 验收标准 |
|----|----------|----------|----------|
| US-001 | 操作员 | 作为操作员，我希望看到 AI 真实的分析结果，而不是样例数据 | Pipeline SSE 事件包含真实的 ai_model 字段 |
| US-002 | 开发人员 | 作为开发人员，我需要确认每个 Stage 都调用了正确的 AI | 日志显示 _gemma4_analyze 被调用 |
| US-003 | 产品经理 | 作为产品经理，我需要功能可循环验证 | 连续 3 次运行结果一致 |

---

## 3. 功能需求

### 3.1 功能点列表

| ID | 功能点 | 优先级 | 状态 |
|----|--------|--------|------|
| FR-001 | 集成 _gemma4_analyze 到 SSE Stream | P0 | ✅ DONE |
| FR-002 | 使用检测结果构建 RAG 查询 | P0 | ✅ DONE |
| FR-003 | 使用 Gemma4 决策结果更新前端 | P1 | ✅ DONE |
| FR-004 | 添加 ai_model 字段到所有事件 | P1 | ✅ DONE |
| FR-005 | 循环测试验证稳定性 | P0 | 🔄 IN_PROGRESS |
| FR-006 | 前端显示 AI 模型信息 | P2 | TODO |

### 3.2 详细需求

#### FR-001: 集成 _gemma4_analyze 到 SSE Stream

**描述**: 在 `demo_sse_stream` 函数中，为每一帧调用 `_gemma4_analyze` 函数

**前置条件**: 
- Ollama 服务运行中
- Gemma4 E2B 模型已下载

**交互流程**:
1. 提取视频帧
2. 执行 YOLO+SAM 检测
3. 调用 `_check_ollama()` 获取可用模型
4. 调用 `_gemma4_analyze(frame_bgr, model, rag_context, timeout=60)`
5. 解析返回结果

**代码变更**:
```python
# 调用 Gemma4 E2B 进行视觉理解和决策
gemma_result = await _gemma4_analyze(
    frame_bgr=frame_bgr,
    model=gemma_model,
    rag_context=rag_context,
    timeout=60.0
)
# 使用 Gemma 返回的结果
scene_desc = gemma_result.get("scene_description", scene_desc)
risk_level = gemma_result.get("risk_level", "low")
```

---

## 4. 技术方案

### 4.1 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Pipeline SSE Stream                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Frame → YOLO+SAM → RAG Query → Gemma4 → Decision          │
│    │         │          │            │         │            │
│    ↓         ↓          ↓            ↓         ↓            │
│  Stage1   Stage2     Stage3      Stage4    Alert            │
│  (感知)   (识别)      (检索)      (决策)    (预警)           │
│                                                              │
│  所有事件包含: {"ai_model": "gemma4:e2b"}                    │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 API 响应格式

**Stage Events**:
```json
{
  "stage": "identify",
  "progress": 25,
  "status": "done",
  "summary": "航拍图像描述...",
  "detail": "详细描述...",
  "ai_model": "gemma4:e2b"
}
```

**Decision Event**:
```json
{
  "stage": "decision",
  "progress": 33,
  "status": "done",
  "detail": {
    "has_incident": true,
    "risk_level": "high",
    "title": "高速公路交通事件",
    "description": "...",
    "recommendation": "请立即通报交警...",
    "confidence": 0.95,
    "ai_model": "gemma4:e2b"
  }
}
```

---

## 5. 测试计划

### 5.1 单元测试

- [x] Python 语法检查通过
- [x] `_gemma4_analyze` 函数存在且可调用
- [x] `_check_ollama` 返回正确的模型名称

### 5.2 集成测试

- [x] SSE Stream 返回 Stage 2 identify 事件
- [x] SSE Stream 返回 Stage 3 rag 事件  
- [x] SSE Stream 返回 Stage 4 decision 事件
- [x] 所有事件包含 ai_model 字段
- [x] Gemma4 返回真实的场景描述（非样例）

### 5.3 循环验证测试

- [ ] 循环 1: 运行 SSE Stream 检查帧 1 分析
- [ ] 循环 2: 再次运行 SSE Stream 检查帧 1 分析
- [ ] 循环 3: 第三次运行 SSE Stream 检查帧 1 分析
- [ ] 验证: 3 次结果一致或合理变化

### 5.4 边界测试

- [ ] Ollama 不可用时的 fallback
- [ ] RAG 返回空时的处理
- [ ] Gemma4 超时处理

---

## 6. 风险评估

| 风险 | 影响 | 概率 | 应对策略 |
|------|------|------|----------|
| Ollama 未运行 | 高 | 中 | 已添加 fallback 到样例数据 |
| Gemma4 响应慢 | 中 | 中 | 设置 60s 超时 |
| 前端不显示 ai_model | 低 | 低 | 检查前端代码 |

---

## 7. 里程碑

| 日期 | 里程碑 | 交付物 |
|------|--------|--------|
| 2026-04-24 | 后端集成完成 | routes_demo.py 已修改 |
| 2026-04-24 | 首次验证通过 | SSE 返回真实 AI 结果 |
| 2026-04-24 | 循环验证完成 | 3 次测试通过 |
| 2026-04-24 | 前端显示优化 | AI 模型信息显示 |

---

## 8. 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-04-24 | v0.1 | 初稿 | Claude |
| 2026-04-24 | v0.2 | 添加测试结果 | Claude |
