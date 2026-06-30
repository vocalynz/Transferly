const express = require('express');

const { telegramWebhookController } = require('../controllers/telegramController');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

router.post('/webhook', asyncHandler(telegramWebhookController));

module.exports = {
  telegramRoutes: router
};
