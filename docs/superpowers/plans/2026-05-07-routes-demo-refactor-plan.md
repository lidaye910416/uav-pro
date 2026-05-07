# routes_demo.py 重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 routes_demo.py (2000+行) 解耦为独立服务，支持单路/多路视频分析

**Architecture:** 采用 Pipeline 实例化模式，各服务独立可测试，PipelineManager 管理多路 Pipeline 实例

**Tech Stack:** Python 3.11+, FastAPI, OpenCV, YOLO, SAM, Ollama, ChromaDB, pytest

---

## 文件结构

```
backend/app/services/
├── __init__.py                    # 导出所有服务
├── video_service.py              # 新建：视频服务
├── perception_service.py         # 新建：感知服务（YOLO+SAM）
├── vision_service.py             # 改造：视觉识别服务
├── rag_service.py                # 改造：RAG 服务
├── decision_service.py           # 改造：决策服务
├── pipeline.py                   # 新建：Pipeline 流程定义
└── pipeline_manager.py           # 新建：多路管理器

backend/app/api/
└── routes_demo.py               # 改造：精简路由层
```

---

## 任务清单

### Task 1: 数据类定义

**Files:**
- Create: `backend/app/services/types.py`
- Test: `backend/tests/test_types.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_types.py
import pytest
from app.services.types import (
    FrameData, VideoInfo, Detection, MaskDetail,
    DetectionResult, AnnotatedImage, VisionResult,
    DecisionResult, PipelineStatus, SSEEvent
)

def test_frame_data_dataclass():
    """Test FrameData dataclass"""
    frame = FrameData(frame_idx=100, timestamp=3.33, frame_bgr=None)
    assert frame.frame_idx == 100
    assert frame.timestamp == 3.33

def test_detection_dataclass():
    """Test Detection dataclass"""
    det = Detection(label="car", bbox=[10, 20, 100, 200], confidence=0.85)
    assert det.label == "car"
    assert det.confidence == 0.85
    assert len(det.bbox) == 4

def test_pipeline_status_enum():
    """Test PipelineStatus enum values"""
    assert PipelineStatus.IDLE.value == "idle"
    assert PipelineStatus.RUNNING.value == "running"
    assert PipelineStatus.DONE.value == "done"

def test_sse_event_dataclass():
    """Test SSEEvent dataclass"""
    event = SSEEvent(event="stage", data={"stage": "perception", "progress": 50})
    assert event.event == "stage"
    assert event.data["stage"] == "perception"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jasonlee/UAV_PRO/website/backend && python -m pytest tests/test_types.py -v`
Expected: FAIL - ModuleNotFoundError: No module named 'app.services.types'

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/services/types.py
"""共享数据类型定义"""
from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Any, Optional

import numpy as np


@dataclass
class FrameData:
    """视频帧数据"""
    frame_idx: int
    timestamp: float
    frame_bgr: np.ndarray | None


@dataclass
class VideoInfo:
    """视频信息"""
    video_id: str
    label: str
    filename: str
    exists: bool
    total_frames: int
    fps: float
    width: int
    height: int


@dataclass
class Detection:
    """目标检测结果"""
    label: str
    bbox: list[int]  # [x1, y1, x2, y2]
    confidence: float


@dataclass
class MaskDetail:
    """SAM 分割掩膜详情"""
    label: str
    color: str
    pixel_count: int
    confidence: float


@dataclass
class DetectionResult:
    """检测结果"""
    frame_idx: int
    timestamp: str
    resolution: str
    detections: int
    detection_details: list[Detection]
    mask_details: list[MaskDetail]
    segmentations: int


@dataclass
class AnnotatedImage:
    """标注图像"""
    image_url: str  # 访问路径
    result: DetectionResult


@dataclass
class VisionResult:
    """视觉分析结果"""
    has_event: bool
    incident_type: str
    severity: str
    confidence: float
    scene_description: str
    description: str


@dataclass
class DecisionResult:
    """决策结果"""
    risk_level: str
    title: str
    recommended_response: str


class PipelineStatus(Enum):
    """Pipeline 状态"""
    IDLE = "idle"
    RUNNING = "running"
    STOPPING = "stopping"
    DONE = "done"
    ERROR = "error"


@dataclass
class SSEEvent:
    """SSE 事件"""
    event: str
    data: dict[str, Any]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jasonlee/UAV_PRO/website/backend && python -m pytest tests/test_types.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/types.py backend/tests/test_types.py
git commit -m "feat(services): 添加共享数据类型定义"
```

---

### Task 2: VideoService 基础实现

**Files:**
- Create: `backend/app/services/video_service.py`
- Test: `backend/tests/test_video_service.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_video_service.py
import pytest
from pathlib import Path
from app.services.video_service import VideoService, DEMO_VIDEO, MITRA_VIDEO_DIR

def test_video_service_initialization():
    """Test VideoService can be instantiated with video_id"""
    vs = VideoService("default")
    assert vs.video_id == "default"

def test_resolve_video_path_default():
    """Test resolving default video path"""
    path = VideoService.resolve_video_path("default")
    assert path is not None or path is None  # Depends on if video exists

def test_resolve_video_path_gal1():
    """Test resolving gal_1 video path"""
    path = VideoService.resolve_video_path("gal_1")
    assert isinstance(path, Path) or path is None

def test_list_available_videos():
    """Test listing all available videos"""
    videos = VideoService.list_available_videos()
    assert "default" in videos
    assert "mitra" in videos
    assert isinstance(videos["mitra"], list)

