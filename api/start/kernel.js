const compression = require('compression');
const cors = require('cors');
const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const config = require('../config');
const { assignRequestId } = require('../middleware/requestContext');
const { authenticateRequest } = require('../middleware/authenticateRequest');
const { errorHandler, notFoundHandler } = require('../middleware/errorHandler');
const { registerRoutes } = require('../routes');
const { logger } = require('../utils/logger');

function buildCorsOptions() {
  const allowedOrigins = new Set(config.CORS_ALLOWED_ORIGINS);

  return {
    credentials: true,
    exposedHeaders: ['x-request-id'],
    allowedHeaders: [
      'authorization',
      'content-type',
      'idempotency-key',
      'x-admin-token',
      'x-request-id',
      'x-transferly-client',
      'x-telegram-bot-api-secret-token'
    ],
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    }
  };
}

function requestLogger(request, response, next) {
  const startedAt = process.hrtime.bigint();

  response.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    logger.info(
      {
        requestId: request.id,
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        durationMs: Math.round(durationMs)
      },
      'HTTP request completed'
    );
  });

  next();
}

function configureHttpKernel(app) {
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors(buildCorsOptions()));
  app.use(compression());
  app.use(assignRequestId);
  app.use(requestLogger);
  app.use(authenticateRequest);
  app.use(
    rateLimit({
      windowMs: config.API_RATE_LIMIT_WINDOW_MS,
      max: config.API_RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (request) => request.path === '/health',
      handler: (request, response) => {
        response.status(429).json({
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
          requestId: request.id
        });
      }
    })
  );
  app.use(
    express.json({
      limit: '1mb',
      verify(request, _response, buffer) {
        request.rawBody = buffer.toString('utf8');
      }
    })
  );

  app.get('/health', (request, response) => {
    response.json({
      ok: true,
      status: 'healthy',
      requestId: request.id,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      checks: {
        database: 'configured',
        queue: config.INLINE_QUEUE_MODE ? 'inline' : 'redis',
        corsOrigins: config.CORS_ALLOWED_ORIGINS.length,
        telegramMiniAppAuth: Boolean(config.TELEGRAM_BOT_TOKEN)
      }
    });
  });

  registerRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);
}

module.exports = {
  configureHttpKernel
};
