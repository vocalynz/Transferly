const express = require('express');

const {
  createPayoutController,
  previewPayoutController,
  getPayoutTimelineController,
  getPayoutController,
  listPayoutsController,
  refreshPayoutController
} = require('../controllers/payoutController');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireUserAuthIfConfigured } = require('../middleware/authenticateRequest');
const { requireIdempotencyKey } = require('../middleware/requireIdempotencyKey');

const router = express.Router();

router.post('/', requireUserAuthIfConfigured, requireIdempotencyKey, asyncHandler(createPayoutController));
router.post('/preview', requireUserAuthIfConfigured, asyncHandler(previewPayoutController));
router.get('/:id/timeline', requireUserAuthIfConfigured, asyncHandler(getPayoutTimelineController));
router.post('/:id/refresh', requireUserAuthIfConfigured, asyncHandler(refreshPayoutController));
router.get('/:id', requireUserAuthIfConfigured, asyncHandler(getPayoutController));
router.get('/', requireUserAuthIfConfigured, asyncHandler(listPayoutsController));

module.exports = {
  payoutRoutes: router
};
