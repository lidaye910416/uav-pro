# Pipeline Stage 1 优化：YOLO + SAM 可视化方案

> 日期：2026-04-22
> 状态：进行中

---

## 一、目标

将 Pipeline Stage 1 从「帧差法运动检测」升级为「YOLO + SAM 精确分割 + 彩色掩码可视化」：

```
视频帧 → YOLOv8 检测 → SAM 分割 → 彩色掩码叠加图 → Gemma 分析
```

Gemma 将收到：
- **增强可视化图像**：原图 + 不同类别物体用不同颜色标记的分割掩码
- **结构化提示词**：检测到的物体类别、位置、数量、异常指标

---

## 二、技术架构

### 2.1 新流程

```
视频帧 (BGR)
    ↓
┌─────────────────────────────────┐
│ YOLOv8n 目标检测                 │
│ 输入：frame                      │
│ 输出：DetectedObject[] (bbox,    │
│       label, confidence)         │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ SAM 像素级分割                   │
│ 输入：YOLO bbox[]                │
│ 输出：SegmentationMask[]         │
│       (mask, polygon, color)     │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ 彩色掩码可视化                   │
│ 输入：frame + masks              │
│ 输出：combined_image (BGR)       │
│ - 车辆：蓝色边框+半透明填充       │
│ - 行人：绿色边框+半透明填充        │
│ - 障碍物：红色边框+半透明填充     │
│ - 掩码区域叠加对应颜色            │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ 增强提示词生成                   │
│ 输出：detection_summary          │
│ - 物体数量、类别、位置           │
│ - 异常指标列表                   │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ Gemma 多模态分析                 │
│ 输入：combined_image (base64) +  │
│       detection_summary          │
│ 输出：异常判断、风险等级、建议    │
└─────────────────────────────────┘
```

### 2.2 SSE 事件更新

```javascript
// Stage 1: 检测+分割+可视化
event: stage
data: {
  "stage": "detection",      // 替换原来的 "framediff"
  "progress": 100,
  "status": "done",
  "detail": {
    "detections": 12,
    "segmentations": 10,
    "combined_image": "base64...",  // 新增：合并可视化图
  },
  "objects": [...],           // YOLO 检测结果
  "masks": [...],            // SAM 分割结果
}
```

---

## 三、新增/修改文件

### 3.1 新增 mask_visualizer.py

**路径**：`app/services/perception/mask_visualizer.py`

**功能**：将原图与 SAM 分割掩码合并为彩色可视化图像

**接口**：
```python
class MaskVisualizer:
    def __init__(self, category_colors: dict = DEFAULT_COLORS):
        """初始化可视化器"""
    
    def visualize(
        self,
        image: np.ndarray,
        detections: list[DetectedObject],
        masks: list[SegmentationMask],
    ) -> np.ndarray:
        """生成合并可视化图像
        
        Returns: BGR 图像，已叠加彩色掩码和标签
        """
    
    def add_bbox_label(
        self,
        image: np.ndarray,
        bbox: tuple,
        label: str,
        color: tuple,
        confidence: float,
    ) -> np.ndarray:
        """在图像上添加带标签的边界框"""
```

**颜色配置**：
```python
DEFAULT_COLORS = {
    "vehicle":   (255, 100, 0),    # BGR: 蓝色
    "person":    (0, 255, 100),    # BGR: 绿色
    "obstacle":  (0, 100, 255),    # BGR: 红色
    "default":   (200, 200, 100),  # BGR: 黄色
}
```

---

### 3.2 修改 analyze_pipeline_yolo.py

**新增整合方法**：
```python
class YOLOPipeline:
    def process_frame_with_sam(
        self,
        frame: np.ndarray,
        use_sam: bool = True,
    ) -> FrameProcessResult:
        """处理单帧（含 SAM 分割和可视化）
        
        Returns:
            FrameProcessResult:
                - frame: 原始帧
                - detections: YOLO 检测结果
                - tracked: DeepSORT 跟踪结果
                - masks: SAM 分割结果
                - combined_image: 合并可视化图 (BGR)
                - detection_summary: 结构化提示词
                - processing_time_ms: 处理耗时
        """
```

