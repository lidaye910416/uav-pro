# -*- coding: utf-8 -*-
"""完整 YOLO+SAM Pipeline 测试 - 生成 GGV4 MLLM 可视化图像和提示词"""
from __future__ import annotations

import sys
import json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from segment_anything import SamPredictor, sam_model_registry
from ultralytics import YOLO

# 路径配置
video_path = Path(__file__).parent.parent / "data" / "streams" / "MiTra" / "T1_D2.mp4"
output_dir = Path(__file__).parent.parent / "tests" / "test_output"
sam_model_path = Path(__file__).parent.parent / "models" / "sam" / "sam_vit_b.pth"
yolo_model_path = Path(__file__).parent.parent / "yolov8n.pt"

# 车辆相关类别（YOLO COCO 类别中与交通相关的）
VEHICLE_CLASSES = {2: 'car', 3: 'motorcycle', 5: 'bus', 7: 'truck'}
PERSON_CLASS = 0
ALL_TARGET_CLASSES = [0, 2, 3, 5, 7]  # person, car, motorcycle, bus, truck

output_dir.mkdir(exist_ok=True)
(output_dir / "结果照片").mkdir(exist_ok=True)

print("=" * 60)
print("🚀 YOLO + Meta SAM + Gemma Prompt 完整 Pipeline 测试")
print("=" * 60)

# ========== 中文字体配置 ==========
def get_chinese_font(size=20):
    """获取中文字体"""
    font_paths = [
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/Users/jasonlee/Library/Fonts/HarmonyOS_Sans_SC_Regular.ttf",
        "/System/Library/Fonts/Supplemental/Songti.ttc",
    ]
    for fp in font_paths:
        if Path(fp).exists():
            try:
                return ImageFont.truetype(fp, size)
            except:
                continue
    # 回退到默认字体
    return ImageFont.load_default()

# ========== 1. 加载模型 ==========
print("\n📦 加载模型...")

sam = sam_model_registry["vit_b"](checkpoint=str(sam_model_path))
predictor = SamPredictor(sam)
print("   ✅ Meta SAM ViT-B 加载成功")

yolo = YOLO(str(yolo_model_path))
print("   ✅ YOLOv8n 加载成功")

# ========== 2. 读取视频帧（提取多个帧进行测试） ==========
print("\n📹 读取视频帧...")
cap = cv2.VideoCapture(str(video_path))

if not cap.isOpened():
    print("❌ 无法打开视频")
    sys.exit(1)

total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
fps = cap.get(cv2.CAP_PROP_FPS)
print(f"   视频信息: {total_frames} 帧, FPS: {fps}")

