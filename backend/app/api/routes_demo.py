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

router = APIRouter(prefix="/demo", tags=["演示"])

# ── Demo video path ──────────────────────────────────────────────────────────

DEMO_VIDEO = Path(__file__).resolve().parents[2] / "data" / "streams" / "MiTra" / "T1_D2.mp4"
DEMO_THUMBNAIL_CACHE = DEMO_VIDEO.parent / ".thumbnail_cache_t1_d2.jpg"

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

    if _yolo_model is None:
        try:
            from ultralytics import YOLO
            yolo_path = backend_dir / "yolov8n.pt"
            if yolo_path.exists():
                _yolo_model = YOLO(str(yolo_path))
                print(f"[YOLO] 模型加载成功: {yolo_path}")
            else:
                print(f"[YOLO] 模型文件不存在: {yolo_path}")
        except Exception as e:
            print(f"[YOLO] 模型加载失败: {e}")
            _yolo_model = None

    if _sam_predictor is None:
        try:
            from segment_anything import SamPredictor, sam_model_registry
            sam_path = backend_dir / "models" / "sam" / "sam_vit_b.pth"
            if sam_path.exists():
                sam = sam_model_registry["vit_b"](checkpoint=str(sam_path))
                _sam_predictor = SamPredictor(sam)
                print(f"[SAM] 模型加载成功: {sam_path}")
            else:
                print(f"[SAM] 模型文件不存在: {sam_path}")
                _sam_predictor = None
        except Exception as e:
            print(f"[SAM] 模型加载失败: {e}")
            _sam_predictor = None

    return _yolo_model, _sam_predictor


