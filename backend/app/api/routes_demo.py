# -*- coding: utf-8 -*-
"""演示接口: 视频帧提取 + 完整 pipeline (感知→识别→RAG→决策) + SSE 推送."""
from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import re
import tempfile
import time
from io import BytesIO
from pathlib import Path
from typing import Optional

import cv2
import httpx
import numpy as np
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.alert import Alert, RiskLevel, AlertStatus
from app.services.chroma_service import get_rag_context as chroma_get_rag_context, search_sops

router = APIRouter(prefix="/demo", tags=["演示"])

# ── Demo video path ──────────────────────────────────────────────────────────

# 默认使用 gal_1.mp4 (2.5MB) 作为演示视频，加载更快
DEMO_VIDEO = Path(__file__).resolve().parents[2] / "data" / "streams" / "gal_1.mp4"
DEMO_THUMBNAIL_CACHE = Path(__file__).resolve().parents[2] / "data" / "streams" / ".thumbnail_cache_gal_1.jpg"

# ── MiTra 多路视频（T1_D1.mp4 ~ T1_D6.mp4）─────────────────────────────────

MITRA_VIDEO_DIR = Path(__file__).resolve().parents[2] / "data" / "streams" / "MiTra"

# 帧图像缓存目录
FRAME_CACHE_DIR = Path(__file__).resolve().parents[2] / "data" / "frames"
FRAME_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# ── YOLO + SAM 模型（延迟加载）───────────────────────────────────────────────

_yolo_model = None
_sam_predictor = None


def _get_yolo_sam_models():
    """懒加载 YOLO 和 SAM 模型"""
    global _yolo_model, _sam_predictor

    # 获取 backend 目录路径 (__file__ 是 app/api/routes_demo.py)
    backend_dir = Path(__file__).resolve().parents[2]  # backend/
    # 模型文件实际在 backend/models/sam/ 目录下
    models_dir = backend_dir / "models" / "sam"

    if _yolo_model is None:
        try:
            from ultralytics import YOLO
            # 查找可用的 YOLO 模型
            yolo_paths = [
                models_dir / "yolov8n.pt",     # 轻量级
                backend_dir / "yolov8n.pt",    # 根目录轻量级
                backend_dir / "yolov8x-world.pt",  # world模型
            ]
            yolo_path = None
            for p in yolo_paths:
                if p.exists():
                    yolo_path = p
                    break
            if yolo_path:
                _yolo_model = YOLO(str(yolo_path))
                print(f"[YOLO] 模型加载成功: {yolo_path}")
            else:
                print(f"[YOLO] 模型文件不存在，尝试使用 ultralytics 默认模型")
                _yolo_model = YOLO("yolov8n.pt")
                print(f"[YOLO] 使用默认模型: yolov8n.pt")
        except Exception as e:
            print(f"[YOLO] 模型加载失败: {e}")
            _yolo_model = None

    # 加载 SAM 模型 - 尝试 segment-anything 库
    if _sam_predictor is None:
        sam_path = models_dir / "mobile_sam.pt"
        sam_vit_path = models_dir / "sam_vit_b.pth"

        # 方法1: 尝试使用 segment-anything 库 + mobile_sam.pt (state dict 格式)
        if sam_path.exists():
            try:
                from segment_anything import sam_model_registry, SamPredictor
                print(f"[SAM] 尝试用 segment-anything 加载: {sam_path}")
                sam = sam_model_registry["mobile_sam"](checkpoint=str(sam_path))
                sam.to("cpu")
                _sam_predictor = SamPredictor(sam)
                print(f"[SAM] segment-anything 加载成功 (mobile_sam)")
            except Exception as sam_err:
                print(f"[SAM] segment-anything mobile_sam 失败: {sam_err}")
                _sam_predictor = None
        else:
            print(f"[SAM] mobile_sam.pt 不存在: {sam_path}")

        # 方法2: 尝试使用 segment-anything 库 + sam_vit_b.pth (原始格式)
        if _sam_predictor is None and sam_vit_path.exists():
            try:
                from segment_anything import sam_model_registry, SamPredictor
                print(f"[SAM] 尝试用 segment-anything 加载: {sam_vit_path}")
                sam = sam_model_registry["vit_b"](checkpoint=str(sam_vit_path))
                sam.to("cpu")
                _sam_predictor = SamPredictor(sam)
                print(f"[SAM] segment-anything 加载成功 (vit_b)")
            except Exception as sam_err:
                print(f"[SAM] segment-anything vit_b 失败: {sam_err}")
                _sam_predictor = None

        if _sam_predictor is None:
            print(f"[SAM] 所有 SAM 模型加载失败，跳过分割")

    return _yolo_model, _sam_predictor


# 颜色配置（BGR 格式）- 与图例保持一致
MASK_COLORS_BGR = {
    "person": (0, 255, 0),           # 绿色
    "car": (255, 100, 0),            # 橙色（蓝色框）
    "truck": (0, 150, 255),          # 浅蓝色
    "bus": (200, 100, 255),          # 紫色
    "bicycle": (100, 150, 255),      # 天蓝色
    "motorcycle": (0, 200, 200),     # 青色
    "default": (200, 200, 100),      # 黄绿色
}


def _get_mask_color(label: str) -> tuple:
    return MASK_COLORS_BGR.get(label.lower(), MASK_COLORS_BGR["default"])


