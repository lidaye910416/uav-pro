# -*- coding: utf-8 -*-
"""SAM 掩膜可视化测试 - 生成更好的掩膜图像"""
from __future__ import annotations

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import cv2
import numpy as np

# 测试视频
video_path = Path(__file__).parent.parent / "data" / "streams" / "gal_1.mp4"
output_dir = Path(__file__).parent / "test_output"

cap = cv2.VideoCapture(str(video_path))
ret, frame = cap.read()
cap.release()

print(f"图像尺寸: {frame.shape}")
print(f"Bbox: (630, 84, 689, 134)")

# 尝试用更大的 imgsz
from ultralytics import SAM

# 使用 imgsz=1024 并叠加掩膜
sam = SAM("mobile_sam.pt")
results = sam(frame, bboxes=[[630, 84, 59, 50]], imgsz=1024, verbose=False)
r = results[0]

if r.masks:
    mask = r.masks.data[0].cpu().numpy()
    print(f"掩膜像素数: {mask.sum()}")
    
    # 创建可视化
    h, w = frame.shape[:2]
    
    # 1. 原始掩膜
    mask_vis = (mask * 255).astype(np.uint8)
    cv2.imwrite(str(output_dir / "sam_mask_raw.jpg"), mask_vis)
    
    # 2. 掩膜叠加到原图（不同颜色）
    overlay = frame.copy()
    
    # 方法1: 彩色掩膜
    colored_overlay = frame.copy()
    # 找到掩膜区域
    mask_bool = mask > 0.3  # 使用较低的阈值
    
    if mask_bool.sum() > 0:
        # 创建彩色掩膜（使用红色高亮）
        colored_overlay[mask_bool] = [0, 50, 255]  # BGR: 红色
        # 添加边界
        contours, _ = cv2.findContours(mask_vis.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(colored_overlay, contours, -1, (0, 255, 0), 2)  # 绿色边界
        cv2.rectangle(colored_overlay, (630, 84), (689, 134), (255, 0, 0), 2)  # 蓝色 bbox
    else:
        print("❌ 掩膜为空")
    
    cv2.imwrite(str(output_dir / "sam_overlay_color.jpg"), colored_overlay)
    print("✅ 彩色掩膜叠加图已保存")
    
    # 3. 尝试用更清晰的掩膜
    mask_clear = (mask * 255).astype(np.uint8)
    # 形态学处理：膨胀
    kernel = np.ones((5, 5), np.uint8)
    mask_dilated = cv2.dilate(mask_clear, kernel, iterations=1)
    
    overlay_dilated = frame.copy()
    if mask_dilated.sum() > 0:
        overlay_dilated[mask_dilated > 127] = [0, 0, 255]  # 红色
    cv2.imwrite(str(output_dir / "sam_overlay_dilated.jpg"), overlay_dilated)
    
    # 4. 放大检测区域
    x1, y1, x2, y2 = 630, 84, 689, 134
    margin = 30
    roi = frame[max(0, y1-margin):min(h, y2+margin), max(0, x1-margin):min(w, x2+margin)]
    cv2.imwrite(str(output_dir / "sam_roi_original.jpg"), roi)
    
    roi_overlay = roi.copy()
    roi_mask = mask_dilated[max(0, y1-margin):min(h, y2+margin), max(0, x1-margin):min(w, x2+margin)]
    if roi_mask.sum() > 0:
        roi_overlay[roi_mask > 127] = [0, 0, 255]
    cv2.imwrite(str(output_dir / "sam_roi_masked.jpg"), roi_overlay)
    print("✅ ROI 区域已保存")
    
    # 5. 创建最终的可视化图像
    final = frame.copy()
    
    # 绘制 bbox
    cv2.rectangle(final, (x1, y1), (x2, y2), (0, 255, 255), 2)  # 黄色边框
    
    # 叠加掩膜
    mask_bool = mask > 0.3
    if mask_bool.sum() > 0:
        # 使用彩色掩膜
        for c in range(3):
            final[:, :, c] = np.where(mask_bool, 
                final[:, :, c] * 0.5 + [0, 50, 255][c] * 0.5, 
                final[:, :, c]).astype(np.uint8)
    
    # 添加标签
    cv2.putText(final, "Bicycle", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
    cv2.putText(final, f"Mask: {int(mask.sum())}px", (x1, y2 + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 0), 1)
    
    cv2.imwrite(str(output_dir / "sam_final_visualization.jpg"), final)
    print("✅ 最终可视化图已保存")
    
print("\n📁 输出文件:")
for f in sorted(output_dir.glob("sam_*.jpg")):
    print(f"   {f.name}")
