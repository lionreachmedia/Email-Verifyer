// PM2 process file for production on a VPS:  pm2 start ecosystem.config.js
module.exports = {
  apps: [
    { name: 'mailguard-api', cwd: './server', script: 'src/server.js', env: { NODE_ENV: 'production' }, max_memory_restart: '600M' },
    { name: 'mailguard-worker', cwd: './server', script: 'src/worker.js', env: { NODE_ENV: 'production' }, max_memory_restart: '600M' },
  ],
};
