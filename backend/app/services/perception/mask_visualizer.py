# -*- coding: utf-8 -*-
"""SAM 掩码可视化模块 - 将原图与分割掩码合并为彩色标注图像"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
import numpy as np
import cv2

from .yolo_detector import DetectedObject
from .sam_segmenter import SegmentationMask


# 默认颜色配置 (BGR 格式)
DEFAULT_COLORS = {
    "vehicle":   (255, 100, 0),    # 蓝色 - 车辆
    "person":    (0, 255, 100),    # 绿色 - 行人
    "bicycle":   (100, 150, 255),  # 浅蓝色 - 非机动车
    "motorcycle":(100, 150, 255),  # 浅蓝色 - 摩托车
    "truck":     (200, 80, 0),     # 深蓝色 - 卡车
    "bus":       (180, 60, 0),     # 深蓝色 - 公交车
    "obstacle":  (0, 80, 255),     # 红色 - 障碍物
    "traffic_light": (0, 200, 255), # 黄色 - 交通设施
    "stop_sign": (0, 180, 255),     # 橙黄色 - 停车标志
    "default":   (200, 200, 100),  # 黄绿色 - 默认
}

# 类别名称映射（COCO → 可读名称）
CATEGORY_LABELS = {
    "car": "vehicle",
    "truck": "truck",
    "bus": "bus",
    "motorcycle": "motorcycle",
    "bicycle": "bicycle",
    "person": "person",
    "traffic light": "traffic_light",
    "stop sign": "stop_sign",
}


def get_category_type(label: str) -> str:
    """将 COCO 标签映射为类别类型"""
    return CATEGORY_LABELS.get(label.lower(), "default")


@dataclass
class VisualizationResult:
    """可视化结果"""
    image: np.ndarray              # 合并后的可视化图像 (BGR)
    object_count: int             # 标注的物体数量
    color_legend: dict             # 颜色图例

    def to_dict(self) -> dict:
        return {
            "object_count": self.object_count,
            "color_legend": self.color_legend,
        }


class MaskVisualizer:
    """SAM 掩码可视化器
    
    将原图与 YOLO 检测框和 SAM 分割掩码合并为彩色标注图像，
    便于 Gemma 多模态模型理解画面内容。
    """

    def __init__(
        self,
        category_colors: dict = None,
        mask_alpha: float = 0.5,  # 提高透明度，让掩膜更明显
        box_thickness: int = 2,
        font_scale: float = 0.5,
    ):
        """初始化可视化器

        Args:
            category_colors: 类别颜色映射，默认为 DEFAULT_COLORS
            mask_alpha: 掩码叠加透明度 (0-1)，越大掩膜越明显
            box_thickness: 边界框线条粗细
            font_scale: 标签字体大小
        """
        self.colors = category_colors or DEFAULT_COLORS.copy()
        self.mask_alpha = mask_alpha
        self.box_thickness = box_thickness
        self.font_scale = font_scale

    def get_color(self, label: str) -> tuple[int, int, int]:
        """获取类别对应的颜色"""
        category = get_category_type(label)
        return self.colors.get(category, self.colors["default"])

    def visualize(
        self,
        image: np.ndarray,
        detections: list[DetectedObject],
        masks: list[SegmentationMask] = None,
        show_labels: bool = True,
        show_confidence: bool = True,
        max_display: int = 50,
    ) -> VisualizationResult:
        """生成合并可视化图像

        Args:
            image: 原始图像 (BGR)
            detections: YOLO 检测结果列表
            masks: SAM 分割掩码列表（可选）
            show_labels: 是否显示类别标签
            show_confidence: 是否显示置信度
            max_display: 最大显示数量（防止图像过于拥挤）

        Returns:
            VisualizationResult 对象，包含合并后的图像
        """
        if image is None or len(image.shape) != 3:
            raise ValueError("无效的输入图像")

        # 复制原图（避免修改原始图像）
        result_image = image.copy()
        h, w = result_image.shape[:2]

        # 统计颜色使用
        color_legend: dict[str, int] = {}

        # 处理掩码（如果提供）
        if masks:
            for mask in masks[:max_display]:
                # 获取对应的检测结果
                det = self._find_matching_detection(detections, mask.bbox)
                label = det.label if det else "unknown"
                color = self.get_color(label)

                # 叠加掩码
                result_image = self._blend_mask(result_image, mask.mask, color)

                # 记录颜色使用
                cat_type = get_category_type(label)
                color_legend[cat_type] = color_legend.get(cat_type, 0) + 1

        # 绘制边界框和标签
        for i, det in enumerate(detections[:max_display]):
            color = self.get_color(det.label)

            # 构建标签文本
            label_parts = []
            if show_labels:
                label_parts.append(det.label)
            if show_confidence:
                label_parts.append(f"{det.confidence:.0%}")

            label_text = " ".join(label_parts) if label_parts else None

            # 绘制边界框
            result_image = self._draw_bbox(
                result_image,
                det.bbox,
                label_text,
                color,
            )

            # 记录颜色使用
            cat_type = get_category_type(det.label)
            color_legend[cat_type] = color_legend.get(cat_type, 0) + 1

        return VisualizationResult(
            image=result_image,
            object_count=len(detections),
            color_legend=color_legend,
        )

    def _find_matching_detection(
        self,
        detections: list[DetectedObject],
        bbox: tuple[int, int, int, int],
        iou_threshold: float = 0.5,
    ) -> Optional[DetectedObject]:
        """根据 bbox 找到匹配的检测结果"""
        if not detections:
            return None

        # 计算 IoU
        def compute_iou(box1, box2):
            x1_min, y1_min, x1_max, y1_max = box1
            x2_min, y2_min, x2_max, y2_max = box2

            inter_xmin = max(x1_min, x2_min)
            inter_ymin = max(y1_min, y2_min)
            inter_xmax = min(x1_max, x2_max)
            inter_ymax = min(y1_max, y2_max)

            if inter_xmax <= inter_xmin or inter_ymax <= inter_ymin:
                return 0.0

            inter_area = (inter_xmax - inter_xmin) * (inter_ymax - inter_ymin)
            box1_area = (x1_max - x1_min) * (y1_max - y1_min)
            box2_area = (x2_max - x2_min) * (y2_max - y2_min)

            return inter_area / float(box1_area + box2_area - inter_area)

        best_det = None
        best_iou = iou_threshold

        for det in detections:
            iou = compute_iou(det.bbox, bbox)
            if iou > best_iou:
                best_iou = iou
                best_det = det

        return best_det

    def _blend_mask(
        self,
        image: np.ndarray,
        mask: np.ndarray,
        color: tuple[int, int, int],
    ) -> np.ndarray:
        """将掩码叠加到图像上（仅在掩膜区域内混合，不影响其他区域）"""
        result = image.copy()

        # 确保掩码是正确的形状
        if mask.shape[:2] != image.shape[:2]:
            # 缩放掩码到图像尺寸
            mask_resized = cv2.resize(
                mask.astype(np.uint8),
                (image.shape[1], image.shape[0]),
                interpolation=cv2.INTER_NEAREST,
            )
            mask_bool = mask_resized > 0
        else:
            mask_bool = mask > 0 if mask.dtype == bool else mask > 0

        # 仅在掩膜区域内混合颜色
        # 使用 alpha 混合：result = original * (1-alpha) + color * alpha
        for c in range(3):
            result[:, :, c] = np.where(
                mask_bool,
                (image[:, :, c] * (1 - self.mask_alpha) + color[c] * self.mask_alpha).astype(np.uint8),
                image[:, :, c]
            )

        return result

    def _draw_bbox(
        self,
        image: np.ndarray,
        bbox: tuple[int, int, int, int],
        label: str = None,
        color: tuple[int, int, int] = None,
    ) -> np.ndarray:
        """绘制带标签的边界框"""
        x1, y1, x2, y2 = bbox
        color = color or (0, 255, 0)

        # 绘制边框
        cv2.rectangle(image, (x1, y1), (x2, y2), color, self.box_thickness)

        # 绘制角标（增强视觉效果）
        corner_length = 10
        # 左上角
        cv2.line(image, (x1, y1), (x1 + corner_length, y1), color, 3)
        cv2.line(image, (x1, y1), (x1, y1 + corner_length), color, 3)
        # 右上角
        cv2.line(image, (x2, y1), (x2 - corner_length, y1), color, 3)
        cv2.line(image, (x2, y1), (x2, y1 + corner_length), color, 3)
        # 左下角
        cv2.line(image, (x1, y2), (x1 + corner_length, y2), color, 3)
        cv2.line(image, (x1, y2), (x1, y2 - corner_length), color, 3)
        # 右下角
        cv2.line(image, (x2, y2), (x2 - corner_length, y2), color, 3)
        cv2.line(image, (x2, y2), (x2, y2 - corner_length), color, 3)

        # 添加标签背景
        if label:
            # 计算标签尺寸
            (tw, th), baseline = cv2.getTextSize(
                label,
                cv2.FONT_HERSHEY_SIMPLEX,
                self.font_scale,
                1,
            )

            # 标签背景位置（在 bbox 上方或内部）
            label_y = max(y1 - 8, th + 8)
            if y1 < th + 16:
                # 如果上方空间不够，放在 bbox 内部上方
                label_y = y1 + th + 8

            # 绘制标签背景
            cv2.rectangle(
                image,
                (x1, label_y - th - 4),
                (x1 + tw + 8, label_y + 4),
                color,
                -1,  # 填充
            )

            # 绘制标签文字
            cv2.putText(
                image,
                label,
                (x1 + 4, label_y),
                cv2.FONT_HERSHEY_SIMPLEX,
                self.font_scale,
                (255, 255, 255),  # 白色文字
                1,
                cv2.LINE_AA,
            )

        return image

    def create_legend(
        self,
        width: int = 200,
        height: int = None,
    ) -> np.ndarray:
        """创建颜色图例图像

        Args:
            width: 图例宽度
            height: 图例高度（默认根据类别数量自动计算）

        Returns:
            图例图像 (BGR)
        """
        if not self.colors:
            return np.zeros((50, width, 3), dtype=np.uint8)

        # 过滤掉 default
        items = [(k, v) for k, v in self.colors.items() if k != "default"]

        if height is None:
            height = 30 + len(items) * 28

        legend = np.ones((height, width, 3), dtype=np.uint8) * 40

        # 标题
        cv2.putText(
            legend,
            "Color Legend",
            (10, 25),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            1,
        )

        # 颜色条目
        y_offset = 55
        for label, color in items:
            # 颜色方块
            cv2.rectangle(legend, (10, y_offset - 12), (30, y_offset + 2), color, -1)
            cv2.rectangle(legend, (10, y_offset - 12), (30, y_offset + 2), (255, 255, 255), 1)

            # 标签文字
            display_name = {
                "vehicle": "Vehicle",
                "person": "Person",
                "truck": "Truck",
                "bus": "Bus",
                "bicycle": "Bicycle",
                "motorcycle": "Motorcycle",
                "obstacle": "Obstacle",
                "traffic_light": "Traffic Light",
            }.get(label, label.title())

            cv2.putText(
                legend,
                display_name,
                (38, y_offset),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                (255, 255, 255),
                1,
            )

            y_offset += 28

        return legend

    def add_legend_overlay(
        self,
        image: np.ndarray,
        color_legend: dict,
        position: str = "top-right",
    ) -> np.ndarray:
        """在图像角落添加图例叠加

        Args:
            image: 输入图像
            color_legend: 颜色统计字典 {"category": count, ...}
            position: 位置 "top-right" | "top-left" | "bottom-right" | "bottom-left"

        Returns:
            添加图例后的图像
        """
        if not color_legend:
            return image

        # 构建图例文本
        lines = []
        for cat, count in sorted(color_legend.items(), key=lambda x: -x[1]):
            display_name = {
                "vehicle": "Car",
                "person": "Person",
                "truck": "Truck",
                "bus": "Bus",
                "bicycle": "Bike",
                "motorcycle": "Moto",
                "obstacle": "Obstacle",
                "traffic_light": "Light",
            }.get(cat, cat.title())
            lines.append(f"{display_name}: {count}")
            lines.append(f"    [{','.join(map(str, self.colors.get(cat, (0, 0, 0))))}]")

        if not lines:
            return image

        # 创建图例区域
        h, w = image.shape[:2]
        line_height = 18
        legend_height = 30 + len(lines) * line_height + 10
        legend_width = 150

        # 背景
        legend_bg = np.ones((legend_height, legend_width, 3), dtype=np.uint8) * 30
        cv2.rectangle(legend_bg, (0, 0), (legend_width - 1, legend_height - 1), (100, 100, 100), 1)

        # 标题
        cv2.putText(legend_bg, "Detection", (10, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        # 绘制每个颜色条
        y_offset = 40
        for i, cat in enumerate(sorted(color_legend.keys(), key=lambda x: -color_legend[x])):
            count = color_legend[cat]
            color = self.colors.get(cat, (200, 200, 100))

            display_name = {
                "vehicle": "Car",
                "person": "Person",
                "truck": "Truck",
                "bus": "Bus",
                "bicycle": "Bike",
                "motorcycle": "Moto",
                "obstacle": "Obstacle",
                "traffic_light": "Light",
            }.get(cat, cat.title())

            # 颜色方块
            cv2.rectangle(legend_bg, (10, y_offset - 10), (30, y_offset + 2), color, -1)

            # 文字
            text = f"{display_name}: {count}"
            cv2.putText(legend_bg, text, (38, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)

            y_offset += line_height

        # 叠加到原图
        x, y = 0, 0
        if position == "top-right":
            x = w - legend_width - 10
            y = 10
        elif position == "top-left":
            x = 10
            y = 10
        elif position == "bottom-right":
            x = w - legend_width - 10
            y = h - legend_height - 10
        elif position == "bottom-left":
            x = 10
            y = h - legend_height - 10

        # 确保不超出边界
        x = max(0, min(x, w - legend_width))
        y = max(0, min(y, h - legend_height))

        # 创建掩码进行叠加
        mask = (legend_bg > 30).any(axis=2)
        image[y:y+legend_height, x:x+legend_width][mask] = legend_bg[mask]

        return image

    def get_detection_summary(
        self,
        detections: list[DetectedObject],
        tracked: list = None,
    ) -> str:
        """生成检测摘要文本（用于提示词）

        Args:
            detections: 检测结果列表
            tracked: 跟踪结果列表（可选）

        Returns:
            结构化摘要文本
        """
        # 按类别统计
        category_count: dict[str, int] = {}
        for det in detections:
            cat = get_category_type(det.label)
            category_count[cat] = category_count.get(cat, 0) + 1

        # 生成摘要
        parts = []
        for cat, count in sorted(category_count.items(), key=lambda x: -x[1]):
            cat_name = {
                "vehicle": "车辆",
                "person": "行人",
                "truck": "卡车",
                "bus": "公交车",
                "bicycle": "自行车",
                "motorcycle": "摩托车",
                "obstacle": "障碍物",
            }.get(cat, cat)
            parts.append(f"{cat_name} {count} 辆/个")

        summary = f"检测到 {len(detections)} 个目标：{'，'.join(parts)}"

        # 添加跟踪信息
        if tracked:
            moving = sum(1 for t in tracked if getattr(t, 'status', None) == 'moving')
            stationary = sum(1 for t in tracked if getattr(t, 'status', None) == 'stationary')
            summary += f"（其中 {moving} 个移动中，{stationary} 个静止）"

        return summary

    def build_gemma_prompt(
        self,
        detections: list[DetectedObject],
        masks: list = None,
        tracked: list = None,
    ) -> dict:
        """构建发送给 Gemma 的完整提示词（对齐 stage4_gemma_prompt.txt 格式）

        Args:
            detections: 检测结果列表
            masks: 分割掩码列表（可选）
            tracked: 跟踪结果列表（可选）

        Returns:
            dict: 包含 prompt 文本和结构化数据
        """
        # 颜色名称映射
        COLOR_NAMES = {
            'person': '绿色',
            'vehicle': '蓝色',
            'bicycle': '浅蓝色',
            'motorcycle': '浅蓝色',
            'obstacle': '红色',
            'default': '黄绿色',
        }

        def get_color_name(label: str) -> str:
            cat = get_category_type(label)
            return COLOR_NAMES.get(cat, '黄绿色')

        # 生成检测摘要行
        detection_lines = []
        for d in detections:
            color = get_color_name(d.label)
            conf_pct = int(d.confidence * 100)
            detection_lines.append(f'- {d.label}（{color}掩膜，置信度 {conf_pct}%）')

        # 生成 SAM 分割详细信息
        sam_details = []
        if masks:
            for i, m in enumerate(masks):
                det = detections[i] if i < len(detections) else None
                label = det.label if det else 'unknown'
                color = get_color_name(label)
                conf_pct = float(m.confidence) * 100
                sam_details.append(f'  - {label}: {color}掩膜 {int(m.area):,} 像素, SAM置信度 {conf_pct:.1f}%')

        # 构建 prompt
        detection_summary = '\n'.join(detection_lines) if detection_lines else '无检测目标'
        sam_summary = '\n'.join(sam_details) if sam_details else '  无分割结果'

        prompt = f'''请分析这张航拍图像，判断是否存在以下6类道路异常之一：

【异常类型定义】
1. collision - 交通事故/碰撞（车辆聚集、变形、散落物）
2. pothole - 路面塌陷/坑洞（路面凹陷、颜色变暗）
3. obstacle - 道路障碍物（落石、遗撒物）
4. parking - 异常停车（应急车道停车）
5. pedestrian - 行人闯入（人形出现在非正常区域）
6. congestion - 交通拥堵（车辆密集、排队）

【图像中SAM分割掩膜颜色图例】
- 绿色掩膜 → 行人 person
- 蓝色掩膜 → 车辆 car/truck/bus
- 浅蓝色掩膜 → 自行车/摩托车
- 黄绿色掩膜 → 其他目标

【当前画面检测摘要】
- 检测到 {len(detections)} 个目标：
{detection_summary}

【SAM分割详细信息】
{sam_summary}

【输出要求】
请按JSON格式输出（只输出JSON，不要其他内容）：
{{
    "has_incident": true/false,
    "incident_type": "collision/pothole/obstacle/parking/pedestrian/congestion/none",
    "confidence": 0.0-1.0,
    "description": "描述发现的情况（50字内）",
    "recommendation": "处置建议（30字内）"
}}

请用中文回答。'''

        return {
            'prompt': prompt,
            'detection_summary': f'检测到 {len(detections)} 个目标：\n{detection_summary}' if detection_lines else '无检测目标',
            'sam_details': sam_details,
            'detections': [
                {
                    'label': d.label,
                    'color': get_color_name(d.label),
                    'confidence': int(d.confidence * 100),
                    'bbox': d.bbox,
                }
                for d in detections
            ],
            'masks': [
                {
                    'label': (detections[i].label if i < len(detections) else 'unknown') if masks else None,
                    'color': get_color_name(detections[i].label if i < len(detections) else 'unknown') if masks else None,
                    'pixel_count': int(m.area),
                    'confidence': float(m.confidence),
                }
                for i, m in enumerate(masks) if masks
            ] if masks else [],
        }


# ── 便捷函数 ────────────────────────────────────────────────────────────────────

def visualize_detections(
    image: np.ndarray,
    detections: list[DetectedObject],
    masks: list[SegmentationMask] = None,
) -> np.ndarray:
    """便捷函数：一行代码可视化检测结果

    Args:
        image: 原始图像
        detections: YOLO 检测结果
        masks: SAM 分割掩码（可选）

    Returns:
        可视化后的图像
    """
    viz = MaskVisualizer()
    result = viz.visualize(image, detections, masks)
    return result.image


def image_to_base64(image: np.ndarray, format: str = "JPEG", quality: int = 85) -> str:
    """将图像转换为 base64 字符串

    Args:
        image: BGR 图像
        format: 输出格式 "JPEG" 或 "PNG"
        quality: JPEG 质量 (1-100)

    Returns:
        base64 编码的字符串
    """
    from io import BytesIO
    import base64 as b64

    if image is None:
        return ""

    # 确保是 RGB
    if len(image.shape) == 3 and image.shape[2] == 3:
        # BGR → RGB
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    else:
        rgb_image = image

    buf = BytesIO()
    pil_image = Image.fromarray(rgb_image)
    pil_image.save(buf, format=format, quality=quality)
    return b64.b64encode(buf.getvalue()).decode("utf-8")


# 导入 PIL（用于 base64 转换）
try:
    from PIL import Image
except ImportError:
    Image = None
