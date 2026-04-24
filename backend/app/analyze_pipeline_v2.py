"""道路异常事件检测 Pipeline V2 - 帧差法 + Gemma + RAG 完整流程"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, List, Optional

import cv2
import numpy as np
import yaml

from app.services.anomaly import AnomalyIdentifier, AnomalyResult
from app.services.perception.motion_detector import MotionDetector, MotionROI
from app.rag_service_v2 import RAGServiceV2


@dataclass
class AlertResult:
    """最终预警结果"""
    has_incident: bool = False
    incident_type: str = "none"
    risk_level: str = "low"  # low/medium/high/critical
    title: str = ""
    description: str = ""
    recommendation: str = ""
    confidence: float = 0.0
    urgency: str = "deferred"  # immediate/deferred
    source_sop: str = ""
    visual_evidence: List[str] = field(default_factory=list)
    location_hint: str = ""
    timestamp: str = ""
    
    def to_dict(self) -> dict[str, Any]:
        """转换为字典"""
        return {
            "has_incident": self.has_incident,
            "incident_type": self.incident_type,
            "risk_level": self.risk_level,
            "title": self.title,
            "description": self.description,
            "recommendation": self.recommendation,
            "confidence": self.confidence,
            "urgency": self.urgency,
            "source_sop": self.source_sop,
            "visual_evidence": self.visual_evidence,
            "location_hint": self.location_hint,
            "timestamp": self.timestamp,
        }


class RoadAnomalyPipeline:
    """完整流程: 帧差法 → 候选ROI → Gemma异常识别 → RAG检索 → 决策 → 预警
    
    使用 Gemma4-e2b 作为统一多模态模型
    """
    
    def __init__(
        self,
        motion_config_path: str | None = None,
        ollama_url: str | None = None,
        model: str | None = None,
        mock_mode: bool = False,
    ) -> None:
        # 加载运动检测配置
        self._motion_config = self._load_motion_config(motion_config_path)
        
        # 初始化运动检测器
        fd_config = self._motion_config.get("frame_difference", {})
        self.motion_detector = MotionDetector(
            threshold=fd_config.get("threshold", 25),
            min_area=fd_config.get("min_area", 500),
            max_area=fd_config.get("max_area", 50000),
            blur_size=fd_config.get("blur_size", 5),
            morph_size=fd_config.get("morph_size", 5),
        )
        
        # 初始化异常识别器 (Gemma4-e2b)
        self.mock_mode = mock_mode
        if not mock_mode:
            self.anomaly_identifier = AnomalyIdentifier(
                ollama_url=ollama_url,
                model=model,
            )
        
        # 初始化 RAG 服务
        self.rag_service = RAGServiceV2()
        
        # ROI 配置
        roi_config = self._motion_config.get("roi", {})
        self.roi_padding = roi_config.get("padding", 10)
        
        # 统计信息
        self.stats = {
            "frames_processed": 0,
            "rois_detected": 0,
            "incidents_found": 0,
        }
    
    def _load_motion_config(self, config_path: str | None) -> dict:
        """加载 motion.yaml 配置"""
        if config_path is None:
            config_path = "/Users/jasonlee/UAV_PRO/website/backend/config/motion.yaml"
        
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                return yaml.safe_load(f)
        except Exception:
            return {
                "frame_difference": {
                    "threshold": 25,
                    "min_area": 500,
                    "max_area": 50000,
                    "blur_size": 5,
                    "morph_size": 5,
                },
                "roi": {"padding": 10}
            }
    
    def reset(self) -> None:
        """重置内部状态"""
        self.motion_detector.reset()
        self.stats = {
            "frames_processed": 0,
            "rois_detected": 0,
            "incidents_found": 0,
        }
    
    def process_frame(self, frame: np.ndarray) -> List[AlertResult]:
        """处理单帧图像
        
        Args:
            frame: BGR 格式的 numpy 数组 (H, W, 3)
            
        Returns:
            检测到的异常列表 (AlertResult)
        """
        self.stats["frames_processed"] += 1
        
        # Step 1: 帧差法检测运动区域
        rois = self.motion_detector.detect(frame)
        self.stats["rois_detected"] += len(rois)
        
        if not rois:
            return []
        
        results = []
        
        # Step 2: 对每个 ROI 进行异常识别
        for roi in rois:
            # 裁剪 ROI 区域
            roi_image = self.motion_detector.crop_roi(frame, roi, self.roi_padding)
            
            # 获取运动信息
            motion_info = {
                "bbox": roi.bbox,
                "area": roi.area,
                "centroid": roi.centroid,
                "aspect_ratio": roi.aspect_ratio,
            }
            
            # Step 3: Gemma 异常识别 (或模拟模式)
            if self.mock_mode:
                anomaly = self._mock_identify(roi, frame)
            else:
                anomaly = self.anomaly_identifier.identify_from_array(
                    roi_image,
                    roi_description=f"检测到运动区域，位置{roi.bbox}",
                    motion_info=motion_info,
                )
            
            if not anomaly.has_incident:
                continue
            
            self.stats["incidents_found"] += 1
            
            # Step 4: RAG 检索 SOP
            rag_context = self.rag_service.retrieve_context(
                incident_type=anomaly.incident_type,
                visual_evidence=anomaly.visual_evidence,
            )
            
            # Step 5: 生成预警结果
            alert = self._generate_alert(anomaly, rag_context, roi)
            results.append(alert)
        
        return results
    
    def _mock_identify(self, roi: MotionROI, frame: np.ndarray) -> AnomalyResult:
        """模拟异常识别 (用于测试)
        
        基于 ROI 的面积和位置模拟识别结果
        """
        # 简单模拟：根据面积判断是否有异常
        if roi.area < 1000:
            return AnomalyResult(
                has_incident=False,
                incident_type="none",
                confidence=0.0,
                description="运动区域过小",
            )
        
        # 模拟识别：随机选择一种异常类型
        import random
        incident_types = ["collision", "congestion", "parking"]
        incident_type = random.choice(incident_types)
        
        return AnomalyResult(
            has_incident=True,
            incident_type=incident_type,
            confidence=0.6 + random.random() * 0.3,
            description=f"模拟检测到{incident_type}异常",
            visual_evidence=["运动区域", "车辆聚集"],
            reason="模拟识别",
        )
    
    def _generate_alert(
        self,
        anomaly: AnomalyResult,
        rag_context: str,
        roi: MotionROI,
    ) -> AlertResult:
        """根据异常和 RAG 上下文生成预警"""
        sop = self.rag_service.retrieve_by_type(
            anomaly.incident_type,
            anomaly.visual_evidence,
        )
        
        # 根据 SOP priority 和异常类型确定 risk_level
        risk_level = self._determine_risk_level(
            anomaly.incident_type,
            anomaly.confidence,
            sop.get("priority", "medium"),
        )
        
        # 生成标题
        title = self._generate_title(anomaly)
        
        # 生成描述
        description = anomaly.description or f"检测到{anomaly.incident_type}异常"
        
        # 从 SOP 内容提取建议
        recommendation = self._extract_recommendation(
            sop.get("content", ""),
            anomaly.incident_type,
        )
        
        return AlertResult(
            has_incident=True,
            incident_type=anomaly.incident_type,
            risk_level=risk_level,
            title=title,
            description=description,
            recommendation=recommendation,
            confidence=anomaly.confidence,
            urgency=sop.get("response_time", "deferred"),
            source_sop=sop.get("id", ""),
            visual_evidence=anomaly.visual_evidence,
            location_hint=f"位置: {roi.bbox}",
            timestamp=datetime.now().isoformat(),
        )
    
    def _determine_risk_level(
        self,
        incident_type: str,
        confidence: float,
        priority: str,
    ) -> str:
        """确定风险等级"""
        base_levels = {
            "high": "high",
            "critical": "critical",
            "medium": "medium",
            "low": "low",
        }
        base = base_levels.get(priority, "medium")
        
        if confidence > 0.8 and base in ["low", "medium"]:
            return "high"
        elif confidence < 0.3 and base in ["high", "critical"]:
            return "medium"
        
        return base
    
    def _generate_title(self, anomaly: AnomalyResult) -> str:
        """生成预警标题"""
        type_names = {
            "collision": "交通事故",
            "pothole": "路面塌陷",
            "obstacle": "道路障碍物",
            "parking": "异常停车",
            "pedestrian": "行人闯入",
            "congestion": "交通拥堵",
        }
        
        type_name = type_names.get(anomaly.incident_type, "未知异常")
        
        if anomaly.confidence > 0.8:
            return f"【确认】{type_name}"
        elif anomaly.confidence > 0.5:
            return f"【疑似】{type_name}"
        else:
            return f"【待确认】{type_name}"
    
    def _extract_recommendation(self, sop_content: str, incident_type: str) -> str:
        """从 SOP 内容提取处置建议"""
        if not sop_content:
            return "请按照标准流程处置"
        
        lines = sop_content.strip().split("\n")
        
        key_steps = []
        for line in lines[:3]:
            line = line.strip()
            if line and line[0].isdigit():
                dot_idx = line.find(".")
                if dot_idx > 0 and dot_idx < 5:
                    line = line[dot_idx+1:].strip()
                key_steps.append(line)
        
        if key_steps:
            return "；".join(key_steps)
        else:
            return "请按照标准流程处置"
    
    def get_stats(self) -> dict[str, Any]:
        """获取统计信息"""
        return self.stats.copy()


def process_video(
    video_path: str,
    max_frames: int = 100,
    skip_frames: int = 2,
    mock_mode: bool = False,
) -> List[AlertResult]:
    """处理视频文件
    
    Args:
        video_path: 视频文件路径
        max_frames: 最大处理帧数 (0=不限制)
        skip_frames: 跳帧数
        mock_mode: 是否使用模拟模式
        
    Returns:
        检测到的所有异常列表
    """
    import time
    
    pipeline = RoadAnomalyPipeline(mock_mode=mock_mode)
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"无法打开视频: {video_path}")
        return []
    
    frame_idx = 0
    all_alerts: List[AlertResult] = []
    
    print(f"开始处理视频: {video_path}")
    print(f"模式: {'模拟' if mock_mode else 'Gemma识别'}")
    print("-" * 60)
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        if frame_idx % skip_frames != 0:
            frame_idx += 1
            continue
        
        start_time = time.time()
        alerts = pipeline.process_frame(frame)
        elapsed = time.time() - start_time
        
        for alert in alerts:
            all_alerts.append(alert)
            print(f"[帧{frame_idx}] {alert.title} - {alert.risk_level} - 置信度:{alert.confidence:.2f}")
        
        frame_idx += 1
        
        if max_frames > 0 and frame_idx >= max_frames:
            print(f"达到最大帧数限制: {max_frames}")
            break
        
        if frame_idx % 50 == 0:
            stats = pipeline.get_stats()
            print(f"进度: {frame_idx}帧, ROI数:{stats['rois_detected']}, 异常:{stats['incidents_found']}")
    
    cap.release()
    
    stats = pipeline.get_stats()
    print("-" * 60)
    print(f"处理完成: 共{stats['frames_processed']}帧")
    print(f"检测到ROI: {stats['rois_detected']}个")
    print(f"发现异常: {stats['incidents_found']}个")
    print(f"输出预警: {len(all_alerts)}个")
    
    return all_alerts


if __name__ == "__main__":
    import sys
    
    test_video = "/Users/jasonlee/UAV_PRO/website/backend/data/streams/gal_1.mp4"
    mock_mode = "--mock" in sys.argv
    
    if len(sys.argv) > 1 and not mock_mode:
        test_video = sys.argv[1]
    
    print("=" * 60)
    print("道路异常事件检测 Pipeline V2 测试")
    print("=" * 60)
    print(f"测试视频: {test_video}")
    print(f"模式: {'模拟模式' if mock_mode else 'Gemma识别'}")
    print("-" * 60)
    
    alerts = process_video(test_video, max_frames=100, skip_frames=3, mock_mode=mock_mode)
    
    if alerts:
        print("\n" + "=" * 60)
        print("检测结果汇总")
        print("=" * 60)
        for i, alert in enumerate(alerts, 1):
            print(f"\n[{i}] {alert.title}")
            print(f"    类型: {alert.incident_type}")
            print(f"    风险: {alert.risk_level}")
            print(f"    描述: {alert.description}")
            print(f"    建议: {alert.recommendation}")
            print(f"    置信度: {alert.confidence:.2f}")
    else:
        print("\n未检测到异常事件")
