const express = require('express');

const { sendEmailReceiptController } = require('../controllers/emailController');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireUserAuthIfConfigured } = require('../middleware/authenticateRequest');

const router = express.Router();

router.post('/send', requireUserAuthIfConfigured, asyncHandler(sendEmailReceiptController));

module.exports = {
  emailRoutes: router
};
