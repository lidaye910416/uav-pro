# -*- coding: utf-8 -*-
"""YOLO+SAM Pipeline 详细测试脚本

测试目标检测+分割功能，验证各阶段输出成果
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

import cv2
import numpy as np

from app.analyze_pipeline_yolo import YOLOPipeline


def visualize_mask_debug(visualizer, image, mask, color, mask_idx):
    """可视化掩膜调试信息"""
    h, w = image.shape[:2]
    
    # 创建单独的掩膜可视化图
    mask_vis = np.zeros_like(image)
    if mask.shape[:2] != (h, w):
        mask_resized = cv2.resize(mask.astype(np.uint8) * 255, (w, h), interpolation=cv2.INTER_NEAREST)
    else:
        mask_resized = mask.astype(np.uint8) * 255
    
    # 为掩膜上色
    colored_mask = np.zeros_like(image)
    colored_mask[mask_resized > 0] = color
    mask_vis = colored_mask
    
    return mask_vis


def test_yolo_sam_pipeline():
    """测试 YOLO+SAM Pipeline 各阶段输出"""
    
    # 视频文件路径
    video_path = Path(__file__).parent.parent / "data" / "streams" / "gal_1.mp4"
    output_dir = Path(__file__).parent / "test_output"
    output_dir.mkdir(exist_ok=True)
    
    if not video_path.exists():
        print(f"❌ 视频文件不存在: {video_path}")
        return False
    
    print(f"📹 测试视频: {video_path}")
    print("=" * 60)
    
    # 初始化 Pipeline
    print("🔧 初始化 YOLO+SAM Pipeline...")
    pipeline = YOLOPipeline(
        model_name="yolov8n.pt",
        confidence_threshold=0.35,
        enable_sam=True,
    )
    
    if not pipeline.initialize():
        print("❌ Pipeline 初始化失败")
        return False
    
    print(f"✅ Pipeline 初始化成功")
    print(f"   - SAM 可用: {pipeline.sam_available}")
    print()
    
    # 打开视频
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"❌ 无法打开视频: {video_path}")
        return False
    
    # 测试第一帧
    frame_idx = 0
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
    ret, frame = cap.read()
    
    if not ret or frame is None:
        print(f"❌ 无法读取帧 {frame_idx}")
        return False
    
    print(f"🖼️  测试帧 {frame_idx}")
    print("=" * 60)
    
    # ==================== 阶段 1: YOLO 检测 ====================
    print("\n📊 阶段 1: YOLO 目标检测")
    print("-" * 40)
    
    detected = pipeline.detector.detect(frame)
    print(f"   检测到 {len(detected)} 个目标")
    
    for i, det in enumerate(detected):
        print(f"   [{i}] {det.label}: bbox={det.bbox}, conf={det.confidence:.2f}")
    
    # 保存 YOLO 检测结果图（仅边界框）
    yolo_only_image = frame.copy()
    for det in detected:
        x1, y1, x2, y2 = det.bbox
        color = (0, 255, 0)  # 绿色
        cv2.rectangle(yolo_only_image, (x1, y1), (x2, y2), color, 2)
        label = f"{det.label} {det.confidence:.0%}"
        cv2.putText(yolo_only_image, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
    
    yolo_path = output_dir / "stage1_yolo_detection.jpg"
    cv2.imwrite(str(yolo_path), yolo_only_image)
    print(f"   ✅ YOLO 检测图已保存: {yolo_path}")
    
    # ==================== 阶段 2: SAM 分割 ====================
    print("\n📊 阶段 2: SAM 像素级分割")
    print("-" * 40)
    
    masks = []
    if pipeline.sam_available and hasattr(pipeline, '_sam') and pipeline._sam:
        try:
            bboxes = [d.bbox for d in detected]
            masks = pipeline._sam.segment(frame, bboxes)
            print(f"   SAM 分割得到 {len(masks)} 个掩膜")
            
            for i, mask in enumerate(masks):
                print(f"   [{i}] bbox={mask.bbox}, area={mask.area:.1f}px, conf={mask.confidence:.2f}")
        except Exception as e:
            print(f"   ❌ SAM 分割失败: {e}")
    
    # 保存 SAM 分割掩膜可视化
    sam_masks_image = frame.copy()
    if masks:
        for i, mask in enumerate(masks):
            # 创建彩色掩膜
            color_map = [(255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 0), (255, 0, 255)]
            color = color_map[i % len(color_map)]
            
            h, w = frame.shape[:2]
            # 确保掩膜尺寸匹配
            if mask.mask.shape[:2] != (h, w):
                mask_resized = cv2.resize(mask.mask.astype(np.uint8) * 255, (w, h), interpolation=cv2.INTER_NEAREST)
            else:
                mask_resized = mask.mask.astype(np.uint8) * 255
            
            # 在原图上叠加掩膜
            for c in range(3):
                sam_masks_image[:, :, c] = np.where(mask_resized > 0, 
                    sam_masks_image[:, :, c] * 0.5 + color[c] * 0.5, 
                    sam_masks_image[:, :, c]).astype(np.uint8)
            
            # 绘制 bbox
            x1, y1, x2, y2 = mask.bbox
            cv2.rectangle(sam_masks_image, (x1, y1), (x2, y2), color, 2)
    
    sam_path = output_dir / "stage2_sam_segmentation.jpg"
    cv2.imwrite(str(sam_path), sam_masks_image)
    print(f"   ✅ SAM 分割图已保存: {sam_path}")
    
    # ==================== 阶段 3: 掩膜可视化合并 ====================
    print("\n📊 阶段 3: 掩膜可视化合并")
    print("-" * 40)
    
    viz_result = pipeline.visualizer.visualize(
        frame,
        detected,
        masks if masks else None,
        show_labels=True,
        show_confidence=True,
        max_display=30,
    )
    
    combined_path = output_dir / "stage3_mask_visualization.jpg"
    if viz_result.image is not None:
        cv2.imwrite(str(combined_path), viz_result.image)
        print(f"   ✅ 合并可视化图已保存: {combined_path}")
    else:
        print(f"   ❌ 合并可视化图为 None!")
    
    # 保存原始帧（对比用）
    original_path = output_dir / "original_frame.jpg"
    cv2.imwrite(str(original_path), frame)
    print(f"   📷 原始帧已保存: {original_path}")
    
    # ==================== 阶段 4: 检测摘要 ====================
    print("\n📊 阶段 4: 检测摘要（用于 Gemma Prompt）")
    print("-" * 40)
    
    tracked = pipeline.tracker.update(detected, frame)
    detection_summary = pipeline.visualizer.get_detection_summary(detected, tracked)
    print(f"   摘要: {detection_summary}")
    
    # 生成完整的 Gemma Prompt
    prompt = f"""你是一个高速公路安全预警专家，分析这张航拍图像。
    
