const express = require('express');

const { referralController } = require('../controllers/referralController');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireUserAuthIfConfigured } = require('../middleware/authenticateRequest');

const router = express.Router();

router.post('/', requireUserAuthIfConfigured, asyncHandler(referralController));

module.exports = {
  referralRoutes: router
};
