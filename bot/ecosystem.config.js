const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const botDir = __dirname;
const logDir = path.join(rootDir, 'logs', 'bot');

module.exports = {
  apps: [
    {
      name: 'transferly-bot',
      script: './bot.js',
      cwd: botDir,
      instances: 1,
      exec_mode: 'fork',

      env: {
        NODE_ENV: 'development'
      },

      restart_delay: 2000,
      max_restarts: 5,
      min_uptime: '10s',

      log_file: path.join(logDir, 'bot.combined.log'),
      out_file: path.join(logDir, 'bot.out.log'),
      error_file: path.join(logDir, 'bot.error.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      watch: false,
      ignore_watch: ['node_modules', 'logs', 'db/*.db', '.git'],

      max_memory_restart: '1G',
      kill_timeout: 5000,

      health_check_grace_period: 3000,
      merge_logs: true,
      time: true,
      autorestart: true,

      env_production: {
        NODE_ENV: 'production'
      },

      env_development: {
        NODE_ENV: 'development',
        watch: true
      },

      crash_restart_delay: 1000
    }
  ]
};
