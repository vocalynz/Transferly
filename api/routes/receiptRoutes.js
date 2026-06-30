const express = require('express');

const { generateReceiptController } = require('../controllers/receiptController');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireUserAuthIfConfigured } = require('../middleware/authenticateRequest');

const router = express.Router();

router.post('/generate', requireUserAuthIfConfigured, asyncHandler(generateReceiptController));

module.exports = {
  receiptRoutes: router
};