---

### 3.3 修改 routes_demo.py

**更新 SSE 流**：
```python
# Stage 1 重命名：framediff → detection
events.append(f"event: stage\ndata: {json.dumps({
    'stage': 'detection',  # 替换 'framediff'
    ...
    'combined_image': combined_image_b64,  # 新增
})}\n\n".encode())
```

---

## 四、MaskVisualizer 实现细节

### 4.1 掩码叠加算法

```python
def _blend_mask(
    image: np.ndarray,
    mask: np.ndarray,
    color: tuple[int, int, int],  # BGR
    alpha: float = 0.3,
) -> np.ndarray:
    """将掩码叠加到图像上"""
    # 创建彩色掩码层
    colored_mask = np.zeros_like(image)
    colored_mask[mask] = color
    
    # 混合
    result = cv2.addWeighted(
        image, 1 - alpha,
        colored_mask, alpha,
        0
    )
    return result
```

### 4.2 边界框绘制

```python
def draw_bbox_with_label(
    image: np.ndarray,
    bbox: tuple[int, int, int, int],
    label: str,
    color: tuple[int, int, int],
    confidence: float,
) -> np.ndarray:
    """绘制带标签的边界框"""
    x1, y1, x2, y2 = bbox
    
    # 边框
    cv2.rectangle(image, (x1, y1), (x2, y2), color, 2)
    
    # 背景矩形
    (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
    cv2.rectangle(image, (x1, y1 - th - 8), (x1 + tw + 8, y1), color, -1)
    
    # 文字
    cv2.putText(image, label, (x1 + 4, y1 - 4),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    
    return image
```

---

## 五、Gemma 提示词增强

### 5.1 新提示词模板

```python
Gemma_Prompt_Template = """请分析这张航拍图像，图中已用彩色标记分割了不同物体：
- 蓝色区域：车辆
- 绿色区域：行人
- 红色区域：障碍物

检测概要：
{detection_summary}

请判断是否存在以下异常情况：
1. 交通事故或车辆碰撞
2. 道路障碍物（遗撒物、故障车）
3. 异常停车（应急车道/行车道停车）
4. 行人闯入
5. 交通拥堵

请用JSON格式输出：
{{"scene_description":"场景描述",
  "should_alert":true/false,
  "risk_level":"low/medium/high/critical",
  "title":"10字内标题",
  "description":"30字内描述",
  "recommendation":"40字内建议",
  "confidence":0.0-1.0}}
"""
```

---

## 六、验证命令

```bash
# 测试 YOLO + SAM + 可视化 Pipeline
cd /Users/jasonlee/UAV_PRO/website/backend
python3 -c "
import cv2
from app.analyze_pipeline_yolo import YOLOPipeline
from app.services.perception.mask_visualizer import MaskVisualizer

pipeline = YOLOPipeline()
viz = MaskVisualizer()

cap = cv2.VideoCapture('data/streams/gal_1.mp4')
ret, frame = cap.read()
cap.release()

if ret:
    result = pipeline.process_frame_with_sam(frame, use_sam=True)
    print(f'检测: {len(result.detections)} 个')
    print(f'分割: {len(result.masks)} 个')
    print(f'可视化图: {result.combined_image.shape if result.combined_image is not None else None}')
"
```

---

## 七、状态检查清单

| 任务 | 状态 | 文件 |
|------|------|------|
| 创建 MaskVisualizer | ✅ | app/services/perception/mask_visualizer.py |
| 更新 YOLOPipeline | ✅ | app/analyze_pipeline_yolo.py |
| 更新 routes_demo.py | ✅ | app/api/routes_demo.py |
| 功能验证 | ✅ | 已测试 gal_1.mp4 |

---

## 八、测试结果

```
[YOLOPipeline] SAM 分割器初始化成功
✓ 帧处理成功
- 检测数量: 1
- 分割数量: 1
- 跟踪数量: 1
- 合并图: 有
- 检测摘要: 检测到 1 个目标：自行车 1 辆/个
- 处理耗时: 211.1ms
```

可视化图像已保存：`data/streams/gal_1_yolo_sam_visualization.jpg`