def _save_annotated_frame(frame_bgr, frame_idx: int, prefix: str = "demo") -> tuple[Optional[str], dict]:
    """执行 YOLO+SAM 标注并保存标注帧，返回 (访问路径, 检测结果)"""
    try:
        yolo, sam_predictor = _get_yolo_sam_models()

        # 缩小图像以节省处理时间（最大宽度 1280）
        h, w = frame_bgr.shape[:2]
        processed_frame = frame_bgr.copy()
        if w > 1280:
            scale = 1280 / w
            processed_frame = cv2.resize(processed_frame, (1280, int(h * scale)))

        # 结果字典
        result = {
            "frame_idx": frame_idx,
            "timestamp": f"{frame_idx / 30:.1f}s",  # 假设 30fps
            "resolution": f"{processed_frame.shape[1]}×{processed_frame.shape[0]}",
            "detections": "0",
            "detection_details": [],
            "mask_details": [],
            "segmentations": "0",
        }

        # 如果没有模型，返回原始帧
        if yolo is None and sam_predictor is None:
            combined_image_url = _save_raw_frame(processed_frame, frame_idx, prefix)
            return combined_image_url, result

        # Step 1: YOLO 检测
        results = yolo(processed_frame, conf=0.25, verbose=False)
        r = results[0]

        detections = []
        if r.boxes is not None:
            for box in r.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
                conf = float(box.conf[0].cpu().numpy())
                label = r.names[int(box.cls[0].cpu().numpy())]
                detections.append({
                    "bbox": [x1, y1, x2, y2],
                    "conf": conf,
                    "label": label
                })

        result["detections"] = str(len(detections))
        result["detection_details"] = [
            {
                "label": d["label"],
                "bbox": d["bbox"],
                "color": _get_color_display_name(d["label"]),
                "confidence": int(d["conf"] * 100)
            }
            for d in detections
        ]

        if not detections:
            combined_image_url = _save_raw_frame(processed_frame, frame_idx, prefix)
            return combined_image_url, result

        # Step 2: SAM 分割
        combined = processed_frame.copy()
        masks_data = []

        if sam_predictor is not None:
            # 使用 segment-anything 进行分割
            try:
                from segment_anything import SamPredictor
                if isinstance(sam_predictor, SamPredictor):
                    # segment-anything SamPredictor
                    sam_predictor.set_image(processed_frame)

                    # 对每个检测框进行分割
                    for det in detections:
                        x1, y1, x2, y2 = [int(v) for v in det["bbox"]]
                        # 使用检测框作为 prompt
                        box = np.array([x1, y1, x2, y2])

                        masks, scores, logits = sam_predictor.predict(
                            box=box,
                            multimask_output=False
                        )

                        if len(masks) > 0:
                            mask = masks[0]
                            color = _get_mask_color(det["label"])
                            masks_data.append({"det": det, "mask": mask, "score": scores[0] if len(scores) > 0 else det["conf"]})

                            # 叠加半透明掩膜（透明度提高：0.8 = 80%透明度，显示更多原图）
                            if mask.sum() > 50:
                                for c in range(3):
                                    combined[:, :, c] = np.where(
                                        mask.astype(bool),
                                        (combined[:, :, c] * 0.7 + color[c] * 0.3).astype(np.uint8),
                                        combined[:, :, c]
                                    )

                        # 绘制加粗边框
                        cv2.rectangle(combined, (x1, y1), (x2, y2), color, 3)

                    # 清除 SAM 状态
                    sam_predictor.reset_image()
                else:
                    # ultralytics YOLO 模型（回退）
                    sam_results = sam_predictor.predict(
                        processed_frame,
                        verbose=False,
                        conf=0.5,
                        show_boxes=False,
                    )
                    if sam_results and len(sam_results) > 0 and sam_results[0].masks is not None:
                        sam_masks = sam_results[0].masks.data.cpu().numpy()
                        for idx, det in enumerate(detections):
                            x1, y1, x2, y2 = [int(v) for v in det["bbox"]]
                            if idx < len(sam_masks):
                                mask = sam_masks[idx]
                                color = _get_mask_color(det["label"])
                                masks_data.append({"det": det, "mask": mask, "score": det["conf"]})

                                # 叠加半透明掩膜（透明度提高：0.8 = 80%透明度，显示更多原图）
                                if mask.sum() > 50:
                                    for c in range(3):
                                        combined[:, :, c] = np.where(
                                            mask.astype(bool),
                                            (combined[:, :, c] * 0.7 + color[c] * 0.3).astype(np.uint8),
                                            combined[:, :, c]
                                        )
                            cv2.rectangle(combined, (x1, y1), (x2, y2), color, 3)
            except Exception as sam_err:
                print(f"[SAM] 分割失败: {sam_err}")
                import traceback
                traceback.print_exc()
                # 回退：只画边框不画掩膜
                for det in detections:
                    color = _get_mask_color(det["label"])
                    x1, y1, x2, y2 = [int(v) for v in det["bbox"]]
                    cv2.rectangle(combined, (x1, y1), (x2, y2), color, 3)
        else:
            # 无 SAM 模型，只画边框
            for det in detections:
                color = _get_mask_color(det["label"])
                x1, y1, x2, y2 = [int(v) for v in det["bbox"]]
                cv2.rectangle(combined, (x1, y1), (x2, y2), color, 3)

        # 添加图例（仅显示类别名称和颜色，不显示置信度）
        combined = _add_legend(combined, detections)

        result["segmentations"] = str(len(masks_data))
        result["mask_details"] = [
            {
                "label": item["det"]["label"],
                "color": _get_color_display_name(item["det"]["label"]),
                "pixel_count": int(item["mask"].sum()),
                "confidence": round(float(item["score"]), 3)
            }
            for item in masks_data
        ]

        # 保存标注图像
        combined_image_url = _save_raw_frame(combined, frame_idx, prefix)
        return combined_image_url, result

    except Exception as e:
        print(f"[_save_annotated_frame] 标注失败: {e}")
        import traceback
        traceback.print_exc()
        return None, {"error": str(e)}


def _add_legend(combined, detections: list = None) -> np.ndarray:
    """在图像左上角添加颜色图例（基于实际检测到的类别）"""
    try:
        legend_x, legend_y = 15, 30

        # 使用 PIL 添加中文文字
        pil_image = Image.fromarray(cv2.cvtColor(combined, cv2.COLOR_BGR2RGB))
        draw = ImageDraw.Draw(pil_image)

        # 获取中文字体 - 尝试多个路径
        font = None
        font_paths = [
            "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf",  # fonts-noto-cjk
            "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
            "/app/fonts/HiraginoSansGB.ttc",  # 容器内
            "/app/fonts/Hiragino Sans GB.ttc",
            "/System/Library/Fonts/Hiragino Sans GB.ttc",  # Mac宿主机
            "/Users/jasonlee/Library/Fonts/HarmonyOS_Sans_SC_Regular.ttf",
        ]
        for fp in font_paths:
            try:
                font = ImageFont.truetype(fp, 18)
                print(f"[_add_legend] 字体加载成功: {fp}")
                break
            except Exception:
                continue

        # 类别到标签的映射（优先中文，回退英文）
        label_map = {
            "person": "Person",
            "car": "Car",
            "truck": "Truck",
            "bus": "Bus",
            "bicycle": "Bicycle",
            "motorcycle": "Motorcycle",
        }
        # 类别到颜色的映射（RGB格式，用于PIL）
        color_map = {
            "person": (0, 255, 0),       # 绿色
            "car": (0, 100, 255),        # 浅蓝色
            "truck": (255, 150, 0),      # 橙色
            "bus": (255, 100, 200),      # 紫色
            "bicycle": (150, 150, 255), # 天蓝色
            "motorcycle": (0, 200, 200), # 青色
        }

        # 根据检测到的类别动态生成图例
        if detections:
            detected_labels = set(d["label"].lower() for d in detections)
        else:
            detected_labels = set()

        # 默认显示所有可能的类别
        display_labels = detected_labels if detected_labels else list(label_map.keys())

        # 添加图例标题
        title = "Detection:"
        if font is None:
            # 使用默认字体时避免绘制文字，改用边框颜色标注
            pass
        else:
            draw.text((legend_x, legend_y), title, fill=(255, 255, 255), font=font)
        legend_y += 25

        for label in display_labels:
            if label not in label_map:
                continue
            color_rgb = color_map.get(label, (128, 128, 128))  # 灰色作为默认值
            desc = label_map.get(label, label)
            # 绘制颜色方块
            draw.rectangle([(legend_x, legend_y - 14), (legend_x + 20, legend_y + 6)], fill=color_rgb, outline=(255, 255, 255))
            # 绘制类别名称（使用默认字体，仅支持ASCII）
            if font is not None:
                draw.text((legend_x + 25, legend_y - 12), desc, fill=(255, 255, 255), font=font)
            legend_y += 22

        return cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
    except Exception as e:
        print(f"[_add_legend] 绘制失败: {e}")
        return combined


def _get_color_display_name(label: str) -> str:
    """获取颜色的中文名称（与图例和掩膜颜色一致）"""
    color_map = {
        "person": "绿色",
        "car": "浅蓝色",
        "truck": "橙色",
        "bus": "紫色",
        "bicycle": "天蓝色",
        "motorcycle": "青色",
    }
    return color_map.get(label.lower(), "黄绿色")