# 颜色配置（BGR 格式）
MASK_COLORS_BGR = {
    "person": (0, 255, 0),           # 绿色
    "car": (255, 100, 0),            # 蓝色
    "truck": (255, 100, 0),          # 蓝色
    "bus": (255, 100, 0),            # 蓝色
    "bicycle": (100, 150, 255),      # 浅蓝色
    "motorcycle": (100, 150, 255),    # 浅蓝色
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
        if yolo is None or sam_predictor is None:
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
            {"label": d["label"], "color": _get_color_display_name(d["label"]), "confidence": int(d["conf"] * 100)}
            for d in detections
        ]

        if not detections:
            combined_image_url = _save_raw_frame(processed_frame, frame_idx, prefix)
            return combined_image_url, result

        # Step 2: SAM 分割
        image_rgb = cv2.cvtColor(processed_frame, cv2.COLOR_BGR2RGB)
        sam_predictor.set_image(image_rgb)

        combined = processed_frame.copy()
        masks_data = []

        for det in detections:
            x1, y1, x2, y2 = det["bbox"]
            input_box = np.array([[x1, y1], [x2, y2]])

            masks, scores, _ = sam_predictor.predict(
                point_coords=None,
                point_labels=None,
                box=input_box,
                multimask_output=False,
            )

            mask = masks[0]
            color = _get_mask_color(det["label"])
            masks_data.append({"det": det, "mask": mask, "score": scores[0] if len(scores) > 0 else 0.5})

            # 叠加半透明掩膜
            if mask.sum() > 50:
                for c in range(3):
                    combined[:, :, c] = np.where(mask,
                        (combined[:, :, c] * 0.5 + color[c] * 0.5).astype(np.uint8),
                        combined[:, :, c])

            # 绘制加粗边框
            cv2.rectangle(combined, (x1, y1), (x2, y2), color, 3)

            # 绘制标签
            label_text = f"{det['label']} {det['conf']:.0%}"
            (tw, th), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
            cv2.rectangle(combined, (x1, y1 - th - 10), (x1 + tw + 10, y1), color, -1)
            cv2.putText(combined, label_text, (x1 + 5, y1 - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        # 添加图例
        combined = _add_legend(combined)

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


def _add_legend(combined) -> np.ndarray:
    """在图像左上角添加颜色图例"""
    try:
        legend_x, legend_y = 15, 30

        # 使用 PIL 添加中文文字
        pil_image = Image.fromarray(cv2.cvtColor(combined, cv2.COLOR_BGR2RGB))
        draw = ImageDraw.Draw(pil_image)

        # 获取中文字体
        try:
            font = ImageFont.truetype("/Users/jasonlee/Library/Fonts/HarmonyOS_Sans_SC_Regular.ttf", 16)
        except:
            font = ImageFont.load_default()

        # 图例项
        legend_items = [
            ("绿色", (0, 255, 0), "行人"),
            ("蓝色", (255, 100, 0), "车辆"),
            ("浅蓝色", (100, 150, 255), "自行车"),
        ]

        draw.text((legend_x, legend_y), "图例:", fill=(255, 255, 255), font=font)
        legend_y += 25

        for color_name, color_rgb, desc in legend_items:
            draw.rectangle([(legend_x, legend_y - 14), (legend_x + 20, legend_y + 6)], fill=color_rgb, outline=(255, 255, 255))
            text = f"{color_name} → {desc}"
            draw.text((legend_x + 25, legend_y - 12), text, fill=(255, 255, 255), font=font)
            legend_y += 22

        return cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
    except:
        return combined


def _get_color_display_name(label: str) -> str:
    """获取颜色的中文名称"""
    color_map = {
        "person": "绿色",
        "car": "蓝色",
        "truck": "蓝色",
        "bus": "蓝色",
        "bicycle": "浅蓝色",
        "motorcycle": "浅蓝色",
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
    {"id": "d1", "label": "T1-D1 · 1号机", "filename": "T1_D1.mp4", "device": "UAV-01"},
    {"id": "d2", "label": "T1-D2 · 2号机", "filename": "T1_D2.mp4", "device": "UAV-02"},
    {"id": "d3", "label": "T1-D3 · 3号机", "filename": "T1_D3.mp4", "device": "UAV-03"},
    {"id": "d4", "label": "T1-D4 · 4号机", "filename": "T1_D4.mp4", "device": "UAV-04"},
    {"id": "d5", "label": "T1-D5 · 5号机", "filename": "T1_D5.mp4", "device": "UAV-05"},
    {"id": "d6", "label": "T1-D6 · 6号机", "filename": "T1_D6.mp4", "device": "UAV-06"},
]


def _resolve_video_path(video_id: str) -> Path | None:
    """Resolve video_id → Path, supporting 'default' and 'd1'-'d6'."""
    if video_id == "default":
        return DEMO_VIDEO if DEMO_VIDEO.exists() else None
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


async def _gemma4_analyze(frame_bgr, model: str, rag_context: str, timeout: float) -> dict:
    """Single-model pipeline: Gemma 4 E2B handles vision + decision in one shot.

    Returns dict with keys: scene_description, decision (AlertDecision fields).
    """
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(frame_rgb)
    img_b64 = _image_to_base64(pil_img)

    system_prompt = (
        "你是一个高速公路安全预警专家，同时也是一个航拍视觉分析专家。"
        "你接收一张航拍图像，必须严格按JSON格式输出，不要添加任何解释或额外文字。"
    )
    user_prompt = f"""请分析这张航拍图像，并结合以下处置规范给出预警判断：

相关处置规范：
{rag_context if rag_context else "（无相关规范，请自行判断）"}

请用JSON格式输出（只输出JSON，不要任何其他内容）：
{{"scene_description":"中文场景描述（100字内）","should_alert":true或false,"risk_level":"low或medium或high或critical","title":"10字内标题","description":"30字内描述","recommendation":"40字内建议","confidence":0.0-1.0}}

请用中文回答。"""

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

        # Extract JSON
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start != -1 and end > start:
            try:
                result = json.loads(raw[start:end])
                # Fallback scene_description from raw text if not in JSON
                if not result.get("scene_description"):
                    # Use first 100 chars of raw as description
                    result["scene_description"] = raw[:100]
                return result
            except json.JSONDecodeError:
                pass
        return {"scene_description": raw[:100] if raw else "分析失败"}
    except Exception:
        return {"scene_description": _pixel_analyze(frame_bgr)[:100]}


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
                rag_context = ""
                try:
                    rag_context = await _rag_retrieve(DJI_FRAME_SCENES[idx % len(DJI_FRAME_SCENES)])
                except Exception:
                    pass
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

                # Decision: 基于检测结果生成预警
                # 判断是否有异常（目前简化处理：只检测到车辆就是正常）
                has_incident = False
                risk_level = "low"
                title = "道路通行正常"
                description = scene_desc
                recommendation = "持续监控，暂无预警处置建议。"
                confidence = 0.85

                # 如果有行人，可能是安全隐患
                if person_count > 0 and person_count >= 1:
                    has_incident = True
                    risk_level = "medium"
                    title = "行人检测告警"
                    recommendation = "持续跟踪行人位置，通知相关部门关注。"
                    confidence = 0.75

                decision_result = {
                    "has_incident": has_incident,
                    "risk_level": risk_level,
                    "title": title,
                    "description": description,
                    "recommendation": recommendation,
                    "confidence": confidence,
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
                    "recommendation": recommendation,
                    "confidence": confidence,
                    "scene_description": scene_desc,
                    "source_type": "demo",
                    "source_path": str(video_path.name),
                    "pipeline_mode": "yolo_sam",
                    "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                    "detection_details": detection_details,
                }

                events.append(f"event: alert\ndata: {json.dumps(alert_payload)}\n\n".encode())
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
                "pipeline_mode": mode,
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            }
            events.append(f"event: alert\ndata: {json.dumps(payload)}\n\n".encode())
            await asyncio.sleep(0.8)

    return events


async def _rag_retrieve(query: str, top_k: int = 3) -> str:
    """Simple RAG retrieval: embed query + search ChromaDB."""
    try:
        from llama_index.embeddings.ollama import OllamaEmbedding
        import chromadb
        from llama_index.core import VectorStoreIndex, StorageContext
        from llama_index.vector_stores.chroma import ChromaVectorStore
        from llama_index.core.retrievers import VectorIndexRetriever

        chroma_client = chromadb.PersistentClient(path="./data/knowledge_base")
        try:
            collection = chroma_client.get_collection("uav_sops")
        except Exception:
            # Empty collection — return generic SOP
            return _FALLBACK_SOP

        if collection.count() == 0:
            return _FALLBACK_SOP

        vector_store = ChromaVectorStore(chroma_collection=collection)
        storage_context = StorageContext.from_defaults(vector_store=vector_store)
        embed_model = OllamaEmbedding(
            model_name="nomic-embed-text",
            base_url=settings.OLLAMA_BASE_URL,
        )
        index = VectorStoreIndex.from_vector_store(
            vector_store, storage_context=storage_context, embed_model=embed_model
        )
        retriever = VectorIndexRetriever(index=index, similarity_top_k=top_k)
        nodes = retriever.retrieve(query)
        if not nodes:
            return _FALLBACK_SOP
        return "\n".join(f"- {n.text[:200]}" for n in nodes)
    except Exception:
        return _FALLBACK_SOP


_FALLBACK_SOP = """
- 高速公路应急车道违规停车处置：开启警示灯，记录车牌，通知交警，勿自行处置。
- 道路遗撒物处置：开启警示灯，开启双闪，摆放三角牌，通知路政清理。
- 交通事故处置：开启双闪，人员撤离，记录现场，通知交警和救援。
- 行人闯入处置：立即通知交警，防止事故发生，记录行人特征。
- 交通拥堵处置：持续监控，更新路况信息，必要时触发交通诱导。
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

            # Stage 1: 感知层 - YOLO+SAM 检测和标注
            yield f"event: stage\ndata: {json.dumps({'stage': 'perception', 'progress': idx * 33, 'status': 'running'})}\n\n".encode()
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
            await asyncio.sleep(0.05)

            # ── Vision: 基于 YOLO+SAM 检测结果调用 Gemma4 E2B ──────────────
            yield f"event: stage\ndata: {json.dumps({'stage': 'identify', 'progress': idx * 33 + 8, 'status': 'running'})}\n\n".encode()
            yield f"event: stage\ndata: {json.dumps({'stage': 'rag', 'progress': idx * 33 + 16, 'status': 'running'})}\n\n".encode()
            await asyncio.sleep(0.05)

            # 检查 Ollama 可用性
            ollama_status = await _check_ollama()
            gemma_model = ollama_status.get("gemma4") or "gemma4:e2b"

            # 构建检测信息用于 RAG 查询
            detection_details = detection_result.get('detection_details', [])
            mask_details = detection_result.get('mask_details', [])
            detection_labels = [d.get('label', 'unknown') for d in detection_details] if detection_details else []
            detection_summary = "、".join(detection_labels) if detection_labels else "道路场景"
            rag_query = f"航拍{idx + 1}号帧，检测到：{detection_summary}"

            # RAG retrieval - 使用检测信息作为查询
            rag_context = ""
            try:
                rag_context = await _rag_retrieve(rag_query)
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
                'progress': idx * 33 + 16,
                'status': 'done',
                'snippets': rag_snippets[:3] if rag_snippets else ["（知识库检索结果）"],
                'query': rag_query[:80],
            })}\n\n".encode()

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
                    timeout=60.0
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

            # Vision done
            yield f"event: stage\ndata: {json.dumps({
                'stage': 'identify',
                'progress': idx * 33 + 25,
                'status': 'done',
                'summary': scene_desc[:60],
                'detail': scene_desc,
                'ai_model': gemma_model,
            })}\n\n".encode()
            await asyncio.sleep(0.05)

            # Decision (uses Gemma result)
            gemma_confidence = gemma_result.get("confidence", 0.85) if 'gemma_result' in dir() else 0.85

            yield f"event: stage\ndata: {json.dumps({
                'stage': 'decision',
                'progress': idx * 33 + 33,
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
            yield f"event: alert\ndata: {json.dumps({
                'id': int(time.time() * 1000),
                'title': title,
                'description': description,
                'risk_level': risk_level,
                'recommendation': recommendation,
                'confidence': gemma_confidence,
                'scene_description': scene_desc,
                'source_type': 'demo',
                'source_path': str(video_path.name),
                'pipeline_mode': 'yolo_sam',
                'ai_model': gemma_model,
                'detection_details': detection_details,
            })}\n\n".encode()
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
