# backend/app/services/pipeline_manager.py
"""PipelineManager - 多路 Pipeline 管理器"""
from __future__ import annotations

import asyncio
from typing import Optional

from app.services.pipeline import Pipeline


class PipelineManager:
    """多路 Pipeline 管理器
    
    负责：
    - 管理多个 Pipeline 实例的生命周期
    - 支持并发创建/销毁
    - 提供 Pipeline 查询接口
    """
    
    _instance: Optional["PipelineManager"] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._pipelines = {}
            cls._instance._lock = asyncio.Lock()
            cls._instance._id_counter = 0
        return cls._instance
    
    def create_pipeline(self, video_id: str) -> str:
        """创建新 Pipeline，返回 pipeline_id"""
        from app.services.video_service import VideoService
        from app.services.perception_service import PerceptionService
        
        # 创建 pipeline_id
        self._id_counter += 1
        pipeline_id = f"pipeline_{self._id_counter:04d}"
        
        # 创建服务实例
        video_service = VideoService(video_id)
        perception_service = PerceptionService()
        
        # 创建 Pipeline
        pipeline = Pipeline(
            video_id=video_id,
            video_service=video_service,
            perception_service=perception_service,
        )
        
        # 注册
        self._pipelines[pipeline_id] = pipeline
        
        print(f"[PipelineManager] 创建 Pipeline: {pipeline_id} (video_id={video_id})")
        return pipeline_id
    
    def get_pipeline(self, pipeline_id: str) -> Optional[Pipeline]:
        """获取 Pipeline"""
        return self._pipelines.get(pipeline_id)
    
    def destroy_pipeline(self, pipeline_id: str) -> bool:
        """销毁 Pipeline"""
        if pipeline_id in self._pipelines:
            pipeline = self._pipelines[pipeline_id]
            # 停止 Pipeline
            asyncio.create_task(pipeline.stop())
            # 移除
            del self._pipelines[pipeline_id]
            print(f"[PipelineManager] 销毁 Pipeline: {pipeline_id}")
            return True
        return False
    
    def list_pipelines(self) -> list[dict]:
        """列出所有 Pipeline"""
        return [
            {
                "pipeline_id": pid,
                "video_id": p.video_id,
                "status": p.status.value,
            }
            for pid, p in self._pipelines.items()
        ]
    
    async def cleanup(self):
        """清理所有 Pipeline"""
        for pipeline_id in list(self._pipelines.keys()):
            self.destroy_pipeline(pipeline_id)


# 全局实例获取函数
def get_pipeline_manager() -> PipelineManager:
    """获取 PipelineManager 单例"""
    return PipelineManager()