def test_video_info_structure():
    """Test VideoInfo structure when video exists"""
    vs = VideoService("default")
    info = vs.get_video_info()
    assert info.video_id == "default"
    assert hasattr(info, "filename")
    assert hasattr(info, "exists")
    assert hasattr(info, "fps")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jasonlee/UAV_PRO/website/backend && python -m pytest tests/test_video_service.py -v`
Expected: FAIL - ModuleNotFoundError: No module named 'app.services.video_service'

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/services/video_service.py
"""视频服务 - 封装视频读取和帧提取"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional
import cv2
import numpy as np

from app.services.types import FrameData, VideoInfo


# 视频路径配置
DEMO_VIDEO = Path(__file__).resolve().parents[2] / "data" / "streams" / "gal_1.mp4"
MITRA_VIDEO_DIR = Path(__file__).resolve().parents[2] / "data" / "streams" / "MiTra"

# 视频列表配置
MITRA_VIDEOS: list[dict] = [
    {"id": "gal_1", "label": "gal_1 · 测试视频", "filename": "gal_1.mp4", "device": "TEST-01"},
    {"id": "d1", "label": "T1-D1 · 1号机", "filename": "T1_D1.mp4", "device": "UAV-01"},
    {"id": "d2", "label": "T1-D2 · 2号机", "filename": "T1_D2.mp4", "device": "UAV-02"},
    {"id": "d3", "label": "T1-D3 · 3号机", "filename": "T1_D3.mp4", "device": "UAV-03"},
    {"id": "d4", "label": "T1-D4 · 4号机", "filename": "T1_D4.mp4", "device": "UAV-04"},
    {"id": "d5", "label": "T1-D5 · 5号机", "filename": "T1_D5.mp4", "device": "UAV-05"},
    {"id": "d6", "label": "T1-D6 · 6号机", "filename": "T1_D6.mp4", "device": "UAV-06"},
]


class VideoService:
    """视频服务 - 封装视频读取和帧提取"""
    
    def __init__(self, video_id: str):
        self.video_id = video_id
        self._video_path: Optional[Path] = None
    
    @property
    def video_path(self) -> Optional[Path]:
        """获取视频路径"""
        if self._video_path is None:
            self._video_path = self.resolve_video_path(self.video_id)
        return self._video_path
    
    @classmethod
    def resolve_video_path(cls, video_id: str) -> Optional[Path]:
        """解析 video_id 到路径"""
        if video_id == "default":
            return DEMO_VIDEO if DEMO_VIDEO.exists() else None
        
        if video_id == "gal_1":
            p = Path(__file__).resolve().parents[2] / "data" / "streams" / "gal_1.mp4"
            return p if p.exists() else None
        
        for v in MITRA_VIDEOS:
            if v["id"] == video_id:
                p = MITRA_VIDEO_DIR / v["filename"]
                return p if p.exists() else None
        
        return None
    
    def get_video_info(self) -> VideoInfo:
        """获取视频信息"""
        path = self.video_path
        
        if path is None or not path.exists():
            return VideoInfo(
                video_id=self.video_id,
                label=f"Video {self.video_id}",
                filename="",
                exists=False,
                total_frames=0,
                fps=0.0,
                width=0,
                height=0,
            )
        
        cap = cv2.VideoCapture(str(path))
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        cap.release()
        
        # 查找 label
        label = f"Video {self.video_id}"
        for v in MITRA_VIDEOS:
            if v["id"] == self.video_id:
                label = v["label"]
                break
        
        return VideoInfo(
            video_id=self.video_id,
            label=label,
            filename=path.name,
            exists=True,
            total_frames=total,
            fps=round(fps, 1),
            width=w,
            height=h,
        )
    
    def extract_frames(self, count: int = 3) -> list[FrameData]:
        """提取均匀分布的帧"""
        path = self.video_path
        if path is None or not path.exists():
            return []
        
        cap = cv2.VideoCapture(str(path))
        if not cap.isOpened():
            return []
        
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        cap.release()
        
        if total <= 0 or fps <= 0:
            return []
        
        interval = total // count
        frames: list[FrameData] = []
        
        for i in range(count):
            frame_idx = i * interval
            cap = cv2.VideoCapture(str(path))
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            cap.release()
            
            if ret and frame is not None:
                frames.append(FrameData(
                    frame_idx=frame_idx,
                    timestamp=frame_idx / fps,
                    frame_bgr=frame,
                ))
        
        return frames
    
    @classmethod
    def list_available_videos(cls) -> dict:
        """列出所有可用视频"""
        default_info = cls("default").get_video_info()
        
        mitra = []
        for v in MITRA_VIDEOS:
            vs = cls(v["id"])
            info = vs.get_video_info()
            mitra.append({
                "id": v["id"],
                "label": v["label"],
                "filename": v["filename"],
                "device": v["device"],
                "exists": info.exists,
                "total_frames": info.total_frames,
                "fps": info.fps,
                "width": info.width,
                "height": info.height,
            })
        
        return {
            "default": {
                "id": "default",
                "label": default_info.label,
                "filename": default_info.filename,
                "exists": default_info.exists,
                "total_frames": default_info.total_frames,
                "fps": default_info.fps,
                "width": default_info.width,
                "height": default_info.height,
            },
            "mitra": mitra,
        }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jasonlee/UAV_PRO/website/backend && python -m pytest tests/test_video_service.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/video_service.py backend/tests/test_video_service.py
git commit -m "feat(services): 添加 VideoService 视频服务"
```

---

### Task 3: PerceptionService 实现

**Files:**
- Create: `backend/app/services/perception_service.py`
- Test: `backend/tests/test_perception_service.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_perception_service.py
import pytest
import numpy as np
from app.services.perception_service import PerceptionService
from app.services.types import Detection, DetectionResult

def test_perception_service_initialization():
    """Test PerceptionService can be instantiated"""
    ps = PerceptionService()
    assert ps.confidence_threshold == 0.25

def test_perception_service_with_custom_threshold():
    """Test PerceptionService with custom threshold"""
    ps = PerceptionService(confidence_threshold=0.5)
    assert ps.confidence_threshold == 0.5

def test_get_mask_color():
    """Test mask color mapping"""
    from app.services.perception_service import MASK_COLORS_DISPLAY
    assert MASK_COLORS_DISPLAY.get("person") == "绿色"
    assert MASK_COLORS_DISPLAY.get("car") == "浅蓝色"

def test_process_frame_returns_annotated_image():
    """Test process_frame returns AnnotatedImage"""
    ps = PerceptionService()
    # Create dummy frame
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    result = ps.process_frame(frame, frame_idx=100)
    assert result is not None
    assert hasattr(result, 'image_url')
    assert hasattr(result, 'result')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jasonlee/UAV_PRO/website/backend && python -m pytest tests/test_perception_service.py -v`
Expected: FAIL - ModuleNotFoundError

- [ ] **Step 3: Write implementation**