当前画面检测摘要:
{detection_summary}

请判断是否存在以下异常: collision(碰撞), pothole(坑洞), obstacle(障碍物), parking(停车), pedestrian(行人), congestion(拥堵)"""
    
    prompt_path = output_dir / "stage4_gemma_prompt.txt"
    with open(prompt_path, "w", encoding="utf-8") as f:
        f.write(prompt)
    print(f"   ✅ Gemma Prompt 已保存: {prompt_path}")
    
    # ==================== 输出汇总 ====================
    print("\n" + "=" * 60)
    print("📁 输出文件汇总")
    print("=" * 60)
    
    files = {
        "stage1_yolo_detection.jpg": "YOLO 检测结果（仅边界框）",
        "stage2_sam_segmentation.jpg": "SAM 分割结果（掩膜叠加）",
        "stage3_mask_visualization.jpg": "合并可视化图（YOLO+SAM）",
        "original_frame.jpg": "原始帧",
        "stage4_gemma_prompt.txt": "Gemma Prompt",
    }
    
    for fname, desc in files.items():
        fpath = output_dir / fname
        if fpath.exists():
            size_kb = fpath.stat().st_size / 1024
            print(f"   ✅ {fname} ({size_kb:.1f} KB) - {desc}")
        else:
            print(f"   ❌ {fname} - 不存在")
    
    cap.release()
    
    print("\n" + "=" * 60)
    print("✅ 测试完成！")
    print("=" * 60)
    
    return True


if __name__ == "__main__":
    print()
    print("🚀 YOLO+SAM Pipeline 详细测试")
    print("=" * 60)
    print()
    
    test_yolo_sam_pipeline()
