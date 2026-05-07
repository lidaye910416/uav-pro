# routes_demo.py 重构设计文档

**日期：** 2026-05-07
**状态：** 已批准
**目标：** 解耦 `routes_demo.py`，提升可测试性和可扩展性

---

## 1. 背景与目标

### 当前问题

- `routes_demo.py` 超过 2000 行，包含所有逻辑
- 模型加载、视频处理、LLM 调用混在一起
- 无法单独测试各功能模块
- 难以扩展到多路视频并发分析

### 重构目标

1. **可测试性**：每个服务可独立单元测试
2. **可扩展性**：支持未来多路视频并发分析
3. **职责清晰**：每个模块单一职责
4. **向后兼容**：现有 API 接口不变

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    PipelineManager                       │
│  - 管理多个 Pipeline 实例的生命周期                       │
│  - 支持并发创建/销毁                                     │
│  - SSE 路由分发                                         │
└─────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│ Pipeline #1 │      │ Pipeline #2 │      │ Pipeline #N │
│ (gal_1.mp4) │      │ (T1_D1.mp4) │      │ (T1_D6.mp4) │
└─────────────┘      └─────────────┘      └─────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│              VideoService (per-instance)                 │
│              PerceptionService (per-instance)            │
│              VisionService (per-instance)                │
│              RAGService (shared)                         │
│              DecisionService (per-instance)              │
└─────────────────────────────────────────────────────────┘
```

### 2.2 组件职责

| 组件 | 职责 | 生命周期 | 可测试性 |
|------|------|----------|----------|
| **PipelineManager** | 管理多个 Pipeline 实例 | 应用级单例 | 高 |
| **Pipeline** | 单路视频完整处理流程 | 按需创建/销毁 | 高 |
| **VideoService** | 视频读取、帧提取 | 跟随 Pipeline | 高 |
| **PerceptionService** | YOLO检测 + SAM分割 | 跟随 Pipeline | 高 |
| **VisionService** | Gemma 纯视觉分析 | 跟随 Pipeline | 高 |
| **RAGService** | ChromaDB 检索 SOP | 应用级单例 | 高 |
| **DecisionService** | 基于 SOP 输出决策 | 跟随 Pipeline | 高 |

---

## 3. 服务详细设计

### 3.1 VideoService

**文件：** `app/services/video_service.py`

```python
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
import cv2

@dataclass
class FrameData:
    frame_idx: int
    timestamp: float
    frame_bgr: "np.ndarray"  # will be numpy array

@dataclass
class VideoInfo:
    video_id: str
    label: str
    filename: str
    exists: bool
    total_frames: int
    fps: float
    width: int
    height: int

class VideoService:
    """视频服务 - 封装视频读取和帧提取"""
    
    # 视频路径配置
    DEMO_VIDEO: Path
    MITRA_VIDEO_DIR: Path
    
    def __init__(self, video_id: str):
        self.video_id = video_id
        self._video_path: Optional[Path] = None
    
    @property
    def video_path(self) -> Optional[Path]:
        """获取视频路径"""
        ...
    
    def extract_frames(self, count: int = 3) -> list[FrameData]:
        """提取均匀分布的帧"""
        ...
    
    def get_video_info(self) -> VideoInfo:
        """获取视频信息"""
        ...
    
    @classmethod
    def list_available_videos(cls) -> list[dict]:
        """列出所有可用视频"""
        ...
    
    @classmethod
    def resolve_video_path(cls, video_id: str) -> Optional[Path]:
        """解析 video_id 到路径"""
        ...
```

### 3.2 PerceptionService

**文件：** `app/services/perception_service.py`

```python
from dataclasses import dataclass
from typing import Optional
import numpy as np

@dataclass
class Detection:
    label: str
    bbox: list[int]  # [x1, y1, x2, y2]
    confidence: float

@dataclass
class MaskDetail:
    label: str
    color: str
    pixel_count: int
    confidence: float

@dataclass
class DetectionResult:
    frame_idx: int
    timestamp: str
    resolution: str
    detections: int
    detection_details: list[Detection]
    mask_details: list[MaskDetail]
    segmentations: int

