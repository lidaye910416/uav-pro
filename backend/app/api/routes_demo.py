# -*- coding: utf-8 -*-
"""演示接口: 视频帧提取 + 完整 pipeline (感知→识别→RAG→决策) + SSE 推送."""
from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
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

logger = logging.getLogger(__name__)
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
            # 查找可用的 YOLO 模型（World 模型优先）
            yolo_paths = [
                backend_dir / "yolov8x-world.pt",  # World模型（优先）
                models_dir / "yolov8n.pt",          # 轻量级
                backend_dir / "yolov8n.pt",          # 根目录轻量级
            ]
            yolo_path = None
            for p in yolo_paths:
                if p.exists():
                    yolo_path = p
                    break
            if yolo_path:
                _yolo_model = YOLO(str(yolo_path))
                logger.info("YOLO 模型加载成功: %s", yolo_path)
            else:
                logger.info("YOLO 模型文件不存在，尝试使用 ultralytics 默认模型")
                _yolo_model = YOLO("yolov8n.pt")
                logger.info("YOLO 使用默认模型: yolov8n.pt")
        except Exception as e:
            logger.error("YOLO 模型加载失败: %s", e)
            _yolo_model = None

    # 加载 SAM 模型 - 尝试 segment-anything 库
    if _sam_predictor is None:
        sam_path = models_dir / "mobile_sam.pt"
        sam_vit_path = models_dir / "sam_vit_b.pth"

        # 方法1: 尝试使用 segment-anything 库 + mobile_sam.pt (state dict 格式)
        if sam_path.exists():
            try:
                from segment_anything import sam_model_registry, SamPredictor
                logger.info("SAM 尝试用 segment-anything 加载: %s", sam_path)
                sam = sam_model_registry["mobile_sam"](checkpoint=str(sam_path))
                sam.to("cpu")
                _sam_predictor = SamPredictor(sam)
                logger.info("SAM segment-anything 加载成功 (mobile_sam)")
            except Exception as sam_err:
                logger.warning("SAM segment-anything mobile_sam 失败: %s", sam_err)
                _sam_predictor = None
        else:
            logger.info("SAM mobile_sam.pt 不存在: %s", sam_path)

        # 方法2: 尝试使用 segment-anything 库 + sam_vit_b.pth (原始格式)
        if _sam_predictor is None and sam_vit_path.exists():
            try:
                from segment_anything import sam_model_registry, SamPredictor
                logger.info("SAM 尝试用 segment-anything 加载: %s", sam_vit_path)
                sam = sam_model_registry["vit_b"](checkpoint=str(sam_vit_path))
                sam.to("cpu")
                _sam_predictor = SamPredictor(sam)
                logger.info("SAM segment-anything 加载成功 (vit_b)")
            except Exception as sam_err:
                logger.warning("SAM segment-anything vit_b 失败: %s", sam_err)
                _sam_predictor = None

        if _sam_predictor is None:
            logger.warning("SAM 所有 SAM 模型加载失败，跳过分割")

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
        results = yolo(processed_frame, conf=0.35, verbose=False)
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
                logger.error("SAM 分割失败: %s", sam_err, exc_info=True)
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
        logger.error("_save_annotated_frame 标注失败: %s", e, exc_info=True)
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
                logger.info("_add_legend 字体加载成功: %s", fp)
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
        logger.error("_add_legend 绘制失败: %s", e)
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
        logger.error("_save_raw_frame 保存失败: %s", e)
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
    """Resolve video_id → Path, supporting 'default', 'gal_1'/'gal_2'/'gal_3' and 'd1'-'d6'."""
    if video_id == "default":
        return DEMO_VIDEO if DEMO_VIDEO.exists() else None
    # Handle gal_1 / gal_2 / gal_3 (all in the root streams directory)
    if video_id in ("gal_1", "gal_2", "gal_3"):
        p = Path(__file__).resolve().parents[2] / "data" / "streams" / f"{video_id}.mp4"
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
            # Match model name with colon (gemma4:e2b) or dash (gemma4-e2b)
            gemma_candidates = ["gemma4:e2b", "gemma4-e2b", "gemma-4-e2b", "gemma-4:e2b"]
            for m in gemma_candidates:
                if m in models:
                    result["gemma4"] = m
                    break
            # Also check partial match for gemma4
            if not result["gemma4"]:
                gemma_match = next((m for m in models if "gemma4" in m.lower() and "e2b" in m.lower()), None)
                if gemma_match:
                    result["gemma4"] = gemma_match
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

