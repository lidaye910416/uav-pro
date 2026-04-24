# YOLO Pipeline P1 实施计划

> 日期：2026-04-21
> 状态：P0完成，P1进行中

---

## 任务清单

### ✅ P0（已完成）

- [x] YOLOXxxDetector — `app/services/perception/yolo_detector.py`
- [x] DeepSORTTracker — `app/services/perception/deepsort_tracker.py`
- [x] PromptBuilder — `app/services/perception/prompt_builder.py`
- [x] YOLOPipeline 整合 — `app/analyze_pipeline_yolo.py`
- [x] 集成到 routes_demo SSE — `routes_demo.py`
- [x] 前端 VideoPlayer 更新 — `VideoPlayer.tsx`
- [x] 功能验证测试

---

### P1：SAM 精确分割（进行中）

#### T1: SAMSegmenter 模块

**文件**: `app/services/perception/sam_segmenter.py`

**实现内容**:
- 使用 `segment-anything-hq` 或 `supervision` 的 SAM wrapper
- 输入 YOLOv8 的 bbox 列表
- 输出像素级掩膜 polygon

**验证步骤**:
```bash
python3 -c "
from app.services.perception.sam_segmenter import SAMSegmenter
import cv2, numpy as np
seg = SAMSegmenter()
cap = cv2.VideoCapture('data/streams/gal_1.mp4')
ret, frame = cap.read()
cap.release()
masks = seg.segment(frame, [[400, 300, 600, 500]])
print(f'分割结果: {len(masks)} 个掩膜')
"
```

#### T2: YOLOPipeline 集成 SAM

**文件**: `app/analyze_pipeline_yolo.py`

**实现内容**:
- YOLOPipeline 添加可选 SAM 分割
- `process_frame()` 返回 enhanced ROI（含掩膜）
- SAM 结果添加到 PromptBuilder

**验证步骤**:
```bash
python3 -c "
from app.analyze_pipeline_yolo import YOLOPipeline
pipeline = YOLOPipeline(enable_sam=True)
pipeline.initialize()
# 处理帧，验证 SAM 输出
"
```

#### T3: 前端分割掩膜叠加显示

**文件**: `frontend/apps/showcase/components/DemoPipeline/VideoPlayer.tsx`

**实现内容**:
- VideoPlayer 添加 `masks?: SegmentationMask[]` prop
- Canvas 绘制掩膜多边形（半透明填充）
- 不同类别用不同颜色

**验证步骤**:
- 启动 showcase 前端
- 访问首页 demo pipeline
- 检查视频区域是否有掩膜叠加

---

### P2：Admin YOLO 参数设置

#### T4: YOLO 参数 API 端点

**文件**: `app/api/routes_analyze.py`

**实现内容**:
- GET `/api/v1/analyze/yolo-params` — 获取当前 YOLO 参数
- PATCH `/api/v1/analyze/yolo-params` — 更新 YOLO 参数
- 持久化到 `config/yolo.yaml`

#### T5: Admin 参数设置 UI

**文件**: `frontend/apps/admin/app/settings/page.tsx`

**实现内容**:
- 新增 "YOLO检测" Tab
- 滑块：置信度阈值 (0.0~1.0, 默认 0.35)
- 滑块：max_age (10~60, 默认 30)
- 滑块：min_hits (1~5, 默认 3)
- 目标类别多选：vehicle/person/obstacle

#### T6: 前端 API 集成

**文件**: `frontend/apps/admin/lib/api.ts`

**实现内容**:
- `fetchYoloParams(): Promise<Record<string, number | boolean>>`
- `updateYoloParams(params): Promise<void>`

---

## 验证总览

| 任务 | 验证方法 | 预期结果 |
|------|---------|---------|
| T1 SAMSegmenter | Python 测试 | 分割出掩膜多边形 |
| T2 Pipeline SAM | Python 测试 | 返回 enhanced ROI |
| T3 前端掩膜显示 | 浏览器检查 | 视频区域有彩色掩膜 |
| T4 YOLO 参数 API | curl 测试 | GET/PATCH 正常 |
| T5 Admin 参数 UI | 浏览器检查 | Tab 存在，滑块可调 |
| T6 前端 API | 浏览器检查 | 参数同步保存 |
