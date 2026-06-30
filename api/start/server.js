const config = require('../config');
const { close, initializeDatabase } = require('../db');
const { logger } = require('../utils/logger');

async function startServer(createApp) {
  await initializeDatabase();
  const { redisConnection } = require('../jobs/queues');

  const app = createApp();
  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, 'HTTP server listening');
  });

  const closeServer = () =>
    new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

  let isShuttingDown = false;

  const shutdown = async (signal) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    logger.info({ signal }, 'Shutting down API server');

    try {
      await closeServer();
      await redisConnection.quit();
      await close();
      process.exit(0);
    } catch (error) {
      logger.error({ err: error, signal }, 'Graceful shutdown failed');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  return server;
}

async function failServerBootstrap(error) {
  const { redisConnection } = require('../jobs/queues');
  logger.error({ err: error }, 'API bootstrap failed');

  try {
    await redisConnection.quit();
    await close();
  } catch (_shutdownError) {
    // Ignore shutdown noise after bootstrap failures.
  }

  process.exit(1);
}

module.exports = {
  failServerBootstrap,
  startServer
};