def _save_raw_frame(frame_bgr, frame_idx: int, prefix: str = "demo") -> Optional[str]:
    """保存原始帧到缓存目录，返回访问路径"""
    try:
        # 生成唯一文件名
        hash_id = hashlib.md5(f"{prefix}_{frame_idx}_{time.time()}".encode()).hexdigest()[:8]
        filename = f"{prefix}_{frame_idx}_{hash_id}.jpg"
        filepath = FRAME_CACHE_DIR / filename

        cv2.imwrite(str(filepath), frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return f"/api/v1/demo/frames/{filename}"
    except Exception as e:
        print(f"[_save_raw_frame] 保存失败: {e}")
        return None


MITRA_VIDEOS: list[dict] = [
    {"id": "gal_1", "label": "gal_1 · 测试视频", "filename": "gal_1.mp4", "device": "TEST-01"},
    {"id": "d1", "label": "T1-D1 · 1号机", "filename": "T1_D1.mp4", "device": "UAV-01"},
    {"id": "d2", "label": "T1-D2 · 2号机", "filename": "T1_D2.mp4", "device": "UAV-02"},
    {"id": "d3", "label": "T1-D3 · 3号机", "filename": "T1_D3.mp4", "device": "UAV-03"},
    {"id": "d4", "label": "T1-D4 · 4号机", "filename": "T1_D4.mp4", "device": "UAV-04"},
    {"id": "d5", "label": "T1-D5 · 5号机", "filename": "T1_D5.mp4", "device": "UAV-05"},
    {"id": "d6", "label": "T1-D6 · 6号机", "filename": "T1_D6.mp4", "device": "UAV-06"},
]


def _resolve_video_path(video_id: str) -> Path | None:
    """Resolve video_id → Path, supporting 'default', 'gal_1' and 'd1'-'d6'."""
    if video_id == "default":
        return DEMO_VIDEO if DEMO_VIDEO.exists() else None
    # Handle gal_1 separately (it's in the root streams directory)
    if video_id == "gal_1":
        p = Path(__file__).resolve().parents[2] / "data" / "streams" / "gal_1.mp4"
        return p if p.exists() else None
    for v in MITRA_VIDEOS:
        if v["id"] == video_id:
            p = MITRA_VIDEO_DIR / v["filename"]
            return p if p.exists() else None
    return None


def _video_info(path: Path) -> dict:
    """Extract basic video metadata."""
    if not path.exists():
        return {}
    cap = cv2.VideoCapture(str(path))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()
    return {"total": total, "fps": round(fps, 1), "width": w, "height": h, "duration_s": round(total / fps, 1) if fps else 0}


# ── GET /demo/frames/{filename} ──────────────────────────────────────────

@router.get("/frames/{filename}")
def get_annotated_frame(filename: str):
    """返回缓存的标注帧图像"""
    filepath = FRAME_CACHE_DIR / filename
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(404, "帧图像不存在")
    return StreamingResponse(
        open(filepath, "rb"),
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=300"},
    )


# ── GET /demo/thumbnail ───────────────────────────────────────────────────

@router.get("/thumbnail")
def get_demo_thumbnail():
    """从演示视频第10%帧提取缩略图，返回JPEG。首次调用生成并缓存。"""
    if DEMO_THUMBNAIL_CACHE.exists():
        return StreamingResponse(
            open(DEMO_THUMBNAIL_CACHE, "rb"),
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=3600"},
        )

    if not DEMO_VIDEO.exists():
        raise HTTPException(404, "演示视频不存在")

    cap = cv2.VideoCapture(str(DEMO_VIDEO))
    if not cap.isOpened():
        raise HTTPException(500, "无法读取视频")

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, total // 10))
    ret, frame = cap.read()
    cap.release()

    if not ret or frame is None:
        raise HTTPException(500, "无法提取帧")

    thumb = cv2.resize(frame, (640, 360))
    cv2.imwrite(str(DEMO_THUMBNAIL_CACHE), thumb, [cv2.IMWRITE_JPEG_QUALITY, 85])

    return StreamingResponse(
        open(DEMO_THUMBNAIL_CACHE, "rb"),
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=3600"},
    )


# ── GET /demo/video ──────────────────────────────────────────────────────────

@router.get("/video")
def get_demo_video(request: Request, video_id: str = "default"):
    """流式返回演示视频 MP4，支持 Range header（seek）。
    video_id: 'default'（DJI_0025_cut1）或 'd1'-'d6'（T1_D1.mp4 ~ T1_D6.mp4）
    """
    video_path = _resolve_video_path(video_id)
    if not video_path:
        raise HTTPException(404, f"视频不存在: {video_id}")
    return _stream_video(video_path, request)


@router.get("/videos")
def list_demo_videos():
    """列出所有可用的演示视频，含 metadata。"""
    return {
        "default": {
            "id": "default",
            "label": "DJI_0025 · 演示视频",
            "filename": DEMO_VIDEO.name,
            "exists": DEMO_VIDEO.exists(),
            "metadata": _video_info(DEMO_VIDEO) if DEMO_VIDEO.exists() else {},
        },
        "mitra": [
            {
                **v,
                "exists": (MITRA_VIDEO_DIR / v["filename"]).exists(),
                "metadata": _video_info(MITRA_VIDEO_DIR / v["filename"]),
            }
            for v in MITRA_VIDEOS
        ],
        "pipeline_mode": settings.PIPELINE_MODE,
    }


def _stream_video(video_path: Path, request: Request):
    """Shared MP4 streaming logic (Range header support)."""
    file_size = video_path.stat().st_size
    range_header = request.headers.get("range")
    if range_header:
        m = re.match(r"bytes=(\d+)-(\d*)", range_header)
        if m:
            start = int(m.group(1))
            end = int(m.group(2)) if m.group(2) else file_size - 1
        else:
            start, end = 0, file_size - 1
    else:
        start, end = 0, file_size - 1
    length = end - start + 1

    def _gen():
        with open(video_path, "rb") as f:
            f.seek(start)
            remaining = length
            while remaining > 0:
                chunk = f.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    return StreamingResponse(
        _gen(),
        media_type="video/mp4",
        status_code=206 if range_header else 200,
        headers=(
            {
                "Accept-Ranges": "bytes",
                "Content-Length": str(length),
                "Content-Range": f"bytes {start}-{end}/{file_size}",
            }
            if range_header
            else {"Content-Length": str(file_size)}
        ),
    )



# ── Seed data (fallback when Ollama unavailable) ───────────────────────────────

SEED_ALERTS = [
    {
        "title": "应急车道违规停车",
        "description": "车辆在京港澳高速北行方向应急车道内违规停靠，已持续超过3分钟",
        "risk_level": "critical",
        "scene_description": "航拍俯视视角，可见一辆白色轿车停靠在高速公路应急车道内，未开启双闪灯",
        "recommendation": "立即通知高速交警处置，记录车牌信息，配合现场疏导",
        "confidence": 0.94,
    },
    {
        "title": "道路遗撒物检测",
        "description": "行车道内发现不明遗撒物，影响车辆正常通行",
        "risk_level": "high",
        "scene_description": "主车道中央位置有明显异物，呈深色，面积约0.5平方米",
        "recommendation": "通知路政部门清理，同步更新路况信息提醒车辆注意避让",
        "confidence": 0.88,
    },
    {
        "title": "车辆异常停滞",
        "description": "车辆在正常行驶过程中突然减速停滞，可能存在故障或事故",
        "risk_level": "high",
        "scene_description": "车辆速度骤降，当前车速0km/h，占据中间车道",
        "recommendation": "后台跟踪3分钟，如持续停滞则上报交通事故预警",
        "confidence": 0.82,
    },
    {
        "title": "行人闯入高速公路",
        "description": "有行人在高速公路行车道内行走，存在严重安全隐患",
        "risk_level": "medium",
        "scene_description": "航拍画面中可见一人在应急车道行走，未穿戴反光衣",
        "recommendation": "立即通知高速交警和路政部门处理，防止事故发生",
        "confidence": 0.79,
    },
    {
        "title": "交通拥堵预警",
        "description": "多辆车速度持续低于30km/h，拥堵趋势明显",
        "risk_level": "low",
        "scene_description": "路面车辆密度显著增加，平均车速下降至25km/h以下",
        "recommendation": "持续监控，必要时触发交通诱导和信息发布",
        "confidence": 0.91,
    },
]


# ── Pipeline helpers ──────────────────────────────────────────────────────────

async def _check_ollama() -> dict:
    """Detect available models and return their config based on pipeline mode."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            r.raise_for_status()
            models = [m["name"] for m in r.json().get("models", [])]

        mode = settings.PIPELINE_MODE
        result = {
            "mode": mode,
            "gemma4": None,
            "vision": None,
            "decision": None,
        }

        if mode == "single":
            # Gemma 4 E2B handles both vision + decision
            gemma_candidates = ["gemma4-e2b", "gemma-4-e2b", "gemma4:e2b"]
            result["gemma4"] = next((m for m in gemma_candidates if m in models), None)
        else:
            # Dual mode: llava for vision, deepseek for decision
            vision_candidates = ["llava:7b", "llava:13b", "moondream2", "llava"]
            decision_candidates = ["deepseek-r1:1.5b", "deepseek-r1:8b", "deepseek-r1:32b"]
            result["vision"] = next((m for m in vision_candidates if m in models), None)
            result["decision"] = next((m for m in decision_candidates if m in models), None)

        return result
    except Exception:
        return {"mode": settings.PIPELINE_MODE, "gemma4": None, "vision": None, "decision": None}


def _image_to_base64(img: Image.Image) -> str:
    if img.mode != "RGB":
        img = img.convert("RGB")
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _pixel_analyze(frame_bgr) -> str:
    """Fallback: extract meaningful scene description from pixel statistics."""
    h, w = frame_bgr.shape[:2]
    total_px = h * w

    # Colour analysis
    b, g, r = [frame_bgr[:, :, c].astype(float) for c in range(3)]

    green_ratio = (g > r * 1.1).sum() / total_px          # vegetation
    gray_ratio  = ((abs(r - g) < 20) & (abs(g - b) < 20)).sum() / total_px  # road/sky
    road_ratio  = ((abs(r - b) < 30) & (r > 60) & (g > 60) & (b < 80)).sum() / total_px  # asphalt

    blue_ratio  = (b > r * 1.15).sum() / total_px          # sky / water
    bright_ratio = (r > 180).sum() / total_px               # bright (buildings/vehicles)

    # Detect horizontal structure (lane markings)
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    h_lines = (edges.sum(axis=1) > edges.shape[1] * 0.15).sum()  # horizontal edges

    # Object detection via contour area (vehicles = small distinct blobs)
    blurred = cv2.GaussianBlur(gray, (7, 7), 0)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    small_blobs = [c for c in contours if 50 < cv2.contourArea(c) < 2000]
    large_blobs = [c for c in contours if cv2.contourArea(c) >= 2000]

    # Bright spots (vehicle rooftops / lane markings)
    bright_spots = (gray > 180).sum() / total_px

    # Compose description
    scene_type = "高速公路" if h_lines > 30 else "普通道路" if h_lines > 10 else "停车场或一般区域"
    if green_ratio > 0.4:
        scene_type = "绿化带环绕的" + scene_type
    if blue_ratio > 0.3:
        scene_type += "（含开阔天空区域）"

    vehicle_est = len(small_blobs)
    abnormal = len(large_blobs) > 3

    parts = [f"航拍俯视{scene_type}图像，分辨率{w}×{h}。"]
    parts.append(f"检测到约{vehicle_est}个小型车辆大小的物体。")
    if vehicle_est > 10:
        parts.append("车道内车辆较多，车流较密集。")
    elif vehicle_est > 5:
        parts.append("部分车道有车辆通行。")
    else:
        parts.append("车辆稀少或无车辆通行。")
    if abnormal:
        parts.append("存在较大面积异常物体，需要关注。")
    if bright_spots > 0.05:
        parts.append("图像中包含较明亮区域（可能为车辆金属反光或道路标线）。")
    parts.append("未检测到明显的行人或非机动车。")
    return " ".join(parts)


async def _vision_describe(frame_bgr, model: str | None, timeout: float) -> str:
    """Send a frame to vision model if available, otherwise use pixel analysis fallback."""
    if model:
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(frame_rgb)
        img_b64 = _image_to_base64(pil_img)
        payload = {
            "model": model,
            "messages": [{
                "role": "user",
                "content": (
                    "你是一个高速公路安全监控专家。请详细描述这张航拍图像："
                    "1. 场景类型（高速公路/停车场/普通道路）"
                    "2. 可见的车辆、行人、障碍物或其他物体"
                    "3. 任何异常情况，如：违规停车、道路遗撒、交通事故、行人闯入等"
                    "请用中文回答。"
                ),
                "images": [img_b64],
            }],
            "stream": False,
        }
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                r = await client.post(f"{settings.OLLAMA_BASE_URL}/api/chat", json=payload)
                r.raise_for_status()
                result = r.json().get("message", {}).get("content", "").strip()
                if result:
                    return result
        except Exception:
            pass
    # Fallback: pixel-based analysis
    return _pixel_analyze(frame_bgr)


async def _gemma4_analyze(frame_bgr, model: str, rag_context: str, timeout: float, yolo_detections: list = None) -> dict:
    """Single-model pipeline: Gemma 4 E2B handles vision + decision in one shot.

    Returns dict with keys: scene_description, decision (AlertDecision fields).
    Optimized prompt to leverage YOLO detection results and scene context.
    """
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(frame_rgb)
    img_b64 = _image_to_base64(pil_img)

    # 构建检测结果摘要（用于增强提示词）
    detection_summary = ""
    if yolo_detections:
        categories = {}
        for det in yolo_detections:
            label = det.get('label', 'unknown')
            categories[label] = categories.get(label, 0) + 1
        if categories:
            parts = [f"{label} {count}个" for label, count in sorted(categories.items())]
            detection_summary = f"【YOLO检测摘要】检测到：{', '.join(parts)}。"

    system_prompt = f"""你是高速公路航拍图像安全分析专家。根据监控画面中的视觉特征和SOP知识库，判断是否存在以下5类事件：

- collision: 车辆碰撞/追尾
- pothole: 道路坑洼
- obstacle: 障碍物/遗撒
- pedestrian: 行人异常
- congestion: 交通拥堵
- none: 无异常

【静态帧分析约束】
你只能分析当前帧的静态信息，无法判断时序状态（如车辆是否静止、移动方向）。

{detection_summary}

【处置规范】（必须遵循）
{rag_context if rag_context else '（无相关规范，请自行判断）'}

【输出要求 - 严格JSON格式】
{{
  "has_event": true或false,
  "incident_type": "collision/pothole/obstacle/pedestrian/congestion/none",
  "severity": "high/mid/low/none",
  "confidence": 0-100,
  "scene_description": "场景描述（50字内）",
  "description": "简洁描述观察到的具体情况",
  "recommended_response": "针对当前情况的处置建议"
}}

注意事项：
1. 仅基于图像中的实际视觉特征判断，不要推测画面外的情况
2. severity需要根据视觉特征的严重程度合理判断
3. description应具体描述视觉特征（如"车辆A的车头与车辆B的车尾相撞"）
4. confidence表示判断的确信程度，视觉越清晰越高"""

    user_prompt = f"""请分析这张航拍图像，基于静态视觉特征判断是否存在交通安全异常。

【分析重点】
1. 观察整体场景类型（直道/弯道/立交/收费站）
2. 检查车辆位置是否正常（是否压线/骑车道/停在应急车道）
3. 观察是否有异常聚集、静止不动的车辆
4. 检查路面是否有坑洞、遗撒物、积水
5. 是否有行人或非机动车在非允许区域

请结合SOP处置规范给出判断，直接输出JSON结果。"""

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt, "images": [img_b64]},
        ],
        "stream": False,
    }
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(f"{settings.OLLAMA_BASE_URL}/api/chat", json=payload)
            r.raise_for_status()
            raw = r.json().get("message", {}).get("content", "").strip()

        # 改进的 JSON 解析：多层清理
        import re as _re

        # 1. 移除 markdown 代码块标记
        clean_raw = raw.replace('```json', '').replace('```', '').strip()

        # 2. 查找 JSON 对象
        start = clean_raw.find("{")
        end = clean_raw.rfind("}") + 1

        if start != -1 and end > start:
            json_str = clean_raw[start:end]
            try:
                result = json.loads(json_str)
                # 验证必需字段
                if result.get("incident_type") and result.get("severity"):
                    # 规范化字段名（兼容新旧格式）
                    has_event = result.get("has_event", result.get("should_alert", False))
                    incident_type = result.get("incident_type", "none")
                    severity = str(result.get("severity", "low")).lower()

                    # 规范化 severity
                    if severity not in ["high", "mid", "low", "none"]:
                        severity = "low"

                    # 规范化 confidence
                    conf = float(result.get("confidence", 50))
                    conf = max(0, min(100, conf))

                    return {
                        "has_event": bool(has_event),
                        "incident_type": incident_type,
                        "severity": severity,
                        "confidence": conf,
                        "scene_description": result.get("scene_description", ""),
                        "description": result.get("description", ""),
                        "recommended_response": result.get("recommended_response", result.get("recommendation", "")),
                    }
            except (json.JSONDecodeError, ValueError) as e:
                pass

        # 3. 回退：尝试单行 JSON
        try:
            single_line = _re.sub(r'\s+', ' ', clean_raw)
            result = json.loads(single_line)
            if result.get("incident_type"):
                return result
        except:
            pass

        # 4. 最后回退：使用原始文本前100字符
        fallback_desc = raw[:100].strip() if raw else "分析失败"
        return {
            "has_event": False,
            "incident_type": "none",
            "severity": "none",
            "confidence": 50,
            "scene_description": "场景正常，无异常事件",
            "description": fallback_desc,
            "recommended_response": "持续监控，暂无预警处置建议。",
        }
    except Exception:
        return {
            "scene_description": "分析失败",
            "should_alert": False,
            "risk_level": "low",
            "title": "分析异常",
            "description": "AI 分析服务暂时不可用",
            "recommendation": "请检查系统状态",
            "confidence": 0.0,
        }


async def _decision_decide(scene_desc: str, rag_context: str, model: str, timeout: float) -> dict | None:
    """Call decision LLM with scene description + RAG context."""
    import re as _re

    system_prompt = (
        "你是一个高速公路安全预警专家。根据场景描述和处置规范，严格按JSON格式输出，不要添加任何解释。"
    )
    user_prompt = f"""场景描述：
{scene_desc}

相关处置规范：
{rag_context if rag_context else "（无相关规范，请自行判断）"}

请以JSON格式输出（仅输出JSON，不要任何其他文字）：
{{"should_alert":true或false,"risk_level":"low或medium或high或critical","title":"10字内标题","description":"30字内描述","recommendation":"40字内建议","confidence":0.0-1.0}}"""

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "stream": False,
    }
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(f"{settings.OLLAMA_BASE_URL}/api/chat", json=payload)
            r.raise_for_status()
            raw = r.json().get("message", {}).get("content", "").strip()

        # Try to extract JSON: find first { to last } (handles nested braces)
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start != -1 and end > start:
            try:
                return json.loads(raw[start:end])
            except json.JSONDecodeError:
                pass

        # Fallback: stricter single-level match
        json_match = _re.search(r"\{[^{}]*\}", raw, _re.DOTALL)
        if json_match:
            return json.loads(json_match.group())

        return json.loads(raw)
    except Exception:
        return None


def _extract_demo_frames(video_path: Path, count: int = 5) -> list[tuple[int, str]]:
    """Extract `count` evenly-spaced frames from video, return [(frame_idx, temp_path)]."""
    if not video_path.exists():
        return []
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return []
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    cap.release()
    if total <= 0 or fps <= 0:
        return []

    interval = total // count
    frames: list[tuple[int, str]] = []
    for i in range(count):
        frame_idx = i * interval
        cap = cv2.VideoCapture(str(video_path))
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        cap.release()
        if not ret:
            continue
        tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
        cv2.imwrite(tmp.name, frame)
        frames.append((frame_idx, tmp.name))
    return frames


async def _summarize_description(scene_desc: str, model: str | None, timeout: float) -> str:
    """将场景描述总结为40-60字摘要。"""
    if not scene_desc or not model:
        return scene_desc[:60] if scene_desc else "场景描述为空"

    system_prompt = "你是一个高速公路安全监控助手。请严格按要求输出。"
    user_prompt = f"""请将以下航拍场景描述总结为40-60字的中文摘要，保留关键信息（如场景类型、异常情况）：
{scene_desc}
直接输出摘要，不要添加解释，不要加引号。"""

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "stream": False,
    }
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(f"{settings.OLLAMA_BASE_URL}/api/chat", json=payload)
            r.raise_for_status()
            raw = r.json().get("message", {}).get("content", "").strip()
            if raw:
                return raw[:80]
    except Exception:
        pass
    return scene_desc[:60]


# ── GET /demo/seed ───────────────────────────────────────────────────────────

@router.get("/seed")
async def seed_demo_data() -> dict:
    """向数据库插入5条多样例预警数据（无需认证）."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Alert).where(Alert.title.in_([a["title"] for a in SEED_ALERTS]))
        )
        existing = result.scalars().all()
        if existing:
            return {
                "ok": True,
                "count": len(existing),
                "message": "样例数据已存在",
                "alerts": [
                    {
                        "id": a.id,
                        "title": a.title,
                        "risk_level": a.risk_level.value if hasattr(a.risk_level, "value") else a.risk_level,
                    }
                    for a in existing
                ],
            }

        created: list[Alert] = []
        for alert_data in SEED_ALERTS:
            alert = Alert(
                title=alert_data["title"],
                description=alert_data["description"],
                risk_level=RiskLevel(alert_data["risk_level"]),
                status=AlertStatus.PENDING,
                scene_description=alert_data["scene_description"],
                recommendation=alert_data["recommendation"],
                confidence=alert_data["confidence"],
                source_type="demo",
                source_path=None,
            )
            session.add(alert)
            created.append(alert)

        await session.commit()
        for alert in created:
            await session.refresh(alert)

        return {
            "ok": True,
            "count": len(created),
            "message": f"成功插入 {len(created)} 条样例预警",
            "alerts": [
                {
                    "id": alert.id,
                    "title": alert.title,
                    "risk_level": alert.risk_level.value if hasattr(alert.risk_level, "value") else alert.risk_level,
                }
                for alert in created
            ],
        }