# 提取多个帧进行测试
test_frames = []
# 从视频不同位置提取帧
frame_positions = [0, total_frames // 4, total_frames // 2, total_frames * 3 // 4, total_frames - 1]

for pos in frame_positions:
    cap.set(cv2.CAP_PROP_POS_FRAMES, pos)
    ret, frame = cap.read()
    if ret:
        test_frames.append((pos, frame))
        print(f"   提取帧 {pos} 成功，尺寸: {frame.shape}")

cap.release()

if not test_frames:
    print("❌ 无法读取视频帧")
    sys.exit(1)

# 使用第一个有内容的帧
frame = test_frames[0][1]
print(f"   使用帧 {test_frames[0][0]} 进行检测，图像尺寸: {frame.shape}")
cv2.imwrite(str(output_dir / "结果照片" / "original_frame.jpg"), frame)

# ========== 3. YOLO 检测（多帧 + 图像预处理） ==========
print("\n🔍 YOLO 目标检测...")
print("   策略：缩小图像 + 只检测车辆/行人类别 + 降低阈值")

all_detections = []

for frame_idx, (pos, f) in enumerate(test_frames):
    print(f"\n   --- 测试帧 {frame_idx + 1} (位置: {pos}) ---")

    # 保存原始帧
    cv2.imwrite(str(output_dir / "结果照片" / f"test_frame_{frame_idx}_pos{pos}.jpg"), f)

    # 尝试多种图像尺寸
    best_frame_detections = []
    for scale in [0.5, 0.25]:  # 先尝试缩小到 50%，再尝试 25%
        h, w = f.shape[:2]
        new_w, new_h = int(w * scale), int(h * scale)
        f_scaled = cv2.resize(f, (new_w, new_h))

        results = yolo(f_scaled, conf=0.15, verbose=False)  # 降低置信度到 0.15
        r = results[0]

        if r.boxes is not None:
            for box in r.boxes:
                cls_id = int(box.cls[0].cpu().numpy())

                # 只保留车辆和行人类别
                if cls_id not in ALL_TARGET_CLASSES:
                    continue

                x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
                conf = float(box.conf[0].cpu().numpy())
                label = r.names[cls_id]

                # 坐标映射回原图
                x1_orig, y1_orig = int(x1 / scale), int(y1 / scale)
                x2_orig, y2_orig = int(x2 / scale), int(y2 / scale)

                best_frame_detections.append({
                    "bbox": (x1_orig, y1_orig, x2_orig, y2_orig),
                    "conf": conf,
                    "label": label,
                    "frame_pos": pos,
                    "scale": scale
                })
                print(f"   [{label}] scale={scale:.0%}, bbox=({x1_orig},{y1_orig},{x2_orig},{y2_orig}), conf={conf:.2f}")

    if best_frame_detections:
        print(f"   ✅ 在 scale={best_frame_detections[0]['scale']:.0%} 下检测到 {len(best_frame_detections)} 个目标")
        # 保存检测结果
        vis = f.copy()
        for det in best_frame_detections:
            x1, y1, x2, y2 = det["bbox"]
            cv2.rectangle(vis, (x1, y1), (x2, y2), (0, 255, 0), 3)
            cv2.putText(vis, f"{det['label']} {det['conf']:.0%}", (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 255, 0), 3)
        cv2.imwrite(str(output_dir / "结果照片" / f"test_frame_{frame_idx}_detected.jpg"), vis)
    else:
        print("   ❌ 未检测到车辆/行人")

    all_detections.extend(best_frame_detections)

# 使用第一个有检测结果的帧，如果没有则用第一帧
if all_detections:
    first_det_frame = all_detections[0]['frame_pos']
    detections = [d for d in all_detections if d['frame_pos'] == first_det_frame]
    print(f"\n   📌 使用帧位置 {first_det_frame} 的检测结果，共 {len(detections)} 个目标")
else:
    detections = []
    print("\n   ⚠️ 没有检测到任何车辆/行人，使用原始帧")

# 保存 YOLO 检测结果
yolo_vis = frame.copy()
for det in detections:
    x1, y1, x2, y2 = det["bbox"]
    cv2.rectangle(yolo_vis, (x1, y1), (x2, y2), (0, 255, 0), 2)
    cv2.putText(yolo_vis, f"{det['label']} {det['conf']:.0%}", (x1, y1 - 5),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
cv2.imwrite(str(output_dir / "结果照片" / "stage1_yolo_detection.jpg"), yolo_vis)
print(f"   ✅ YOLO 检测图已保存")

# ========== 4. SAM 分割 ==========
print("\n✂️ Meta SAM 像素级分割...")
image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
predictor.set_image(image_rgb)

masks_data = []
for det in detections:
    x1, y1, x2, y2 = det["bbox"]
    input_box = np.array([[x1, y1], [x2, y2]])
    
    masks, scores, _ = predictor.predict(
        point_coords=None,
        point_labels=None,
        box=input_box,
        multimask_output=False,
    )
    
    mask = masks[0]
    masks_data.append({
        "det": det,
        "mask": mask,
        "score": scores[0] if len(scores) > 0 else 0.5
    })
    print(f"   [{det['label']}] 掩膜像素数: {mask.sum():,}, 置信度: {scores[0]:.3f}")

# 保存 SAM 分割结果
sam_vis = frame.copy()
for item in masks_data:
    det = item["det"]
    mask = item["mask"]
    x1, y1, x2, y2 = det["bbox"]
    sam_vis[mask] = [0, 0, 255]
    cv2.rectangle(sam_vis, (x1, y1), (x2, y2), (0, 255, 0), 2)

cv2.imwrite(str(output_dir / "结果照片" / "stage2_sam_segmentation.jpg"), sam_vis)
print(f"   ✅ SAM 分割图已保存")

# ========== 5. YOLO+SAM 合并可视化（使用 PIL 支持中文）==========
print("\n🎨 创建 YOLO+SAM 合并可视化图...")

# ========== 颜色配置（BGR 格式）==========
MASK_COLORS_BGR = {
    "person": (0, 255, 0),           # 绿色
    "car": (255, 100, 0),            # 蓝色
    "truck": (255, 100, 0),          # 蓝色
    "bus": (255, 100, 0),            # 蓝色
    "bicycle": (100, 150, 255),       # 浅蓝色
    "motorcycle": (100, 150, 255),    # 浅蓝色
    "default": (200, 200, 100),      # 黄绿色
}

MASK_COLORS_DISPLAY = {
    "person": ("绿色", (0, 255, 0)),
    "car": ("蓝色", (255, 100, 0)),
    "truck": ("蓝色", (255, 100, 0)),
    "bus": ("蓝色", (255, 100, 0)),
    "bicycle": ("浅蓝色", (100, 150, 255)),
    "motorcycle": ("浅蓝色", (100, 150, 255)),
    "default": ("黄绿色", (200, 200, 100)),
}

def get_mask_color(label: str) -> tuple:
    return MASK_COLORS_BGR.get(label.lower(), MASK_COLORS_BGR["default"])

def get_color_display_name(label: str) -> str:
    display = MASK_COLORS_DISPLAY.get(label.lower(), MASK_COLORS_DISPLAY["default"])
    return display[0]

# 使用 PIL 创建图像（支持中文）
# 先用 OpenCV 创建底图
combined = frame.copy()

for item in masks_data:
    det = item["det"]
    mask = item["mask"]
    x1, y1, x2, y2 = det["bbox"]
    color = get_mask_color(det["label"])
    
    # 叠加半透明掩膜
    if mask.sum() > 50:
        for c in range(3):
            combined[:, :, c] = np.where(mask, 
                (combined[:, :, c] * 0.5 + color[c] * 0.5).astype(np.uint8),
                combined[:, :, c])
    
    # 绘制加粗边框
    cv2.rectangle(combined, (x1, y1), (x2, y2), color, 3)
    
    # 绘制角标
    corner_length = 10
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
    (tw, th), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
    cv2.rectangle(combined, (x1, y1 - th - 10), (x1 + tw + 10, y1), color, -1)
    cv2.putText(combined, label_text, (x1 + 5, y1 - 5),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

# 转换为 PIL Image 添加中文图例
pil_image = Image.fromarray(cv2.cvtColor(combined, cv2.COLOR_BGR2RGB))
draw = ImageDraw.Draw(pil_image)

# 获取中文字体
chinese_font = get_chinese_font(18)
small_font = get_chinese_font(14)

# 添加图例背景
legend_x, legend_y = 15, 30
draw.text((legend_x, legend_y), "图例 Color Legend:", fill=(255, 255, 255), font=chinese_font)
legend_y += 30

legend_items = [
    ("绿色", (0, 255, 0), "行人 person"),
    ("蓝色", (255, 100, 0), "车辆 car/truck/bus"),
    ("浅蓝色", (100, 150, 255), "自行车/摩托车"),
    ("黄绿色", (200, 200, 100), "其他目标"),
]

for color_name, color_rgb, desc in legend_items:
    # 绘制颜色方块
    draw.rectangle([(legend_x, legend_y - 14), (legend_x + 25, legend_y + 6)], fill=color_rgb, outline=(255, 255, 255))
    # 绘制说明文字
    text = f"{color_name} → {desc}"
    draw.text((legend_x + 30, legend_y - 12), text, fill=(255, 255, 255), font=small_font)
    legend_y += 26

# 添加标题
title = "YOLO+SAM 分割结果"
draw.text((pil_image.width - 200, 20), title, fill=(255, 184, 0), font=chinese_font)

# 转换回 OpenCV 格式并保存
final_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
cv2.imwrite(str(output_dir / "结果照片" / "stage3_combined_for_gemma.jpg"), final_image)
print(f"   ✅ YOLO+SAM 合并图已保存")

# ========== 6. 生成 GGV4 Prompt ==========
print("\n📝 生成 GGV4 MLLM Prompt...")

# 构建颜色图例说明
color_legend_lines = []
for color_name, _, desc in legend_items:
    color_legend_lines.append(f"- {color_name}掩膜 → {desc}")

color_legend_text = "\n".join(color_legend_lines)

# 构建检测摘要
detection_summary_lines = []
for det in detections:
    color_name = get_color_display_name(det["label"])
    detection_summary_lines.append(
        f"- {det['label']}（{color_name}掩膜，置信度 {det['conf']:.0%}）"
    )

# 构建掩膜描述
mask_descriptions_lines = []
for item in masks_data:
    det = item["det"]
    mask = item["mask"]
    color_name = get_color_display_name(det["label"])
    mask_descriptions_lines.append(
        f"  - {det['label']}: {color_name}掩膜 {mask.sum():,} 像素, SAM置信度 {item['score']:.1%}"
    )

prompt = f"""请分析这张航拍图像，判断是否存在以下6类道路异常之一：

【异常类型定义】
1. collision - 交通事故/碰撞（车辆聚集、变形、散落物）
2. pothole - 路面塌陷/坑洞（路面凹陷、颜色变暗）
3. obstacle - 道路障碍物（落石、遗撒物）
4. parking - 异常停车（应急车道停车）
5. pedestrian - 行人闯入（人形出现在非正常区域）
6. congestion - 交通拥堵（车辆密集、排队）

【图像中SAM分割掩膜颜色图例】
{color_legend_text}

【当前画面检测摘要】
- 检测到 {len(detections)} 个目标：
{chr(10).join(detection_summary_lines)}

【SAM分割详细信息】
{chr(10).join(mask_descriptions_lines)}

【输出要求】
请按JSON格式输出（只输出JSON，不要其他内容）：
{{
    "has_incident": true/false,
    "incident_type": "collision/pothole/obstacle/parking/pedestrian/congestion/none",
    "confidence": 0.0-1.0,
    "description": "描述发现的情况（50字内）",
    "recommendation": "处置建议（30字内）"
}}

请用中文回答。"""

# 保存 Prompt
prompt_path = output_dir / "结果照片" / "stage4_gemma_prompt.txt"
with open(prompt_path, "w", encoding="utf-8") as f:
    f.write(prompt)

print(f"   ✅ Prompt 已保存")

# ========== 7. 保存 JSON 结果 ==========
detection_result = {
    "frame_info": {
        "width": frame.shape[1],
        "height": frame.shape[0],
        "total_detections": len(detections),
    },
    "color_legend": {
        "绿色": "行人 person",
        "蓝色": "车辆 car/truck/bus",
        "浅蓝色": "自行车/摩托车",
        "黄绿色": "其他目标",
    },
    "detections": detections,
    "masks": [
        {
            "label": item["det"]["label"],
            "color_name": get_color_display_name(item["det"]["label"]),
            "pixel_count": int(item["mask"].sum()),
            "confidence": float(item["score"])
        }
        for item in masks_data
    ],
    "gemma_prompt": prompt
}

result_path = output_dir / "结果照片" / "detection_result.json"
with open(result_path, "w", encoding="utf-8") as f:
    json.dump(detection_result, f, ensure_ascii=False, indent=2)

print(f"   ✅ 检测结果 JSON 已保存")

# ========== 8. 输出汇总 ==========
print("\n" + "=" * 60)
print("📁 输出文件汇总")
print("=" * 60)

files = [
    ("结果照片/original_frame.jpg", "原始帧"),
    ("结果照片/stage1_yolo_detection.jpg", "YOLO 检测结果"),
    ("结果照片/stage2_sam_segmentation.jpg", "SAM 分割结果"),
    ("结果照片/stage3_combined_for_gemma.jpg", "YOLO+SAM 合并图（用于 GGV4 MLLM）"),
    ("结果照片/stage4_gemma_prompt.txt", "GGV4 MLLM Prompt"),
    ("结果照片/detection_result.json", "检测结果 JSON"),
]

for fname, desc in files:
    fpath = output_dir / fname
    if fpath.exists():
        size_kb = fpath.stat().st_size / 1024
        print(f"   ✅ {fname} ({size_kb:.1f} KB) - {desc}")

print("\n" + "=" * 60)
print("✅ 测试完成！")
print("=" * 60)
