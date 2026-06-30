const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const apiDir = __dirname;
const logDir = path.join(rootDir, 'logs', 'api');

const common = {
  cwd: apiDir,
  instances: 1,
  exec_mode: 'fork',
  autorestart: true,
  watch: false,
  merge_logs: true,
  time: true,
  min_uptime: '10s',
  max_restarts: 10,
  restart_delay: 2000,
  kill_timeout: 10000,
  max_memory_restart: '512M',
  env: {
    NODE_ENV: 'development'
  },
  env_production: {
    NODE_ENV: 'production'
  }
};

module.exports = {
  apps: [
    {
      ...common,
      name: 'transferly-api',
      script: './app.js',
      out_file: path.join(logDir, 'api.out.log'),
      error_file: path.join(logDir, 'api.error.log'),
      log_file: path.join(logDir, 'api.combined.log')
    },
    {
      ...common,
      name: 'transferly-api-worker',
      script: './jobs/worker.js',
      out_file: path.join(logDir, 'worker.out.log'),
      error_file: path.join(logDir, 'worker.error.log'),
      log_file: path.join(logDir, 'worker.combined.log')
    }
  ]
};
