# UAV 道路交通事故检测系统优化规格说明书

> 日期：2026-04-21
> 状态：进行中

---

## 一、目标

将当前基于帧差法的运动检测 Pipeline 升级为 **YOLOv8 + Deep SORT + SAM + Gemma** 的多模态检测架构，提升 6 类道路异常检测精度（collision、pothole、obstacle、parking、pedestrian、congestion）。

---

## 二、技术架构

```
视频帧输入（gal_1.mp4）
  ↓
┌─────────────────────────────────────┐
│ YOLOv8l 目标检测（YOLOXxxDetector） │
│ 输出：车辆/行人/障碍物 bbox + 置信度 │
│ 模型：yolov8l.pt（COCO 预训练）      │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ Deep SORT 跟踪（DeepSORTTracker）    │
│ 输出：对象 ID + 轨迹 + 速度          │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ SAM 精确分割（SAMSegmenter）         │
│ 输入：YOLOv8 bbox                    │
│ 输出：像素级掩膜（可选，P2 阶段）    │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ 增强提示词生成（PromptBuilder）      │
│ 整合：检测 + 跟踪 + 分割            │
│ 输出：结构化 JSON → Gemma 4 E2B     │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ Gemma 4 E2B 零样本判断（保留）       │
│ 输入：增强提示词 + RAG SOP           │
│ 输出：异常分类 + 置信度 + 建议       │
└─────────────────────────────────────┘
```

---

## 三、新增模块规格

### 3.1 YOLOXxxDetector

**文件**：`app/services/perception/yolo_detector.py`

**功能**：使用 YOLOv8l 实时检测视频帧中的车辆、行人、障碍物。

**接口**：
```python
class YOLOXxxDetector:
    def __init__(self, model_name: str = "yolov8l.pt"):
        """加载 YOLOv8l 模型"""
    
    def detect(self, frame: np.ndarray) -> list[DetectedObject]:
        """
        检测单帧中的目标
        Returns: list of DetectedObject(bbox, label, confidence)
        """
```

**检测类别**（COCO 80 类中筛选）：
- `car`, `truck`, `bus` → 车辆
- `person` → 行人
- `motorcycle`, `bicycle` → 非机动车
- `traffic light`, `stop sign` → 交通设施（障碍物候选）

**性能要求**：单帧检测 < 50ms（GPU）或 < 200ms（CPU）

---

### 3.2 DeepSORTTracker

**文件**：`app/services/perception/deepsort_tracker.py`

**功能**：跨帧追踪检测到的对象，维持 ID 一致性，输出轨迹信息。

**接口**：
```python
class DeepSORTTracker:
    def __init__(self, max_age: int = 30, min_hits: int = 3):
        """初始化 Deep SORT 跟踪器"""
    
    def update(self, detections: list[DetectedObject]) -> list[TrackedObject]:
        """
        更新跟踪状态
        Returns: list of TrackedObject(id, bbox, velocity, trajectory)
        """
```

**输出字段**：
- `track_id`: 对象唯一 ID
- `bbox`: 当前帧边界框
- `velocity`: 速度估计（像素/帧）
- `trajectory`: 历史轨迹点列表（最近 30 帧）
- `age`: 跟踪持续帧数
- `status`: `moving` | `stationary` | `disappeared`

---

### 3.3 SAMSegmenter（可选，P1 阶段）

**文件**：`app/services/perception/sam_segmenter.py`

**功能**：对 YOLOv8 的 bbox 进行像素级精确分割。

**接口**：
```python
class SAMSegmenter:
    def __init__(self, model_type: str = "vit_h"):
        """加载 SAM 模型"""
    
    def segment(self, frame: np.ndarray, bboxes: list) -> list[SegmentationMask]:
        """
        分割指定区域
        Returns: list of mask polygons
        """
```

**性能要求**：单帧分割 < 100ms（使用轻量模型如 `vit_t`）

---

### 3.4 PromptBuilder

**文件**：`app/services/perception/prompt_builder.py`

**功能**：整合检测、跟踪、分割结果，生成增强提示词供 Gemma 分析。

**接口**：
```python
class PromptBuilder:
    def build(self, 
               detected: list[DetectedObject],
               tracked: list[TrackedObject],
               masks: list[SegmentationMask] = []) -> dict:
        """
        生成结构化提示词
        Returns: enhanced_prompt dict
        """
```

**输出 JSON 结构**：
```json
{
  "frame_info": {
    "timestamp": "15.3s",
    "resolution": "1920×1080",
    "total_objects": 5
  },
  "objects": [
    {
      "id": 5,
      "type": "vehicle",
      "label": "car",
      "confidence": 0.94,
      "bbox": [850, 420, 980, 560],
      "mask": "base64...",
      "trajectory": [[840,430], [845,425], [850,420]],
      "speed": "58km/h",
      "motion_state": "moving",
      "trajectory_anomaly": null
    }
  ],
  "anomaly_indicators": [
    "ID=5 和 ID=7 在 15.3s 轨迹重叠",
    "ID=7 速度从 60km/h 降至 0km/h"
  ],
  "suspected_incidents": ["collision"],
  "scene_context": "高速公路主路，晴天，下午3点，双向4车道"
}
```

