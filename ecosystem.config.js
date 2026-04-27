module.exports = {
  apps: [
    {
      name: 'uav-backend',
      script: 'python3',
      args: '-m uvicorn main:app --host ${BACKEND_HOST:-127.0.0.1} --port ${BACKEND_PORT:-8000} --reload',
      cwd: './backend',
      env: {
        PYTHONPATH: './backend',
        BACKEND_HOST: '127.0.0.1',
        BACKEND_PORT: 8000,
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
        PORT: 3000,
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
        PORT: 3001,
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
        PORT: 3002,
      },
      autorestart: true,
      max_restarts: 5,
      exp_backoff_restart_delay: 100,
    },
  ],
}
