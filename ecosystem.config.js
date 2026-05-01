module.exports = {
  apps: [
    {
      name: 'uav-chromadb',
      script: 'bash',
      args: 'start_chromadb.sh',
      cwd: '/Users/jasonlee/uav-pro/backend',
      interpreter: 'none',
      autorestart: false,
      watch: false,
      env: {
        PYTHONPATH: '/Users/jasonlee/uav-pro/backend'
      }
    },
    {
      name: 'uav-backend',
      script: 'bash',
      args: 'start_backend.sh',
      cwd: '/Users/jasonlee/uav-pro/backend',
      interpreter: 'none',
      autorestart: false,
      watch: false,
      env: {
        PYTHONPATH: '/Users/jasonlee/uav-pro/backend'
      }
    },
    {
      name: 'uav-showcase',
      script: 'bash',
      args: '-c "PORT=3000 pnpm --filter @uav/showcase dev"',
      cwd: '/Users/jasonlee/uav-pro/frontend',
      interpreter: 'none',
      autorestart: false,
      watch: false,
    },
    {
      name: 'uav-dashboard',
      script: 'bash',
      args: '-c "PORT=3001 pnpm --filter @uav/dashboard dev"',
      cwd: '/Users/jasonlee/uav-pro/frontend',
      interpreter: 'none',
      autorestart: false,
      watch: false,
    },
    {
      name: 'uav-admin',
      script: 'bash',
      args: '-c "PORT=3002 pnpm --filter @uav/admin dev"',
      cwd: '/Users/jasonlee/uav-pro/frontend',
      interpreter: 'none',
      autorestart: false,
      watch: false,
    }
  ]
};