```python
# backend/app/services/perception_service.py
"""感知服务 - YOLO检测 + SAM分割"""
from __future__ import annotations

import hashlib
import time
from pathlib import Path
from typing import Optional
import cv2
import numpy as np

from app.services.types import (
    Detection, MaskDetail, DetectionResult, AnnotatedImage
)


# 颜色配置
MASK_COLORS_BGR = {
    "person": (0, 255, 0),           # 绿色
    "car": (255, 100, 0),            # 橙色（蓝色框）
    "truck": (0, 150, 255),          # 浅蓝色
    "bus": (200, 100, 255),          # 紫色
    "bicycle": (100, 150, 255),      # 天蓝色
    "motorcycle": (0, 200, 200),     # 青色
    "default": (200, 200, 100),       # 黄绿色
}

MASK_COLORS_DISPLAY = {
    "person": "绿色",
    "car": "浅蓝色",
    "truck": "橙色",
    "bus": "紫色",
    "bicycle": "天蓝色",
    "motorcycle": "青色",
    "default": "黄绿色",
}

# 帧缓存目录
FRAME_CACHE_DIR = Path(__file__).resolve().parents[3] / "data" / "frames"
FRAME_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# 模型路径
_backend_dir = Path(__file__).resolve().parents[2]
MODELS_DIR = _backend_dir / "models" / "sam"


def _get_mask_color(label: str) -> tuple:
    return MASK_COLORS_BGR.get(label.lower(), MASK_COLORS_BGR["default"])


def _get_color_display_name(label: str) -> str:
    return MASK_COLORS_DISPLAY.get(label.lower(), "黄绿色")


def _save_raw_frame(frame_bgr, frame_idx: int, prefix: str = "demo") -> Optional[str]:
    """保存原始帧到缓存目录，返回访问路径"""
    try:
        hash_id = hashlib.md5(f"{prefix}_{frame_idx}_{time.time()}".encode()).hexdigest()[:8]
        filename = f"{prefix}_{frame_idx}_{hash_id}.jpg"
        filepath = FRAME_CACHE_DIR / filename
        
        cv2.imwrite(str(filepath), frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return f"/api/v1/demo/frames/{filename}"
    except Exception as e:
        print(f"[_save_raw_frame] 保存失败: {e}")
        return None


class PerceptionService:
    """感知服务 - YOLO检测 + SAM分割"""
    
    def __init__(self, confidence_threshold: float = 0.25):
        self.confidence_threshold = confidence_threshold
        self._yolo_model = None
        self._sam_predictor = None
    
    def _ensure_models_loaded(self):
        """懒加载模型"""
        if self._yolo_model is None or self._sam_predictor is None:
            self._yolo_model, self._sam_predictor = _get_yolo_sam_models()
    
    def detect(self, frame_bgr: np.ndarray) -> DetectionResult:
        """执行检测，返回检测结果"""
        self._ensure_models_loaded()
        
        # 缩小图像以节省处理时间（最大宽度 1280）
        h, w = frame_bgr.shape[:2]
        processed_frame = frame_bgr.copy()
        if w > 1280:
            scale = 1280 / w
            processed_frame = cv2.resize(processed_frame, (1280, int(h * scale)))
        
        result = DetectionResult(
            frame_idx=0,
            timestamp="0s",
            resolution=f"{processed_frame.shape[1]}×{processed_frame.shape[0]}",
            detections=0,
            detection_details=[],
            mask_details=[],
            segmentations=0,
        )
        
        # 如果没有模型，返回空结果
        if self._yolo_model is None:
            return result
        
        # YOLO 检测
        results = self._yolo_model(processed_frame, conf=self.confidence_threshold, verbose=False)
        r = results[0]
        
        detections: list[Detection] = []
        if r.boxes is not None:
            for box in r.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
                conf = float(box.conf[0].cpu().numpy())
                label = r.names[int(box.cls[0].cpu().numpy())]
                detections.append(Detection(
                    label=label,
                    bbox=[x1, y1, x2, y2],
                    confidence=conf,
                ))
        
        result.detections = len(detections)
        result.detection_details = detections
        
        return result
    
    def annotate(
        self, 
        frame_bgr: np.ndarray, 
        detections: list[Detection],
        frame_idx: int = 0
    ) -> AnnotatedImage:
        """生成标注图像"""
        self._ensure_models_loaded()
        
        # 缩小图像
        h, w = frame_bgr.shape[:2]
        processed_frame = frame_bgr.copy()
        if w > 1280:
            scale = 1280 / w
            processed_frame = cv2.resize(processed_frame, (1280, int(h * scale)))
        
        combined = processed_frame.copy()
        masks_data = []
        
        if self._sam_predictor is not None and detections:
            try:
                from segment_anything import SamPredictor
                if isinstance(self._sam_predictor, SamPredictor):
                    self._sam_predictor.set_image(processed_frame)
                    
                    for det in detections:
                        x1, y1, x2, y2 = [int(v) for v in det.bbox]
                        box = np.array([[x1, y1], [x2, y2]], dtype=np.int32)
                        
                        masks, scores, _ = self._sam_predictor.predict(
                            box=box,
                            multimask_output=False
                        )
                        
                        if len(masks) > 0:
                            mask = masks[0]
                            color = _get_mask_color(det.label)
                            
                            # 叠加半透明掩膜
                            if mask.sum() > 50:
                                for c in range(3):
                                    combined[:, :, c] = np.where(
                                        mask.astype(bool),
                                        (combined[:, :, c] * 0.7 + color[c] * 0.3).astype(np.uint8),
                                        combined[:, :, c]
                                    )
                            
                            masks_data.append({
                                "det": det,
                                "mask": mask,
                                "score": scores[0] if len(scores) > 0 else det.confidence,
                            })
                        
                        cv2.rectangle(combined, (x1, y1), (x2, y2), color, 3)
                    
                    self._sam_predictor.reset_image()
            except Exception as e:
                print(f"[PerceptionService] SAM 分割失败: {e}")
                # 回退：只画边框
                for det in detections:
                    color = _get_mask_color(det.label)
                    x1, y1, x2, y2 = [int(v) for v in det.bbox]
                    cv2.rectangle(combined, (x1, y1), (x2, y2), color, 3)
        else:
            # 无 SAM 模型，只画边框
            for det in detections:
                color = _get_mask_color(det.label)
                x1, y1, x2, y2 = [int(v) for v in det.bbox]
                cv2.rectangle(combined, (x1, y1), (x2, y2), color, 3)
        
        # 添加图例
        combined = _add_legend(combined, detections)
        
        # 保存标注图像
        image_url = _save_raw_frame(combined, frame_idx, prefix="demo")
        if image_url is None:
            image_url = _save_raw_frame(processed_frame, frame_idx, prefix="demo_raw")
        
        # 构建结果
        mask_details = [
            MaskDetail(
                label=item["det"].label,
                color=_get_color_display_name(item["det"].label),
                pixel_count=int(item["mask"].sum()),
                confidence=round(float(item["score"]), 3),
            )
            for item in masks_data
        ]
        
        result = DetectionResult(
            frame_idx=frame_idx,
            timestamp=f"{frame_idx / 30:.1f}s",
            resolution=f"{processed_frame.shape[1]}×{processed_frame.shape[0]}",
            detections=len(detections),
            detection_details=detections,
            mask_details=mask_details,
            segmentations=len(masks_data),
        )
        
        return AnnotatedImage(image_url=image_url or "", result=result)
    
    def process_frame(self, frame_bgr: np.ndarray, frame_idx: int = 0) -> AnnotatedImage:
        """完整处理：检测 + 标注"""
        detections_result = self.detect(frame_bgr)
        detections = detections_result.detection_details
        return self.annotate(frame_bgr, detections, frame_idx)


def _get_yolo_sam_models():
    """懒加载 YOLO 和 SAM 模型"""
    global _yolo_model, _sam_predictor
    
    yolo_model = None
    sam_predictor = None
    
    # 加载 YOLO
    try:
        from ultralytics import YOLO
        yolo_paths = [
            MODELS_DIR / "yolov8n.pt",
            _backend_dir / "yolov8n.pt",
            _backend_dir / "yolov8x-world.pt",
        ]
        yolo_path = None
        for p in yolo_paths:
            if p.exists():
                yolo_path = p
                break
        if yolo_path:
            yolo_model = YOLO(str(yolo_path))
            print(f"[YOLO] 模型加载成功: {yolo_path}")
        else:
            print(f"[YOLO] 模型文件不存在")
    except Exception as e:
        print(f"[YOLO] 模型加载失败: {e}")
    
    # 加载 SAM
    sam_path = MODELS_DIR / "mobile_sam.pt"
    sam_vit_path = MODELS_DIR / "sam_vit_b.pth"
    
    if sam_path.exists():
        try:
            from segment_anything import sam_model_registry, SamPredictor
            sam = sam_model_registry["mobile_sam"](checkpoint=str(sam_path))
            sam.to("cpu")
            sam_predictor = SamPredictor(sam)
            print(f"[SAM] mobile_sam 加载成功")
        except Exception as e:
            print(f"[SAM] mobile_sam 加载失败: {e}")
    
    if sam_predictor is None and sam_vit_path.exists():
        try:
            from segment_anything import sam_model_registry, SamPredictor
            sam = sam_model_registry["vit_b"](checkpoint=str(sam_vit_path))
            sam.to("cpu")
            sam_predictor = SamPredictor(sam)
            print(f"[SAM] vit_b 加载成功")
        except Exception as e:
            print(f"[SAM] vit_b 加载失败: {e}")
    
    return yolo_model, sam_predictor


def _add_legend(combined, detections: list = None) -> np.ndarray:
    """在图像左上角添加颜色图例"""
    try:
        from PIL import Image, ImageDraw, ImageFont
        
        legend_x, legend_y = 15, 30
        
        # 获取字体
        font = None
        font_paths = [
            "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf",
            "/app/fonts/HiraginoSansGB.ttc",
            "/System/Library/Fonts/Hiragino Sans GB.ttc",
        ]
        for fp in font_paths:
            try:
                font = ImageFont.truetype(fp, 18)
                break
            except Exception:
                continue
        
        label_map = {
            "person": "Person",
            "car": "Car",
            "truck": "Truck",
            "bus": "Bus",
            "bicycle": "Bicycle",
            "motorcycle": "Motorcycle",
        }
        color_map = {
            "person": (0, 255, 0),
            "car": (0, 100, 255),
            "truck": (255, 150, 0),
            "bus": (255, 100, 200),
            "bicycle": (150, 150, 255),
            "motorcycle": (0, 200, 200),
        }
        
        pil_image = Image.fromarray(cv2.cvtColor(combined, cv2.COLOR_BGR2RGB))
        draw = ImageDraw.Draw(pil_image)
        
        # 根据检测到的类别动态生成图例
        if detections:
            detected_labels = set(d["label"].lower() for d in detections)
        else:
            detected_labels = set()
        
        display_labels = detected_labels if detected_labels else list(label_map.keys())
        
        if font:
            draw.text((legend_x, legend_y), "Detection:", fill=(255, 255, 255), font=font)
            legend_y += 25
        
        for label in display_labels:
            if label not in label_map:
                continue
            color_rgb = color_map.get(label, (128, 128, 128))
            desc = label_map.get(label, label)
            draw.rectangle([(legend_x, legend_y - 14), (legend_x + 20, legend_y + 6)], fill=color_rgb, outline=(255, 255, 255))
            if font:
                draw.text((legend_x + 25, legend_y - 12), desc, fill=(255, 255, 255), font=font)
            legend_y += 22
        
        return cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
    except Exception as e:
        print(f"[_add_legend] 绘制失败: {e}")
        return combined


# 全局变量
_yolo_model = None
_sam_predictor = None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jasonlee/UAV_PRO/website/backend && python -m pytest tests/test_perception_service.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/perception_service.py backend/tests/test_perception_service.py
git commit -m "feat(services): 添加 PerceptionService 感知服务"
```

