# -*- coding: utf-8 -*-
"""测试 MobileSAM 模型"""
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

# 测试不同的 SAM 模型
print("\n=== 测试 1: Ultralytics SAM (mobile_sam.pt) ===")
try:
    from ultralytics import SAM
    sam = SAM("mobile_sam.pt")
    results = sam(frame, bboxes=[[630, 84, 59, 50]], imgsz=1024, verbose=False)
    r = results[0]
    if r.masks and r.masks.data[0].sum() > 0:
        print(f"✅ 掩膜像素数: {r.masks.data[0].sum()}")
        mask = r.masks.data[0].cpu().numpy()
        mask_vis = (mask * 255).astype(np.uint8)
        cv2.imwrite(str(output_dir / "sam_mobile_imgsz1024.jpg"), mask_vis)
    else:
        print(f"❌ 掩膜为空")
except Exception as e:
    print(f"❌ 错误: {e}")

print("\n=== 测试 2: Ultralytics SAM (无 bbox) ===")
try:
    sam = SAM("mobile_sam.pt")
    results = sam(frame, verbose=False)
    r = results[0]
    if r.masks and len(r.masks.data) > 0:
        # 检查第一个掩膜
        mask = r.masks.data[0].cpu().numpy()
        print(f"✅ 检测到 {len(r.masks.data)} 个掩膜")
        print(f"   第一个掩膜像素数: {mask.sum()}")
        if mask.sum() > 0:
            mask_vis = (mask * 255).astype(np.uint8)
            cv2.imwrite(str(output_dir / "sam_mobile_auto.jpg"), mask_vis)
            print(f"   ✅ 已保存")
    else:
        print(f"❌ 无掩膜")
except Exception as e:
    print(f"❌ 错误: {e}")

print("\n=== 测试 3: SAM (segment-anything-hq) ===")
try:
    from segment_anything_hq import SamPredictor, build_sam_vit_b
    import torch
    
    # 下载模型（如果不存在）
    model_path = Path.home() / ".cache" / "sam" / "sam_vit_b_01ec64.pth"
    if not model_path.exists():
        print(f"⚠️ 模型不存在: {model_path}")
        print(f"   尝试下载...")
    
    sam = build_sam_vit_b(checkpoint=str(model_path))
    predictor = SamPredictor(sam)
    
    # 转换图像
    image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    predictor.set_image(image_rgb)
    
    # 使用点提示
    points = np.array([[659, 109]])  # 自行车中心
    labels = np.array([1])
    
    masks, scores, logits = predictor.predict(
        point_coords=points,
        point_labels=labels,
        multimask_output=True,
    )
    
    print(f"✅ 检测到 {len(masks)} 个掩膜")
    for i, (mask, score) in enumerate(zip(masks, scores)):
        print(f"   掩膜 {i}: 像素数={mask.sum()}, 置信度={score:.3f}")
        
        if mask.sum() > 0:
            mask_vis = (mask * 255).astype(np.uint8)
            cv2.imwrite(str(output_dir / f"sam_hq_mask_{i}.jpg"), mask_vis)
            
            # 叠加到原图
            overlay = frame.copy()
            overlay[mask] = [0, 0, 255]  # 红色
            cv2.imwrite(str(output_dir / f"sam_hq_overlay_{i}.jpg"), overlay)
            print(f"   ✅ 已保存")
            
except Exception as e:
    print(f"❌ 错误: {e}")
    import traceback
    traceback.print_exc()

print("\n=== 测试 4: 使用全图自动分割 ===")
try:
    from segment_anything_hq import SamPredictor, build_sam_vit_b
    import torch
    
    model_path = Path.home() / ".cache" / "sam" / "sam_vit_b_01ec64.pth"
    sam = build_sam_vit_b(checkpoint=str(model_path))
    predictor = SamPredictor(sam)
    
    image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    predictor.set_image(image_rgb)
    
    # 使用 bbox 提示
    bbox = np.array([[630, 84], [689, 134]])
    masks, scores, logits = predictor.predict(
        point_coords=None,
        point_labels=None,
        box=bbox,
        multimask_output=False,
    )
    
    print(f"✅ 检测到 {len(masks)} 个掩膜")
    for i, (mask, score) in enumerate(zip(masks, scores)):
        print(f"   掩膜 {i}: 像素数={mask.sum()}, 置信度={score:.3f}")
        
        if mask.sum() > 0:
            mask_vis = (mask * 255).astype(np.uint8)
            cv2.imwrite(str(output_dir / f"sam_hq_bbox_mask_{i}.jpg"), mask_vis)
            
            # 叠加到原图
            overlay = frame.copy()
            overlay[mask] = [0, 0, 255]  # 红色
            cv2.imwrite(str(output_dir / f"sam_hq_bbox_overlay_{i}.jpg"), overlay)
            print(f"   ✅ 已保存")
            
except Exception as e:
    print(f"❌ 错误: {e}")

print("\n测试完成")
