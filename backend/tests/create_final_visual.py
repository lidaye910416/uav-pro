# -*- coding: utf-8 -*-
"""创建最终 YOLO+SAM 可视化"""
from __future__ import annotations

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import cv2
import numpy as np
from segment_anything import SamPredictor, sam_model_registry

# 测试视频
video_path = Path(__file__).parent.parent / "data" / "streams" / "gal_1.mp4"
output_dir = Path(__file__).parent / "test_output"
model_path = Path(__file__).parent.parent / "models" / "sam" / "sam_vit_b.pth"

cap = cv2.VideoCapture(str(video_path))
ret, frame = cap.read()
cap.release()

print(f"图像尺寸: {frame.shape}")

# 加载 SAM
sam = sam_model_registry["vit_b"](checkpoint=str(model_path))
predictor = SamPredictor(sam)
image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
predictor.set_image(image_rgb)
print("✅ SAM 模型加载成功")

# 使用之前测试过的 YOLO 检测结果（从 final_test.py）
# bbox: (630, 84, 689, 134) - car
# bbox: (818, 386, 882, 563) - person
detections = [
    {"bbox": (630, 84, 689, 134), "conf": 0.81, "label": "car"},
    {"bbox": (818, 386, 882, 563), "conf": 0.87, "label": "person"},
]

color_map = {
    "car": (255, 100, 0),      # 蓝色
    "person": (0, 255, 100),   # 绿色
}

# 创建最终可视化
final = frame.copy()

for det in detections:
    x1, y1, x2, y2 = det["bbox"]
    color = color_map.get(det["label"], (200, 200, 100))
    
    # SAM 分割
    sam_bbox = np.array([[x1, y1], [x2, y2]])
    masks, _, _ = predictor.predict(
        point_coords=None,
        point_labels=None,
        box=sam_bbox,
        multimask_output=False,
    )
    
    # 叠加掩膜
    if len(masks) > 0:
        mask = masks[0]
        print(f"   [{det['label']}] 掩膜像素数: {mask.sum():,}")
        if mask.sum() > 50:
            for c in range(3):
                final[:, :, c] = np.where(mask, 
                    (final[:, :, c] * 0.5 + color[c] * 0.5).astype(np.uint8),
                    final[:, :, c])
    
    # 绘制 bbox
    cv2.rectangle(final, (x1, y1), (x2, y2), color, 3)
    
    # 标签
    label_text = f"{det['label']} {det['conf']:.0%}"
    cv2.rectangle(final, (x1, y1 - 25), (x1 + 100, y1), color, -1)
    cv2.putText(final, label_text, (x1 + 5, y1 - 8), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

# 添加图例
cv2.putText(final, "YOLO+SAM Pipeline", (10, 30), 
            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 184, 0), 2)

cv2.imwrite(str(output_dir / "sam_vitb_final.jpg"), final)
print("✅ 最终可视化已保存")

# 保存单独的掩膜图像（用于 MLLM）
for i, det in enumerate(detections):
    x1, y1, x2, y2 = det["bbox"]
    color = color_map.get(det["label"], (200, 200, 100))
    
    sam_bbox = np.array([[x1, y1], [x2, y2]])
    masks, _, _ = predictor.predict(
        point_coords=None,
        point_labels=None,
        box=sam_bbox,
        multimask_output=False,
    )
    
    if len(masks) > 0:
        mask = masks[0]
        # 创建带掩膜的高亮图
        highlight = frame.copy()
        if mask.sum() > 50:
            highlight[mask] = [0, 0, 255]  # 红色高亮
            cv2.rectangle(highlight, (x1, y1), (x2, y2), color, 2)
        
        cv2.imwrite(str(output_dir / f"sam_mask_{det['label']}_{i}.jpg"), highlight)
        print(f"✅ 掩膜图已保存: sam_mask_{det['label']}_{i}.jpg")

print("\n📁 输出文件:")
for f in sorted(output_dir.glob("sam_vitb_*.jpg")):
    size_kb = f.stat().st_size / 1024
    print(f"   {f.name} ({size_kb:.1f} KB)")
for f in sorted(output_dir.glob("sam_mask_*.jpg")):
    size_kb = f.stat().st_size / 1024
    print(f"   {f.name} ({size_kb:.1f} KB)")
