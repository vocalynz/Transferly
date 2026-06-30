const express = require('express');

const {
  handleCryptoWebhookController,
  handlePayPalWebhookController,
  handleStripeWebhookController
} = require('../controllers/webhookController');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

router.post('/paypal', asyncHandler(handlePayPalWebhookController));
router.post('/stripe', asyncHandler(handleStripeWebhookController));
router.post('/crypto', asyncHandler(handleCryptoWebhookController));

module.exports = {
  webhookRoutes: router
};
