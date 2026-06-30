const express = require('express');
const rateLimit = require('express-rate-limit');

const config = require('../config');
const { telegramMiniAppLoginController } = require('../controllers/authController');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

const authRateLimiter = rateLimit({
  windowMs: config.AUTH_RATE_LIMIT_WINDOW_MS,
  max: config.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (request, response) => {
    response.status(429).json({
      code: 'AUTH_RATE_LIMITED',
      message: 'Too many authentication attempts. Please try again later.',
      requestId: request.id
    });
  }
});

router.post('/telegram-mini-app', authRateLimiter, asyncHandler(telegramMiniAppLoginController));

module.exports = {
  authRoutes: router
};
