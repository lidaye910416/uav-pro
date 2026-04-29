"use client"

import { useState, useEffect } from "react"

interface SOP {
  id: string
  category: string
  event: string
  severity: string
  recommendations: string
  response_time: string
}

interface SOPDetails {
  detection_signs: string[]
  procedure: string[]
  recommendations: string
  response_time: string
}

// SOP 分类颜色
const CATEGORY_COLORS: Record<string, string> = {
  "交通事故": "var(--accent-red)",
  "交通违法": "var(--accent-amber)",
  "道路障碍": "var(--accent-orange)",
  "人员异常": "var(--accent-purple)",
  "天气异常": "var(--accent-blue)",
  "交通拥堵": "var(--accent-cyan)",
  "设施异常": "var(--accent-gray)",
  "紧急事件": "var(--accent-red)",
}

const SEVERITY_LABELS: Record<string, { label: string; color: string }> = {
  critical: { label: "严重", color: "var(--accent-red)" },
  high: { label: "高危", color: "var(--accent-amber)" },
  medium: { label: "中危", color: "var(--accent-blue)" },
  low: { label: "低危", color: "var(--accent-green)" },
}

// SOP 知识库数据（内置备用）
const FALLBACK_SOPS: SOP[] = [
  { id: "sop_001", category: "交通事故", event: "车辆追尾事故", severity: "high", recommendations: "优先确认人员安全，通知交警、急救和路政部门尽快到场处置。", response_time: "5分钟内上报" },
  { id: "sop_002", category: "交通事故", event: "单车故障事故", severity: "medium", recommendations: "故障车辆应尽快移至应急车道，开启双闪灯，人员撤离至护栏外等待救援。", response_time: "10分钟内上报" },
  { id: "sop_003", category: "交通事故", event: "连环追尾事故", severity: "critical", recommendations: "连环追尾属重大事故，必须多部门联动处置，人员安全是第一优先。", response_time: "2分钟内上报" },
  { id: "sop_101", category: "交通违法", event: "应急车道违规停车", severity: "high", recommendations: "应急车道是生命通道，非紧急情况严禁停车。紧急停车必须开启双闪，人员撤离至护栏外。", response_time: "实时监控" },
  { id: "sop_102", category: "交通违法", event: "违法倒车逆行", severity: "critical", recommendations: "倒车、逆行是严重违法行为，极易引发重大事故，必须立即制止。", response_time: "发现即上报" },
  { id: "sop_201", category: "道路障碍", event: "道路遗撒物", severity: "high", recommendations: "道路遗撒物是重大安全隐患，必须立即清理。发现遗撒可通知12122或通过APP上报。", response_time: "5分钟内上报" },
  { id: "sop_204", category: "道路障碍", event: "动物闯入", severity: "medium", recommendations: "发现动物闯入应及时报告，驾驶员发现后应减速慢行，切勿紧急制动。", response_time: "10分钟内上报" },
  { id: "sop_301", category: "人员异常", event: "行人闯入高速", severity: "critical", recommendations: "行人闯入高速公路是重大安全隐患，必须立即通知交警处理。行人应尽快撤离至护栏外安全地带。", response_time: "发现即上报" },
  { id: "sop_401", category: "天气异常", event: "团雾低能见度", severity: "high", recommendations: "遇团雾应开启雾灯、近光灯和示廓灯，降低车速至能安全停车的范围内。", response_time: "发现即上报" },
  { id: "sop_501", category: "交通拥堵", event: "交通拥堵预警", severity: "medium", recommendations: "遇拥堵应保持车距，依次有序通行，不要随意变道或占用应急车道。", response_time: "持续监控" },
  { id: "sop_701", category: "紧急事件", event: "车辆起火冒烟", severity: "critical", recommendations: "车辆起火极为危险，发现后应立即撤离至安全距离，报警等待救援，切勿自行灭火。", response_time: "发现即上报" },
  { id: "sop_702", category: "紧急事件", event: "危化品泄漏", severity: "critical", recommendations: "危化品泄漏极其危险，非专业人员应远离现场，等待专业部门处置。", response_time: "发现即上报" },
]

interface SOPDetailsCache {
  [key: string]: SOPDetails
}

