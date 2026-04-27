// PM2 配置文件
// 支持通过环境变量自定义端口配置

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
const backendPort = process.env.BACKEND_PORT || '8000';

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
        PORT: process.env.SHOWCASE_PORT || '3000',
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
        PORT: process.env.DASHBOARD_PORT || '3001',
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
        PORT: process.env.ADMIN_PORT || '3002',
      },
      autorestart: true,
      max_restarts: 5,
      exp_backoff_restart_delay: 100,
    },
  ],
}