# ── 预警入库辅助函数 ────────────────────────────────────────────────────────────

async def _save_alert_to_db(alert_data: dict) -> int | None:
    """将预警数据保存到数据库，返回 Alert ID"""
    try:
        async with AsyncSessionLocal() as session:
            # 转换 risk_level 字符串到枚举
            risk_str = str(alert_data.get("risk_level", "low")).lower()
            if risk_str not in ["low", "medium", "high", "critical"]:
                risk_str = "low"
            risk = RiskLevel(risk_str)

            alert = Alert(
                title=alert_data.get("title", "未知预警"),
                description=alert_data.get("description", ""),
                risk_level=risk,
                status=AlertStatus.PENDING,
                scene_description=alert_data.get("scene_description"),
                recommendation=alert_data.get("recommendation"),
                confidence=alert_data.get("confidence"),
                source_type=alert_data.get("source_type", "video"),
                source_path=alert_data.get("source_path"),
                pipeline_mode=alert_data.get("pipeline_mode", "single"),
            )
            session.add(alert)
            await session.commit()
            await session.refresh(alert)
            print(f"[_save_alert_to_db] 预警已保存: ID={alert.id}, title={alert.title}")
            return alert.id
    except Exception as e:
        print(f"[_save_alert_to_db] 保存预警失败: {e}")
        import traceback
        traceback.print_exc()
        return None


