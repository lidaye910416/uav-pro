"""RAG 知识库服务 V2 - 支持按 incident_type 检索 SOP"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import yaml


class RAGServiceV2:
    """增强版 RAG 服务 - 支持按类型检索和 SOP 匹配"""
    
    def __init__(
        self,
        sop_path: str | None = None,
        collection_name: str = "road_incident_sop",
    ) -> None:
        if sop_path is None:
            sop_path = "/Users/jasonlee/UAV_PRO/website/backend/data/knowledge_base/road_incident_sop.json"
        
        self.sop_path = Path(sop_path)
        self.collection_name = collection_name
        self._sop_db: dict[str, Any] = {}
        self._load_sop_db()
    
    def _load_sop_db(self) -> None:
        """加载 SOP 数据库"""
        if self.sop_path.exists():
            with open(self.sop_path, "r", encoding="utf-8") as f:
                self._sop_db = json.load(f)
        else:
            # 返回默认空数据库
            self._sop_db = {
                "collection": self.collection_name,
                "version": "1.0",
                "incidents": []
            }
    
    def reload(self) -> None:
        """重新加载 SOP 数据库"""
        self._load_sop_db()
    
    def retrieve_by_type(
        self,
        incident_type: str,
        visual_evidence: list[str] | None = None,
    ) -> dict[str, Any]:
        """根据异常类型检索 SOP
        
        Args:
            incident_type: 异常类型 (collision/pothole/obstacle/parking/pedestrian/congestion)
            visual_evidence: 视觉证据列表
            
        Returns:
            匹配的 SOP 字典，包含 id, type, title, content, priority 等
        """
        incidents = self._sop_db.get("documents", [])
        
        # 按类型匹配
        for incident in incidents:
            if incident.get("type") == incident_type:
                # 如果提供了视觉证据，计算匹配分数
                if visual_evidence:
                    matched_indicators = self._match_indicators(
                        visual_evidence,
                        incident.get("risk_indicators", [])
                    )
                    incident["matched_indicators"] = matched_indicators
                    incident["match_score"] = len(matched_indicators) / len(incident.get("risk_indicators", []) or [1])
                
                return incident
        
        # 未找到，返回空结果
        return {
            "id": f"{incident_type}_unknown",
            "type": incident_type,
            "title": "未知异常",
            "content": "未找到对应处置规范，请联系管理人员",
            "priority": "medium",
            "risk_indicators": [],
            "response_time": "unknown"
        }
    
    def _match_indicators(
        self,
        visual_evidence: list[str],
        risk_indicators: list[str],
    ) -> list[str]:
        """匹配视觉证据与风险指标
        
        简单的关键词匹配，返回匹配的指标列表
        """
        matched = []
        
        # 将所有字符串转为小写以便匹配
        evidence_lower = [e.lower() for e in visual_evidence]
        indicators_lower = [i.lower() for i in risk_indicators]
        
        for i, indicator in enumerate(indicators_lower):
            for evidence in evidence_lower:
                # 检查证据是否包含指标关键词
                if any(word in evidence for word in indicator.split()):
                    matched.append(risk_indicators[i])
                    break
                # 或者指标包含证据关键词
                if any(word in indicator for word in evidence.split()):
                    matched.append(risk_indicators[i])
                    break
        
        return matched
    
    def retrieve_context(
        self,
        incident_type: str,
        visual_evidence: list[str] | None = None,
    ) -> str:
        """检索上下文文本 (用于 Prompt)
        
        Args:
            incident_type: 异常类型
            visual_evidence: 视觉证据
            
        Returns:
            格式化的 SOP 上下文文本
        """
        sop = self.retrieve_by_type(incident_type, visual_evidence)
        
        context_lines = [
            f"【{sop.get('title', '未知规范')}】",
            f"规范ID: {sop.get('id', 'unknown')}",
            f"优先级: {sop.get('priority', 'medium')}",
            f"响应时效: {sop.get('response_time', 'unknown')}",
            "",
            "处置步骤:",
            sop.get("content", "无规范内容"),
        ]
        
        # 如果有匹配的指标，添加
        if visual_evidence and sop.get("matched_indicators"):
            context_lines.extend([
                "",
                f"匹配指标: {', '.join(sop['matched_indicators'])}",
            ])
        
        return "\n".join(context_lines)
    
    def get_all_incident_types(self) -> list[str]:
        """获取所有异常类型列表"""
        return [inc.get("type") for inc in self._sop_db.get("incidents", [])]
    
    def search_sop(self, query: str) -> list[dict[str, Any]]:
        """搜索 SOP (简单的关键词搜索)
        
        Args:
            query: 搜索关键词
            
        Returns:
            匹配的 SOP 列表
        """
        query_lower = query.lower()
        results = []
        
        for incident in self._sop_db.get("incidents", []):
            # 搜索标题、内容、类型
            searchable = " ".join([
                incident.get("title", ""),
                incident.get("content", ""),
                incident.get("type", ""),
            ]).lower()
            
            if query_lower in searchable:
                results.append(incident)
        
        return results


# 全局实例
_rag_service_v2: RAGServiceV2 | None = None


def get_rag_service_v2() -> RAGServiceV2:
    """获取全局 RAGServiceV2 实例"""
    global _rag_service_v2
    if _rag_service_v2 is None:
        _rag_service_v2 = RAGServiceV2()
    return _rag_service_v2


# 测试
if __name__ == "__main__":
    rag = RAGServiceV2()
    
    print("所有异常类型:", rag.get_all_incident_types())
    
    # 测试检索
    for inc_type in ["collision", "pothole", "pedestrian"]:
        print(f"\n--- {inc_type} ---")
        context = rag.retrieve_context(inc_type, ["车辆聚集", "变形"])
        print(context[:200], "...")