async def _gemma4_vision_analyze(frame_bgr, model: str, timeout: float, yolo_detections: list = None) -> dict:
    """
    【识别层】Gemma 视觉分析 - 纯看图判断，不使用 RAG

    职责：仅基于图像视觉特征，独立判断是否存在异常事件
    输出：incident_type, severity, confidence, scene_description, description

    设计原则：
    - 不带 SOP 上下文，避免模型"套用"规范而偏离真实视觉判断
    - 让模型先独立看图，确保判断基于实际图像特征
    """
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(frame_rgb)
    img_b64 = _image_to_base64(pil_img)

    # 构建 YOLO 检测结果摘要（仅作为图像理解辅助，不含 SOP）
    yolo_summary = ""
    if yolo_detections:
        categories = {}
        for det in yolo_detections:
            label = det.get('label', 'unknown')
            categories[label] = categories.get(label, 0) + 1
        if categories:
            parts = [f"{label} {count}个" for label, count in sorted(categories.items())]
            yolo_summary = f"【图像中的物体】检测到：{', '.join(parts)}。"

    # =====================================================
    # 【识别层提示词】- 纯视觉分析，不使用 RAG 上下文
    # =====================================================
    system_prompt = f"""你是高速公路航拍图像安全分析专家。

【任务】
仅根据图像中的静态视觉特征，独立判断是否存在以下事件之一：

  collision  - 车辆碰撞/追尾（两车或多车接触、车辆变形、碎片散落）
  pothole    - 道路坑洼（路面凹陷、坑洞、破损）
  obstacle   - 障碍物/遗撒（散落物、掉落物、占据车道的物体）
  pedestrian - 行人异常（行人在车道内、逆行、异常聚集）
  congestion - 交通拥堵（车辆排队、停滞、密集排列）
  none       - 无异常（道路正常通行）

{yolo_summary}

【判断原则】
1. 仅基于当前帧的视觉特征，不要推测画面外的情况
2. 置信度较低时，倾向于判断为 "none"（正常通行）
3. 视觉特征越明显、越严重，severity 越高
4. 不要参考任何外部规范，你的判断必须基于图像本身

【输出格式 - 严格JSON】
{{
  "has_event": true或false,
  "incident_type": "collision/pothole/obstacle/pedestrian/congestion/none",
  "severity": "high/mid/low/none",
  "confidence": 0-100,
  "scene_description": "场景描述（40字内）",
  "description": "具体观察到的视觉特征（60字内）"
}}

只输出 JSON，不要其他任何文字。"""

    user_prompt = """请分析这张航拍图像，独立判断是否存在交通安全异常。

观察要点：
1. 整体场景（直道/弯道/立交/收费站/服务区）
2. 车辆状态（正常行驶/停滞/异常聚集）
3. 路面状况（坑洞/遗撒/积水/破损）
4. 行人/非机动车（是否在禁止区域）
5. 异常物体（障碍物/事故车辆/散落物）

请仅基于图像中的实际视觉特征给出判断。"""

    full_prompt = f"{system_prompt}\n\n{user_prompt}"

    payload = {
        "model": model,
        "prompt": full_prompt,
        "images": [img_b64],
        "stream": False,
        "think": False,
        "options": {"num_predict": 200},
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            logger.info("_gemma4_vision_analyze 调用 Ollama, timeout=%ss", timeout)
            r = await client.post(f"{settings.OLLAMA_BASE_URL}/api/generate", json=payload)
            r.raise_for_status()
            raw = r.json().get("response", "").strip()
            logger.info("_gemma4_vision_analyze 原始响应: %s...", raw[:150])

        # 解析 JSON
        clean_raw = raw.replace('```json', '').replace('```', '').strip()
        start = clean_raw.find("{")
        end = clean_raw.rfind("}") + 1

        if start != -1 and end > start:
            json_str = clean_raw[start:end]
            result = json.loads(json_str)
            return {
                "has_event": bool(result.get("has_event", False)),
                "incident_type": result.get("incident_type", "none"),
                "severity": str(result.get("severity", "low")).lower(),
                "confidence": round(max(0.0, min(1.0, float(result.get("confidence", 0.5)))), 2),
                "scene_description": result.get("scene_description", ""),
                "description": result.get("description", ""),
            }

        # 回退：无法解析 JSON
        return {
            "has_event": False,
            "incident_type": "none",
            "severity": "none",
            "confidence": 0.5,
            "scene_description": "分析失败，回退为正常",
            "description": raw[:100] if raw else "分析失败",
        }
    except Exception as e:
        logger.error("_gemma4_vision_analyze 失败: %s", e)
        # 合成场景描述: 基于 detection_details 简单合成, 不再 raise
        if yolo_detections:
            n = len(yolo_detections)
            top = yolo_detections[:5]
            parts = [
                f"{d.get('label', 'unknown')}({d.get('color', '黄绿色')}, 置信度 {d.get('confidence', 0)}%)"
                for d in top
            ]
            scene_desc = f"{n} 个目标: " + ", ".join(parts)
        else:
            scene_desc = "分析服务不可用"
        return {
            "has_event": False,
            "incident_type": "none",
            "severity": "none",
            "confidence": 0.5,
            "scene_description": scene_desc,
            "description": "AI分析失败，使用YOLO检测结果合成场景描述",
        }


async def _rag_decide(incident_type: str, scene_description: str, model: str, timeout: float) -> dict:
    """
    【决策层】基于 RAG SOP 的风险评估与处置建议

    职责：
    - 根据识别层输出的 incident_type，从 ChromaDB 检索相关 SOP
    - 结合 SOP 规范输出风险等级（risk_level）、预警标题、处置建议

    设计原则：
    - RAG 检索基于 incident_type，精准匹配而非模糊查询
    - 不重复做视觉分析，信任识别层的判断结果
    - 输出直接用于预警推送

    Args:
        incident_type: 识别层输出的事件类型
        scene_description: 识别层输出的场景描述
        model: Gemma4 模型名
        timeout: 超时时间

    Returns:
        {risk_level, title, recommended_response}
    """
    # =====================================================
    # RAG 检索：基于 incident_type 精准匹配 SOP
    # =====================================================
    if incident_type and incident_type != "none":
        rag_context = chroma_get_rag_context(incident_type, top_k=3)
    else:
        # 无异常场景，查 "none" 相关的 SOP
        rag_context = chroma_get_rag_context("道路正常通行", top_k=2)

    # 格式化 SOP 上下文
    sop_lines = []
    if rag_context:
        for line in rag_context.split("\n"):
            line = line.strip()
            if line and not line.startswith("-"):
                sop_lines.append(f"  {line}")

    sop_text = "\n".join(sop_lines) if sop_lines else "（无相关 SOP 规范）"

    # =====================================================
    # 【决策层提示词】- 基于 SOP 的风险评估
    # =====================================================
    system_prompt = f"""你是高速公路安全预警决策专家。

【输入信息】
- 场景：{scene_description if scene_description else "正常通行"}
- 事件类型：{incident_type if incident_type else "none"}

【SOP 处置规范】（已从知识库检索）
{sop_text}

【任务】
根据 SOP 规范，输出风险评估和处置建议。

【输出格式 - 严格JSON】
{{
  "risk_level": "low/medium/high/critical",
  "title": "预警标题（8字内）",
  "recommended_response": "处置建议（50字内）"
}}

【风险等级映射规则】
- SOP severity=none → risk_level=low
- SOP severity=low → risk_level=low
- SOP severity=mid → risk_level=medium
- SOP severity=high → risk_level=high

【注意事项】
1. 只输出 JSON，不要任何其他文字
2. 推荐建议必须具体、可执行
3. 标题要简洁醒目，8字以内"""

    user_prompt = """请根据以上信息输出预警决策。"""

    full_prompt = f"{system_prompt}\n\n{user_prompt}"

    payload = {
        "model": model,
        "prompt": full_prompt,
        "stream": False,
        "think": False,
        "options": {"num_predict": 80},
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(f"{settings.OLLAMA_BASE_URL}/api/generate", json=payload)
            r.raise_for_status()
            raw = r.json().get("response", "").strip()
            logger.info("_rag_decide 原始响应: %s...", raw[:150])

        # 解析 JSON
        clean_raw = raw.replace('```json', '').replace('```', '').strip()
        start = clean_raw.find("{")
        end = clean_raw.rfind("}") + 1

        if start != -1 and end > start:
            json_str = clean_raw[start:end]
            result = json.loads(json_str)
            return {
                "risk_level": result.get("risk_level", "low"),
                "title": result.get("title", "道路通行正常"),
                "recommended_response": result.get("recommended_response", "持续监控"),
            }

        # 回退：无法解析 JSON
        return {
            "risk_level": "low",
            "title": "道路通行正常",
            "recommended_response": "持续监控，暂无预警处置建议",
        }
    except Exception as e:
        logger.error("_rag_decide 失败: %s", e)
        return {
            "risk_level": "low",
            "title": "道路通行正常",
            "recommended_response": "持续监控",
        }


def _extract_demo_frames(video_path: Path, count: int = 5) -> list[tuple[int, str]]:
    """Extract `count` evenly-spaced frames from a single video, return [(frame_idx, temp_path)]."""
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


def _extract_demo_frames_multi(video_paths: list[Path]) -> list[tuple[int, str, str]]:
    """从多个视频各抽 1 帧 (frame 0), 返回 [(frame_idx, temp_path, video_name)]."""
    frames: list[tuple[int, str, str]] = []
    for vp in video_paths:
        if not vp.exists():
            continue
        cap = cv2.VideoCapture(str(vp))
        if not cap.isOpened():
            cap.release()
            continue
        # 抽第 0 帧
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        ret, frame = cap.read()
        cap.release()
        if not ret:
            continue
        tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
        cv2.imwrite(tmp.name, frame)
        frames.append((0, tmp.name, vp.name))
    return frames
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
            logger.info("_save_alert_to_db 预警已保存: ID=%s, title=%s", alert.id, alert.title)
            return alert.id
    except Exception as e:
        logger.error("_save_alert_to_db 保存预警失败: %s", e, exc_info=True)
        return None


def _infer_incident_from_detections(detection_details: list) -> dict:
    """根据 YOLO detection_details 强制推断 incident_type，避免 incident_type= 'none' 阻断 RAG/决策。

    规则按优先级:
      - person + car → pedestrian, mid
      - 多个 car 且 bbox 距离近 → collision, high
      - bus/truck → obstacle, low
      - pothole → pothole, low (YOLO 不会直接出 pothole，预留)
      - fire/smoke → collision, critical
      - 默认 → congestion, low
    """
    if not detection_details:
        return {"incident_type": "congestion", "severity": "low", "has_event": False}

    labels = [d.get("label", "").lower() for d in detection_details]
    label_set = set(labels)

    # fire / smoke
    for fire_label in ("fire", "smoke"):
        if fire_label in label_set:
            return {"incident_type": "collision", "severity": "critical", "has_event": True}

    # person + car 组合
    if ("person" in label_set) and ("car" in label_set):
        return {"incident_type": "pedestrian", "severity": "mid", "has_event": True}

    # 多个 car + 距离近 → collision
    car_dets = [d for d in detection_details if d.get("label", "").lower() == "car"]
    if len(car_dets) >= 2:
        centers = []
        for d in car_dets:
            x1, y1, x2, y2 = d.get("bbox", [0, 0, 0, 0])
            centers.append(((x1 + x2) / 2, (y1 + y2) / 2))
        collision = False
        for i in range(len(centers)):
            for j in range(i + 1, len(centers)):
                dx = centers[i][0] - centers[j][0]
                dy = centers[i][1] - centers[j][1]
                if (dx * dx + dy * dy) ** 0.5 < 100:
                    collision = True
                    break
            if collision:
                break
        if collision:
            return {"incident_type": "collision", "severity": "high", "has_event": True}

    # bus / truck → obstacle
    for big in ("bus", "truck"):
        if big in label_set:
            return {"incident_type": "obstacle", "severity": "low", "has_event": True}

    # pothole
    if "pothole" in label_set:
        return {"incident_type": "pothole", "severity": "low", "has_event": True}

    # 默认: 任意检测 → congestion
    return {"incident_type": "congestion", "severity": "low", "has_event": False}


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

    # 使用 3 个不同演示视频各抽 1 帧, 让首页展示不同场景
    streams_dir = Path(__file__).resolve().parents[2] / "data" / "streams"
    demo_video_paths = [
        streams_dir / "gal_1.mp4",
        streams_dir / "gal_2.mp4",
        streams_dir / "gal_3.mp4",
    ]
    # Fallback: 如果某个 gal_X.mp4 不存在, 用 DEMO_VIDEO 替代
    demo_video_paths = [p if p.exists() else DEMO_VIDEO for p in demo_video_paths]
    demo_video_paths = [p for p in demo_video_paths if p.exists()]

    if not demo_video_paths:
        # Return empty stream if no video
        async def generate():
            yield b"data: {}\n\n"
        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    frames = _extract_demo_frames_multi(demo_video_paths)
    if not frames:
        async def generate():
            yield b"data: {}\n\n"
        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # 第一个视频用于元数据
    primary_video = demo_video_paths[0]
    total = int(cv2.VideoCapture(str(primary_video)).get(cv2.CAP_PROP_FRAME_COUNT))
    fps_v = cv2.VideoCapture(str(primary_video)).get(cv2.CAP_PROP_FPS)

    async def generate():
        for idx, (frame_idx, tmp_path, video_name) in enumerate(frames):
            frame_bgr = cv2.imread(tmp_path)
            if frame_bgr is None:
                continue
            video_path = Path(video_name)

            # 计算每帧的基础进度 (0, 30, 60 for 3 frames)
            frame_base = idx * 30

            # Stage 1: 感知层 - YOLO+SAM 检测和标注
            yield f"event: stage\ndata: {json.dumps({'stage': 'perception', 'progress': frame_base + 5, 'status': 'running'})}\n\n".encode()
            await asyncio.sleep(0.05)

            # 执行 YOLO+SAM 标注，返回图像 URL 和检测结果
            combined_image_url, detection_result = _save_annotated_frame(frame_bgr, frame_idx, prefix="demo")


            # 发送 perception done 事件，包含标注图像 URL
            perception_done = json.dumps({
                'stage': 'perception',
                'progress': frame_base + 10,
                'status': 'done',
                'combined_image_url': combined_image_url,
            })
            yield f"event: stage\ndata: {perception_done}\n\n".encode()
            await asyncio.sleep(0.3)  # 等待前端渲染 perception 完成

            # 发送 frame_data 事件，包含检测结果和标注图像 URL
            frame_data = json.dumps({
                'frame_idx': frame_idx,
                'timestamp': f"{frame_idx / fps_v:.1f}s",
                'resolution': detection_result.get('resolution', f"3840×2160"),
                'fps': fps_v,
                'stream_src': video_name,
                'total_frames': total,
                'detections': detection_result.get('detections', '0'),
                'segmentations': detection_result.get('segmentations', '0'),
                'detection_details': detection_result.get('detection_details', []),
                'mask_details': detection_result.get('mask_details', []),
                'combined_image_url': combined_image_url,
            })
            yield f"event: frame_data\ndata: {frame_data}\n\n".encode()
            await asyncio.sleep(0.1)

            # ── Stage 2: 识别层 - Gemma4 视觉分析（纯看图，不带 RAG）────────────
            yield f"event: stage\ndata: {json.dumps({'stage': 'identify', 'progress': frame_base + 20, 'status': 'running'})}\n\n".encode()
            await asyncio.sleep(0.3)  # 等待前端渲染 identify running 状态

            # 检查 Ollama 可用性
            ollama_status = await _check_ollama()
            gemma_model = ollama_status.get("gemma4") or "gemma4:e2b"

            # 获取检测结果
            detection_details = detection_result.get('detection_details', [])

            # 初始化默认值
            scene_desc = DJI_FRAME_SCENES[idx % len(DJI_FRAME_SCENES)]
            has_incident = False
            incident_type = "none"
            severity = "none"
            vision_confidence = 0.85

            # 调用识别层：Gemma4 纯视觉分析（不带 RAG）
            try:
                logger.info("demo_sse_stream 调用识别层 _gemma4_vision_analyze, timeout=15s")
                vision_result = await _gemma4_vision_analyze(
                    frame_bgr=frame_bgr,
                    model=gemma_model,
                    timeout=15.0,  # 缩短超时，避免阻塞流
                    yolo_detections=detection_details
                )
                logger.info("demo_sse_stream 识别层完成: incident_type=%s, has_event=%s", vision_result.get('incident_type'), vision_result.get('has_event'))

                # 使用识别层结果
                scene_desc = vision_result.get("scene_description", scene_desc)
                has_incident = vision_result.get("has_event", False)
                incident_type = vision_result.get("incident_type", "none")
                severity = vision_result.get("severity", "none")
                vision_confidence = vision_result.get("confidence", 0.85)

                # Vision done - 发送识别层完成事件
                identify_done = json.dumps({
                    'stage': 'identify',
                    'progress': frame_base + 45,
                    'status': 'done',
                    'summary': scene_desc[:60],
                    'detail': scene_desc,
                    'incident_type': incident_type,
                    'severity': severity,
                    'confidence': vision_confidence,
                    'ai_model': gemma_model,
                })
                yield f"event: stage\ndata: {identify_done}\n\n".encode()
                await asyncio.sleep(0.3)  # 等待前端渲染 identify 完成

            except Exception as e:
                logger.error("demo_sse_stream 识别层异常: %s: %s", type(e).__name__, e, exc_info=True)

                # 识别层失败时使用检测结果生成描述
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

                identify_err = json.dumps({
                    'stage': 'identify',
                    'progress': frame_base + 45,
                    'status': 'done',
                    'summary': scene_desc[:60],
                    'detail': scene_desc,
                    'ai_model': gemma_model,
                    'error': str(e),
                })
                yield f"event: stage\ndata: {identify_err}\n\n".encode()
                await asyncio.sleep(0.3)

            # ── Stage 3: RAG 检索 + 决策层（强制触发）────────────────────
            # 强制根据 detection_details 推断 incident_type，避免 Gemma4 不可靠的判断导致 RAG/决策被跳过
            inferred = _infer_incident_from_detections(detection_details)
            # 仅当 Gemma4 给出明确事件类型且不在我们的强制规则内时，才信任 Gemma4
            if incident_type and incident_type != "none" and incident_type in ("collision", "pothole", "obstacle", "pedestrian", "congestion"):
                # Gemma4 给出了有效类型，使用 Gemma4 的结果
                pass
            else:
                # 否则使用基于 YOLO detection 的强制推断
                incident_type = inferred["incident_type"]
                severity = inferred["severity"]
                has_incident = inferred["has_event"]

            # ── 永远运行 RAG + 决策层（不再区分 none/异常）────────
            yield f"event: stage\ndata: {json.dumps({'stage': 'rag', 'progress': frame_base + 55, 'status': 'running'})}\n\n".encode()
            await asyncio.sleep(0.3)

            # RAG 检索
            rag_query = f"{incident_type}高速公路交通事件处置"
            rag_context = ""
            try:
                rag_context = chroma_get_rag_context(rag_query, top_k=3)
            except Exception:
                pass

            rag_snippets = [
                ln.strip()
                for ln in rag_context.split("\n")
                if ln.strip() and not ln.strip().startswith("-")
            ]

            # RAG done
            rag_done = json.dumps({
                'stage': 'rag',
                'progress': frame_base + 65,
                'status': 'done',
                'snippets': rag_snippets[:3] if rag_snippets else ["（知识库检索结果）"],
                'query': rag_query[:80],
            })
            yield f"event: stage\ndata: {rag_done}\n\n".encode()
            await asyncio.sleep(0.3)

            # ── 决策层：基于 incident_type + RAG SOP 输出风险等级 ────────
            decision_running = json.dumps({
                'stage': 'decision',
                'progress': frame_base + 70,
                'status': 'running',
            })
            yield f"event: stage\ndata: {decision_running}\n\n".encode()
            await asyncio.sleep(0.3)

            # 风险等级 + title + recommendation 映射
            severity_to_risk = {
                "critical": "critical",
                "high": "high",
                "mid": "medium",
                "medium": "medium",
                "low": "low",
                "none": "low",
            }
            title_map = {
                "collision": "碰撞事故告警",
                "pothole": "道路坑洼告警",
                "obstacle": "障碍物告警",
                "pedestrian": "行人异常告警",
                "congestion": "交通拥堵告警",
            }
            recommendation_map = {
                "collision": "立即通知高速交警处置，封闭事故车道",
                "pothole": "通知路政部门修复，设置警示标志",
                "obstacle": "通知路政清理，发布路况提醒",
                "pedestrian": "立即通知高速交警劝离，发布警示",
                "congestion": "持续监控车流，必要时发布诱导信息",
            }

            risk_level = "low"
            title = title_map.get(incident_type, "道路通行异常")
            recommendation = recommendation_map.get(incident_type, "持续监控")

            try:
                logger.info("demo_sse_stream 调用决策层 _rag_decide, incident_type=%s", incident_type)
                decision_result = await _rag_decide(
                    incident_type=incident_type,
                    scene_description=scene_desc,
                    model=gemma_model,
                    timeout=15.0,
                )
                logger.info("demo_sse_stream 决策层完成: risk_level=%s, title=%s", decision_result.get('risk_level'), decision_result.get('title'))

                # 优先使用 Gemma4 输出，但 fallback 到基于 severity 的映射
                risk_level = decision_result.get("risk_level") or severity_to_risk.get(severity, "low")
                if decision_result.get("title"):
                    title = decision_result.get("title")
                if decision_result.get("recommended_response"):
                    recommendation = decision_result.get("recommended_response")

            except Exception as e:
                logger.error("demo_sse_stream 决策层异常: %s: %s", type(e).__name__, e)
                # 决策层失败时使用 severity 映射
                risk_level = severity_to_risk.get(severity, "low")

            # Decision done
            decision_done = json.dumps({
                'stage': 'decision',
                'progress': frame_base + 85,
                'status': 'done',
                'detail': {
                    'has_incident': has_incident,
                    'incident_type': incident_type,
                    'severity': severity,
                    'risk_level': risk_level,
                    'title': title,
                    'description': scene_desc,
                    'recommendation': recommendation,
                    'confidence': vision_confidence,
                    'ai_model': gemma_model,
                },
            })
            yield f"event: stage\ndata: {decision_done}\n\n".encode()
            await asyncio.sleep(0.05)

            # Alert event - 发送预警
            alert_payload = {
                'id': int(time.time() * 1000),
                'title': title,
                'description': scene_desc,
                'risk_level': risk_level,
                'incident_type': incident_type,
                'severity': severity,
                'recommendation': recommendation,
                'confidence': vision_confidence,
                'scene_description': scene_desc,
                'source_type': 'demo',
                'source_path': video_name,
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