# ── SSE 演示流 ────────────────────────────────────────────────────────────────

async def _demo_sse_stream(loop: bool = False) -> list[bytes]:
    """Build list of SSE-encoded bytes events for the stream.

    Args:
        loop: 是否循环运行（默认 False）

    使用 YOLO+SAM 进行目标检测和分割，无需 Ollama 模型。
    Falls back to seed data when video unavailable.
    """
    events: list[bytes] = []
    video_path = DEMO_VIDEO

    # Pre-computed scene descriptions
    DJI_FRAME_SCENES = [
        (
            "航拍俯视高速公路主干道，分辨率3840×2160。检测到约520个小型车辆物体。"
            "车道内车辆密集，多辆车正常行驶，应急车道空旷。"
            "主路通行正常，无拥堵，无行人，未检测到异常物体。"
        ),
        (
            "航拍俯视高速公路立交桥区域，分辨率3840×2160。"
            "应急车道内有一辆养护施工车辆停靠，车旁有两名穿反光衣的施工人员。"
            "施工区域已放置锥形标和警示灯。主路车辆正常通行。"
        ),
        (
            "航拍俯视高速公路弯道区域，分辨率3840×2160。"
            "检测到约680个小型车辆物体。车流密集，部分车辆间距较近。"
            "主路外侧车道有一辆白色轿车停靠，未开启双闪灯，人员已撤离至护栏外。"
        ),
    ]

    # 只要视频存在就运行 YOLO+SAM
    if video_path.exists():
        frames = _extract_demo_frames(video_path, count=3)
        if not frames:
            frames = None

        if frames:
            total = int(cv2.VideoCapture(str(video_path)).get(cv2.CAP_PROP_FRAME_COUNT))
            fps_v = cv2.VideoCapture(str(video_path)).get(cv2.CAP_PROP_FPS)

            for idx, (frame_idx, tmp_path) in enumerate(frames):
                frame_bgr = cv2.imread(tmp_path)
                if frame_bgr is None:
                    continue

                # Stage 1: 感知层 - YOLO+SAM 检测和标注
                events.append(f"event: stage\ndata: {json.dumps({'stage': 'perception', 'progress': idx * 33, 'status': 'running'})}\n\n".encode())

                # 执行 YOLO+SAM 标注，返回图像 URL 和检测结果
                combined_image_url, detection_result = _save_annotated_frame(frame_bgr, frame_idx, prefix="demo")

                # 发送 frame_data 事件，包含检测结果和标注图像 URL
                events.append(f"event: frame_data\ndata: {json.dumps({
                    'frame_idx': frame_idx,
                    'timestamp': f"{frame_idx / fps_v:.1f}s",
                    'resolution': detection_result.get('resolution', f"3840×2160"),
                    'fps': fps_v,
                    'stream_src': str(video_path.name),
                    'total_frames': total,
                    'detections': detection_result.get('detections', '0'),
                    'segmentations': detection_result.get('segmentations', '0'),
                    'detection_details': detection_result.get('detection_details', []),
                    'mask_details': detection_result.get('mask_details', []),
                    'combined_image_url': combined_image_url,
                })}\n\n".encode())

                # ── RAG retrieval ──────────────────────────────────────────────
                # 使用检测到的实际场景描述进行 RAG 检索
                rag_query = scene_desc if scene_desc and not scene_desc.startswith("航拍图像，检测到") else DJI_FRAME_SCENES[idx % len(DJI_FRAME_SCENES)]
                rag_context = ""
                try:
                    rag_context = chroma_get_rag_context(rag_query, top_k=3)
                except Exception as e:
                    print(f"[_demo_sse_stream] RAG retrieval failed: {e}")
                    rag_context = ""
                rag_snippets = [
                    ln.strip()
                    for ln in rag_context.split("\n")
                    if ln.strip() and not ln.strip().startswith("-")
                ]

                # ── Vision: 基于 YOLO+SAM 检测结果生成描述 ───────────────────────
                events.append(f"event: stage\ndata: {json.dumps({'stage': 'identify', 'progress': idx * 33 + 8, 'status': 'running'})}\n\n".encode())
                events.append(f"event: stage\ndata: {json.dumps({'stage': 'rag', 'progress': idx * 33 + 16, 'status': 'running'})}\n\n".encode())

                # 使用 YOLO+SAM 检测结果生成场景描述
                detection_details = detection_result.get('detection_details', [])
                mask_details = detection_result.get('mask_details', [])

                # 构建场景描述
                if detection_details:
                    car_count = sum(1 for d in detection_details if 'car' in d.get('label', '').lower())
                    person_count = sum(1 for d in detection_details if 'person' in d.get('label', '').lower())
                    truck_count = sum(1 for d in detection_details if 'truck' in d.get('label', '').lower())

                    scene_desc = f"航拍图像，检测到 {car_count} 辆汽车"
                    if truck_count > 0:
                        scene_desc += f"，{truck_count} 辆卡车"
                    if person_count > 0:
                        scene_desc += f"，{person_count} 名行人"
                    scene_desc += "。道路通行正常。"
                else:
                    scene_desc = DJI_FRAME_SCENES[idx % len(DJI_FRAME_SCENES)]

                # RAG done
                events.append(f"event: stage\ndata: {json.dumps({
                    'stage': 'rag',
                    'progress': idx * 33 + 16,
                    'status': 'done',
                    'snippets': rag_snippets,
                    'query': scene_desc[:80],
                })}\n\n".encode())

                # Vision done
                events.append(f"event: stage\ndata: {json.dumps({
                    'stage': 'identify',
                    'progress': idx * 33 + 25,
                    'status': 'done',
                    'summary': scene_desc[:60],
                    'detail': scene_desc,
                })}\n\n".encode())

                # Decision: 调用 Gemma4 进行 LLM 分析
                # 检查 Ollama 是否可用
                ollama_check = await _check_ollama()
                gemma_model = ollama_check.get("gemma4")

                # 构建 LLM 分析结果（默认正常）
                llm_result = {
                    "has_event": False,
                    "incident_type": "none",
                    "severity": "none",
                    "confidence": 85,
                    "scene_description": scene_desc,
                    "description": "道路通行正常，无异常事件",
                    "recommended_response": "持续监控，暂无预警处置建议。",
                }

                # 如果 Gemma 可用，调用 LLM 分析
                if gemma_model:
                    try:
                        # 使用 RAG 检索获取相关 SOP
                        rag_context = chroma_get_rag_context(scene_desc, top_k=3)
                        rag_snippets = [
                            ln.strip()
                            for ln in rag_context.split("\n")
                            if ln.strip() and not ln.strip().startswith("-")
                        ]

                        # 调用 Gemma4 进行图像分析
                        llm_result = await _gemma4_analyze(
                            frame_bgr,
                            model=gemma_model,
                            rag_context=rag_context,
                            timeout=90.0,
                            yolo_detections=detection_details,
                        )
                        print(f"[_demo_sse_stream] Gemma4 分析结果: {llm_result.get('incident_type')}, {llm_result.get('severity')}")
                    except Exception as e:
                        print(f"[_demo_sse_stream] Gemma4 调用失败: {e}")
                        import traceback
                        traceback.print_exc()

                # 根据 LLM 结果生成预警
                has_incident = llm_result.get("has_event", False)
                incident_type = llm_result.get("incident_type", "none")
                severity = llm_result.get("severity", "none")
                confidence = int(llm_result.get("confidence", 85))

                # 映射 severity 到 risk_level
                risk_level_map = {"high": "high", "mid": "medium", "low": "low", "none": "low"}
                risk_level = risk_level_map.get(severity, "low")

                # 生成标题
                title_map = {
                    "collision": "碰撞事故告警",
                    "pothole": "道路坑洼告警",
                    "obstacle": "障碍物告警",
                    "pedestrian": "行人异常告警",
                    "congestion": "交通拥堵告警",
                    "none": "道路通行正常",
                }
                title = title_map.get(incident_type, "道路通行正常")

                description = llm_result.get("description", scene_desc)
                recommendation = llm_result.get("recommended_response", "持续监控，暂无预警处置建议。")

                decision_result = {
                    "has_incident": has_incident,
                    "incident_type": incident_type,
                    "risk_level": risk_level,
                    "severity": severity,
                    "title": title,
                    "description": description,
                    "recommendation": recommendation,
                    "confidence": confidence,
                    "llm_analysis": llm_result,
                }

                events.append(f"event: stage\ndata: {json.dumps({
                    'stage': 'decision',
                    'progress': idx * 33 + 33,
                    'status': 'done',
                    'detail': decision_result,
                })}\n\n".encode())

                alert_payload = {
                    "id": int(time.time() * 1000) + idx,
                    "title": title,
                    "description": description,
                    "risk_level": risk_level,
                    "incident_type": incident_type,
                    "severity": severity,
                    "recommendation": recommendation,
                    "confidence": confidence,
                    "scene_description": llm_result.get("scene_description", scene_desc),
                    "source_type": "demo",
                    "source_path": str(video_path.name),
                    "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                    "detection_details": detection_details,
                }

                events.append(f"event: alert\ndata: {json.dumps(alert_payload)}\n\n".encode())
                # 保存预警到数据库
                await _save_alert_to_db(alert_payload)
                await asyncio.sleep(0.8)

    # Fallback: use seed data if video unavailable
    if not events:
        for idx, alert_data in enumerate(SEED_ALERTS):
            events.append(f"event: stage\ndata: {json.dumps({'stage': 'perception', 'progress': idx * 20})}\n\n".encode())
            events.append(f"event: stage\ndata: {json.dumps({'stage': 'identify', 'progress': idx * 20 + 5})}\n\n".encode())
            events.append(f"event: stage\ndata: {json.dumps({'stage': 'rag', 'progress': idx * 20 + 10, 'scene': alert_data.get('scene_description','')[:80]})}\n\n".encode())
            events.append(f"event: stage\ndata: {json.dumps({'stage': 'decision', 'progress': idx * 20 + 15})}\n\n".encode())
            payload = {
                "id": int(time.time() * 1000) + idx,
                **alert_data,
                "source_type": "demo",
                "source_path": str(video_path.name) if video_path.exists() else "seed",
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            }
            events.append(f"event: alert\ndata: {json.dumps(payload)}\n\n".encode())
            await asyncio.sleep(0.8)

    return events