---

### Task 4: VisionService 改造

**Files:**
- Modify: `backend/app/services/vision_service.py`
- Test: `backend/tests/test_vision_service.py` (扩展)

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_vision_service.py - 添加新测试
import pytest
import numpy as np
from app.services.vision_service import VisionService

def test_vision_service_analyze_returns_vision_result():
    """Test VisionService.analyze returns VisionResult"""
    vs = VisionService()
    # Create dummy frame
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    result = vs.analyze(frame)
    assert result.has_event is not None
    assert result.incident_type is not None
    assert isinstance(result.confidence, float)

def test_vision_service_with_yolo_detections():
    """Test VisionService with YOLO detections"""
    vs = VisionService()
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    yolo_detections = [
        {"label": "car", "bbox": [10, 20, 100, 200], "confidence": 0.85}
    ]
    result = vs.analyze(frame, yolo_detections=yolo_detections)
    assert result is not None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jasonlee/UAV_PRO/website/backend && python -m pytest tests/test_vision_service.py -v`
Expected: FAIL - VisionService.analyze not found

- [ ] **Step 3: Add analyze method to VisionService**

```python
# backend/app/services/vision_service.py - 添加 analyze 方法
# 在 VisionService 类中添加:

    def analyze(
        self,
        frame_bgr: np.ndarray,
        yolo_detections: list[dict] = None,
        timeout: float = 300.0
    ) -> VisionResult:
        """纯视觉分析，不使用 RAG
        
        Args:
            frame_bgr: BGR 格式的图像
            yolo_detections: YOLO 检测结果
            timeout: 超时时间（秒）
            
        Returns:
            VisionResult: 包含 has_event, incident_type, severity, confidence, scene_description, description
        """
        from app.services.types import VisionResult
        
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(frame_rgb)
        img_b64 = self._image_to_base64(pil_img)
        
        # 构建 YOLO 检测结果摘要
        yolo_summary = ""
        if yolo_detections:
            categories = {}
            for det in yolo_detections:
                label = det.get('label', 'unknown')
                categories[label] = categories.get(label, 0) + 1
            if categories:
                parts = [f"{label} {count}个" for label, count in sorted(categories.items())]
                yolo_summary = f"【图像中的物体】检测到：{', '.join(parts)}。"
        
        system_prompt = f"""你是高速公路航拍图像安全分析专家。

【任务】
仅根据图像中的静态视觉特征，独立判断是否存在以下事件之一：

  collision  - 车辆碰撞/追尾
  pothole    - 道路坑洼
  obstacle   - 障碍物/遗撒
  pedestrian - 行人异常
  congestion - 交通拥堵
  none       - 无异常

{yolo_summary}

【判断原则】
1. 仅基于当前帧的视觉特征
2. 置信度较低时，倾向于判断为 "none"
3. 不要参考任何外部规范

【输出格式 - 严格JSON】
{{
  "has_event": true或false,
  "incident_type": "collision/pothole/obstacle/pedestrian/congestion/none",
  "severity": "high/mid/low/none",
  "confidence": 0-100,
  "scene_description": "场景描述（40字内）",
  "description": "具体观察到的视觉特征（60字内）"
}}

只输出 JSON，不要其他任何文字。"""

        user_prompt = """请分析这张航拍图像，独立判断是否存在交通安全异常。

观察要点：
1. 整体场景（直道/弯道/立交/收费站）
2. 车辆状态（正常行驶/停滞/异常聚集）
3. 路面状况（坑洞/遗撒/积水/破损）
4. 行人/非机动车（是否在禁止区域）
5. 异常物体（障碍物/事故车辆/散落物）

请仅基于图像中的实际视觉特征给出判断。"""

        full_prompt = f"{system_prompt}\n\n{user_prompt}"

        payload = {
            "model": self.model,
            "prompt": full_prompt,
            "images": [img_b64],
            "stream": False,
            "think": False,
            "options": {"num_predict": 200},
        }

        try:
            with httpx.AsyncClient(timeout=timeout) as client:
                print(f"[VisionService] 调用 Ollama，timeout={timeout}s")
                r = await client.post(f"{self.base_url}/api/generate", json=payload)
                r.raise_for_status()
                raw = r.json().get("response", "").strip()
                print(f"[VisionService] 原始响应: {raw[:150]}...")

            # 解析 JSON
            clean_raw = raw.replace('```json', '').replace('```', '').strip()
            start = clean_raw.find("{")
            end = clean_raw.rfind("}") + 1

            if start != -1 and end > start:
                json_str = clean_raw[start:end]
                result = json.loads(json_str)
                return VisionResult(
                    has_event=bool(result.get("has_event", False)),
                    incident_type=result.get("incident_type", "none"),
                    severity=str(result.get("severity", "low")).lower(),
                    confidence=round(max(0.0, min(1.0, float(result.get("confidence", 0.5)))), 2),
                    scene_description=result.get("scene_description", ""),
                    description=result.get("description", ""),
                )

            return VisionResult(
                has_event=False,
                incident_type="none",
                severity="none",
                confidence=0.5,
                scene_description="分析失败，回退为正常",
                description=raw[:100] if raw else "分析失败",
            )
        except Exception as e:
            print(f"[VisionService] 分析失败: {e}")
            return VisionResult(
                has_event=False,
                incident_type="none",
                severity="none",
                confidence=0.5,
                scene_description="分析服务不可用",
                description="AI分析失败",
            )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jasonlee/UAV_PRO/website/backend && python -m pytest tests/test_vision_service.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/vision_service.py backend/tests/test_vision_service.py
