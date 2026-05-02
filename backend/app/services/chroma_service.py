# -*- coding: utf-8 -*-
"""ChromaDB RAG Service for SOP Knowledge Base."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import chromadb

# ChromaDB 配置 - 使用 host.docker.internal 访问外部端口
CHROMADB_HOST = os.getenv("CHROMADB_HOST", "host.docker.internal")
CHROMADB_PORT = int(os.getenv("CHROMADB_PORT", "9001"))  # 使用外部端口 9001
CHROMADB_URL = os.getenv("CHROMADB_URL", f"http://{CHROMADB_HOST}:{CHROMADB_PORT}")

# Collection names
SOP_COLLECTION_NAME = "sop_knowledge_base"

# SOP 数据定义（5个检测场景 × 2-3条 = 13条SOP）
SOP_DOCUMENTS = [
    # === Collision 场景 ===
    {
        "id": "sop_collision_1",
        "text": "[SOP] collision | severity=mid | 场景特征：两车近距离接触，单一碰撞点，无人员被困 | 描述：两辆车发生碰撞，可继续行驶 | 建议：开启双闪，缓慢移至路边，联系保险公司",
        "incident_type": "collision",
        "severity": "mid",
    },
    {
        "id": "sop_collision_2",
        "text": "[SOP] collision | severity=high | 场景特征：车辆变形严重，多车连环追尾，有烟雾/火花 | 描述：严重交通事故，可能有人员伤亡 | 建议：立即报警，开启双闪，三角牌150m外，人员撤离至护栏外",
        "incident_type": "collision",
        "severity": "high",
    },
    # === Pothole 场景 ===
    {
        "id": "sop_pothole_1",
        "text": "[SOP] pothole | severity=mid | 场景特征：单个小坑洞，直径<50cm，深度<10cm | 描述：路面局部损坏，不影响通行但需修复 | 建议：减速通过，记录位置，报告养护部门",
        "incident_type": "pothole",
        "severity": "mid",
    },
    {
        "id": "sop_pothole_2",
        "text": "[SOP] pothole | severity=high | 场景特征：多个坑洞群，或单个大坑，直径>1m | 描述：严重路面损坏，威胁行车安全 | 建议：立即报告，设置警告标志，绕行",
        "incident_type": "pothole",
        "severity": "high",
    },
    # === Obstacle 场景 ===
    {
        "id": "sop_obstacle_1",
        "text": "[SOP] obstacle | severity=mid | 场景特征：小物体，掉落物，可单人移动 | 描述：路面散落物，可能影响摩托车/自行车 | 建议：减速绕行，记录位置，联系清理",
        "incident_type": "obstacle",
        "severity": "mid",
    },
    {
        "id": "sop_obstacle_2",
        "text": "[SOP] obstacle | severity=high | 场景特征：大型障碍物，交通事故遗留物，施工材料 | 描述：严重影响通行，需专业处理 | 建议：开启危险报警，保持车距，报警处理",
        "incident_type": "obstacle",
        "severity": "high",
    },
    # === Pedestrian 场景 ===
    {
        "id": "sop_pedestrian_1",
        "text": "[SOP] pedestrian | severity=mid | 场景特征：行人在人行道或安全区域，无异常行为 | 描述：正常交通参与者 | 建议：保持正常行驶，注意观察",
        "incident_type": "pedestrian",
        "severity": "mid",
    },
    {
        "id": "sop_pedestrian_2",
        "text": "[SOP] pedestrian | severity=high | 场景特征：行人进入车道，奔跑，异常聚集，逆行 | 描述：危险行为，可能导致事故 | 建议：立即减速，停车避让，必要时报警",
        "incident_type": "pedestrian",
        "severity": "high",
    },
    # === Congestion 场景 ===
    {
        "id": "sop_congestion_1",
        "text": "[SOP] congestion | severity=low | 场景特征：车辆排队，但缓慢移动，无停滞 | 描述：常规交通拥堵 | 建议：保持车距，耐心等待，避免加塞",
        "incident_type": "congestion",
        "severity": "low",
    },
    {
        "id": "sop_congestion_2",
        "text": "[SOP] congestion | severity=mid | 场景特征：车辆完全停滞，长时间无移动，有应急车道被占用 | 描述：严重拥堵，可能有事故 | 建议：开启导航查看路况，按序排队，勿占用应急车道",
        "incident_type": "congestion",
        "severity": "mid",
    },
    # === None 场景 ===
    {
        "id": "sop_none_1",
        "text": "[SOP] none | severity=none | 场景特征：道路畅通，无异常物体/人员/事件 | 描述：正常交通状态 | 建议：正常行驶",
        "incident_type": "none",
        "severity": "none",
    },
]


class ChromaService:
    """ChromaDB RAG Service"""

    def __init__(self, host: str = CHROMADB_HOST, port: int = CHROMADB_PORT):
        self.host = host
        self.port = port
        self.url = f"http://{host}:{port}"
        self._client: Optional[chromadb.Client] = None

    @property
    def client(self) -> chromadb.Client:
        """获取或创建 ChromaDB 客户端"""
        if self._client is None:
            # 优先使用 HTTP 客户端连接远程服务
            try:
                self._client = chromadb.HttpClient(host=self.host, port=self.port)
                # 测试连接
                self._client.heartbeat()
            except Exception:
                # 回退到嵌入式客户端
                data_dir = Path(__file__).resolve().parents[3] / "data" / "chromadb"
                data_dir.mkdir(parents=True, exist_ok=True)
                self._client = chromadb.PersistentClient(path=str(data_dir))
        return self._client

    def get_collection(self, name: str = SOP_COLLECTION_NAME):
        """获取指定名称的 collection"""
        return self.client.get_or_create_collection(name=name, metadata={"description": "SOP Knowledge Base for UAV Traffic Detection"})

    def search(self, query: str, top_k: int = 3, collection_name: str = SOP_COLLECTION_NAME) -> list[dict]:
        """
        搜索 SOP 知识库（使用 ChromaDB 内置 embedding）

        Args:
            query: 查询文本
            top_k: 返回结果数量
            collection_name: collection 名称

        Returns:
            list[dict]: 包含 id, text, distance, metadata 的结果列表
        """
        try:
            collection = self.get_collection(collection_name)
            count = collection.count()
            if count == 0:
                return []

            results = collection.query(
                query_texts=[query],
                n_results=min(top_k, count),
                include=["documents", "distances", "metadatas"],
            )

            # 格式化结果
            formatted = []
            if results and results.get("ids") and results["ids"]:
                for i in range(len(results["ids"][0])):
                    doc = {
                        "id": results["ids"][0][i],
                        "text": results["documents"][0][i] if results.get("documents") else "",
                        "distance": results["distances"][0][i] if results.get("distances") else 0,
                        "metadata": results["metadatas"][0][i] if results.get("metadatas") else {},
                    }
                    formatted.append(doc)
            return formatted
        except Exception as e:
            print(f"[ChromaService] search error: {e}")
            import traceback
            traceback.print_exc()
            return []

    def get_rag_context(self, query: str, top_k: int = 3) -> str:
        """
        获取 RAG 上下文字符串（用于 LLM 提示词）
        
        Args:
            query: 查询文本
            top_k: 返回结果数量
        
        Returns:
            str: 格式化的 SOP 上下文
        """
        results = self.search(query, top_k)
        if not results:
            return ""
        
        lines = []
        for r in results:
            text = r.get("text", "")
            if text:
                lines.append(f"- {text}")
        return "\n".join(lines)

    def init_sop_collection(self, force: bool = False) -> int:
        """
        初始化 SOP 知识库 collection

        Args:
            force: 是否强制重建（删除旧数据）

        Returns:
            int: 插入的文档数量
        """
        try:
            # 检查 collection 是否存在
            try:
                collection = self.client.get_collection(SOP_COLLECTION_NAME)
                existing_count = collection.count()
                if existing_count > 0 and not force:
                    print(f"[ChromaService] SOP 知识库已存在：{existing_count} 条记录")
                    return existing_count
                # 强制重建：删除旧 collection
                if force:
                    self.client.delete_collection(SOP_COLLECTION_NAME)
                    print(f"[ChromaService] 删除旧 SOP 知识库")
            except Exception:
                pass  # Collection 不存在

            # 创建新 collection（自动使用内置 embedding）
            collection = self.client.create_collection(
                name=SOP_COLLECTION_NAME,
                metadata={"description": "SOP Knowledge Base for UAV Traffic Detection"}
            )

            # 插入 SOP 文档（ChromaDB 会自动生成 embedding）
            ids = [sop["id"] for sop in SOP_DOCUMENTS]
            texts = [sop["text"] for sop in SOP_DOCUMENTS]
            metadatas = [
                {"incident_type": sop["incident_type"], "severity": sop["severity"]}
                for sop in SOP_DOCUMENTS
            ]

            # 分批插入以避免超时
            batch_size = 5
            for i in range(0, len(ids), batch_size):
                batch_ids = ids[i:i+batch_size]
                batch_texts = texts[i:i+batch_size]
                batch_metadatas = metadatas[i:i+batch_size]
                collection.add(ids=batch_ids, documents=batch_texts, metadatas=batch_metadatas)

            print(f"[ChromaService] 初始化 SOP 知识库：{len(SOP_DOCUMENTS)} 条记录")
            return len(SOP_DOCUMENTS)
        except Exception as e:
            print(f"[ChromaService] 初始化失败: {e}")
            import traceback
            traceback.print_exc()
            return 0

    def get_collection_info(self, collection_name: str = SOP_COLLECTION_NAME) -> dict:
        """获取 collection 信息"""
        try:
            collection = self.get_collection(collection_name)
            return {
                "name": collection.name,
                "count": collection.count(),
                "metadata": collection.metadata,
            }
        except Exception as e:
            return {"error": str(e)}


# 全局实例
_chroma_service: Optional[ChromaService] = None


def get_chroma_service() -> ChromaService:
    """获取 ChromaService 单例"""
    global _chroma_service
    if _chroma_service is None:
        _chroma_service = ChromaService()
    return _chroma_service


def search_sops(query: str, top_k: int = 3) -> list[dict]:
    """便捷函数：搜索 SOP 知识库"""
    return get_chroma_service().search(query, top_k)


def get_rag_context(query: str, top_k: int = 3) -> str:
    """便捷函数：获取 RAG 上下文"""
    return get_chroma_service().get_rag_context(query, top_k)
