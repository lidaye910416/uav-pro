#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SOP 知识库导入脚本 v2
基于无人机高速公路检测场景的专业标准作业程序
按 5 类异常类型（collision/pothole/obstacle/pedestrian/congestion）组织
与 Gemma 图像分析结构化输出对齐
"""

import json
from pathlib import Path

# ============================================================================
# 新版 SOP 知识库：按 5 类检测类型组织
# ============================================================================
# incident_type 对照：
#   collision   — 交通事故/碰撞
#   pothole     — 路面塌陷/坑洞
#   obstacle    — 道路障碍物
#   pedestrian  — 行人闯入
#   congestion  — 交通拥堵
# ============================================================================

SOP_KNOWLEDGE = {
    # ==================== collision 交通事故/碰撞 ====================
    "collision": [
        {
            "id": "sop_c001",
            "incident_type": "collision",
            "event": "多车追尾碰撞",
            "severity": "critical",
            "recognition_criteria": {
                "lane_occupied": "主车道或所有车道",
                "object_count": "≥2辆",
                "distance": "间距很近",
                "vehicle_state": "静止",
                "visual_marks": "collision_marks=true, debris_scattered=true",
            },
            "description": "多辆机动车聚集静止在主车道，可见碰撞痕迹和散落物",
            "recommended_response": "立即上报最高级别预警，通知交警、急救、路政联动处置，持续跟踪人员安全",
        },
        {
            "id": "sop_c002",
            "incident_type": "collision",
            "event": "单车静止主车道",
            "severity": "high",
            "recognition_criteria": {
                "lane_occupied": "主车道",
                "object_count": "1辆",
                "distance": "无",
                "vehicle_state": "静止",
                "visual_marks": "collision_marks=unknown",
            },
            "description": "单辆机动车静止在主车道中央，未开启双闪，存在安全隐患",
            "recommended_response": "通知高速交警立即前往处置，评估是否需要交通管制",
        },
        {
            "id": "sop_c003",
            "incident_type": "collision",
            "event": "事故导致拥堵倒灌",
            "severity": "high",
            "recognition_criteria": {
                "lane_occupied": "所有车道",
                "object_count": "≥5辆",
                "distance": "很近",
                "vehicle_state": "减速或静止",
                "visual_marks": "queue_forming=true",
            },
            "description": "多车聚集导致拥堵蔓延，车流排队延伸，上游车辆无法正常通行",
            "recommended_response": "评估拥堵范围，通知交通管理部门发布路况预警和诱导信息",
        },
    ],

    # ==================== pothole 路面塌陷/坑洞 ====================
    "pothole": [
        {
            "id": "sop_p001",
            "incident_type": "pothole",
            "event": "路面坑洞破损",
            "severity": "medium",
            "recognition_criteria": {
                "lane_occupied": "无",
                "object_count": "0",
                "distance": "无",
                "vehicle_state": "匀速行驶",
                "visual_marks": "pothole_visible=true",
            },
            "description": "路面出现明显深色凹陷区域，纹理断裂，桥梁伸缩缝损坏",
            "recommended_response": "记录坑洞位置和范围，通知路政养护部门评估修复，必要时临时管制",
        },
        {
            "id": "sop_p002",
            "incident_type": "pothole",
            "event": "路面塌陷下沉",
            "severity": "high",
            "recognition_criteria": {
                "lane_occupied": "车道局部",
                "object_count": "0",
                "distance": "无",
                "vehicle_state": "减速",
                "visual_marks": "pothole_visible=true",
            },
            "description": "路面大面积沉陷，颜色深暗，可见结构裂缝，严重影响行车安全",
            "recommended_response": "立即上报，通知路政部门实施临时交通管制，尽快修复",
        },
    ],

    # ==================== obstacle 道路障碍物 ====================
    "obstacle": [
        {
            "id": "sop_o001",
            "incident_type": "obstacle",
            "event": "道路遗撒物",
            "severity": "high",
            "recognition_criteria": {
                "lane_occupied": "主车道或应急车道",
                "object_count": "≥1",
                "distance": "无",
                "vehicle_state": "匀速行驶",
                "visual_marks": "debris_scattered=true",
            },
            "description": "路面有不明物体、货物散落或建筑材料，占用车道影响通行",
            "recommended_response": "立即通知路政养护清理，通知交警设置警示标志，持续监控至清理完成",
        },
        {
            "id": "sop_o002",
            "incident_type": "obstacle",
            "event": "行驶车辆持续掉落货物",
            "severity": "high",
            "recognition_criteria": {
                "lane_occupied": "主车道",
                "object_count": "≥1",
                "distance": "无",
                "vehicle_state": "匀速行驶",
                "visual_marks": "debris_scattered=true",
            },
            "description": "行驶中车辆持续掉落货物，沿路形成散落轨迹，后方车辆紧急避让",
            "recommended_response": "追踪货物来源车辆，通知交警拦截，通知路政清理路面",
        },
        {
            "id": "sop_o003",
            "incident_type": "obstacle",
            "event": "静止障碍物",
            "severity": "medium",
            "recognition_criteria": {
                "lane_occupied": "应急车道",
                "object_count": "≥1",
                "distance": "无",
                "vehicle_state": "静止",
                "visual_marks": "debris_scattered=false, vehicle_hazard_lights=unknown",
            },
            "description": "有不明物体或废弃物停靠在应急车道，未开启警示灯",
            "recommended_response": "通知路政部门清理，持续监控现场变化",
        },
    ],

    # ==================== pedestrian 行人闯入 ====================
    "pedestrian": [
        {
            "id": "sop_ped001",
            "incident_type": "pedestrian",
            "event": "行人闯入行车道",
            "severity": "critical",
            "recognition_criteria": {
                "lane_occupied": "主车道",
                "object_count": "≥1人",
                "distance": "无",
                "vehicle_state": "减速或静止",
                "visual_marks": "vehicle_hazard_lights=unknown",
            },
            "description": "行人在主车道行走或站立，多辆车减速避让，存在严重安全风险",
            "recommended_response": "立即上报最高级别预警，通知高速交警立即处置，持续跟踪行人位置",
        },
        {
            "id": "sop_ped002",
            "incident_type": "pedestrian",
            "event": "行人闯入应急车道",
            "severity": "high",
            "recognition_criteria": {
                "lane_occupied": "应急车道",
                "object_count": "≥1人",
                "distance": "无",
                "vehicle_state": "未知",
                "visual_marks": "vehicle_hazard_lights=unknown",
            },
            "description": "行人在应急车道行走，虽未直接占用主车道，但存在进入行车道风险",
            "recommended_response": "通知高速交警关注处置，提醒后方车辆注意，持续跟踪至安全撤离",
        },
        {
            "id": "sop_ped003",
            "incident_type": "pedestrian",
            "event": "行人穿越中央分隔带",
            "severity": "critical",
            "recognition_criteria": {
                "lane_occupied": "所有车道",
                "object_count": "≥1人",
                "distance": "无",
                "vehicle_state": "混合",
                "visual_marks": "vehicle_hazard_lights=unknown",
            },
            "description": "行人在中央分隔带行走或翻越，影响双向车道，危险性极高",
            "recommended_response": "立即上报最高级别预警，双向通知交警拦截处置",
        },
    ],

    # ==================== congestion 交通拥堵 ====================
    "congestion": [
        {
            "id": "sop_con001",
            "incident_type": "congestion",
            "event": "车流减速聚集",
            "severity": "medium",
            "recognition_criteria": {
                "lane_occupied": "主车道",
                "object_count": "≥5辆",
                "distance": "很近",
                "vehicle_state": "减速",
                "visual_marks": "queue_forming=true, collision_marks=false",
            },
            "description": "多辆车减速聚集，车间距明显缩小，拥堵趋势形成，但未见事故",
            "recommended_response": "持续监控拥堵演变，通知交通管理部门发布路况信息，如发现事故及时上报",
        },
        {
            "id": "sop_con002",
            "incident_type": "congestion",
            "event": "严重拥堵排队",
            "severity": "high",
            "recognition_criteria": {
                "lane_occupied": "所有车道",
                "object_count": "≥10辆",
                "distance": "很近",
                "vehicle_state": "静止或减速",
                "visual_marks": "queue_forming=true",
            },
            "description": "车辆排队延伸长度较大，拥堵蔓延至上游路段，多车道受影响",
            "recommended_response": "立即评估拥堵严重程度，通知交通管理部门实施管制措施，发布预警诱导信息",
        },
        {
            "id": "sop_con003",
            "incident_type": "congestion",
            "event": "偶发拥堵消散",
            "severity": "low",
            "recognition_criteria": {
                "lane_occupied": "主车道局部",
                "object_count": "3-5辆",
                "distance": "近",
                "vehicle_state": "减速",
                "visual_marks": "queue_forming=true",
            },
            "description": "局部车辆减速聚集，但整体车流仍可缓慢通行，预计短时间内消散",
            "recommended_response": "持续跟踪拥堵变化，如加剧及时升级预警级别",
        },
    ],

    # ==================== none 正常场景（无异常） ====================
    "none": [
        {
            "id": "sop_n001",
            "incident_type": "none",
            "event": "正常通行",
            "severity": "none",
            "recognition_criteria": {
                "lane_occupied": "无",
                "object_count": "≥0",
                "distance": "一般或远",
                "vehicle_state": "匀速行驶",
                "visual_marks": "all_false",
            },
            "description": "车辆匀速行驶，保持安全车距，应急车道空旷，无行人无障碍",
            "recommended_response": "持续正常监控，无需预警处置",
        },
        {
            "id": "sop_n002",
            "incident_type": "none",
            "event": "单车应急车道停靠（已设置警示）",
            "severity": "none",
            "recognition_criteria": {
                "lane_occupied": "应急车道",
                "object_count": "1辆",
                "distance": "无",
                "vehicle_state": "静止",
                "visual_marks": "vehicle_hazard_lights=true",
            },
            "description": "单车故障停靠应急车道，开启双闪，人员已撤离至护栏外",
            "recommended_response": "持续监控，等待清障，无需预警",
        },
    ],
}


def format_sop_for_chroma(sop: dict) -> dict:
    """将 SOP 格式化为适合 ChromaDB 存储的文本。

    输出格式与 Gemma 场景属性对齐：
    [SOP-{i}] incident_type | severity | 场景特征：{recognition_criteria} | 描述：{description} | 建议：{recommended_response}
    """
    inc_type = sop["incident_type"]
    severity = sop["severity"]
    criteria = sop["recognition_criteria"]
    desc = sop["description"]
    resp = sop["recommended_response"]

    # 拼接场景特征描述（与 Gemma spatial_features / visual_features 对应）
    scene_features = (
        f"车道占用：{criteria['lane_occupied']}；"
        f"目标数量：{criteria['object_count']}；"
        f"目标间距：{criteria['distance']}；"
        f"车辆状态：{criteria['vehicle_state']}；"
        f"视觉标记：{criteria['visual_marks']}"
    )

    # 结构化文本：与 Gemma 输出 + Decision LLM 输入格式对齐
    text = (
        f"[SOP] {inc_type} | {severity} | "
        f"场景特征：{scene_features} | "
        f"描述：{desc} | "
        f"建议：{resp}"
    )

    return {
        "id": sop["id"],
        "text": text,
        "incident_type": inc_type,
        "event": sop.get("event", inc_type),
        "severity": severity,
        "description": desc,
        "recommended_response": resp,
        "recognition_criteria": json.dumps(criteria, ensure_ascii=False),
    }


def main():
    """导入 SOP 到 ChromaDB（使用 Ollama 嵌入模型）"""
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))

    from app.core.config import settings

    # 格式化所有 SOP
    all_sops = []
    for category, sops in SOP_KNOWLEDGE.items():
        for sop in sops:
            formatted = format_sop_for_chroma(sop)
            all_sops.append(formatted)

    print(f"共准备了 {len(all_sops)} 条 SOP 知识")
    for sop in all_sops:
        print(f"  - [{sop['id']}] {sop['incident_type']} / {sop['event']} ({sop['severity']})")

    # 导入到 ChromaDB
    try:
        import chromadb

        db_path = Path(__file__).parent.parent / "data" / "knowledge_base"
        db_path.mkdir(parents=True, exist_ok=True)

        client = chromadb.PersistentClient(path=str(db_path))

        # 删除旧集合
        try:
            client.delete_collection("uav_sops")
            print("\n已删除旧的 uav_sops 集合")
        except:
            pass

        # 使用 Ollama 嵌入模型
        from llama_index.embeddings.ollama import OllamaEmbedding
        embed_model = OllamaEmbedding(
            model_name="nomic-embed-text",
            base_url=settings.OLLAMA_BASE_URL,
        )

        # 批量获取嵌入向量
        print("\n正在生成嵌入向量（使用 Ollama nomic-embed-text）...")
        texts = [sop['text'] for sop in all_sops]
        embeddings = embed_model.get_text_embedding_batch(texts, show_progress=True)

        # 创建集合（禁用自动嵌入，使用预计算嵌入）
        collection = client.create_collection(
            name="uav_sops",
            metadata={"description": "无人机高速公路检测 SOP 知识库 v2（按 5 类异常类型组织）"}
        )

        # 批量添加文档和嵌入向量
        ids = [sop['id'] for sop in all_sops]
        documents = [sop['text'] for sop in all_sops]
        metadatas = [{
            "incident_type": sop['incident_type'],
            "event": sop['event'],
            "severity": sop['severity'],
            "description": sop['description'],
            "recommended_response": sop['recommended_response'],
            "recognition_criteria": sop['recognition_criteria'],
        } for sop in all_sops]

        collection.add(
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas
        )

        print(f"\n✅ 成功导入 {len(all_sops)} 条 SOP 到 ChromaDB（按 5 类异常类型组织）")
        print(f"   存储路径: {db_path}")

        # 验证 & 分类统计
        count = collection.count()
        print(f"   集合中文档数: {count}")

        # 按 incident_type 统计
        from collections import Counter
        type_counts = Counter(sop['incident_type'] for sop in all_sops)
        for inc_type, cnt in sorted(type_counts.items()):
            print(f"     - {inc_type}: {cnt} 条")

    except ImportError as e:
        print(f"缺少依赖: {e}")
        print("请先安装: pip install chromadb llama-index-embeddings-ollama")
        return 1
    except Exception as e:
        print(f"导入失败: {e}")
        import traceback
        traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
