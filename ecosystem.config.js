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
      name: 'uav-frontend',
      script: 'pnpm',
      args: 'dev',
      cwd: '/Users/jasonlee/uav-pro/frontend',
      interpreter: 'none',
      autorestart: false,
      watch: false,
    }
  ]
};