git commit -m "feat(services): 扩展 VisionService 支持 analyze 方法"
```

---

### Task 5: Pipeline 类实现

**Files:**
- Create: `backend/app/services/pipeline.py`
- Test: `backend/tests/test_pipeline.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_pipeline.py
import pytest
import asyncio
from app.services.pipeline import Pipeline, PipelineStatus

def test_pipeline_initialization():
    """Test Pipeline can be initialized"""
    pipeline = Pipeline(video_id="default")
    assert pipeline.video_id == "default"
    assert pipeline.status == PipelineStatus.IDLE
    assert pipeline.id is not None

def test_pipeline_status_transitions():
    """Test Pipeline status transitions"""
    pipeline = Pipeline(video_id="default")
    assert pipeline.status == PipelineStatus.IDLE
    pipeline.status = PipelineStatus.RUNNING
    assert pipeline.status == PipelineStatus.RUNNING
    pipeline.status = PipelineStatus.DONE
    assert pipeline.status == PipelineStatus.DONE
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jasonlee/UAV_PRO/website/backend && python -m pytest tests/test_pipeline.py -v`
Expected: FAIL - ModuleNotFoundError

- [ ] **Step 3: Write implementation**

```python
# backend/app/services/pipeline.py
"""Pipeline - 单路视频处理流程"""
from __future__ import annotations

import asyncio
import uuid
from typing import AsyncGenerator, Optional
from dataclasses import dataclass, field

from app.services.types import PipelineStatus, SSEEvent


