/**
 * UAV-PRO 配置中心
 * 统一管理所有服务的配置
 */

import servicesConfig from './services.json'

// 从 services.json 读取配置
const services = servicesConfig.services as Record<string, any>

/**
 * 获取服务 URL
 * @param serviceName 服务名称 (backend, ollama, showcase, dashboard, admin)
 */
export function getServiceUrl(serviceName: string): string {
  const service = services[serviceName]
  if (!service) {
    console.warn(`Service "${serviceName}" not found, using fallback`)
    return ''
  }
  
  const protocol = service.protocol || 'http'
  const host = service.host || '127.0.0.1'
  const port = service.port
  
  return `${protocol}://${host}:${port}`
}

/**
 * 获取服务基础 URL (不带路径)
 */
export function getServiceBaseUrl(serviceName: string): string {
  return getServiceUrl(serviceName)
}

/**
 * 获取带 API 路径的后端地址
 */
export function getBackendApiUrl(): string {
  const baseUrl = getServiceUrl('backend')
  const basePath = services.backend?.basePath || '/api/v1'
  return `${baseUrl}${basePath}`
}

/**
 * 获取前端端口
 */
export function getAppPort(appName: 'showcase' | 'dashboard' | 'admin'): number {
  return services.apps?.[appName]?.port || 3000
}

// 导出所有服务配置
export const config = {
  backend: {
    host: services.backend?.host || '127.0.0.1',
    port: services.backend?.port || 8000,
    baseUrl: getServiceUrl('backend'),
    apiUrl: getBackendApiUrl(),
  },
  ollama: {
    host: services.ollama?.host || '127.0.0.1',
    port: services.ollama?.port || 11434,
    baseUrl: getServiceUrl('ollama'),
  },
  apps: {
    showcase: {
      port: services.apps?.showcase?.port || 3000,
    },
    dashboard: {
      port: services.apps?.dashboard?.port || 3001,
    },
    admin: {
      port: services.apps?.admin?.port || 3002,
    },
  },
}

export default config
