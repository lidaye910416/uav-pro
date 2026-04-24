"""统一的 Prompt 管理模块"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml


class PromptManager:
    """统一管理所有 Prompt 配置"""
    
    def __init__(self, config_path: str | None = None) -> None:
        if config_path is None:
            config_path = "/Users/jasonlee/UAV_PRO/website/backend/config/prompts.yaml"
        
        self.config_path = Path(config_path)
        self._config: dict[str, Any] = {}
        self._load()
    
    def _load(self) -> None:
        """加载 prompts.yaml"""
        if self.config_path.exists():
            with open(self.config_path, "r", encoding="utf-8") as f:
                self._config = yaml.safe_load(f)
        else:
            self._config = self._get_default_config()
    
    def _get_default_config(self) -> dict:
        """返回默认配置"""
        return {
            "anomaly_identification": {
                "system": "你是一个专业的高速公路航拍图像分析专家。",
                "user_template": "分析: {roi_description}",
                "output_format": '{"has_incident": true/false, "incident_type": "..."}'
            },
            "decision_output": {
                "system": "你是一个道路安全应急指挥专家。",
                "user_template": "异常: {incident_type}",
                "output_format": '{"risk_level": "low/medium/high/critical"}'
            }
        }
    
    def reload(self) -> None:
        """重新加载配置"""
        self._load()
    
    @property
    def anomaly_system(self) -> str:
        """异常识别 System Prompt"""
        return self._config.get("anomaly_identification", {}).get("system", "")
    
    @property
    def anomaly_user_template(self) -> str:
        """异常识别用户模板"""
        return self._config.get("anomaly_identification", {}).get("user_template", "")
    
    @property
    def anomaly_output_format(self) -> str:
        """异常识别输出格式"""
        return self._config.get("anomaly_identification", {}).get("output_format", "")
    
    @property
    def decision_system(self) -> str:
        """决策输出 System Prompt"""
        return self._config.get("decision_output", {}).get("system", "")
    
    @property
    def decision_user_template(self) -> str:
        """决策输出用户模板"""
        return self._config.get("decision_output", {}).get("user_template", "")
    
    @property
    def decision_output_format(self) -> str:
        """决策输出格式"""
        return self._config.get("decision_output", {}).get("output_format", "")
    
    def get_incident_types(self) -> dict:
        """获取异常类型定义"""
        return self._config.get("incident_types", {})
    
    def get_incident_info(self, incident_type: str) -> dict | None:
        """获取特定异常类型的详细信息"""
        types = self.get_incident_types()
        return types.get(incident_type)
    
    def build_anomaly_prompt(
        self,
        roi_description: str,
        motion_info: dict | None = None,
    ) -> tuple[str, str]:
        """构建异常识别完整 Prompt
        
        Returns:
            (system_prompt, user_prompt)
        """
        import json
        
        system = self.anomaly_system
        user_template = self.anomaly_user_template
        output_format = self.anomaly_output_format
        
        motion_str = json.dumps(motion_info, ensure_ascii=False) if motion_info else "无运动信息"
        user = f"{user_template.format(roi_description=roi_description, motion_info=motion_str)}\n\n{output_format}"
        
        return system, user
    
    def build_decision_prompt(
        self,
        incident_type: str,
        confidence: float,
        description: str,
        visual_evidence: list,
        rag_context: str,
    ) -> tuple[str, str]:
        """构建决策输出完整 Prompt
        
        Returns:
            (system_prompt, user_prompt)
        """
        system = self.decision_system
        user_template = self.decision_user_template
        output_format = self.decision_output_format
        
        evidence_str = ", ".join(visual_evidence) if visual_evidence else "无"
        user = f"""{user_template.format(
            incident_type=incident_type,
            confidence=confidence,
            description=description,
            visual_evidence=evidence_str,
            rag_context=rag_context,
        )}\n\n{output_format}"""
        
        return system, user


# 全局实例
_prompt_manager: PromptManager | None = None


def get_prompt_manager() -> PromptManager:
    """获取全局 PromptManager 实例"""
    global _prompt_manager
    if _prompt_manager is None:
        _prompt_manager = PromptManager()
    return _prompt_manager


# 测试
if __name__ == "__main__":
    manager = PromptManager()
    
    print("异常识别 Prompt:")
    print(f"  System: {manager.anomaly_system[:50]}...")
    
    system, user = manager.build_anomaly_prompt("测试ROI", {"area": 1000})
    print(f"\n构建的 Prompt:")
    print(f"  User: {user[:100]}...")
