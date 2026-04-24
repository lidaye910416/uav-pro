# -*- coding: utf-8 -*-
"""增强提示词生成模块 - 整合检测、跟踪结果生成结构化提示词"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
import json

from .yolo_detector import DetectedObject
from .deepsort_tracker import TrackedObject


@dataclass
class AnomalyIndicator:
    """异常指示器"""
    type: str        # collision/parking/pedestrian/congestion/obstacle
    description: str # 描述文本
    confidence: float = 0.5
    involved_ids: list[int] = None  # 涉及的跟踪对象 ID

    def __post_init__(self):
        if self.involved_ids is None:
            self.involved_ids = []


class PromptBuilder:
    """增强提示词生成器
    
    整合 YOLOv8 检测、Deep SORT 跟踪、异常分析结果，
    生成结构化 JSON 供 Gemma 4 E2B 分析。
    """

    # 异常检测规则配置
    STATIONARY_THRESHOLD = 2.0   # 速度阈值（像素/帧），低于此值视为静止
    STATIONARY_FRAMES = 10       # 持续静止帧数阈值（触发违停判断）
    TRAJECTORY_OVERLAP_THRESHOLD = 0.3  # 轨迹重叠阈值（碰撞判断）

    def __init__(self, scene_context: str = "高速公路航拍"):
        """初始化提示词生成器

        Args:
            scene_context: 场景描述文本
        """
        self.scene_context = scene_context
        self._history: dict[int, list] = {}  # 跟踪对象历史轨迹

    def build(
        self,
        detected: list[DetectedObject],
        tracked: list[TrackedObject],
        frame_idx: int = 0,
        timestamp: float = 0.0,
        resolution: tuple[int, int] = (1920, 1080),
    ) -> dict:
        """生成增强提示词

        Args:
            detected: YOLOv8 检测到的目标列表
            tracked: Deep SORT 跟踪的目标列表
            frame_idx: 当前帧索引
            timestamp: 当前帧时间戳（秒）
            resolution: 视频分辨率 (w, h)

        Returns:
            结构化提示词字典
        """
        # 更新历史轨迹
        for obj in tracked:
            if obj.track_id not in self._history:
                self._history[obj.track_id] = []
            self._history[obj.track_id].append({
                "frame_idx": frame_idx,
                "center": obj.center,
                "bbox": obj.bbox,
            })
            # 保持历史长度（最近 30 帧）
            if len(self._history[obj.track_id]) > 30:
                self._history[obj.track_id].pop(0)

        # 分析异常指标
        anomaly_indicators = self._analyze_anomalies(tracked, frame_idx)

        # 构建对象列表
        objects = []
        for obj in tracked:
            trajectory_coords = [
                (p["center"][0], p["center"][1])
                for p in self._history.get(obj.track_id, [])
            ]

            objects.append({
                "id": obj.track_id,
                "type": obj.category,
                "label": obj.label,
                "confidence": float(obj.confidence),
                "bbox": list(obj.bbox),
                "bbox_normalized": self._normalize_bbox(obj.bbox, resolution),
                "trajectory": trajectory_coords,
                "trajectory_normalized": self._normalize_trajectory(trajectory_coords, resolution),
                "speed": f"{obj.speed:.1f}px/f",
                "motion_state": obj.status,
                "age": obj.age,
            })

        # 归一化 ROI 坐标
        roi_list = []
        for obj in detected:
            roi_list.append({
                "x1": round(obj.bbox[0] / resolution[0] * 100, 1),
                "y1": round(obj.bbox[1] / resolution[1] * 100, 1),
                "x2": round(obj.bbox[2] / resolution[0] * 100, 1),
                "y2": round(obj.bbox[3] / resolution[1] * 100, 1),
                "confidence": float(obj.confidence),
                "label": obj.label,
                "category": obj.category,
            })

        # 构建提示词
        prompt = {
            "frame_info": {
                "frame_idx": frame_idx,
                "timestamp": f"{timestamp:.1f}s",
                "resolution": f"{resolution[0]}×{resolution[1]}",
                "total_detections": len(detected),
                "active_tracks": len(tracked),
            },
            "objects": objects,
            "rois": roi_list,
            "anomaly_indicators": [
                {
                    "type": a.type,
                    "description": a.description,
                    "confidence": float(a.confidence),
                    "involved_ids": a.involved_ids,
                }
                for a in anomaly_indicators
            ],
            "suspected_incidents": list(set(a.type for a in anomaly_indicators)),
            "scene_context": self.scene_context,
        }

        return prompt

    def _analyze_anomalies(
        self,
        tracked: list[TrackedObject],
        frame_idx: int,
    ) -> list[AnomalyIndicator]:
        """分析跟踪对象，检测异常行为

        Args:
            tracked: 当前帧跟踪的目标列表
            frame_idx: 当前帧索引

        Returns:
            异常指示器列表
        """
        indicators = []

        # 1. 检测静止目标（潜在违停）
        stationary_objs = [
            obj for obj in tracked
            if obj.status == "stationary" and obj.category == "vehicle"
        ]
        for obj in stationary_objs:
            if obj.age > self.STATIONARY_FRAMES:
                indicators.append(AnomalyIndicator(
                    type="parking",
                    description=f"车辆 ID={obj.track_id} 在位置 {obj.center} 静止超过 {obj.age} 帧",
                    confidence=0.75,
                    involved_ids=[obj.track_id],
                ))

        # 2. 检测轨迹重叠（潜在碰撞）
        for i, obj_a in enumerate(tracked):
            for obj_b in tracked[i+1:]:
                if self._check_trajectory_overlap(obj_a, obj_b):
                    indicators.append(AnomalyIndicator(
                        type="collision",
                        description=f"ID={obj_a.track_id} 和 ID={obj_b.track_id} 轨迹重叠，可能发生碰撞",
                        confidence=0.85,
                        involved_ids=[obj_a.track_id, obj_b.track_id],
                    ))

        # 3. 检测行人进入行车道
        for obj in tracked:
            if obj.category == "person" and obj.status == "moving":
                # 检查是否在道路中央（简化：y 坐标在画面中下部）
                cx, cy = obj.center
                h = obj.bbox[3] - obj.bbox[1]
                # 假设画面中下部是行车道
                if cy > h * 0.4:  # 在画面中下部
                    indicators.append(AnomalyIndicator(
                        type="pedestrian",
                        description=f"行人 ID={obj.track_id} 进入道路区域，位置 {obj.center}",
                        confidence=0.80,
                        involved_ids=[obj.track_id],
                    ))

        # 4. 检测拥堵（车辆密度过高）
        if len([obj for obj in tracked if obj.category == "vehicle"]) > 5:
            # 简化的拥堵检测：画面中超过 5 辆车
            indicators.append(AnomalyIndicator(
                type="congestion",
                description=f"检测到 {len([obj for obj in tracked if obj.category == 'vehicle'])} 辆车，可能存在拥堵",
                confidence=0.65,
                involved_ids=[obj.track_id for obj in tracked if obj.category == "vehicle"],
            ))

        return indicators

    def _check_trajectory_overlap(
        self,
        obj_a: TrackedObject,
        obj_b: TrackedObject,
    ) -> bool:
        """检查两个对象的轨迹是否重叠"""
        history_a = self._history.get(obj_a.track_id, [])
        history_b = self._history.get(obj_b.track_id, [])

        if not history_a or not history_b:
            return False

        # 检查最近几帧的中心点距离
        for p_a in history_a[-5:]:
            for p_b in history_b[-5:]:
                dx = p_a["center"][0] - p_b["center"][0]
                dy = p_a["center"][1] - p_b["center"][1]
                dist = (dx**2 + dy**2)**0.5
                if dist < 50:  # 距离小于 50 像素视为重叠
                    return True

        return False

    def _normalize_bbox(
        self,
        bbox: tuple[int, int, int, int],
        resolution: tuple[int, int],
    ) -> dict:
        """将 bbox 归一化到 0-100 范围"""
        w, h = resolution
        x1, y1, x2, y2 = bbox
        return {
            "x1": round(x1 / w * 100, 2),
            "y1": round(y1 / h * 100, 2),
            "x2": round(x2 / w * 100, 2),
            "y2": round(y2 / h * 100, 2),
        }

    def _normalize_trajectory(
        self,
        trajectory: list[tuple[int, int]],
        resolution: tuple[int, int],
    ) -> list[dict]:
        """将轨迹点归一化到 0-100 范围"""
        w, h = resolution
        return [
            {"x": round(x / w * 100, 2), "y": round(y / h * 100, 2)}
            for x, y in trajectory
        ]

    def reset(self) -> None:
        """重置历史记录"""
        self._history.clear()

    def to_json_string(self, prompt: dict) -> str:
        """将提示词转换为 JSON 字符串（用于调试）"""
        return json.dumps(prompt, ensure_ascii=False, indent=2)