@dataclass
class AnnotatedImage:
    image_url: str  # 访问路径
    result: DetectionResult

class PerceptionService:
    """感知服务 - YOLO检测 + SAM分割"""
    
    def __init__(self, confidence_threshold: float = 0.25):
        self.confidence_threshold = confidence_threshold
        self._yolo_model = None
        self._sam_predictor = None
    
    def _ensure_models_loaded(self):
        """懒加载模型"""
        ...
    
    def detect(self, frame_bgr: np.ndarray) -> DetectionResult:
        """执行检测"""
        ...
    
    def annotate(self, frame_bgr: np.ndarray, detections: list[Detection]) -> AnnotatedImage:
        """生成标注图像"""
        ...
    
    def process_frame(self, frame_bgr: np.ndarray, frame_idx: int) -> AnnotatedImage:
        """完整处理：检测 + 标注"""
        ...
```

### 3.3 VisionService (改造)

**文件：** `app/services/vision_service.py`

```python
@dataclass
class VisionResult:
    has_event: bool
    incident_type: str  # collision/pothole/obstacle/pedestrian/congestion/none
    severity: str       # high/mid/low/none
    confidence: float
    scene_description: str
    description: str

class VisionService:
    """视觉识别服务 - Gemma 纯视觉分析"""
    
    def __init__(self, ollama_url: str = None, model: str = None):
        ...
    
    def analyze(
        self,
        frame_bgr: np.ndarray,
        yolo_detections: list[dict] = None,
        timeout: float = 300.0
    ) -> VisionResult:
        """纯视觉分析，不使用 RAG"""
        ...
```

### 3.4 RAGService (改造)

**文件：** `app/services/rag_service.py`

```python
class RAGService:
    """RAG 服务 - ChromaDB SOP 检索"""
    
    def __init__(self):
        self._chroma = None
    
    @property
    def chroma(self):
        """懒加载 ChromaDB"""
        ...
    
    def search(self, query: str, top_k: int = 3) -> list[dict]:
        """搜索 SOP"""
        ...
    
    def get_context(self, query: str, top_k: int = 3) -> str:
        """获取格式化上下文"""
        ...
```

### 3.5 DecisionService (改造)

**文件：** `app/services/decision_service.py`

```python
@dataclass
class DecisionResult:
    risk_level: str     # low/medium/high/critical
    title: str
    recommended_response: str

class DecisionService:
    """决策服务 - 基于 SOP 的风险评估"""
    
    def __init__(self, ollama_url: str = None, model: str = None):
        ...
    
    def decide(
        self,
        incident_type: str,
        scene_description: str,
        timeout: float = 60.0
    ) -> DecisionResult:
        """执行决策"""
        ...
```

### 3.6 Pipeline

**文件：** `app/services/pipeline.py`

```python
from enum import Enum
from typing import AsyncGenerator, Optional
import asyncio

class PipelineStatus(Enum):
    IDLE = "idle"
    RUNNING = "running"
    STOPPING = "stopping"
    DONE = "done"
    ERROR = "error"

@dataclass
class SSEEvent:
    event: str
    data: dict

class Pipeline:
    """单路视频 Pipeline"""
    
    def __init__(
        self,
        video_id: str,
        video_service: VideoService,
        perception_service: PerceptionService,
        vision_service: VisionService,
        rag_service: RAGService,
        decision_service: DecisionService,
    ):
        self.id = str(uuid.uuid4())
        self.video_id = video_id
        self.status = PipelineStatus.IDLE
        self._services = {
            "video": video_service,
            "perception": perception_service,
            "vision": vision_service,
            "rag": rag_service,
            "decision": decision_service,
        }
        self._stop_event = asyncio.Event()
    
    async def start(self) -> AsyncGenerator[SSEEvent, None]:
        """启动 Pipeline，返回 SSE 事件流"""
        ...
    
    async def stop(self):
        """停止 Pipeline"""
        ...