async def _rag_retrieve(query: str, top_k: int = 3) -> str:
    """Simple RAG retrieval: search ChromaDB SOP knowledge base."""
    try:
        # 使用新的 chroma_service
        return chroma_get_rag_context(query, top_k)
    except Exception:
        return _FALLBACK_SOP


_FALLBACK_SOP = """
- 道路遗撒物处置：开启警示灯，开启双闪，摆放三角牌，通知路政清理。
- 交通事故处置：开启双闪，人员撤离，记录现场，通知交警和救援。
- 行人闯入处置：立即通知交警，防止事故发生，记录行人特征。
- 交通拥堵处置：持续监控，更新路况信息，必要时触发交通诱导。
- 道路障碍物处置：开启警示灯，摆放警示牌，通知路政或养护部门清理。
"""


@router.get("/stream")
async def demo_sse_stream(loop: bool = False) -> StreamingResponse:
    """SSE 演示流：运行完整 pipeline，每阶段推送 stage + alert 事件.

    Args:
        loop: 是否循环运行（默认 False，运行一次）
    """
    # Scene descriptions for fallback
    DJI_FRAME_SCENES = [
        (
            "航拍俯视高速公路直道区域，分辨率3840×2160。"
            "主路车道线清晰可见，主路通行正常，未检测到异常物体。"
        ),
        (
            "航拍俯视高速公路弯道区域，分辨率3840×2160。"
            "主路通行正常，无拥堵，无行人，未检测到异常物体。"
        ),
        (
            "航拍俯视高速公路立交桥区域，分辨率3840×2160。"
            "应急车道内有一辆养护施工车辆停靠，车旁有两名穿反光衣的施工人员。"
            "施工区域已放置锥形标和警示灯。主路车辆正常通行。"
        ),
        (
            "航拍俯视高速公路弯道区域，分辨率3840×2160。"
            "检测到约680个小型车辆物体。车流密集，部分车辆间距较近。"
            "主路外侧车道有一辆白色轿车停靠，未开启双闪灯，人员已撤离至护栏外。"
        ),
    ]

    video_path = DEMO_VIDEO
    if not video_path or not video_path.exists():
        # Return empty stream if no video
        async def generate():
            yield b"data: {}\n\n"
        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    frames = _extract_demo_frames(video_path, count=3)
    if not frames:
        async def generate():
            yield b"data: {}\n\n"
        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    total = int(cv2.VideoCapture(str(video_path)).get(cv2.CAP_PROP_FRAME_COUNT))
    fps_v = cv2.VideoCapture(str(video_path)).get(cv2.CAP_PROP_FPS)

    async def generate():
        for idx, (frame_idx, tmp_path) in enumerate(frames):
            frame_bgr = cv2.imread(tmp_path)
            if frame_bgr is None:
                continue

            # 计算每帧的基础进度 (0, 30, 60 for 3 frames)
            frame_base = idx * 30

            # Stage 1: 感知层 - YOLO+SAM 检测和标注
            yield f"event: stage\ndata: {json.dumps({'stage': 'perception', 'progress': frame_base + 5, 'status': 'running'})}\n\n".encode()
            await asyncio.sleep(0.05)

            # 执行 YOLO+SAM 标注，返回图像 URL 和检测结果
            combined_image_url, detection_result = _save_annotated_frame(frame_bgr, frame_idx, prefix="demo")

            # 发送 frame_data 事件，包含检测结果和标注图像 URL
            yield f"event: frame_data\ndata: {json.dumps({
                'frame_idx': frame_idx,
                'timestamp': f"{frame_idx / fps_v:.1f}s",
                'resolution': detection_result.get('resolution', f"3840×2160"),
                'fps': fps_v,
                'stream_src': str(video_path.name),
                'total_frames': total,
                'detections': detection_result.get('detections', '0'),
                'segmentations': detection_result.get('segmentations', '0'),
                'detection_details': detection_result.get('detection_details', []),
                'mask_details': detection_result.get('mask_details', []),
                'combined_image_url': combined_image_url,
            })}\n\n".encode()
            await asyncio.sleep(0.1)

            # 发送 perception done 事件，包含标注图像 URL
            yield f"event: stage\ndata: {json.dumps({
                'stage': 'perception',
                'progress': frame_base + 10,
                'status': 'done',
                'combined_image_url': combined_image_url,
            })}\n\n".encode()
            await asyncio.sleep(0.3)  # 等待前端渲染 perception 完成

            # 发送 frame_data 事件，包含检测结果和标注图像 URL
            yield f"event: frame_data\ndata: {json.dumps({
                'frame_idx': frame_idx,
                'timestamp': f"{frame_idx / fps_v:.1f}s",
                'resolution': detection_result.get('resolution', f"3840×2160"),
                'fps': fps_v,
                'stream_src': str(video_path.name),
                'total_frames': total,
                'detections': detection_result.get('detections', '0'),
                'segmentations': detection_result.get('segmentations', '0'),
                'detection_details': detection_result.get('detection_details', []),
                'mask_details': detection_result.get('mask_details', []),
                'combined_image_url': combined_image_url,
            })}\n\n".encode()
            await asyncio.sleep(0.1)

            # ── Stage 2: RAG retrieval ─────────────────────────────────────────
            # 先进行 RAG 检索，获取相关规范上下文
            yield f"event: stage\ndata: {json.dumps({'stage': 'rag', 'progress': frame_base + 15, 'status': 'running'})}\n\n".encode()
            await asyncio.sleep(0.3)  # 等待前端渲染 rag running 状态

            # 检查 Ollama 可用性
            ollama_status = await _check_ollama()
            gemma_model = ollama_status.get("gemma4") or "gemma4:e2b"

            # 构建更语义化的 RAG 查询
            detection_details = detection_result.get('detection_details', [])
            mask_details = detection_result.get('mask_details', [])

            # 根据检测结果构建语义查询
            if detection_details:
                labels = [d.get('label', '').lower() for d in detection_details]
                if 'car' in labels or 'truck' in labels:
                    rag_query = "高速公路车辆通行异常交通事件处置规范"
                elif 'person' in labels:
                    rag_query = "高速公路行人闯入道路安全异常处置规范"
                elif 'boat' in labels:
                    rag_query = "道路区域水域安全监控异常处置规范"
                else:
                    rag_query = "高速公路交通安全监控异常事件处置规范"
            else:
                rag_query = "高速公路道路通行安全监控正常状态处置流程"

            # RAG retrieval
            rag_context = ""
            try:
                rag_context = await _rag_retrieve(rag_query, top_k=3)
            except Exception:
                pass
            rag_snippets = [
                ln.strip()
                for ln in rag_context.split("\n")
                if ln.strip() and not ln.strip().startswith("-")
            ]

            # RAG done
            yield f"event: stage\ndata: {json.dumps({
                'stage': 'rag',
                'progress': frame_base + 20,
                'status': 'done',
                'snippets': rag_snippets[:3] if rag_snippets else ["（知识库检索结果）"],
                'query': rag_query[:80],
            })}\n\n".encode()
            await asyncio.sleep(0.3)  # 等待前端渲染 rag 完成

            # ── Stage 3: Gemma4 视觉理解 ─────────────────────────────────────
            yield f"event: stage\ndata: {json.dumps({'stage': 'identify', 'progress': frame_base + 30, 'status': 'running'})}\n\n".encode()
            await asyncio.sleep(0.3)  # 等待前端渲染 identify running 状态

            # 调用 Gemma4 E2B 进行视觉理解和决策
            scene_desc = DJI_FRAME_SCENES[idx % len(DJI_FRAME_SCENES)]
            has_incident = False
            risk_level = "low"
            title = "道路通行正常"
            description = scene_desc
            recommendation = "持续监控，暂无预警处置建议。"
            incident_type = "none"

            try:
                gemma_result = await _gemma4_analyze(
                    frame_bgr=frame_bgr,
                    model=gemma_model,
                    rag_context=rag_context,
                    timeout=60.0,
                    yolo_detections=detection_details
                )
                # 使用 Gemma 返回的结果
                scene_desc = gemma_result.get("scene_description", scene_desc)
                risk_level = gemma_result.get("risk_level", "low")
                title = gemma_result.get("title", "道路通行正常")
                description = gemma_result.get("description", scene_desc)
                recommendation = gemma_result.get("recommendation", "持续监控，暂无预警处置建议。")
                should_alert = gemma_result.get("should_alert", False)
                has_incident = should_alert
                if risk_level in ["high", "critical"]:
                    incident_type = "safety_alert"
                elif should_alert:
                    incident_type = "anomaly"
            except Exception as e:
                # Gemma 调用失败时使用备用描述
                if detection_details:
                    car_count = sum(1 for d in detection_details if 'car' in d.get('label', '').lower())
                    person_count = sum(1 for d in detection_details if 'person' in d.get('label', '').lower())
                    truck_count = sum(1 for d in detection_details if 'truck' in d.get('label', '').lower())
                    scene_desc = f"航拍图像，检测到 {car_count} 辆汽车"
                    if truck_count > 0:
                        scene_desc += f"，{truck_count} 辆卡车"
                    if person_count > 0:
                        scene_desc += f"，{person_count} 名行人"
                    scene_desc += "。道路通行正常。"

            # Vision done - Gemma4 分析完成
            yield f"event: stage\ndata: {json.dumps({
                'stage': 'identify',
                'progress': frame_base + 50,
                'status': 'done',
                'summary': scene_desc[:60],
                'detail': scene_desc,
                'ai_model': gemma_model,
            })}\n\n".encode()
            await asyncio.sleep(0.3)  # 等待前端渲染 identify 完成

            # Decision (uses Gemma result) - Stage 4
            yield f"event: stage\ndata: {json.dumps({
                'stage': 'decision',
                'progress': frame_base + 60,
                'status': 'running',
            })}\n\n".encode()
            await asyncio.sleep(0.3)  # 等待前端渲染 decision running 状态

            gemma_confidence = gemma_result.get("confidence", 0.85) if 'gemma_result' in dir() else 0.85

            yield f"event: stage\ndata: {json.dumps({
                'stage': 'decision',
                'progress': frame_base + 80,
                'status': 'done',
                'detail': {
                    'has_incident': has_incident,
                    'risk_level': risk_level,
                    'title': title,
                    'description': description,
                    'recommendation': recommendation,
                    'confidence': gemma_confidence,
                    'ai_model': gemma_model,
                },
            })}\n\n".encode()
            await asyncio.sleep(0.05)

            # Alert event
            alert_payload = {
                'id': int(time.time() * 1000),
                'title': title,
                'description': description,
                'risk_level': risk_level,
                'recommendation': recommendation,
                'confidence': gemma_confidence,
                'scene_description': scene_desc,
                'source_type': 'demo',
                'source_path': str(video_path.name),
                'detection_details': detection_details,
            }
            yield f"event: alert\ndata: {json.dumps(alert_payload)}\n\n".encode()
            # 保存预警到数据库
            await _save_alert_to_db(alert_payload)
            await asyncio.sleep(0.05)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