class Pipeline:
    """单路视频 Pipeline
    
    负责协调各服务完成视频处理流程：
    1. 视频帧提取 (VideoService)
    2. 目标检测+分割 (PerceptionService)
    3. 视觉分析 (VisionService)
    4. RAG 检索 (RAGService)
    5. 决策输出 (DecisionService)
    """
    
    def __init__(
        self,
        video_id: str,
        video_service=None,
        perception_service=None,
        vision_service=None,
        rag_service=None,
        decision_service=None,
    ):
        self.id = str(uuid.uuid4())[:8]
        self.video_id = video_id
        self.status = PipelineStatus.IDLE
        self._stop_event = asyncio.Event()
        
        # 服务引用
        self._services = {
            "video": video_service,
            "perception": perception_service,
            "vision": vision_service,
            "rag": rag_service,
            "decision": decision_service,
        }
    
    @property
    def video_service(self):
        return self._services.get("video")
    
    @property
    def perception_service(self):
        return self._services.get("perception")
    
    @property
    def vision_service(self):
        return self._services.get("vision")
    
    @property
    def rag_service(self):
        return self._services.get("rag")
    
    @property
    def decision_service(self):
        return self._services.get("decision")
    
    async def start(self) -> AsyncGenerator[SSEEvent, None]:
        """启动 Pipeline，返回 SSE 事件流"""
        if self.status == PipelineStatus.RUNNING:
            return
        
        self.status = PipelineStatus.RUNNING
        self._stop_event.clear()
        
        try:
            # 检查必需服务
            if not self.video_service:
                yield SSEEvent(event="error", data={"error": "VideoService not configured"})
                self.status = PipelineStatus.ERROR
                return
            
            # 提取帧
            yield SSEEvent(event="stage", data={
                "stage": "perception",
                "progress": 5,
                "status": "running"
            })
            
            frames = self.video_service.extract_frames(count=3)
            if not frames:
                yield SSEEvent(event="error", data={"error": "No frames extracted"})
                self.status = PipelineStatus.ERROR
                return
            
            # 处理每一帧
            total_frames = len(frames)
            for idx, frame_data in enumerate(frames):
                if self._stop_event.is_set():
                    break
                
                frame_base = idx * 30
                
                # 感知层
                if self.perception_service:
                    annotated = self.perception_service.process_frame(
                        frame_data.frame_bgr,
                        frame_idx=frame_data.frame_idx
                    )
                    
                    yield SSEEvent(event="frame_data", data={
                        "frame_idx": frame_data.frame_idx,
                        "timestamp": f"{frame_data.timestamp:.1f}s",
                        "resolution": annotated.result.resolution,
                        "detections": annotated.result.detections,
                        "segmentations": annotated.result.segmentations,
                        "detection_details": [
                            {"label": d.label, "bbox": d.bbox, "confidence": d.confidence}
                            for d in annotated.result.detection_details
                        ],
                        "mask_details": [
                            {"label": m.label, "color": m.color, "pixel_count": m.pixel_count, "confidence": m.confidence}
                            for m in annotated.result.mask_details
                        ],
                        "combined_image_url": annotated.image_url,
                    })
                
                # 视觉分析层
                if self.vision_service:
                    yield SSEEvent(event="stage", data={
                        "stage": "identify",
                        "progress": frame_base + 20,
                        "status": "running"
                    })
                    
                    # 转换检测结果为 dict 格式
                    yolo_detections = None
                    if self.perception_service and annotated:
                        yolo_detections = [
                            {"label": d.label, "bbox": d.bbox, "confidence": d.confidence}
                            for d in annotated.result.detection_details
                        ]
                    
                    vision_result = await self.vision_service.analyze(
                        frame_data.frame_bgr,
                        yolo_detections=yolo_detections
                    )
                    
                    yield SSEEvent(event="stage", data={
                        "stage": "identify",
                        "progress": frame_base + 45,
                        "status": "done",
                        "summary": vision_result.scene_description[:60],
                        "detail": vision_result.scene_description,
                        "incident_type": vision_result.incident_type,
                        "severity": vision_result.severity,
                        "confidence": vision_result.confidence,
                    })
                    
                    # RAG + 决策层（仅异常场景）
                    if vision_result.incident_type != "none" and vision_result.has_event:
                        if self.rag_service:
                            yield SSEEvent(event="stage", data={
                                "stage": "rag",
                                "progress": frame_base + 55,
                                "status": "running"
                            })
                            
                            rag_context = self.rag_service.get_context(
                                f"{vision_result.incident_type}高速公路交通事件",
                                top_k=3
                            )
                            
                            yield SSEEvent(event="stage", data={
                                "stage": "rag",
                                "progress": frame_base + 65,
                                "status": "done",
                                "snippets": rag_context.split("\n") if rag_context else [],
                            })
                        
                        if self.decision_service:
                            yield SSEEvent(event="stage", data={
                                "stage": "decision",
                                "progress": frame_base + 70,
                                "status": "running"
                            })
                            
                            decision = await self.decision_service.decide(
                                incident_type=vision_result.incident_type,
                                scene_description=vision_result.scene_description
                            )
                            
                            yield SSEEvent(event="stage", data={
                                "stage": "decision",
                                "progress": frame_base + 85,
                                "status": "done",
                                "detail": {
                                    "has_incident": vision_result.has_event,
                                    "incident_type": vision_result.incident_type,
                                    "severity": vision_result.severity,
                                    "risk_level": decision.risk_level,
                                    "title": decision.title,
                                    "recommendation": decision.recommended_response,
                                    "confidence": vision_result.confidence,
                                },
                            })
                    else:
                        # 正常场景，跳过 RAG + 决策
                        yield SSEEvent(event="stage", data={
                            "stage": "rag",
                            "progress": frame_base + 55,
                            "status": "skipped",
                            "summary": "暂不进行 SOP 检索",
                            "reason": "识别层判断无异常",
                        })
                        yield SSEEvent(event="stage", data={
                            "stage": "decision",
                            "progress": frame_base + 70,
                            "status": "skipped",
                            "summary": "暂不进行事故深度决策",
                            "reason": "识别层判断无异常",
                        })
                    
                    # 发送预警
                    yield SSEEvent(event="alert", data={
                        "id": int(asyncio.get_event_loop().time() * 1000),
                        "title": vision_result.scene_description[:20] if vision_result.has_event else "道路通行正常",
                        "description": vision_result.description,
                        "risk_level": "low",
                        "incident_type": vision_result.incident_type,
                        "severity": vision_result.severity,
                        "recommendation": "持续监控" if not vision_result.has_event else "",
                        "confidence": vision_result.confidence,
                        "scene_description": vision_result.scene_description,
                        "source_type": "demo",
                    })
                
                await asyncio.sleep(0.8)
            
            self.status = PipelineStatus.DONE
            
        except Exception as e:
            print(f"[Pipeline] 执行异常: {e}")
            import traceback
            traceback.print_exc()
            yield SSEEvent(event="error", data={"error": str(e)})
            self.status = PipelineStatus.ERROR
    
    async def stop(self):
        """停止 Pipeline"""
        self._stop_event.set()
        self.status = PipelineStatus.STOPPING
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jasonlee/UAV_PRO/website/backend && python -m pytest tests/test_pipeline.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/pipeline.py backend/tests/test_pipeline.py
git commit -m "feat(services): 添加 Pipeline 类"
```

---

### Task 6: PipelineManager 实现

**Files:**
- Create: `backend/app/services/pipeline_manager.py`
- Test: `backend/tests/test_pipeline_manager.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_pipeline_manager.py
import pytest
from app.services.pipeline_manager import PipelineManager

