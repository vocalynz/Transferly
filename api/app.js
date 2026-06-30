const express = require('express');

const { configureHttpKernel } = require('./start/kernel');
const { failServerBootstrap, startServer } = require('./start/server');

function createApp() {
  const app = express();
  configureHttpKernel(app);
  return app;
}

module.exports = {
  createApp,
  startServer: () => startServer(createApp)
};

if (require.main === module) {
  module.exports.startServer().catch(failServerBootstrap);
}
