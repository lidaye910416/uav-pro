/**
 * UAV-PRO 前端共享 API 配置
 *
 * 所有 URL 都通过环境变量注入，避免硬编码端口。
 * 端口配置单一来源: 项目根 start.sh
 */

const FALLBACK_BACKEND = "http://localhost:8888"

/** 后端 API 根地址 (如 http://localhost:8888) */
export const getApiBase = (): string =>
  process.env.NEXT_PUBLIC_API_BASE || FALLBACK_BACKEND;

/** 后端 API v1 根地址 (如 http://localhost:8888/api/v1) */
export const API_BASE = `${getApiBase()}/api/v1`;

/** Showcase 应用 URL */
export const getShowcaseUrl = (): string =>
  process.env.NEXT_PUBLIC_SHOWCASE_URL || "http://localhost:4000";

/** Dashboard 应用 URL */
export const getDashboardUrl = (): string =>
  process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:4001";

/** Admin 应用 URL */
export const getAdminUrl = (): string =>
  process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:4002";
