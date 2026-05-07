# backend/app/services/pipeline.py
"""Pipeline - 单路视频处理流程"""
from __future__ import annotations

import asyncio
import uuid
from typing import AsyncGenerator, Optional

from app.services.types import PipelineStatus, SSEEvent


class Pipeline:
    """单路视频 Pipeline
    
    负责协调各服务完成视频处理流程：
    1. 视频帧提取 (VideoService)
    2. 目标检测+分割 (PerceptionService)
    3. 视觉分析 (VisionService)
    4. RAG 检索 (RAGService)
    5. 决策输出 (DecisionService)
    """
    
    def __init__(
        self,
        video_id: str,
        video_service=None,
        perception_service=None,
        vision_service=None,
        rag_service=None,
        decision_service=None,
    ):
        self.id = str(uuid.uuid4())[:8]
        self.video_id = video_id
        self.status = PipelineStatus.IDLE
        self._stop_event = asyncio.Event()
        
        # 服务引用
        self._services = {
            "video": video_service,
            "perception": perception_service,
            "vision": vision_service,
            "rag": rag_service,
            "decision": decision_service,
        }
    
    @property
    def video_service(self):
        return self._services.get("video")
    
    @property
    def perception_service(self):
        return self._services.get("perception")
    
    @property
    def vision_service(self):
        return self._services.get("vision")
    
    @property
    def rag_service(self):
        return self._services.get("rag")
    
    @property
    def decision_service(self):
        return self._services.get("decision")
    
    async def start(self) -> AsyncGenerator[SSEEvent, None]:
        """启动 Pipeline，返回 SSE 事件流"""
        if self.status == PipelineStatus.RUNNING:
            return
        
        self.status = PipelineStatus.RUNNING
        self._stop_event.clear()
        
        try:
            # 检查必需服务
            if not self.video_service:
                yield SSEEvent(event="error", data={"error": "VideoService not configured"})
                self.status = PipelineStatus.ERROR
                return
            
            # 提取帧
            yield SSEEvent(event="stage", data={
                "stage": "perception",
                "progress": 5,
                "status": "running"
            })
            
            frames = self.video_service.extract_frames(count=3)
            if not frames:
                yield SSEEvent(event="error", data={"error": "No frames extracted"})
                self.status = PipelineStatus.ERROR
                return
            
            # 处理每一帧
            for idx, frame_data in enumerate(frames):
                if self._stop_event.is_set():
                    break
                
                frame_base = idx * 30
                
                # 感知层
                if self.perception_service:
                    annotated = self.perception_service.process_frame(
                        frame_data.frame_bgr,
                        frame_idx=frame_data.frame_idx
                    )
                    
                    yield SSEEvent(event="frame_data", data={
                        "frame_idx": frame_data.frame_idx,
                        "timestamp": f"{frame_data.timestamp:.1f}s",
                        "resolution": annotated.result.resolution,
                        "detections": annotated.result.detections,
                        "segmentations": annotated.result.segmentations,
                        "detection_details": [
                            {"label": d.label, "bbox": d.bbox, "confidence": d.confidence}
                            for d in annotated.result.detection_details
                        ],
                        "mask_details": [
                            {"label": m.label, "color": m.color, "pixel_count": m.pixel_count, "confidence": m.confidence}
                            for m in annotated.result.mask_details
                        ],
                        "combined_image_url": annotated.image_url,
                    })
                    
                    yield SSEEvent(event="stage", data={
                        "stage": "perception",
                        "progress": frame_base + 10,
                        "status": "done"
                    })
                
                # 视觉分析层
                if self.vision_service:
                    yield SSEEvent(event="stage", data={
                        "stage": "identify",
                        "progress": frame_base + 20,
                        "status": "running"
                    })
                    
                    # 转换检测结果为 dict 格式
                    yolo_detections = None
                    if self.perception_service and annotated:
                        yolo_detections = [
                            {"label": d.label, "bbox": d.bbox, "confidence": d.confidence}
                            for d in annotated.result.detection_details
                        ]
                    
                    try:
                        vision_result = await self.vision_service.analyze(
                            frame_data.frame_bgr,
                            yolo_detections=yolo_detections
                        )
                    except Exception as e:
                        print(f"[Pipeline] Vision analysis failed: {e}")
                        # 回退：使用默认结果
                        from app.services.types import VisionResult
                        vision_result = VisionResult(
                            has_event=False,
                            incident_type="none",
                            severity="none",
                            confidence=0.5,
                            scene_description="分析失败，回退为正常",
                            description="视觉分析异常"
                        )
                    
                    yield SSEEvent(event="stage", data={
                        "stage": "identify",
                        "progress": frame_base + 45,
                        "status": "done",
                        "summary": vision_result.scene_description[:60],
                        "detail": vision_result.scene_description,
                        "incident_type": vision_result.incident_type,
                        "severity": vision_result.severity,
                        "confidence": vision_result.confidence,
                    })
                    
                    # RAG + 决策层（仅异常场景）
                    if vision_result.incident_type != "none" and vision_result.has_event:
                        if self.rag_service:
                            yield SSEEvent(event="stage", data={
                                "stage": "rag",
                                "progress": frame_base + 55,
                                "status": "running"
                            })
                            
                            rag_context = self.rag_service.get_context(
                                f"{vision_result.incident_type}高速公路交通事件",
                                top_k=3
                            )
                            
                            yield SSEEvent(event="stage", data={
                                "stage": "rag",
                                "progress": frame_base + 65,
                                "status": "done",
                                "snippets": rag_context.split("\n") if rag_context else [],
                            })
                        
                        if self.decision_service:
                            yield SSEEvent(event="stage", data={
                                "stage": "decision",
                                "progress": frame_base + 70,
                                "status": "running"
                            })
                            
                            try:
                                decision = await self.decision_service.decide(
                                    incident_type=vision_result.incident_type,
                                    scene_description=vision_result.scene_description
                                )
                                
                                yield SSEEvent(event="stage", data={
                                    "stage": "decision",
                                    "progress": frame_base + 85,
                                    "status": "done",
                                    "detail": {
                                        "has_incident": vision_result.has_event,
                                        "incident_type": vision_result.incident_type,
                                        "severity": vision_result.severity,
                                        "risk_level": decision.risk_level,
                                        "title": decision.title,
                                        "recommendation": decision.recommended_response,
                                        "confidence": vision_result.confidence,
                                    },
                                })
                            except Exception as e:
                                print(f"[Pipeline] Decision failed: {e}")
                                yield SSEEvent(event="stage", data={
                                    "stage": "decision",
                                    "progress": frame_base + 85,
                                    "status": "done",
                                    "detail": {
                                        "has_incident": vision_result.has_event,
                                        "incident_type": vision_result.incident_type,
                                        "severity": vision_result.severity,
                                        "risk_level": "low",
                                        "title": "分析完成",
                                        "recommendation": "持续监控",
                                        "confidence": vision_result.confidence,
                                    },
                                })
                    else:
                        # 正常场景，跳过 RAG + 决策
                        yield SSEEvent(event="stage", data={
                            "stage": "rag",
                            "progress": frame_base + 55,
                            "status": "skipped",
                            "summary": "暂不进行 SOP 检索",
                            "reason": "识别层判断无异常",
                        })
                        yield SSEEvent(event="stage", data={
                            "stage": "decision",
                            "progress": frame_base + 70,
                            "status": "skipped",
                            "summary": "暂不进行事故深度决策",
                            "reason": "识别层判断无异常",
                        })
                    
                    # 发送预警
                    yield SSEEvent(event="alert", data={
                        "id": int(asyncio.get_event_loop().time() * 1000),
                        "title": vision_result.scene_description[:20] if vision_result.has_event else "道路通行正常",
                        "description": vision_result.description,
                        "risk_level": "low",
                        "incident_type": vision_result.incident_type,
                        "severity": vision_result.severity,
                        "recommendation": "持续监控" if not vision_result.has_event else "",
                        "confidence": vision_result.confidence,
                        "scene_description": vision_result.scene_description,
                        "source_type": "demo",
                    })
                
                await asyncio.sleep(0.8)
            
            self.status = PipelineStatus.DONE
            
        except Exception as e:
            print(f"[Pipeline] 执行异常: {e}")
            import traceback
            traceback.print_exc()
            yield SSEEvent(event="error", data={"error": str(e)})
            self.status = PipelineStatus.ERROR
    
    async def stop(self):
        """停止 Pipeline"""
        self._stop_event.set()
        self.status = PipelineStatus.STOPPING