// 完整的 SOP 详情
const SOP_DETAILS: SOPDetailsCache = {
  "sop_001": {
    detection_signs: ["多辆车异常停滞", "车辆间距过近", "可见碰撞痕迹", "车流突然减速聚集"],
    procedure: ["确认事故车辆数量和位置", "观察是否有人员伤亡迹象", "记录事故范围和车道占用情况", "判断是否影响主线通行", "立即通知高速交警指挥中心", "同时通知急救和路政部门", "持续监控事故区域"],
    recommendations: "如确认事故，应优先确认人员安全，同时通知相关部门尽快到达现场处置。",
    response_time: "5分钟内上报，15分钟内到场"
  },
  "sop_002": {
    detection_signs: ["单车静止不动", "开启双闪灯", "占据车道或应急车道", "人员站在车旁"],
    procedure: ["确认故障车辆位置和占用车道情况", "观察是否开启双闪灯", "判断人员是否处于安全位置", "评估对交通的影响程度", "通知路政清障部门", "持续跟踪至清障完成"],
    recommendations: "故障车辆应尽快移至应急车道，开启双闪灯，人员撤离至护栏外等待救援。",
    response_time: "10分钟内上报，30分钟内到场"
  },
  "sop_003": {
    detection_signs: ["3辆以上车辆连续碰撞", "大面积车辆堆积", "可见多次碰撞痕迹", "可能有人员站立于车道内"],
    procedure: ["快速评估事故规模和涉及车辆数", "立即上报最高级别预警", "通知急救、消防、交警、路政多部门联动", "持续跟踪现场人员动态", "协助交通管制", "记录事故演变过程"],
    recommendations: "连环追尾属重大事故，必须多部门联动处置，人员安全是第一优先。",
    response_time: "2分钟内上报，即时跟踪"
  },
  "sop_101": {
    detection_signs: ["车辆停靠在应急车道", "未开启双闪灯", "车内人员未撤离", "持续停靠超过5分钟"],
    procedure: ["确认车辆是否开启双闪灯", "观察车内人员状态和位置", "记录车牌号码和车身特征", "判断停靠原因", "如人员未撤离至安全位置，优先提醒", "通知高速交警进行处罚处理", "如为故障车辆，通知路政清障"],
    recommendations: "应急车道是生命通道，非紧急情况严禁停车。紧急停车必须开启双闪，人员撤离至护栏外。",
    response_time: "实时监控，发现即上报"
  },
  "sop_102": {
    detection_signs: ["车辆向后行驶", "行驶方向与车道方向相反", "在匝道或分流处逆行", "连续变道或压线行驶"],
    procedure: ["立即确认车辆行驶方向", "上报最高级别预警", "通知交警进行拦截处置", "持续跟踪车辆位置和行驶轨迹", "评估对其他车辆的危险程度", "协助发布预警信息提醒后方车辆"],
    recommendations: "倒车、逆行是严重违法行为，极易引发重大事故，必须立即制止。",
    response_time: "发现即上报，即时跟踪"
  },
  "sop_201": {
    detection_signs: ["路面有不明物体", "货物散落占用车道", "建筑材料掉落在路面", "轮胎碎片等散落物"],
    procedure: ["确认遗撒物位置和占用车道情况", "评估遗撒物大小和危险性", "观察是否影响车辆正常通行", "立即通知路政养护部门", "同时通知交警设置警示标志", "持续监控至清理完成", "如影响重大，通知交通管制"],
    recommendations: "道路遗撒物是重大安全隐患，必须立即清理。发现遗撒可通知12122或通过APP上报。",
    response_time: "5分钟内上报，20分钟内到场清理"
  },
  "sop_204": {
    detection_signs: ["动物在路面行走", "动物在应急车道或边坡", "车辆因动物紧急制动", "动物尸体在路面"],
    procedure: ["确认动物种类和位置", "评估对交通的潜在影响", "如为活体，通知林业或动物管理部门", "如已死亡，通知路政清理", "持续监控现场情况"],
    recommendations: "发现动物闯入应及时报告，驾驶员发现后应减速慢行，切勿紧急制动。",
    response_time: "10分钟内上报，及时处置"
  },
  "sop_301": {
    detection_signs: ["行人在行车道行走", "行人在应急车道行走", "行人穿越中央分隔带", "行人站在桥上或边坡"],
    procedure: ["立即确认识别对象为行人", "上报最高级别预警", "通知高速交警立即前往处置", "持续跟踪行人位置和移动轨迹", "评估对交通的影响范围", "提醒后方车辆注意避让", "如可能，记录行人特征供后续联系"],
    recommendations: "行人闯入高速公路是重大安全隐患，必须立即通知交警处理。行人应尽快撤离至护栏外安全地带。",
    response_time: "发现即上报，实时跟踪"
  },
  "sop_401": {
    detection_signs: ["局部区域能见度骤降", "车辆灯光可见范围缩小", "道路区域呈现白色模糊", "车辆减速或停车"],
    procedure: ["评估团雾范围和严重程度", "通知交通管理部门发布预警", "建议启动限速或封闭管制", "持续监控雾情变化", "协助引导车辆安全通行"],
    recommendations: "遇团雾应开启雾灯、近光灯和示廓灯，降低车速至能安全停车的范围内，就近驶入服务区或驶离高速。",
    response_time: "发现即评估，即时上报"
  },
  "sop_501": {
    detection_signs: ["多辆车速度持续低于30公里每小时", "车辆间距明显缩小", "拥堵趋势明显", "车辆排队长度增加"],
    procedure: ["评估拥堵范围和程度", "查找可能的拥堵原因", "通知交通管理部门发布路况信息", "持续监控拥堵演变", "如发现事故，及时上报"],
    recommendations: "遇拥堵应保持车距，依次有序通行，不要随意变道或占用应急车道。",
    response_time: "持续监控，发现异常及时上报"
  },
  "sop_701": {
    detection_signs: ["可见火焰", "车辆冒黑烟或白烟", "车辆紧急停车", "人员快速撤离"],
    procedure: ["立即确认火情位置和程度", "上报最高级别预警", "通知消防和交警部门", "持续跟踪现场人员安全", "评估是否需要交通管制", "记录火情演变过程"],
    recommendations: "车辆起火极为危险，发现后应立即撤离至安全距离，报警等待救援，切勿自行灭火。",
    response_time: "发现即上报，实时跟踪"
  },
  "sop_702": {
    detection_signs: ["车辆停在应急车道", "可见液体或气体泄漏", "人员佩戴防护设备", "区域已设置警戒"],
    procedure: ["确认泄漏车辆类型和位置", "上报最高级别预警", "通知应急管理、消防、环保部门", "评估泄漏范围和影响", "建议实施交通管制和人员疏散", "持续监控事态发展"],
    recommendations: "危化品泄漏极其危险，非专业人员应远离现场，等待专业部门处置。",
    response_time: "发现即上报，协助管制"
  },
}

