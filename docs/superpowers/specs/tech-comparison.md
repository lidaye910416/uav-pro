# 技术路线图对比

## SeeUnsafe 论文技术路线图

```mermaid
flowchart TD
    subgraph 输入层
        A[📹 视频流输入] --> B[帧采样]
        B --> C[关键帧提取]
    end

    subgraph 运动分析层
        C --> D[帧差法/光流法]
        D --> E[运动区域检测]
        E --> F[候选目标生成]
        F --> G{置信度筛选}
        G -->|高分| H[UAV候选区]
        G -->|低分| I[丢弃]
    end

    subgraph 多模态验证层
        H --> J[多模态融合验证]
        
        J --> J1[👁️ 视觉特征]
        J --> J2[📐 运动特征]
        J --> J3[📍 轨迹特征]
        J --> J4[⏰ 时空上下文]
        
        J1 --> K[CNN特征提取]
        J2 --> L[速度/方向分析]
        J3 --> M[轨迹匹配]
        J4 --> N[位置/时间分析]
        
        K --> O[特征融合]
        L --> O
        M --> O
        N --> O
    end

    subgraph 决策层
        O --> P[加权评分]
        P --> Q{阈值判断}
        Q -->|≥ 0.7| R[🚨 确认UAV]
        Q -->|0.4-0.7| S[⚠️ 可疑目标]
        Q -->|< 0.4| T[✅ 排除]
    end

    subgraph 注册模块
        R --> U[Register数据库]
        U --> V[基线比对]
        V --> W[轨迹匹配]
    end

    style A fill:#e1f5fe
    style R fill:#ffcdd2
    style T fill:#c8e6c9
    style U fill:#fff9c4
```

---

## 当前系统技术路线图

```mermaid
flowchart TD
    subgraph 输入层
        A[🖼️ 单帧图像] --> B[图像加载]
    end

    subgraph 视觉理解层
        B --> C[Vision Service]
        C --> D[LLaVA 7B 多模态]
        D --> E[场景描述生成]
    end

    subgraph 知识增强层
        E --> F[RAG Service]
        F --> G[向量检索]
        G --> H[相关规范检索]
        H --> I[SOP上下文]
    end

    subgraph 决策层
        E --> J[Decision Service]
        I --> J
        J --> K[DeepSeek R1]
        K --> L[JSON结构化输出]
        L --> M{risk_level}
    end

    subgraph 输出层
        M -->|low| N[📵 低风险-忽略]
        M -->|medium| O[⚠️ 中风险-记录]
        M -->|high| P[🚨 高风险-预警]
        M -->|critical| Q[🔴 紧急-立即处置]
    end

    style A fill:#fff3e0
    style N fill:#c8e6c9
    style O fill:#fff9c4
    style P fill:#ffccbc
    style Q fill:#ffcdd2
```

---

## 对比分析

| 维度 | SeeUnsafe | 当前系统 |
|------|-----------|----------|
| **输入** | 连续视频流 | 单帧图像 |
| **检测方式** | 运动分析 + 视觉验证 | 仅视觉理解 |
| **多模态** | ✅ 四维融合 | ❌ 单模态 |
| **Register** | ✅ 基线轨迹比对 | ❌ 无 |
| **实时性** | ✅ 15fps 实时 | ❌ LLM延迟高 |
| **误检控制** | ✅ 运动预筛 + 多模态验证 | ❌ 依赖LLM判断 |
| **轨迹跟踪** | ✅ 跨帧跟踪 | ❌ 无 |

## 关键差距

1. **缺少运动检测前置过滤** → 大量背景误检
2. **缺少多模态融合** → 纯视觉容易误判
3. **缺少时序分析** → 单帧无法判断运动状态
4. **缺少Register机制** → 无法识别已知UAV