```

### 3.7 PipelineManager

**文件：** `app/services/pipeline_manager.py`

```python
class PipelineManager:
    """多路 Pipeline 管理器"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._pipelines = {}
            cls._instance._lock = asyncio.Lock()
        return cls._instance
    
    async def create_pipeline(self, video_id: str) -> str:
        """创建新 Pipeline，返回 pipeline_id"""
        ...
    
    def get_pipeline(self, pipeline_id: str) -> Optional[Pipeline]:
        """获取 Pipeline"""
        ...
    
    async def destroy_pipeline(self, pipeline_id: str) -> bool:
        """销毁 Pipeline"""
        ...
    
    def list_pipelines(self) -> list[dict]:
        """列出所有 Pipeline"""
        ...
```

---

## 4. 路由层设计

**文件：** `app/api/routes_demo.py` (改造后 ~100行)

```python
@router.get("/stream")
async def demo_sse_stream(pipeline_id: str = None) -> StreamingResponse:
    """SSE 演示流"""
    # 获取或创建 Pipeline
    if not pipeline_id:
        pipeline_id = await pipeline_manager.create_pipeline("default")
    
    pipeline = pipeline_manager.get_pipeline(pipeline_id)
    if not pipeline:
        raise HTTPException(404, "Pipeline not found")
    
    # 返回 SSE 流
    async def generate():
        async for event in pipeline.start():
            yield f"event: {event.event}\ndata: {json.dumps(event.data)}\n\n".encode()
    
    return StreamingResponse(generate(), media_type="text/event-stream")

@router.post("/stream/stop")
async def stop_stream(pipeline_id: str):
    """停止指定 Pipeline"""
    ...

@router.get("/videos")
async def list_videos():
    """列出可用视频"""
    return VideoService.list_available_videos()
```

---

## 5. 错误处理策略

### 5.1 服务级回退

| 服务 | 失败时行为 |
|------|------------|
| VideoService | 无视频 → 返回空列表 |
| PerceptionService | 无模型 → 返回原始帧 |
| VisionService | Ollama 不可用 → 使用默认结果 |
| RAGService | ChromaDB 不可用 → 返回空上下文 |
| DecisionService | Ollama 不可用 → 基于 severity 映射 |

### 5.2 Pipeline 级回退

- 任何阶段失败 → 记录日志，继续后续阶段
- 最终无法处理 → 返回 `status: error` 事件

---

## 6. 测试策略

### 6.1 单元测试

| 服务 | 测试文件 | 测试项 |
|------|----------|--------|
| VideoService | test_video_service.py | 帧提取、视频信息、路径解析 |
| PerceptionService | test_perception_service.py | 检测、标注、模型懒加载 |
| VisionService | test_vision_service.py (扩展) | 视觉分析、JSON 解析 |
| RAGService | test_rag_service.py (扩展) | 检索、上下文格式化 |
| DecisionService | test_decision_service.py (扩展) | 决策、JSON 解析 |
| Pipeline | test_pipeline.py | 流程编排、状态转换 |
| PipelineManager | test_pipeline_manager.py | 实例管理、并发安全 |

### 6.2 集成测试

- `test_pipeline_complete.py` - 完整流程测试
- `test_pipeline_anomaly_scenario.py` - 异常场景测试

### 6.3 测试原则

- 使用 mock 隔离外部依赖（Ollama、ChromaDB）
- 每个服务独立可测试
- 关键路径 100% 覆盖

---

## 7. 实施顺序

1. **Phase 1: 基础设施**
   - 创建目录结构
   - 定义数据类（dataclass）

2. **Phase 2: 原子服务**
   - VideoService
   - PerceptionService

3. **Phase 3: LLM 服务**
   - VisionService (改造)
   - RAGService (改造)
   - DecisionService (改造)

4. **Phase 4: Pipeline**
   - Pipeline 类
   - PipelineManager 类

5. **Phase 5: 路由层**
   - 改造 routes_demo.py
   - 移除原函数

6. **Phase 6: 测试**
   - 单元测试
   - 集成测试
   - 回归测试

---

## 8. 向后兼容性

### 8.1 API 兼容性

- 所有现有接口路径不变
- 响应格式保持一致
- SSE 事件类型不变

### 8.2 配置兼容性

- 使用现有环境变量
- 模型路径不变
- ChromaDB 配置不变

---

**文档版本：** 1.0
**批准日期：** 2026-05-07
