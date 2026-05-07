# backend/app/services/perception_service.py
"""感知服务 - YOLO检测 + SAM分割"""
from __future__ import annotations

import hashlib
import time
from pathlib import Path
from typing import Optional
import cv2
import numpy as np

from app.services.types import (
    Detection, MaskDetail, DetectionResult, AnnotatedImage
)


# 颜色配置
MASK_COLORS_BGR = {
    "person": (0, 255, 0),           # 绿色
    "car": (255, 100, 0),            # 橙色（蓝色框）
    "truck": (0, 150, 255),          # 浅蓝色
    "bus": (200, 100, 255),          # 紫色
    "bicycle": (100, 150, 255),      # 天蓝色
    "motorcycle": (0, 200, 200),     # 青色
    "default": (200, 200, 100),       # 黄绿色
}

MASK_COLORS_DISPLAY = {
    "person": "绿色",
    "car": "浅蓝色",
    "truck": "橙色",
    "bus": "紫色",
    "bicycle": "天蓝色",
    "motorcycle": "青色",
    "default": "黄绿色",
}

# 帧缓存目录
FRAME_CACHE_DIR = Path(__file__).resolve().parents[3] / "data" / "frames"
FRAME_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# 模型路径
_backend_dir = Path(__file__).resolve().parents[2]
MODELS_DIR = _backend_dir / "models" / "sam"


def _get_mask_color(label: str) -> tuple:
    return MASK_COLORS_BGR.get(label.lower(), MASK_COLORS_BGR["default"])


def _get_color_display_name(label: str) -> str:
    return MASK_COLORS_DISPLAY.get(label.lower(), "黄绿色")


