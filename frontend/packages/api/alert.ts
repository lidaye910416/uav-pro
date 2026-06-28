/**
 * 共享 Alert 类型 - 前后端对齐
 *
 * 后端 Pydantic Alert 模型 (backend/app/models/alert.py) 的 TypeScript 镜像。
 * 三个 app 都从此处导入，避免重复定义。
 */

export type RiskLevel = "low" | "medium" | "high" | "critical"
export type AlertStatus = "pending" | "confirmed" | "resolved" | "dismissed"

export interface DetectionItem {
  label: string
  color: string
  confidence: number
}

export interface Alert {
  id: number
  title: string
  description: string | null
  risk_level: RiskLevel
  status: AlertStatus
  confidence: number | null
  recommendation: string | null
  scene_description?: string | null
  source_type?: string | null
  source_path?: string | null
  pipeline_mode?: string | null
  latitude?: number | null
  longitude?: number | null
  location_name?: string | null
  created_at: string
  updated_at?: string | null
  detection_details?: DetectionItem[]
  ai_model?: string
}
