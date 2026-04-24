# -*- coding: utf-8 -*-
"""Pipeline 配置读取器 - 读取 config/pipeline.yaml 定义"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional

import yaml


class PipelineConfig:
    """Pipeline 配置读取器
    
    单例模式，全局共享配置
    """
    
    _instance: Optional["PipelineConfig"] = None
    _config: dict[str, Any] = {}
    
    def __new__(cls) -> "PipelineConfig":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._load_config()
        return cls._instance
    
    def _load_config(self) -> None:
        """加载 Pipeline 配置"""
        config_path = Path(__file__).parent.parent / "config" / "pipeline.yaml"
        if not config_path.exists():
            raise FileNotFoundError(f"Pipeline 配置文件不存在: {config_path}")
        
        with open(config_path, "r", encoding="utf-8") as f:
            self._config = yaml.safe_load(f)
    
    def reload(self) -> None:
        """重新加载配置"""
        self._load_config()
    
    @property
    def pipeline_info(self) -> dict[str, Any]:
        """获取 Pipeline 基本信息"""
        return self._config.get("pipeline", {})
    
    @property
    def stage_1(self) -> dict[str, Any]:
        """获取 Stage 1 配置 (目标检测与分割)"""
        return self._config.get("stage_1", {})
    
    @property
    def stage_2(self) -> dict[str, Any]:
        """获取 Stage 2 配置 (异常识别)"""
        return self._config.get("stage_2", {})
    
    @property
    def stage_3(self) -> dict[str, Any]:
        """获取 Stage 3 配置 (RAG检索)"""
        return self._config.get("stage_3", {})
    
    @property
    def stage_4(self) -> dict[str, Any]:
        """获取 Stage 4 配置 (决策输出)"""
        return self._config.get("stage_4", {})
    
    def get_stage(self, stage_key: str) -> dict[str, Any]:
        """获取指定 Stage 配置
        
        Args:
            stage_key: Stage 键名 (detection/identify/rag/decision)
            
        Returns:
            Stage 配置字典
        """
        key_map = {
            "detection": "stage_1",
            "identify": "stage_2",
            "rag": "stage_3",
            "decision": "stage_4",
        }
        config_key = key_map.get(stage_key, stage_key)
        return self._config.get(config_key, {})
    
    def get_anomaly_types(self) -> list[dict[str, Any]]:
        """获取所有异常类型定义"""
        return self.stage_2.get("anomaly_types", [])
    
    def get_anomaly_type(self, key: str) -> Optional[dict[str, Any]]:
        """获取指定异常类型定义
        
        Args:
            key: 异常类型键 (collision/parking/obstacle/pedestrian/congestion/pothole)
            
        Returns:
            异常类型配置或 None
        """
        for at in self.get_anomaly_types():
            if at.get("key") == key:
                return at
        return None
    
    def get_risk_levels(self) -> dict[str, Any]:
        """获取风险等级配置"""
        return self.stage_4.get("risk_levels", {})
    
    def get_risk_level_config(self, level: str) -> Optional[dict[str, Any]]:
        """获取指定风险等级配置
        
        Args:
            level: 风险等级 (critical/high/medium/low)
            
        Returns:
            风险等级配置或 None
        """
        return self.get_risk_levels().get(level)
    
    def get_sop(self, incident_type: str) -> Optional[dict[str, Any]]:
        """获取 SOP 处置规范

        Args:
            incident_type: 异常类型

        Returns:
            SOP 配置或 None
        """
        sops = self.stage_3.get("sop_knowledge", {})
        return sops.get(incident_type)
    
    def get_frontend_config(self) -> dict[str, Any]:
        """获取前端配置"""
        return self._config.get("frontend", {})
    
    def get_performance_config(self) -> dict[str, Any]:
        """获取性能配置"""
        return self._config.get("performance", {})
    
    def get_sse_sequence(self) -> list[dict[str, Any]]:
        """获取 SSE 事件序列"""
        return self._config.get("sse_sequence", {}).get("events", [])
    
    def get_data_format(self, format_key: str) -> Optional[dict[str, Any]]:
        """获取数据格式定义
        
        Args:
            format_key: 格式键名 (roi_box/detected_object/anomaly_result/alert_result)
            
        Returns:
            数据格式定义或 None
        """
        formats = self._config.get("data_formats", {})
        return formats.get(format_key)
    
    def to_dict(self) -> dict[str, Any]:
        """获取完整配置字典"""
        return self._config.copy()


# 全局单例
_pipeline_config: Optional[PipelineConfig] = None


def get_pipeline_config() -> PipelineConfig:
    """获取 Pipeline 配置单例
    
    Returns:
        PipelineConfig 实例
    """
    global _pipeline_config
    if _pipeline_config is None:
        _pipeline_config = PipelineConfig()
    return _pipeline_config


# 便捷访问函数
def get_stage_info(key: str) -> dict[str, Any]:
    """获取 Stage 信息"""
    return get_pipeline_config().get_stage(key)


def get_incident_types() -> list[dict[str, Any]]:
    """获取所有异常类型"""
    return get_pipeline_config().get_anomaly_types()


def get_sop(incident_type: str) -> Optional[dict[str, Any]]:
    """获取 SOP 处置规范"""
    return get_pipeline_config().get_sop(incident_type)


def get_risk_levels() -> dict[str, Any]:
    """获取风险等级配置"""
    return get_pipeline_config().get_risk_levels()


# 测试
if __name__ == "__main__":
    config = get_pipeline_config()
    print("=" * 60)
    print(f"Pipeline: {config.pipeline_info['name']}")
    print(f"Version: {config.pipeline_info['version']}")
    print("=" * 60)
    
    print("\n【Stage 配置】")
    for key in ["detection", "identify", "rag", "decision"]:
        stage = config.get_stage(key)
        print(f"  {key}: {stage.get('name', 'N/A')}")
    
    print("\n【异常类型】")
    for at in config.get_anomaly_types():
        print(f"  - {at['key']}: {at['name']}")
    
    print("\n【SOP 示例 (parking)】")
    sop = config.get_sop("parking")
    if sop:
        print(f"  ID: {sop['id']}")
        print(f"  Priority: {sop['priority']}")
        print(f"  Response: {sop['response_time']}")
    
    print("\n【风险等级】")
    for level in ["critical", "high", "medium", "low"]:
        rl = config.get_risk_level_config(level)
        if rl:
            print(f"  {level}: {rl['label']} - {rl['urgency']}")
    
    print("\n【性能估算】")
    perf = config.get_performance_config()
    print(f"  总计: {perf.get('total_estimate_ms', 'N/A')}")