def _save_raw_frame(frame_bgr, frame_idx: int, prefix: str = "demo") -> Optional[str]:
    """保存原始帧到缓存目录，返回访问路径"""
    try:
        hash_id = hashlib.md5(f"{prefix}_{frame_idx}_{time.time()}".encode()).hexdigest()[:8]
        filename = f"{prefix}_{frame_idx}_{hash_id}.jpg"
        filepath = FRAME_CACHE_DIR / filename
        
        cv2.imwrite(str(filepath), frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return f"/api/v1/demo/frames/{filename}"
    except Exception as e:
        print(f"[_save_raw_frame] 保存失败: {e}")
        return None


def _add_legend(combined, detections: list = None) -> np.ndarray:
    """在图像左上角添加颜色图例"""
    try:
        from PIL import Image, ImageDraw, ImageFont
        
        legend_x, legend_y = 15, 30
        
        # 获取字体
        font = None
        font_paths = [
            "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf",
            "/app/fonts/HiraginoSansGB.ttc",
            "/System/Library/Fonts/Hiragino Sans GB.ttc",
        ]
        for fp in font_paths:
            try:
                font = ImageFont.truetype(fp, 18)
                break
            except Exception:
                continue
        
        label_map = {
            "person": "Person",
            "car": "Car",
            "truck": "Truck",
            "bus": "Bus",
            "bicycle": "Bicycle",
            "motorcycle": "Motorcycle",
        }
        color_map = {
            "person": (0, 255, 0),
            "car": (0, 100, 255),
            "truck": (255, 150, 0),
            "bus": (255, 100, 200),
            "bicycle": (150, 150, 255),
            "motorcycle": (0, 200, 200),
        }
        
        pil_image = Image.fromarray(cv2.cvtColor(combined, cv2.COLOR_BGR2RGB))
        draw = ImageDraw.Draw(pil_image)
        
        # 根据检测到的类别动态生成图例
        if detections:
            detected_labels = set()
            for d in detections:
                if hasattr(d, 'label'):
                    detected_labels.add(d.label.lower())
                elif isinstance(d, dict):
                    detected_labels.add(d.get('label', '').lower())
        else:
            detected_labels = set()
        
        display_labels = list(detected_labels) if detected_labels else list(label_map.keys())
        
        if font:
            draw.text((legend_x, legend_y), "Detection:", fill=(255, 255, 255), font=font)
            legend_y += 25
        
        for label in display_labels:
            if label not in label_map:
                continue
            color_rgb = color_map.get(label, (128, 128, 128))
            desc = label_map.get(label, label)
            draw.rectangle([(legend_x, legend_y - 14), (legend_x + 20, legend_y + 6)], fill=color_rgb, outline=(255, 255, 255))
            if font:
                draw.text((legend_x + 25, legend_y - 12), desc, fill=(255, 255, 255), font=font)
            legend_y += 22
        
        return cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
    except Exception as e:
        print(f"[_add_legend] 绘制失败: {e}")
        return combined


class PerceptionService:
    """感知服务 - YOLO检测 + SAM分割"""
    
    def __init__(self, confidence_threshold: float = 0.25):
        self.confidence_threshold = confidence_threshold
        self._yolo_model = None
        self._sam_predictor = None
    
    def _ensure_models_loaded(self):
        """懒加载模型"""
        if self._yolo_model is None or self._sam_predictor is None:
            self._yolo_model, self._sam_predictor = _get_yolo_sam_models()
    
    def detect(self, frame_bgr: np.ndarray) -> DetectionResult:
        """执行检测，返回检测结果"""
        self._ensure_models_loaded()
        
        # 缩小图像以节省处理时间（最大宽度 1280）
        h, w = frame_bgr.shape[:2]
        processed_frame = frame_bgr.copy()
        if w > 1280:
            scale = 1280 / w
            processed_frame = cv2.resize(processed_frame, (1280, int(h * scale)))
        
        result = DetectionResult(
            frame_idx=0,
            timestamp="0s",
            resolution=f"{processed_frame.shape[1]}×{processed_frame.shape[0]}",
            detections=0,
            detection_details=[],
            mask_details=[],
            segmentations=0,
        )
        
        # 如果没有模型，返回空结果
        if self._yolo_model is None:
            return result
        
        # YOLO 检测
        try:
            results = self._yolo_model(processed_frame, conf=self.confidence_threshold, verbose=False)
            if results and len(results) > 0:
                r = results[0]
                
                detections: list[Detection] = []
                if r.boxes is not None:
                    for box in r.boxes:
                        x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
                        conf = float(box.conf[0].cpu().numpy())
                        label = r.names[int(box.cls[0].cpu().numpy())]
                        detections.append(Detection(
                            label=label,
                            bbox=[x1, y1, x2, y2],
                            confidence=conf,
                        ))
                
                result.detections = len(detections)
                result.detection_details = detections
        except Exception as e:
            print(f"[PerceptionService] YOLO 检测失败: {e}")
        
        return result
    
    def annotate(
        self, 
        frame_bgr: np.ndarray, 
        detections: list,
        frame_idx: int = 0
    ) -> AnnotatedImage:
        """生成标注图像"""
        self._ensure_models_loaded()
        
        # 缩小图像
        h, w = frame_bgr.shape[:2]
        processed_frame = frame_bgr.copy()
        if w > 1280:
            scale = 1280 / w
            processed_frame = cv2.resize(processed_frame, (1280, int(h * scale)))
        
        combined = processed_frame.copy()
        masks_data = []
        
        # 处理 detections（可能是 Detection 对象或 dict）
        processed_detections = []
        for det in detections:
            if isinstance(det, Detection):
                processed_detections.append(det)
            elif isinstance(det, dict):
                processed_detections.append(Detection(
                    label=det.get('label', 'unknown'),
                    bbox=det.get('bbox', [0, 0, 0, 0]),
                    confidence=det.get('confidence', 0.0),
                ))
        
        if self._sam_predictor is not None and processed_detections:
            try:
                from segment_anything import SamPredictor
                if isinstance(self._sam_predictor, SamPredictor):
                    self._sam_predictor.set_image(processed_frame)
                    
                    for det in processed_detections:
                        x1, y1, x2, y2 = [int(v) for v in det.bbox]
                        box = np.array([[x1, y1], [x2, y2]], dtype=np.int32)
                        
                        masks, scores, _ = self._sam_predictor.predict(
                            box=box,
                            multimask_output=False
                        )
                        
                        if len(masks) > 0:
                            mask = masks[0]
                            color = _get_mask_color(det.label)
                            
                            # 叠加半透明掩膜
                            if mask.sum() > 50:
                                for c in range(3):
                                    combined[:, :, c] = np.where(
                                        mask.astype(bool),
                                        (combined[:, :, c] * 0.7 + color[c] * 0.3).astype(np.uint8),
                                        combined[:, :, c]
                                    )
                            
                            masks_data.append({
                                "det": det,
                                "mask": mask,
                                "score": scores[0] if len(scores) > 0 else det.confidence,
                            })
                        
                        cv2.rectangle(combined, (x1, y1), (x2, y2), color, 3)
                    
                    self._sam_predictor.reset_image()
            except Exception as e:
                print(f"[PerceptionService] SAM 分割失败: {e}")
                # 回退：只画边框
                for det in processed_detections:
                    color = _get_mask_color(det.label)
                    x1, y1, x2, y2 = [int(v) for v in det.bbox]
                    cv2.rectangle(combined, (x1, y1), (x2, y2), color, 3)
        else:
            # 无 SAM 模型或无检测，只画边框
            for det in processed_detections:
                color = _get_mask_color(det.label)
                x1, y1, x2, y2 = [int(v) for v in det.bbox]
                cv2.rectangle(combined, (x1, y1), (x2, y2), color, 3)
        
        # 添加图例
        combined = _add_legend(combined, processed_detections)
        
        # 保存标注图像
        image_url = _save_raw_frame(combined, frame_idx, prefix="demo")
        if image_url is None:
            image_url = _save_raw_frame(processed_frame, frame_idx, prefix="demo_raw")
        
        # 构建结果
        mask_details = []
        for item in masks_data:
            det = item["det"]
            if isinstance(det, Detection):
                mask_details.append(MaskDetail(
                    label=det.label,
                    color=_get_color_display_name(det.label),
                    pixel_count=int(item["mask"].sum()),
                    confidence=round(float(item["score"]), 3),
                ))
        
        result = DetectionResult(
            frame_idx=frame_idx,
            timestamp=f"{frame_idx / 30:.1f}s",
            resolution=f"{processed_frame.shape[1]}×{processed_frame.shape[0]}",
            detections=len(processed_detections),
            detection_details=processed_detections,
            mask_details=mask_details,
            segmentations=len(masks_data),
        )
        
        return AnnotatedImage(image_url=image_url or "", result=result)
    
    def process_frame(self, frame_bgr: np.ndarray, frame_idx: int = 0) -> AnnotatedImage:
        """完整处理：检测 + 标注"""
        detections_result = self.detect(frame_bgr)
        detections = detections_result.detection_details
        return self.annotate(frame_bgr, detections, frame_idx)


def _get_yolo_sam_models():
    """懒加载 YOLO 和 SAM 模型"""
    global _yolo_model, _sam_predictor
    
    yolo_model = None
    sam_predictor = None
    
    # 加载 YOLO
    try:
        from ultralytics import YOLO
        yolo_paths = [
            MODELS_DIR / "yolov8n.pt",
            _backend_dir / "yolov8n.pt",
            _backend_dir / "yolov8x-world.pt",
        ]
        yolo_path = None
        for p in yolo_paths:
            if p.exists():
                yolo_path = p
                break
        if yolo_path:
            yolo_model = YOLO(str(yolo_path))
            print(f"[YOLO] 模型加载成功: {yolo_path}")
        else:
            print(f"[YOLO] 模型文件不存在")
    except Exception as e:
        print(f"[YOLO] 模型加载失败: {e}")
    
    # 加载 SAM
    sam_path = MODELS_DIR / "mobile_sam.pt"
    sam_vit_path = MODELS_DIR / "sam_vit_b.pth"
    
    if sam_path.exists():
        try:
            from segment_anything import sam_model_registry, SamPredictor
            sam = sam_model_registry["mobile_sam"](checkpoint=str(sam_path))
            sam.to("cpu")
            sam_predictor = SamPredictor(sam)
            print(f"[SAM] mobile_sam 加载成功")
        except Exception as e:
            print(f"[SAM] mobile_sam 加载失败: {e}")
    
    if sam_predictor is None and sam_vit_path.exists():
        try:
            from segment_anything import sam_model_registry, SamPredictor
            sam = sam_model_registry["vit_b"](checkpoint=str(sam_vit_path))
            sam.to("cpu")
            sam_predictor = SamPredictor(sam)
            print(f"[SAM] vit_b 加载成功")
        except Exception as e:
            print(f"[SAM] vit_b 加载失败: {e}")
    
    return yolo_model, sam_predictor


# 全局变量
_yolo_model = None
_sam_predictor = None
