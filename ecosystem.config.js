// PM2 配置文件
// 支持通过环境变量自定义端口配置
// 端口配置统一从 .env 读取，package.json 中使用 ${PORT:-默认值} 读取环境变量

// 从 .env 加载配置
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        process.env[match[1].trim()] = match[2].trim();
      }
    });
  }
}

loadEnv();

const backendHost = process.env.BACKEND_HOST || '127.0.0.1';
const backendPort = process.env.BACKEND_PORT || '8888';

// 前端服务端口（从环境变量读取，没有则使用默认值）
const showcasePort = process.env.SHOWCASE_PORT || '3000';
const dashboardPort = process.env.DASHBOARD_PORT || '3001';
const adminPort = process.env.ADMIN_PORT || '3002';

// 前端 URL 配置（用于服务间跳转，动态构建）
const showcaseUrl = `http://localhost:${showcasePort}`;
const dashboardUrl = `http://localhost:${dashboardPort}`;
const adminUrl = `http://localhost:${adminPort}`;

module.exports = {
  apps: [
    {
      name: 'uav-backend',
      script: 'python3',
      args: `-m uvicorn main:app --host ${backendHost} --port ${backendPort} --reload`,
      cwd: './backend',
      env: {
        PYTHONPATH: './backend',
        BACKEND_HOST: backendHost,
        BACKEND_PORT: backendPort,
        // 传递给前端的环境变量
        NEXT_PUBLIC_API_BASE: `http://localhost:${backendPort}`,
      },
      autorestart: true,
      max_restarts: 10,
      watch: ['./backend/app'],
    },
    {
      name: 'uav-showcase',
      script: 'npm',
      args: 'run dev',
      cwd: './frontend/apps/showcase',
      env: {
        NODE_ENV: 'development',
        PORT: showcasePort,
        NEXT_PUBLIC_API_BASE: `http://localhost:${backendPort}`,
        NEXT_PUBLIC_DASHBOARD_URL: dashboardUrl,
        NEXT_PUBLIC_ADMIN_URL: adminUrl,
      },
      autorestart: true,
      max_restarts: 5,
      exp_backoff_restart_delay: 100,
    },
    {
      name: 'uav-dashboard',
      script: 'npm',
      args: 'run dev',
      cwd: './frontend/apps/dashboard',
      env: {
        NODE_ENV: 'development',
        PORT: dashboardPort,
        NEXT_PUBLIC_API_BASE: `http://localhost:${backendPort}`,
        NEXT_PUBLIC_SHOWCASE_URL: showcaseUrl,
        NEXT_PUBLIC_ADMIN_URL: adminUrl,
      },
      autorestart: true,
      max_restarts: 5,
      exp_backoff_restart_delay: 100,
    },
    {
      name: 'uav-admin',
      script: 'npm',
      args: 'run dev',
      cwd: './frontend/apps/admin',
      env: {
        NODE_ENV: 'development',
        PORT: adminPort,
        NEXT_PUBLIC_API_BASE: `http://localhost:${backendPort}`,
        NEXT_PUBLIC_SHOWCASE_URL: showcaseUrl,
        NEXT_PUBLIC_DASHBOARD_URL: dashboardUrl,
      },
      autorestart: true,
      max_restarts: 5,
      exp_backoff_restart_delay: 100,
    },
  ],
}
