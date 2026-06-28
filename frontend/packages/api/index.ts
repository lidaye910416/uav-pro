/**
 * UAV-PRO 前端共享 API 配置
 *
 * 所有 URL 都通过环境变量注入，避免硬编码端口。
 * 端口配置单一来源: 项目根 start.sh
 */

const FALLBACK_BACKEND = "http://localhost:8888";

/** 后端 API 根地址 (如 http://localhost:8888) */
export const getApiBase = (): string =>
  process.env.NEXT_PUBLIC_API_BASE || FALLBACK_BACKEND;

/** Showcase 应用 URL */
export const getShowcaseUrl = (): string =>
  process.env.NEXT_PUBLIC_SHOWCASE_URL ||
  (typeof window !== "undefined"
    ? `http://localhost:${window.location.port === "4001" || window.location.port === "4002" ? "4000" : "4000"}`
    : "http://localhost:4000");

/** Dashboard 应用 URL */
export const getDashboardUrl = (): string =>
  process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:4001";

/** Admin 应用 URL */
export const getAdminUrl = (): string =>
  process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:4002";
