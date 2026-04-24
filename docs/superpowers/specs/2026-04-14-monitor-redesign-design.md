# 感知中心重构 + Gemma 4 E2B 单模型 Pipeline 设计

## 1. 背景与目标

### 当前状态
- Pipeline: llava:7b（感知）+ deepseek-r1:1.5b（决策）+ ChromaDB RAG，三个独立阶段
- 感知中心: 单视频 + pipeline 状态 + 预警列表
- /brain 页面: 模型状态 + 知识库管理（功能与感知中心有重叠）

### 用户决策
1. **Pipeline**: 单模型（Gemma 4 E2B 感知+决策）+ RAG；llava+deepseek 双模型方案保留为可选配置，管理员可在管理后台切换
2. **感知中心**: 6 路视频并发同显，每路独立感知，统一预警输出
3. **功能分配**: 感知中心专注显示，管理后台负责所有配置

---

## 2. 系统架构

### 2.1 Pipeline 模式（管理后台可切换）

#### 模式 A: 单模型（默认）
```
视频帧 → Gemma 4 E2B → 理解画面 → ChromaDB SOP 检索
         → 综合 SOP 上下文 → 输出预警
```

#### 模式 B: 双模型
```
视频帧 → llava:7b → 视觉理解描述 → ChromaDB SOP 检索
                                ↓
                      deepseek-r1:1.5b → 综合决策 → 预警
```

### 2.2 Ollama 模型配置

| 模型 | 用途 | 加载方式 |
|------|------|---------|
| gemma:2b | 单模型模式（感知+决策） | Ollama，指向本地 GGUF |
| llava:7b | 双模型模式（感知） | Ollama Registry |
| deepseek-r1:1.5b | 双模型模式（决策） | Ollama Registry |
| nomic-embed-text | 向量嵌入 | Ollama Registry |

---

## 3. 管理后台新增/调整

### 3.1 新增「系统配置」页面（Settings）
- **Pipeline 模式切换**: 单模型 / 双模型 单选
- **模型选择**: 当模式为单模型时，选择具体模型（Gemma 4 E2B）
- **知识库管理**: ChromaDB 集合切换、文档增删改
- **流配置**: 视频流列表管理（已存在于 admin/streams）
- **设备管理**: 无人机列表（已存在于 admin/devices）

### 3.2 移除 /dashboard/brain 页面
- 模型状态展示 → 移入「系统配置」页面（精简版）
- 知识库管理 → 已存在 admin/rag
- RAG 检索测试 → 已存在 admin/rag
- Pipeline 诊断 → 感知中心自带

### 3.3 感知中心（Monitor）精简
- 移除：视频源选择（→ 管理后台配置）
- 移除：模型状态卡片（→ 管理后台）
- 移除：知识库切换入口
- 专注：大屏多视频 + 感知结果 + 实时预警

---

## 4. 感知中心大屏布局

### 4.1 页面结构
```
┌──────────────────────────────────────────────────────────────┐
│ Header: 感知中心 | LIVE | 设备数 | 预警统计 | 管理后台入口  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                      │
│  │ 视频 1  │ │ 视频 2  │ │ 视频 3  │                      │
│  │ UAV-001 │ │ UAV-002 │ │ UAV-003 │                      │
│  │ [感知]  │ │ [感知]  │ │ [感知]  │                      │
│  │ 状态... │ │ 状态... │ │ 状态...  │                      │
│  └─────────┘ └─────────┘ └─────────┘                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                      │
│  │ 视频 4  │ │ 视频 5  │ │ 视频 6  │                      │
│  │ UAV-004 │ │ UAV-005 │ │ UAV-006 │                      │
│  │ [待机]  │ │ [待机]  │ │ [待机]  │                      │
│  └─────────┘ └─────────┘ └─────────┘                      │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ 实时预警流: [Critical] 应急车道违规停车 09:42 | [High] ... │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 视频卡片设计
- 每路视频：视频播放器 + 设备标签 + 感知状态指示灯 + 当前感知内容摘要
- 状态: 待机（灰）/ 感知中（琥珀脉冲）/ 预警（红）/ 正常（绿）
- 点击卡片展开：感知详细内容（可折叠）

### 4.3 测试数据
- 6 个测试视频: T1_D1.mp4 ~ T1_D6.mp4（来自 MiTra/Tracking_Logs_Videos_T1）
- 6 个对应跟踪日志: T1_D1.tlgx ~ T1_D6.tlgx
- 每路绑定一个设备 ID: UAV-001 ~ UAV-006
- 视频来自后端 `/api/v1/demo/video/:id` 接口

### 4.4 并发策略
- 6 路视频并发播放
- 感知请求: 每路独立，可同时发起
- GPU 资源由 Ollama 后端统一管理，前端不关心并发细节

---

## 5. 实施计划

### Phase 1: 后端 - Gemma 4 E2B 支持
- [ ] 更新 Ollama Modelfile 指向本地 GGUF 文件
- [ ] 修改 `routes_analyze.py`: 支持单模型 Pipeline
- [ ] 修改 `routes_analyze.py`: 保留双模型 Pipeline 作为可选项
- [ ] 配置文件 `config/llm.yaml`: 支持 pipeline_mode: single/dual

### Phase 2: 后端 - 视频流支持
- [ ] 修改 `routes_demo.py`: 支持 `/api/v1/demo/video/:id` 多视频
- [ ] 注册 `/api/v1/streams/:id/video` 获取指定视频

### Phase 3: 管理后台
- [ ] 新增 `admin/settings/page.tsx`: Pipeline 模式切换 + 模型状态
- [ ] 简化 `/dashboard/brain` 页面（可选：改为诊断页或删除）

### Phase 4: 感知中心重构
- [ ] 重新设计 `monitor/page.tsx`: 6 路视频网格布局
- [ ] 每路视频卡片: 播放器 + 状态 + 感知摘要
- [ ] 实时预警流面板
- [ ] 移除视频源选择（由管理后台配置）

---

## 6. 关键文件变更清单

| 文件 | 操作 |
|------|------|
| `backend/app/api/routes_analyze.py` | 重写 analyze Pipeline，支持单/双模型 |
| `backend/app/api/routes_demo.py` | 支持多视频 `/demo/video/:id` |
| `backend/config/llm.yaml` | 新增 pipeline_mode 配置 |
| `backend/app/models/config.py` | Pipeline 配置模型 |
| `frontend/apps/dashboard/app/monitor/page.tsx` | 重写为 6 路大屏 |
| `frontend/apps/admin/app/settings/page.tsx` | 新增：Pipeline 配置页 |
| `frontend/apps/dashboard/app/brain/page.tsx` | 简化或删除 |
| `frontend/apps/dashboard/app/page.tsx` | 导航更新（移除 brain 入口） |
| `frontend/apps/dashboard/components/Layout/Sidebar.tsx` | 导航更新 |

