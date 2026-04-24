# -*- coding: utf-8 -*-
"""测试官方 Meta SAM 分割"""
from __future__ import annotations

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import cv2
import numpy as np

# 测试视频
video_path = Path(__file__).parent.parent / "data" / "streams" / "gal_1.mp4"
output_dir = Path(__file__).parent / "test_output"
model_path = Path(__file__).parent.parent / "models" / "sam" / "sam_vit_b.pth"

cap = cv2.VideoCapture(str(video_path))
ret, frame = cap.read()
cap.release()

print(f"图像尺寸: {frame.shape}")
print(f"模型路径: {model_path}")
print(f"模型存在: {model_path.exists()}")

# ========== 测试官方 SAM ==========
print("\n📊 测试官方 Meta SAM...")
try:
    from segment_anything import SamPredictor, sam_model_registry
    
    # 加载模型
    sam = sam_model_registry["vit_b"](checkpoint=str(model_path))
    predictor = SamPredictor(sam)
    print("✅ 模型加载成功")
    
    # 转换图像为 RGB
    image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    
    # 设置图像
    predictor.set_image(image_rgb)
    print("✅ 图像已设置")
    
    h, w = frame.shape[:2]
    
    # ========== 测试 1: 使用 YOLO bbox 进行分割 ==========
    print("\n📊 测试 bbox 提示分割...")
    
    # YOLO 检测到的 car 位置
    bbox = np.array([[630, 84], [689, 134]])
    
    masks, scores, logits = predictor.predict(
        point_coords=None,
        point_labels=None,
        box=bbox,
        multimask_output=False,
    )
    
    print(f"   检测到 {len(masks)} 个掩膜")
    for i, (mask, score) in enumerate(zip(masks, scores)):
        print(f"   掩膜 {i}: 像素数={mask.sum():,}, 置信度={score:.3f}")
        
        # 保存掩膜
        mask_vis = (mask * 255).astype(np.uint8)
        cv2.imwrite(str(output_dir / f"sam_vitb_bbox_mask_{i}.jpg"), mask_vis)
        
        # 叠加到原图
        overlay = frame.copy()
        overlay[mask] = [0, 0, 255]  # 红色
        cv2.rectangle(overlay, (630, 84), (689, 134), (0, 255, 0), 2)
        cv2.putText(overlay, f"Mask: {mask.sum():,}px", (630, 84 - 10), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
        cv2.imwrite(str(output_dir / f"sam_vitb_bbox_overlay_{i}.jpg"), overlay)
    
    # ========== 测试 2: 使用点提示 ==========
    print("\n📊 测试点提示分割...")
    point = np.array([[659, 109]])  # 自行车中心
    label = np.array([1])
    
    masks, scores, logits = predictor.predict(
        point_coords=point,
        point_labels=label,
        multimask_output=True,
    )
    
    print(f"   检测到 {len(masks)} 个掩膜")
    for i, (mask, score) in enumerate(zip(masks, scores)):
        print(f"   掩膜 {i}: 像素数={mask.sum():,}, 置信度={score:.3f}")
        
        mask_vis = (mask * 255).astype(np.uint8)
        cv2.imwrite(str(output_dir / f"sam_vitb_point_mask_{i}.jpg"), mask_vis)
        
        overlay = frame.copy()
        overlay[mask] = [0, 0, 255]
        cv2.circle(overlay, (659, 109), 5, (0, 255, 0), -1)
        cv2.imwrite(str(output_dir / f"sam_vitb_point_overlay_{i}.jpg"), overlay)
    
    # ========== 创建最终可视化 ==========
    print("\n📊 创建最终 YOLO+SAM 可视化...")
    
    # YOLO 检测
    from ultralytics import YOLO
    yolo = YOLO("yolov8n.pt")
    results = yolo(frame, conf=0.35, verbose=False)
    r = results[0]
    
    final = frame.copy()
    
    if r.boxes is not None:
        for box in r.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
            conf = float(box.conf[0].cpu().numpy())
            label = r.names[int(box.cls[0].cpu().numpy())]
            
            # 使用 SAM 分割
            sam_bbox = np.array([[x1, y1], [x2, y2]])
            masks, _, _ = predictor.predict(
                point_coords=None,
                point_labels=None,
                box=sam_bbox,
                multimask_output=False,
            )
            
            # 颜色
            color_map = {
                "car": (255, 100, 0),      # 蓝色
                "person": (0, 255, 100),   # 绿色
                "bicycle": (100, 150, 255), # 浅蓝色
                "truck": (200, 80, 0),     # 深蓝色
            }
            color = color_map.get(label, (200, 200, 100))
            
            # 叠加掩膜
            if len(masks) > 0:
                mask = masks[0]
                if mask.sum() > 50:
                    for c in range(3):
                        final[:, :, c] = np.where(mask, 
                            (final[:, :, c] * 0.5 + color[c] * 0.5).astype(np.uint8),
                            final[:, :, c])
            
            # 绘制 bbox
            cv2.rectangle(final, (x1, y1), (x2, y2), color, 3)
            
            # 标签
            cv2.rectangle(final, (x1, y1 - 25), (x1 + 80, y1), color, -1)
            cv2.putText(final, f"{label}", (x1 + 5, y1 - 8), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    
    cv2.imwrite(str(output_dir / "sam_vitb_final.jpg"), final)
    print("✅ 最终可视化已保存")
    
    print("\n✅ 官方 SAM 测试成功!")
    
except Exception as e:
    print(f"❌ 错误: {e}")
    import traceback
    traceback.print_exc()

print("\n📁 输出文件:")
for f in sorted(output_dir.glob("sam_vitb_*.jpg")):
    print(f"   {f.name}")
