# -*- coding: utf-8 -*-
"""详细调试 SAM 掩膜生成"""
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

# 使用 Ultralytics SAM 直接测试
sam = SAM("mobile_sam.pt")

# 假设检测到一个自行车
bbox = (630, 84, 689, 134)
x1, y1, x2, y2 = bbox

# SAM 使用 [x, y, w, h] 格式
sam_bbox = [x1, y1, x2 - x1, y2 - y1]
print(f"原始 bbox: {bbox}")
print(f"SAM bbox: {sam_bbox}")

# 执行分割
results = sam(frame, bboxes=[sam_bbox], imgsz=320, verbose=True)

print(f"\n结果数量: {len(results)}")

for i, r in enumerate(results):
    print(f"\n结果 {i}:")
    print(f"  - boxes: {r.boxes}")
    print(f"  - masks: {r.masks}")
    
    if r.masks is not None:
        print(f"  - masks.data shape: {r.masks.data.shape}")
        print(f"  - masks.xy: {r.masks.xy}")
        
        # 获取第一个掩膜
        mask_data = r.masks.data[0].cpu().numpy()
        print(f"  - mask_data shape: {mask_data.shape}")
        print(f"  - mask_data min/max: {mask_data.min():.4f} / {mask_data.max():.4f}")
        
        # 统计掩膜像素
        binary = mask_data > 0.5
        mask_pixels = binary.sum()
        print(f"  - 掩膜像素数 (>0.5): {mask_pixels}")
        
        # 保存原始掩膜
        mask_vis = (mask_data * 255).astype(np.uint8)
        cv2.imwrite(str(output_dir / "sam_direct_mask.jpg"), mask_vis)
        
        # 叠加掩膜到原图
        overlay = frame.copy()
        mask_bool = binary
        overlay[mask_bool] = [0, 0, 255]  # 红色高亮
        cv2.rectangle(overlay, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.imwrite(str(output_dir / "sam_direct_overlay.jpg"), overlay)
        
        print(f"  ✅ 掩膜图已保存")
    else:
        print(f"  ❌ 无掩膜数据")