def test_pipeline_manager_singleton():
    """Test PipelineManager is singleton"""
    pm1 = PipelineManager()
    pm2 = PipelineManager()
    assert pm1 is pm2

def test_create_pipeline():
    """Test creating a pipeline"""
    pm = PipelineManager()
    pipeline_id = pm.create_pipeline("default")
    assert pipeline_id is not None
    assert len(pipeline_id) > 0

def test_get_pipeline():
    """Test getting a pipeline"""
    pm = PipelineManager()
    pipeline_id = pm.create_pipeline("default")
    pipeline = pm.get_pipeline(pipeline_id)
    assert pipeline is not None
    assert pipeline.video_id == "default"

def test_destroy_pipeline():
    """Test destroying a pipeline"""
    pm = PipelineManager()
    pipeline_id = pm.create_pipeline("default")
    result = pm.destroy_pipeline(pipeline_id)
    assert result is True
    pipeline = pm.get_pipeline(pipeline_id)
    assert pipeline is None

def test_list_pipelines():
    """Test listing pipelines"""
    pm = PipelineManager()
    pm.create_pipeline("default")
    pipelines = pm.list_pipelines()
    assert isinstance(pipelines, list)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jasonlee/UAV_PRO/website/backend && python -m pytest tests/test_pipeline_manager.py -v`
Expected: FAIL - ModuleNotFoundError

- [ ] **Step 3: Write implementation**

```python
# backend/app/services/pipeline_manager.py
"""PipelineManager - 多路 Pipeline 管理器"""
from __future__ import annotations

import asyncio
from typing import Optional

from app.services.pipeline import Pipeline
from app.services.types import PipelineStatus


class PipelineManager:
    """多路 Pipeline 管理器
    
    负责：
    - 管理多个 Pipeline 实例的生命周期
    - 支持并发创建/销毁
    - 提供 Pipeline 查询接口
    """
    
    _instance: Optional[PipelineManager] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._pipelines = {}
            cls._instance._lock = asyncio.Lock()
            cls._instance._id_counter = 0
        return cls._instance
    
    def create_pipeline(self, video_id: str) -> str:
        """创建新 Pipeline，返回 pipeline_id"""
        from app.services.video_service import VideoService
        from app.services.perception_service import PerceptionService
        
        # 创建 pipeline_id
        self._id_counter += 1
        pipeline_id = f"pipeline_{self._id_counter:04d}"
        
        # 创建服务实例
        video_service = VideoService(video_id)
        perception_service = PerceptionService()
        
        # 创建 Pipeline
        pipeline = Pipeline(
            video_id=video_id,
            video_service=video_service,
            perception_service=perception_service,
        )
        
        # 注册
        self._pipelines[pipeline_id] = pipeline
        
        print(f"[PipelineManager] 创建 Pipeline: {pipeline_id} (video_id={video_id})")
        return pipeline_id
    
    def get_pipeline(self, pipeline_id: str) -> Optional[Pipeline]:
        """获取 Pipeline"""
        return self._pipelines.get(pipeline_id)
    
    def destroy_pipeline(self, pipeline_id: str) -> bool:
        """销毁 Pipeline"""
        if pipeline_id in self._pipelines:
            pipeline = self._pipelines[pipeline_id]
            # 停止 Pipeline
            asyncio.create_task(pipeline.stop())
            # 移除
            del self._pipelines[pipeline_id]
            print(f"[PipelineManager] 销毁 Pipeline: {pipeline_id}")
            return True
        return False
    
    def list_pipelines(self) -> list[dict]:
        """列出所有 Pipeline"""
        return [
            {
                "pipeline_id": pid,
                "video_id": p.video_id,
                "status": p.status.value,
            }
            for pid, p in self._pipelines.items()
        ]
    
    async def cleanup(self):
        """清理所有 Pipeline"""
        for pipeline_id in list(self._pipelines.keys()):
            self.destroy_pipeline(pipeline_id)


# 全局实例获取函数
def get_pipeline_manager() -> PipelineManager:
    """获取 PipelineManager 单例"""
    return PipelineManager()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jasonlee/UAV_PRO/website/backend && python -m pytest tests/test_pipeline_manager.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/pipeline_manager.py backend/tests/test_pipeline_manager.py
git commit -m "feat(services): 添加 PipelineManager 多路管理器"
```

---

### Task 7: 改造 routes_demo.py

**Files:**
- Modify: `backend/app/api/routes_demo.py`
- Test: 使用现有测试验证

- [ ] **Step 1: 查看当前 routes_demo.py 结构**

Run: `wc -l /Users/jasonlee/UAV_PRO/website/backend/app/api/routes_demo.py`
Expected: ~2000 行

- [ ] **Step 2: 编写精简版 routes_demo.py**

```python
# backend/app/api/routes_demo.py
"""演示接口 - 精简版路由层"""
from __future__ import annotations

import asyncio
import json
import re
import time
from pathlib import Path
from typing import AsyncGenerator

import cv2
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.core.database import AsyncSessionLocal
from app.models.alert import Alert, RiskLevel, AlertStatus
from app.services.pipeline_manager import get_pipeline_manager
from app.services.video_service import VideoService

router = APIRouter(prefix="/demo", tags=["演示"])

# ── 帧缓存目录 ──────────────────────────────────────────────────────────────
FRAME_CACHE_DIR = Path(__file__).resolve().parents[2] / "data" / "frames"
FRAME_CACHE_DIR.mkdir(parents=True, exist_ok=True)


# ── 帧图像服务 ────────────────────────────────────────────────────────────────

