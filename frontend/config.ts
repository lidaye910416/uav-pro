/**
 * 前端服务端口统一配置
 * —— 修改这里的端口值后，所有 app 的按钮/API调用自动同步，无需改其他文件
 *
 * 服务端口（修改后 start.sh 也会同步读取）:
 *   SHOWCASE  → http://localhost:3000  (Turbo 默认)
 *   DASHBOARD → http://localhost:3001  (Turbo 默认)
 *   ADMIN    → http://localhost:3002  (Turbo 默认)
 *   BACKEND  → http://localhost:8888
 *   CHROMADB → http://localhost:8001
 */

const PORTS = {
  SHOWCASE:  parseInt(process.env.NEXT_PUBLIC_SHOWCASE_PORT || "3000", 10),
  DASHBOARD: parseInt(process.env.NEXT_PUBLIC_DASHBOARD_PORT || "3001", 10),
  ADMIN:     parseInt(process.env.NEXT_PUBLIC_ADMIN_PORT     || "3002", 10),
  BACKEND:   parseInt(process.env.NEXT_PUBLIC_BACKEND_PORT   || "8888", 10),
  CHROMADB:  parseInt(process.env.NEXT_PUBLIC_CHROMADB_PORT  || "8001", 10),
} as const;

export const URLS = {
  SHOWCASE:  `http://localhost:${PORTS.SHOWCASE}`,
  DASHBOARD: `http://localhost:${PORTS.DASHBOARD}`,
  ADMIN:     `http://localhost:${PORTS.ADMIN}`,
  BACKEND:   `http://localhost:${PORTS.BACKEND}`,
  CHROMADB:  `http://localhost:${PORTS.CHROMADB}`,
} as const;

export const API = {
  BASE:       `${URLS.BACKEND}`,
  TAGS:       `${URLS.BACKEND}/api/v1/ollama/tags`,
  ANALYZE:    `${URLS.BACKEND}/api/v1/analyze`,
  ALERTS:     `${URLS.BACKEND}/api/v1/alerts`,
  ADMIN_HEALTH:`${URLS.BACKEND}/api/v1/admin/health`,
  DEMO_STREAM:`${URLS.BACKEND}/api/v1/demo/stream`,
} as const;

export const NAV = {
  TO_DASHBOARD:   `${URLS.DASHBOARD}/monitor`,
  TO_DASHBOARD_BRAIN:  `${URLS.DASHBOARD}/brain`,
  TO_DASHBOARD_KB:     `${URLS.DASHBOARD}/knowledge`,
  TO_ADMIN:       URLS.ADMIN,
  TO_SHOWCASE:    URLS.SHOWCASE,
} as const;

export default { URLS, API, NAV, PORTS };
