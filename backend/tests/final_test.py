# -*- coding: utf-8 -*-
"""最终测试 - 生成完整的 YOLO+SAM 可视化结果"""
from __future__ import annotations

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import cv2
import numpy as np
from ultralytics import SAM

# 测试视频
video_path = Path(__file__).parent.parent / "data" / "streams" / "gal_1.mp4"
output_dir = Path(__file__).parent / "test_output"

cap = cv2.VideoCapture(str(video_path))
ret, frame = cap.read()
cap.release()

print(f"图像尺寸: {frame.shape}")

# ========== 阶段 1: YOLO 检测 ==========
print("\n📊 阶段 1: YOLO 检测")
from ultralytics import YOLO
yolo = YOLO("yolov8n.pt")
results = yolo(frame, conf=0.35, verbose=False)
r = results[0]

# 绘制 YOLO 检测结果
yolo_vis = frame.copy()
detections = []
if r.boxes is not None:
    for box in r.boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
        conf = float(box.conf[0].cpu().numpy())
        label = r.names[int(box.cls[0].cpu().numpy())]
        
        # 绘制 bbox
        cv2.rectangle(yolo_vis, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(yolo_vis, f"{label} {conf:.0%}", (x1, y1 - 5), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
        
        detections.append({
            "bbox": (x1, y1, x2, y2),
            "conf": conf,
            "label": label
        })
        print(f"   [{label}] bbox=({x1},{y1},{x2},{y2}), conf={conf:.2f}")

cv2.imwrite(str(output_dir / "stage1_yolo.jpg"), yolo_vis)
print(f"✅ YOLO 检测图已保存")

# ========== 阶段 2: SAM 分割 ==========
print("\n📊 阶段 2: SAM 分割")
sam = SAM("mobile_sam.pt")

sam_vis = frame.copy()
all_masks = []

for det in detections:
    x1, y1, x2, y2 = det["bbox"]
    # SAM bbox 格式: [x, y, w, h]
    sam_bbox = [x1, y1, x2 - x1, y2 - y1]
    
    results = sam(frame, bboxes=[sam_bbox], imgsz=1024, verbose=False)
    r = results[0]
    
    if r.masks is not None:
        mask = r.masks.data[0].cpu().numpy()
        print(f"   掩膜像素数: {mask.sum()}")
        
        if mask.sum() > 10:  # 只保存有效的掩膜
            all_masks.append(mask)
            
            # 叠加掩膜到可视化图
            mask_bool = mask > 0.3
            if mask_bool.sum() > 0:
                # 使用红色高亮掩膜区域
                sam_vis[mask_bool] = [0, 30, 255]  # BGR 红色
            
            # 绘制 bbox
            cv2.rectangle(sam_vis, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(sam_vis, f"{det['label']} MASK", (x1, y1 - 5), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)

cv2.imwrite(str(output_dir / "stage2_sam.jpg"), sam_vis)
print(f"✅ SAM 分割图已保存")

# ========== 阶段 3: YOLO+SAM 合并可视化 ==========
print("\n📊 阶段 3: YOLO+SAM 合并可视化")

combined = frame.copy()

# 定义颜色
colors = {
    "bicycle": (255, 100, 0),    # 蓝色
    "car": (0, 255, 100),        # 绿色
    "person": (0, 100, 255),     # 红色
    "truck": (200, 80, 0),       # 深蓝色
    "bus": (180, 60, 0),         # 深蓝色
}

for i, det in enumerate(detections):
    x1, y1, x2, y2 = det["bbox"]
    color = colors.get(det["label"], (200, 200, 100))
    
    # 绘制 bbox（加粗边框）
    cv2.rectangle(combined, (x1, y1), (x2, y2), color, 3)
    
    # 绘制角标
    corner_length = 8
    cv2.line(combined, (x1, y1), (x1 + corner_length, y1), color, 4)
    cv2.line(combined, (x1, y1), (x1, y1 + corner_length), color, 4)
    cv2.line(combined, (x2, y1), (x2 - corner_length, y1), color, 4)
    cv2.line(combined, (x2, y1), (x2, y1 + corner_length), color, 4)
    cv2.line(combined, (x1, y2), (x1 + corner_length, y2), color, 4)
    cv2.line(combined, (x1, y2), (x1, y2 - corner_length), color, 4)
    cv2.line(combined, (x2, y2), (x2 - corner_length, y2), color, 4)
    cv2.line(combined, (x2, y2), (x2, y2 - corner_length), color, 4)
    
    # 绘制标签背景
    label_text = f"{det['label']} {det['conf']:.0%}"
    (tw, th), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
    cv2.rectangle(combined, (x1, y1 - th - 8), (x1 + tw + 8, y1), color, -1)
    cv2.putText(combined, label_text, (x1 + 4, y1 - 4), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

# 叠加掩膜（如果有）
for i, mask in enumerate(all_masks):
    mask_bool = mask > 0.3
    if mask_bool.sum() > 0:
        # 半透明掩膜
        color = list(colors.values())[i % len(colors.values())]
        for c in range(3):
            combined[:, :, c] = np.where(mask_bool, 
                (combined[:, :, c] * 0.6 + color[c] * 0.4).astype(np.uint8),
                combined[:, :, c])

# 添加图例
legend_y = 30
for label, color in colors.items():
    if any(d["label"] == label for d in detections):
        cv2.rectangle(combined, (10, legend_y), (30, legend_y + 15), color, -1)
        cv2.putText(combined, label, (35, legend_y + 12), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)
        legend_y += 25

cv2.imwrite(str(output_dir / "stage3_combined.jpg"), combined)
print(f"✅ YOLO+SAM 合并图已保存")

# ========== 输出汇总 ==========
print("\n" + "=" * 60)
print("📁 输出文件:")
files = [
    ("stage1_yolo.jpg", "YOLO 检测结果"),
    ("stage2_sam.jpg", "SAM 分割结果"),
    ("stage3_combined.jpg", "YOLO+SAM 合并可视化"),
    ("original_frame.jpg", "原始帧"),
]
for fname, desc in files:
    fpath = output_dir / fname
    if fpath.exists():
        size_kb = fpath.stat().st_size / 1024
        print(f"   ✅ {fname} ({size_kb:.1f} KB) - {desc}")

print("\n" + "=" * 60)
print("✅ 测试完成！")