---

### 3.5 YOLOPipeline（整合层）

**文件**：`app/analyze_pipeline_yolo.py`

**功能**：串联 YOLOv8 + Deep SORT + SAM + PromptBuilder，为 SSE 接口提供统一的 pipeline 调用。

**接口**：
```python
class YOLOPipeline:
    def __init__(self):
        self.detector = YOLOXxxDetector()
        self.tracker = DeepSORTTracker()
        self.segmenter = SAMSegmenter()  # 可选
        self.prompt_builder = PromptBuilder()
    
    def process_frame(self, frame: np.ndarray) -> EnhancedPrompt:
        """处理单帧，返回增强提示词"""
```

---

## 四、后端 API 改动

### 4.1 新增接口

**GET /api/v1/analyze/yolo-status**：返回 YOLOv8 模型加载状态、可用类别。

**POST /api/v1/analyze/yolo-detect**：单帧检测接口（调试用）。

### 4.2 修改接口

**GET /api/v1/demo/stream**：修改 SSE stream，YOLOv8 检测结果通过 yolo_detect 事件推送。

**SSE 事件格式**：
```
event: yolo_detect
data: {"frame_idx": "00015", "objects": [...], "tracked_objects": [...]}

event: anomaly_alert
data: {"incident_type": "collision", "confidence": 0.87, "evidence": [...]}
```

---

## 五、前端改动

### 5.1 Dashboard Monitor（localhost:3000/monitor）

**改动**：将当前 ROI 矩形框（帧差法）替换为 YOLOv8 检测框。

**YOLO 检测框样式**：
- 车辆：蓝色边框（#3b82f6） + 类别标签
- 行人：绿色边框（#22c55e） + 类别标签
- 障碍物：红色边框（#ef4444） + 类别标签
- 跟踪 ID 标签显示在框上方

**保留**：右侧参数面板（threshold/min_area/max_area/blur_size/morph_size 暂时保留，作为帧差法备用）

### 5.2 Admin Settings（localhost:3001/settings）

**新增 Tab**：YOLO 检测设置
- 目标类别选择（车辆/行人/障碍物）
- 置信度阈值滑块（0.0 ~ 1.0，默认 0.5）
- 跟踪参数（max_age, min_hits）

---

## 六、测试计划

### 6.1 单元测试

**测试文件**：tests/test_yolo_detector.py
- 测试 YOLOv8 模型加载
- 测试 detect() 方法输出格式
- 测试空帧输入处理

**测试文件**：tests/test_deepsort_tracker.py
- 测试跟踪器初始化
- 测试多目标跟踪
- 测试轨迹输出格式

### 6.2 集成测试

**测试文件**：tests/test_pipeline_integration.py
- 测试 YOLOv8 + Deep SORT 串联
- 测试 YOLOPipeline.process_frame()
- 测试 SSE 流输出格式

### 6.3 功能验证

验证命令：
```bash
# 1. YOLOv8 检测测试
python3 -c "
from app.services.perception.yolo_detector import YOLOXxxDetector
import cv2
det = YOLOXxxDetector()
cap = cv2.VideoCapture('data/streams/gal_1.mp4')
ret, frame = cap.read()
results = det.detect(frame)
print(f'检测到 {len(results)} 个目标')
for r in results:
    print(f'  - {r.label}: {r.confidence:.2f}')
"

# 2. Pipeline 集成测试
python3 -c "
from app.analyze_pipeline_yolo import YOLOPipeline
pipeline = YOLOPipeline()
# 处理视频前 10 帧
# 验证输出格式
"
```

---

## 七、实施阶段

| 阶段 | 任务 | 产出 |
|------|------|------|
| **P0** | 实现 YOLOXxxDetector | app/services/perception/yolo_detector.py |
| **P0** | 实现 DeepSORTTracker | app/services/perception/deepsort_tracker.py |
| **P0** | 实现 PromptBuilder | app/services/perception/prompt_builder.py |
| **P0** | 实现 YOLOPipeline 整合 | app/analyze_pipeline_yolo.py |
| **P0** | 集成到 routes_demo SSE | 修改 routes_demo.py 使用新 pipeline |
| **P0** | 前端 Dashboard 检测框显示 | 修改 monitor/page.tsx |
| **P0** | 功能验证测试 | 运行检测，验证输出 |
| **P1** | 实现 SAMSegmenter | app/services/perception/sam_segmenter.py |
| **P1** | 前端分割掩膜叠加 | 修改 VideoPlayer.tsx |
| **P2** | Admin YOLO 参数设置页 | 修改 settings/page.tsx |

---

## 八、已知约束

1. **Ollama Gemma 模型**：需保持 gemma-4-e2b 可用（或 fallback）
2. **YOLOv8 模型**：使用 ultralytics 包，需确认已安装
3. **Deep SORT**：需确认 sort/clip 相关依赖
4. **SAM**：可选 P1/P2 阶段，需确认 sam-hq 已安装
5. **视频测试源**：data/streams/gal_1.mp4
