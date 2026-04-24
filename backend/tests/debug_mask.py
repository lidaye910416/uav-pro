# -*- coding: utf-8 -*-
"""调试 SAM 掩膜生成"""
from __future__ import annotations

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import cv2
import numpy as np
from app.services.perception.sam_segmenter import SAMSegmenter

# 测试视频
video_path = Path(__file__).parent.parent / "data" / "streams" / "gal_1.mp4"
output_dir = Path(__file__).parent / "test_output"

cap = cv2.VideoCapture(str(video_path))
ret, frame = cap.read()
cap.release()

if not ret:
    print("❌ 无法读取视频帧")
    sys.exit(1)

# 测试 SAM 分割
sam = SAMSegmenter(model_size="vit_b")

# 假设检测到一个自行车
bbox = (630, 84, 689, 134)  # YOLO 检测结果

print(f"🔍 测试 SAM 分割...")
print(f"   输入 bbox: {bbox}")
print(f"   图像尺寸: {frame.shape}")

# 执行分割
masks = sam.segment(frame, [bbox])

if masks:
    mask = masks[0]
    print(f"   ✅ 分割成功!")
    print(f"   - 掩膜形状: {mask.mask.shape}")
    print(f"   - 掩膜 bbox: {mask.bbox}")
    print(f"   - 掩膜面积: {mask.area} 像素")
    print(f"   - 掩膜置信度: {mask.confidence}")
    print(f"   - 多边形点数: {len(mask.polygon)}")
    
    # 创建掩膜可视化
    h, w = frame.shape[:2]
    
    # 1. 原始掩膜（二值）
    binary_mask = np.zeros((h, w), dtype=np.uint8)
    if mask.mask.shape[:2] == (h, w):
        binary_mask = mask.mask.astype(np.uint8) * 255
    else:
        binary_mask = cv2.resize(mask.mask.astype(np.uint8) * 255, (w, h), interpolation=cv2.INTER_NEAREST)
    
    cv2.imwrite(str(output_dir / "mask_binary.jpg"), binary_mask)
    print(f"   ✅ 二值掩膜已保存")
    
    # 2. 掩膜叠加到原图（红色高亮）
    mask_overlay = frame.copy()
    mask_bool = binary_mask > 0
    mask_overlay[mask_bool] = [0, 0, 255]  # 红色
    
    # 添加边框
    x1, y1, x2, y2 = bbox
    cv2.rectangle(mask_overlay, (x1, y1), (x2, y2), (0, 255, 0), 2)  # 绿色边框
    
    cv2.imwrite(str(output_dir / "mask_overlay_red.jpg"), mask_overlay)
    print(f"   ✅ 红色掩膜叠加图已保存")
    
    # 3. 半透明掩膜叠加
    alpha = 0.5
    mask_overlay2 = frame.copy()
    # 创建彩色掩膜
    colored_mask = np.zeros_like(frame)
    colored_mask[mask_bool] = [0, 200, 255]  # 黄色掩膜
    mask_overlay2 = cv2.addWeighted(frame, 1-alpha, colored_mask, alpha, 0)
    
    # 添加边框
    cv2.rectangle(mask_overlay2, (x1, y1), (x2, y2), (0, 255, 0), 2)
    
    cv2.imwrite(str(output_dir / "mask_overlay_alpha.jpg"), mask_overlay2)
    print(f"   ✅ 半透明掩膜叠加图已保存")
    
    # 4. 放大掩膜区域查看
    x1, y1, x2, y2 = bbox
    margin = 20
    roi = frame[max(0, y1-margin):min(h, y2+margin), max(0, x1-margin):min(w, x2+margin)]
    cv2.imwrite(str(output_dir / "mask_roi_original.jpg"), roi)
    
    roi_mask = binary_mask[max(0, y1-margin):min(h, y2+margin), max(0, x1-margin):min(w, x2+margin)]
    roi_overlay = roi.copy()
    roi_overlay[roi_mask > 0] = [0, 0, 255]
    cv2.imwrite(str(output_dir / "mask_roi_highlight.jpg"), roi_overlay)
    print(f"   ✅ ROI 区域放大图已保存")
    
    print(f"\n📁 输出文件:")
    print(f"   - mask_binary.jpg: 二值掩膜")
    print(f"   - mask_overlay_red.jpg: 红色掩膜叠加")
    print(f"   - mask_overlay_alpha.jpg: 半透明掩膜叠加")
    print(f"   - mask_roi_original.jpg: 检测区域原图")
    print(f"   - mask_roi_highlight.jpg: 检测区域掩膜高亮")
    
else:
    print(f"   ❌ 分割失败")