export function SOPPanel() {
  const [sops] = useState<SOP[]>(FALLBACK_SOPS)
  const [selectedSOP, setSelectedSOP] = useState<SOP | null>(null)
  const [filter, setFilter] = useState<string>("全部")
  const [searchQuery, setSearchQuery] = useState("")

  // 按分类分组
  const categories = ["全部", ...new Set(sops.map(s => s.category))]

  // 过滤后的 SOP
  const filteredSOPs = sops.filter(sop => {
    const matchesCategory = filter === "全部" || sop.category === filter
    const matchesSearch = searchQuery === "" ||
      sop.event.includes(searchQuery) ||
      sop.category.includes(searchQuery) ||
      sop.recommendations.includes(searchQuery)
    return matchesCategory && matchesSearch
  })

  const selectedDetails = selectedSOP ? SOP_DETAILS[selectedSOP.id] : null

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span style={{ color: "var(--accent-blue)" }}>◫</span>
        <span className="text-xs font-bold" style={{ color: "var(--accent-blue)" }}>
          SOP 知识库
        </span>
        <span className="ml-auto text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          {sops.length} 条规程
        </span>
      </div>

      {/* Search */}
      <div className="px-4 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <input
          type="text"
          placeholder="搜索 SOP..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-1.5 rounded-lg text-xs"
          style={{
            background: "var(--bg-primary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
          }}
        />
      </div>

      {/* Category Filter */}
      <div className="px-4 py-2 flex gap-1 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className="px-2 py-0.5 rounded text-xs transition-all"
            style={{
              background: filter === cat ? CATEGORY_COLORS[cat] || "var(--accent-amber)" : "var(--bg-primary)",
              color: filter === cat ? "#000" : "var(--text-muted)",
              border: `1px solid ${filter === cat ? CATEGORY_COLORS[cat] || "var(--accent-amber)" : "var(--border)"}`,
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* SOP List */}
      <div className="overflow-y-auto" style={{ maxHeight: "300px" }}>
        {filteredSOPs.length === 0 ? (
          <div className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>
            未找到匹配的 SOP
          </div>
        ) : (
          filteredSOPs.map(sop => (
            <div
              key={sop.id}
              className="px-4 py-3 cursor-pointer transition-all"
              style={{
                borderBottom: "1px solid var(--border)",
                background: selectedSOP?.id === sop.id ? `${CATEGORY_COLORS[sop.category]}10` : "transparent",
                borderLeft: selectedSOP?.id === sop.id ? `3px solid ${CATEGORY_COLORS[sop.category]}` : "3px solid transparent",
              }}
              onClick={() => setSelectedSOP(sop)}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="px-1.5 py-0.5 rounded text-xs font-bold"
                  style={{
                    background: CATEGORY_COLORS[sop.category],
                    color: "#000",
                  }}
                >
                  {sop.category}
                </span>
                <span
                  className="px-1.5 py-0.5 rounded text-xs"
                  style={{
                    background: `${SEVERITY_LABELS[sop.severity].color}20`,
                    color: SEVERITY_LABELS[sop.severity].color,
                  }}
                >
                  {SEVERITY_LABELS[sop.severity].label}
                </span>
              </div>
              <div className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                {sop.event}
              </div>
              <div className="text-xs mt-1 line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                {sop.recommendations}
              </div>
            </div>
          ))
        )}
      </div>

      {/* SOP Details Modal */}
      {selectedSOP && selectedDetails && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.8)" }}
          onClick={() => setSelectedSOP(null)}
        >
          <div
            className="rounded-2xl overflow-hidden max-w-lg w-full max-h-[80vh] flex flex-col"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className="px-4 py-3 flex items-center gap-2"
              style={{
                borderBottom: "1px solid var(--border)",
                background: `${CATEGORY_COLORS[selectedSOP.category]}20`,
              }}
            >
              <span
                className="px-2 py-0.5 rounded text-xs font-bold"
                style={{
                  background: CATEGORY_COLORS[selectedSOP.category],
                  color: "#000",
                }}
              >
                {selectedSOP.category}
              </span>
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                {selectedSOP.event}
              </span>
              <button
                className="ml-auto px-2 py-1 rounded text-xs"
                style={{
                  background: "var(--bg-primary)",
                  color: "var(--text-muted)",
                }}
                onClick={() => setSelectedSOP(null)}
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto p-4 space-y-4">
              {/* 识别特征 */}
              <div>
                <div className="text-xs font-bold mb-2" style={{ color: "var(--accent-amber)" }}>
                  识别特征
                </div>
                <div className="space-y-1">
                  {selectedDetails.detection_signs.map((sign, i) => (
                    <div key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      • {sign}
                    </div>
                  ))}
                </div>
              </div>

              {/* 处置流程 */}
              <div>
                <div className="text-xs font-bold mb-2" style={{ color: "var(--accent-green)" }}>
                  处置流程
                </div>
                <div className="space-y-1">
                  {selectedDetails.procedure.map((step, i) => (
                    <div key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {i + 1}. {step}
                    </div>
                  ))}
                </div>
              </div>

              {/* 处置建议 */}
              <div
                className="p-3 rounded-lg"
                style={{ background: "var(--bg-primary)", border: "1px solid var(--accent-blue)30" }}
              >
                <div className="text-xs font-bold mb-1" style={{ color: "var(--accent-blue)" }}>
                  处置建议
                </div>
                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {selectedDetails.recommendations}
                </div>
              </div>

              {/* 响应时间 */}
              <div
                className="p-3 rounded-lg"
                style={{ background: "var(--bg-primary)", border: "1px solid var(--accent-amber)30" }}
              >
                <div className="text-xs font-bold mb-1" style={{ color: "var(--accent-amber)" }}>
                  响应时间
                </div>
                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {selectedDetails.response_time}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