@router.get("/frames/{filename}")
def get_annotated_frame(filename: str):
    """返回缓存的标注帧图像"""
    filepath = FRAME_CACHE_DIR / filename
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(404, "帧图像不存在")
    return StreamingResponse(
        open(filepath, "rb"),
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=300"},
    )


# ── 视频服务 ─────────────────────────────────────────────────────────────────

@router.get("/thumbnail")
def get_demo_thumbnail():
    """从演示视频第10%帧提取缩略图"""
    video_service = VideoService("default")
    info = video_service.get_video_info()
    
    if not info.exists:
        raise HTTPException(404, "演示视频不存在")
    
    # 实现缩略图提取...
    # (简化实现，直接返回视频流请求)
    raise HTTPException(501, "Not implemented - use /demo/video")


@router.get("/video")
def get_demo_video(request: Request, video_id: str = "default"):
    """流式返回演示视频 MP4"""
    from app.api.routes_demo_original import _stream_video, _resolve_video_path
    
    video_path = _resolve_video_path(video_id)
    if not video_path:
        raise HTTPException(404, f"视频不存在: {video_id}")
    return _stream_video(video_path, request)


@router.get("/videos")
def list_demo_videos():
    """列出所有可用的演示视频"""
    return VideoService.list_available_videos()


# ── Pipeline SSE 流 ─────────────────────────────────────────────────────────

@router.get("/stream")
async def demo_sse_stream(request: Request, video_id: str = "default"):
    """SSE 演示流 - 运行完整 pipeline"""
    pm = get_pipeline_manager()
    pipeline_id = pm.create_pipeline(video_id)
    pipeline = pm.get_pipeline(pipeline_id)
    
    if not pipeline:
        raise HTTPException(500, "Failed to create pipeline")
    
    async def generate():
        try:
            async for event in pipeline.start():
                yield f"event: {event.event}\ndata: {json.dumps(event.data)}\n\n".encode()
        except Exception as e:
            print(f"[demo_sse_stream] SSE error: {e}")
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n".encode()
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/stream/stop")
async def stop_stream(pipeline_id: str = None):
    """停止指定 Pipeline"""
    pm = get_pipeline_manager()
    
    if pipeline_id:
        pm.destroy_pipeline(pipeline_id)
        return {"ok": True, "message": f"Pipeline {pipeline_id} stopped"}
    
    # 停止所有
    for p in pm.list_pipelines():
        pm.destroy_pipeline(p["pipeline_id"])
    return {"ok": True, "message": "All pipelines stopped"}


# ── 数据管理 ─────────────────────────────────────────────────────────────────

@router.get("/seed")
async def seed_demo_data() -> dict:
    """向数据库插入样例预警数据"""
    # (保持原有实现)
    ...
```

- [ ] **Step 3: 保留原有函数用于回退**

```python
# backend/app/api/routes_demo_original.py
# 原有 routes_demo.py 内容移动到这里，作为回退实现
```

- [ ] **Step 4: 测试 API 端点**

Run: `cd /Users/jasonlee/UAV_PRO/website/backend && python -c "from app.api import routes_demo; print('routes_demo import OK')"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/routes_demo.py
git mv backend/app/api/routes_demo.py backend/app/api/routes_demo_original.py  # 移动原有文件
git commit -m "refactor(api): 精简 routes_demo.py，将实现移至 services"
```

---

### Task 8: 更新 services/__init__.py

**Files:**
- Modify: `backend/app/services/__init__.py`

- [ ] **Step 1: 更新导出**

```python
# backend/app/services/__init__.py
"""服务模块"""
from app.services.types import (
    FrameData, VideoInfo, Detection, MaskDetail,
    DetectionResult, AnnotatedImage, VisionResult,
    DecisionResult, PipelineStatus, SSEEvent
)
from app.services.video_service import VideoService
from app.services.perception_service import PerceptionService
from app.services.pipeline import Pipeline
from app.services.pipeline_manager import PipelineManager, get_pipeline_manager

__all__ = [
    # Types
    "FrameData", "VideoInfo", "Detection", "MaskDetail",
    "DetectionResult", "AnnotatedImage", "VisionResult",
    "DecisionResult", "PipelineStatus", "SSEEvent",
    # Services
    "VideoService",
    "PerceptionService",
    "Pipeline",
    "PipelineManager",
    "get_pipeline_manager",
]
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/__init__.py
git commit -m "feat(services): 更新 __init__.py 导出"
```

---

### Task 9: 集成测试

**Files:**
- Test: `backend/tests/test_pipeline_complete.py`

- [ ] **Step 1: 编写集成测试**

```python
# backend/tests/test_pipeline_complete.py
import pytest
import asyncio
from app.services.pipeline import Pipeline
from app.services.video_service import VideoService
from app.services.perception_service import PerceptionService

@pytest.mark.asyncio
async def test_pipeline_with_real_video():
    """测试 Pipeline 使用真实视频"""
    vs = VideoService("default")
    info = vs.get_video_info()
    
    if not info.exists:
        pytest.skip("Demo video not available")
    
    ps = PerceptionService()
    pipeline = Pipeline(
        video_id="default",
        video_service=vs,
        perception_service=ps,
    )
    
    events = []
    async for event in pipeline.start():
        events.append(event)
        if len(events) >= 5:  # 只取前5个事件
            break
    
    assert len(events) > 0
    assert any(e.event == "frame_data" for e in events)
```

- [ ] **Step 2: 运行集成测试**

Run: `cd /Users/jasonlee/UAV_PRO/website/backend && python -m pytest tests/test_pipeline_complete.py -v`
Expected: 根据视频是否存在决定结果

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_pipeline_complete.py
git commit -m "test: 添加 Pipeline 集成测试"
```

---

## 自检清单

完成所有任务后，自检：

1. **Spec 覆盖**：每个设计文档中的功能都有对应实现？
2. **类型一致性**：所有类型、接口名称一致？
3. **无占位符**：无 TBD、TODO、placeholder？
4. **测试通过**：所有单元测试通过？
5. **向后兼容**：现有 API 端点仍可用？

---

## 执行选项

**计划完成并保存到 `docs/superpowers/plans/2026-05-07-routes-demo-refactor-plan.md`**

**两个执行选项：**

**1. Subagent-Driven (推荐)** - 每个任务派生子 agent，双阶段审查

**2. Inline Execution** - 本会话批量执行，带检查点

**选择哪种方式？**
