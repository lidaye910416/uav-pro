#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SOP 知识库导入脚本
基于无人机高速公路检测场景的专业标准作业程序
"""

import json
from pathlib import Path

# 定义专业 SOP 知识库
SOP_KNOWLEDGE = {
    # ==================== 交通事故 SOP ====================
    "traffic_incident_sops": [
        {
            "id": "sop_001",
            "category": "交通事故",
            "event": "车辆追尾事故",
            "severity": "high",
            "detection_signs": ["多辆车异常停滞", "车辆间距过近", "可见碰撞痕迹", "车流突然减速聚集"],
            "procedure": [
                "1. 确认事故车辆数量和位置",
                "2. 观察是否有人员伤亡迹象",
                "3. 记录事故范围和车道占用情况",
                "4. 判断是否影响主线通行",
                "5. 立即通知高速交警指挥中心",
                "6. 同时通知急救和路政部门",
                "7. 持续监控事故区域，跟踪事态发展"
            ],
            "recommendations": "如确认事故，应优先确认人员安全，同时通知相关部门尽快到达现场处置。",
            "response_time": "5分钟内上报，15分钟内到场"
        },
        {
            "id": "sop_002",
            "category": "交通事故",
            "event": "单车故障事故",
            "severity": "medium",
            "detection_signs": ["单车静止不动", "开启双闪灯", "占据车道或应急车道", "人员站在车旁"],
            "procedure": [
                "1. 确认故障车辆位置和占用车道情况",
                "2. 观察是否开启双闪灯",
                "3. 判断人员是否处于安全位置",
                "4. 评估对交通的影响程度",
                "5. 通知路政清障部门",
                "6. 如影响主线，通知交警进行交通管制",
                "7. 持续跟踪至清障完成"
            ],
            "recommendations": "故障车辆应尽快移至应急车道，开启双闪灯，人员撤离至护栏外等待救援。",
            "response_time": "10分钟内上报，30分钟内到场"
        },
        {
            "id": "sop_003",
            "category": "交通事故",
            "event": "连环追尾事故",
            "severity": "critical",
            "detection_signs": ["3辆以上车辆连续碰撞", "大面积车辆堆积", "可见多次碰撞痕迹", "可能有人员站立于车道内"],
            "procedure": [
                "1. 快速评估事故规模和涉及车辆数",
                "2. 立即上报最高级别预警",
                "3. 通知急救、消防、交警、路政多部门联动",
                "4. 持续跟踪现场人员动态，重点关注人员安全",
                "5. 协助交通管制，评估拥堵范围",
                "6. 记录事故演变过程，为事后分析提供依据"
            ],
            "recommendations": "连环追尾属重大事故，必须多部门联动处置，人员安全是第一优先。",
            "response_time": "2分钟内上报，即时跟踪"
        }
    ],

    # ==================== 交通违法 SOP ====================
    "violation_sops": [
        {
            "id": "sop_101",
            "category": "交通违法",
            "event": "应急车道违规停车",
            "severity": "high",
            "detection_signs": ["车辆停靠在应急车道", "未开启双闪灯", "车内人员未撤离", "持续停靠超过5分钟"],
            "procedure": [
                "1. 确认车辆是否开启双闪灯",
                "2. 观察车内人员状态和位置",
                "3. 记录车牌号码和车身特征",
                "4. 判断停靠原因（故障/休息/其他）",
                "5. 如人员未撤离至安全位置，优先提醒",
                "6. 通知高速交警进行处罚处理",
                "7. 如为故障车辆，通知路政清障"
            ],
            "recommendations": "应急车道是生命通道，非紧急情况严禁停车。紧急停车必须开启双闪，人员撤离至护栏外。",
            "response_time": "实时监控，发现即上报"
        },
        {
            "id": "sop_102",
            "category": "交通违法",
            "event": "违法倒车逆行",
            "severity": "critical",
            "detection_signs": ["车辆向后行驶", "行驶方向与车道方向相反", "在匝道或分流处逆行", "连续变道或压线行驶"],
            "procedure": [
                "1. 立即确认车辆行驶方向",
                "2. 上报最高级别预警",
                "3. 通知交警进行拦截处置",
                "4. 持续跟踪车辆位置和行驶轨迹",
                "5. 评估对其他车辆的危险程度",
                "6. 协助发布预警信息提醒后方车辆"
            ],
            "recommendations": "倒车、逆行是严重违法行为，极易引发重大事故，必须立即制止。",
            "response_time": "发现即上报，即时跟踪"
        },
        {
            "id": "sop_103",
            "category": "交通违法",
            "event": "货车长时间占用快车道",
            "severity": "low",
            "detection_signs": ["货车在快车道行驶", "长时间不主动变道", "后方小型车无法超车"],
            "procedure": [
                "1. 确认车辆类型和车道位置",
                "2. 记录车牌号码和违法行为",
                "3. 上报交通管理部门",
                "4. 持续监控车辆行驶状态"
            ],
            "recommendations": "大型车应靠右行驶，小型车靠左但不得长期占用客车道。",
            "response_time": "发现后记录，超速严重时立即上报"
        }
    ],

    # ==================== 道路障碍 SOP ====================
    "obstacle_sops": [
        {
            "id": "sop_201",
            "category": "道路障碍",
            "event": "道路遗撒物",
            "severity": "high",
            "detection_signs": ["路面有不明物体", "货物散落占用车道", "建筑材料掉落在路面", "轮胎碎片等散落物"],
            "procedure": [
                "1. 确认遗撒物位置和占用车道情况",
                "2. 评估遗撒物大小和危险性",
                "3. 观察是否影响车辆正常通行",
                "4. 立即通知路政养护部门",
                "5. 同时通知交警设置警示标志",
                "6. 持续监控至清理完成",
                "7. 如影响重大，通知交通管制"
            ],
            "recommendations": "道路遗撒物是重大安全隐患，必须立即清理。发现遗撒可通知12122或通过APP上报。",
            "response_time": "5分钟内上报，20分钟内到场清理"
        },
        {
            "id": "sop_202",
            "category": "道路障碍",
            "event": "路面坑洞损坏",
            "severity": "medium",
            "detection_signs": ["路面出现明显凹陷", "路面破损露石", "桥梁伸缩缝损坏", "路面沉陷或塌陷"],
            "procedure": [
                "1. 确认损坏位置和范围",
                "2. 评估对行车安全的影响程度",
                "3. 记录损坏详细情况",
                "4. 通知路政养护部门",
                "5. 评估是否需要临时交通管制",
                "6. 持续跟踪修复进度"
            ],
            "recommendations": "路面损坏需及时修复，驾驶员发现后应减速慢行，注意避让。",
            "response_time": "24小时内评估，48小时内修复"
        },
        {
            "id": "sop_203",
            "category": "道路障碍",
            "event": "散落货物车辆",
            "severity": "high",
            "detection_signs": ["行驶中车辆持续掉落货物", "货物沿路散落形成轨迹", "后方车辆紧急避让"],
            "procedure": [
                "1. 追踪货物来源车辆",
                "2. 记录车辆车牌和特征",
                "3. 评估散落货物的危险程度",
                "4. 通知交警拦截检查",
                "5. 同时通知路政清理路面",
                "6. 提醒后方车辆注意避让"
            ],
            "recommendations": "货运车辆应确保货物固定牢靠，散落货物造成事故需承担法律责任。",
            "response_time": "实时跟踪，即时通知清理"
        },
        {
            "id": "sop_204",
            "category": "道路障碍",
            "event": "动物闯入",
            "severity": "medium",
            "detection_signs": ["动物在路面行走", "动物在应急车道或边坡", "车辆因动物紧急制动", "动物尸体在路面"],
            "procedure": [
                "1. 确认动物种类和位置",
                "2. 评估对交通的潜在影响",
                "3. 如为活体，通知林业或动物管理部门",
                "4. 如已死亡，通知路政清理",
                "5. 持续监控现场情况"
            ],
            "recommendations": "发现动物闯入应及时报告，驾驶员发现后应减速慢行，切勿紧急制动。",
            "response_time": "10分钟内上报，及时处置"
        }
    ],

    # ==================== 人员异常 SOP ====================
    "person_sops": [
        {
            "id": "sop_301",
            "category": "人员异常",
            "event": "行人闯入高速",
            "severity": "critical",
            "detection_signs": ["行人在行车道行走", "行人在应急车道行走", "行人穿越中央分隔带", "行人站在桥上或边坡"],
            "procedure": [
                "1. 立即确认识别对象为行人",
                "2. 上报最高级别预警",
                "3. 通知高速交警立即前往处置",
                "4. 持续跟踪行人位置和移动轨迹",
                "5. 评估对交通的影响范围",
                "6. 提醒后方车辆注意避让",
                "7. 如可能，记录行人特征供后续联系"
            ],
            "recommendations": "行人闯入高速公路是重大安全隐患，必须立即通知交警处理。行人应尽快撤离至护栏外安全地带。",
            "response_time": "发现即上报，实时跟踪"
        },
        {
            "id": "sop_302",
            "category": "人员异常",
            "event": "疑似故障乘客",
            "severity": "medium",
            "detection_signs": ["人员站在车旁", "打双闪的故障车辆", "人员向过路车辆招手", "人员聚集在应急带"],
            "procedure": [
                "1. 确认人员状态和位置",
                "2. 判断是否为车辆故障",
                "3. 如已设置警示且人员安全，持续监控",
                "4. 如人员处于危险位置，通知交警前往",
                "5. 持续跟踪至救援完成"
            ],
            "recommendations": "车辆故障应尽量移至应急车道，开启双闪，人员撤离至护栏外，等待救援。",
            "response_time": "10分钟内确认，20分钟内到场"
        }
    ],

    # ==================== 天气异常 SOP ====================
    "weather_sops": [
        {
            "id": "sop_401",
            "category": "天气异常",
            "event": "团雾低能见度",
            "severity": "high",
            "detection_signs": ["局部区域能见度骤降", "车辆灯光可见范围缩小", "道路区域呈现白色模糊", "车辆减速或停车"],
            "procedure": [
                "1. 评估团雾范围和严重程度",
                "2. 通知交通管理部门发布预警",
                "3. 建议启动限速或封闭管制",
                "4. 持续监控雾情变化",
                "5. 协助引导车辆安全通行"
            ],
            "recommendations": "遇团雾应开启雾灯、近光灯和示廓灯，降低车速至能安全停车的范围内，就近驶入服务区或驶离高速。",
            "response_time": "发现即评估，即时上报"
        },
        {
            "id": "sop_402",
            "category": "天气异常",
            "event": "路面积水结冰",
            "severity": "high",
            "detection_signs": ["路面颜色变深", "车辆经过时有水花", "车辆打滑迹象", "路面反光异常"],
            "procedure": [
                "1. 确认积水或结冰范围",
                "2. 评估对行车安全的影响",
                "3. 通知路政部门排水或除冰",
                "4. 建议交通管理部门限速",
                "5. 持续监控处置进展"
            ],
            "recommendations": "积水路段应减速行驶，双手握方向盘；结冰路面应提前减速，避免急转急刹。",
            "response_time": "发现即上报，及时处置"
        },
        {
            "id": "sop_403",
            "category": "天气异常",
            "event": "强风侧风",
            "severity": "medium",
            "detection_signs": ["车辆行驶轨迹偏移", "树木或杂物摇晃", "车辆减速明显", "大型车辆晃动"],
            "procedure": [
                "1. 评估风力和影响范围",
                "2. 通知交通管理部门发布预警",
                "3. 建议对大型车辆限行",
                "4. 持续监控风速变化"
            ],
            "recommendations": "遇强风应双手握方向盘，减速行驶，远离大型车辆，尽量减少超车。",
            "response_time": "发现即评估，及时预警"
        }
    ],

    # ==================== 交通拥堵 SOP ====================
    "congestion_sops": [
        {
            "id": "sop_501",
            "category": "交通拥堵",
            "event": "交通拥堵预警",
            "severity": "medium",
            "detection_signs": ["多辆车速度持续低于30公里每小时", "车辆间距明显缩小", "拥堵趋势明显", "车辆排队长度增加"],
            "procedure": [
                "1. 评估拥堵范围和程度",
                "2. 查找可能的拥堵原因",
                "3. 通知交通管理部门发布路况信息",
                "4. 持续监控拥堵演变",
                "5. 如发现事故，及时上报"
            ],
            "recommendations": "遇拥堵应保持车距，依次有序通行，不要随意变道或占用应急车道。",
            "response_time": "持续监控，发现异常及时上报"
        },
        {
            "id": "sop_502",
            "category": "交通拥堵",
            "event": "拥堵倒灌",
            "severity": "high",
            "detection_signs": ["拥堵蔓延至上游路段", "拥堵长度持续增加", "车速持续下降", "车辆积压严重"],
            "procedure": [
                "1. 立即评估拥堵严重程度",
                "2. 通知交通管理部门",
                "3. 建议实施交通管制措施",
                "4. 持续跟踪拥堵演变",
                "5. 协助发布预警和诱导信息"
            ],
            "recommendations": "拥堵倒灌时后车无法及时反应，极易引发追尾事故，应保持车距，注意观察。",
            "response_time": "立即评估，持续跟踪"
        }
    ],

    # ==================== 紧急事件 SOP ====================
    "emergency_sops": [
        {
            "id": "sop_701",
            "category": "紧急事件",
            "event": "车辆起火冒烟",
            "severity": "critical",
            "detection_signs": ["可见火焰", "车辆冒黑烟或白烟", "车辆紧急停车", "人员快速撤离"],
            "procedure": [
                "1. 立即确认火情位置和程度",
                "2. 上报最高级别预警",
                "3. 通知消防和交警部门",
                "4. 持续跟踪现场人员安全",
                "5. 评估是否需要交通管制",
                "6. 记录火情演变过程"
            ],
            "recommendations": "车辆起火极为危险，发现后应立即撤离至安全距离，报警等待救援，切勿自行灭火。",
            "response_time": "发现即上报，实时跟踪"
        },
        {
            "id": "sop_702",
            "category": "紧急事件",
            "event": "危化品泄漏",
            "severity": "critical",
            "detection_signs": ["车辆停在应急车道", "可见液体或气体泄漏", "人员佩戴防护设备", "区域已设置警戒"],
            "procedure": [
                "1. 确认泄漏车辆类型和位置",
                "2. 上报最高级别预警",
                "3. 通知应急管理、消防、环保部门",
                "4. 评估泄漏范围和影响",
                "5. 建议实施交通管制和人员疏散",
                "6. 持续监控事态发展"
            ],
            "recommendations": "危化品泄漏极其危险，非专业人员应远离现场，等待专业部门处置。",
            "response_time": "发现即上报，协助管制"
        },
        {
            "id": "sop_703",
            "category": "紧急事件",
            "event": "车辆翻覆",
            "severity": "high",
            "detection_signs": ["车辆侧翻或倒扣", "车辆占用多车道", "可能有人员被困", "货物散落"],
            "procedure": [
                "1. 确认翻覆车辆数量和位置",
                "2. 评估是否有人员伤亡",
                "3. 通知交警、急救、路政部门",
                "4. 评估货物泄漏风险",
                "5. 持续跟踪救援进展"
            ],
            "recommendations": "翻覆事故易造成交通中断，应尽快清理恢复通行。",
            "response_time": "发现即上报，多部门联动"
        }
    ]
}


def format_sop_for_chroma(sop):
    """将 SOP 格式化为适合 ChromaDB 存储的文本"""
    text_parts = []
    text_parts.append("类别：" + sop['category'])
    text_parts.append("事件：" + sop['event'])
    text_parts.append("严重程度：" + sop['severity'])

    if 'detection_signs' in sop:
        text_parts.append("识别特征：" + "、".join(sop['detection_signs']))

    if 'procedure' in sop:
        text_parts.append("处置流程：" + "；".join(sop['procedure']))

    if 'recommendations' in sop:
        text_parts.append("处置建议：" + sop['recommendations'])

    if 'response_time' in sop:
        text_parts.append("响应时间：" + sop['response_time'])

    full_text = "\n".join(text_parts)

    return {
        "id": sop['id'],
        "text": full_text,
        "category": sop['category'],
        "event": sop['event'],
        "severity": sop['severity'],
        "recommendations": sop.get('recommendations', ''),
        "response_time": sop.get('response_time', ''),
    }


def main():
    """导入 SOP 到 ChromaDB"""
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))

    # 格式化所有 SOP
    all_sops = []
    for category, sops in SOP_KNOWLEDGE.items():
        for sop in sops:
            formatted = format_sop_for_chroma(sop)
            all_sops.append(formatted)

    print(f"共准备了 {len(all_sops)} 条 SOP 知识")
    for sop in all_sops:
        print(f"  - [{sop['id']}] {sop['event']} ({sop['severity']})")

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

        # 创建新集合
        collection = client.create_collection(
            name="uav_sops",
            metadata={"description": "无人机高速公路检测 SOP 知识库"}
        )

        # 批量添加文档
        ids = []
        documents = []
        metadatas = []

        for sop in all_sops:
            ids.append(sop['id'])
            documents.append(sop['text'])
            metadatas.append({
                "category": sop['category'],
                "event": sop['event'],
                "severity": sop['severity'],
                "recommendations": sop['recommendations'],
                "response_time": sop['response_time'],
            })

        collection.add(
            ids=ids,
            documents=documents,
            metadatas=metadatas
        )

        print(f"\n成功导入 {len(all_sops)} 条 SOP 到 ChromaDB")
        print(f"存储路径: {db_path}")

        # 验证
        count = collection.count()
        print(f"集合中现有文档数: {count}")

    except ImportError as e:
        print(f"缺少依赖: {e}")
        print("请先安装 chromadb: pip install chromadb")
        return 1
    except Exception as e:
        print(f"导入失败: {e}")
        import traceback
        traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
