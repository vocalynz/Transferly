const express = require('express');

const {
  createProviderInvoiceController,
  createProviderPayoutController,
  getProviderActivityController,
  getProviderBalanceController,
  getProviderController,
  getProviderHealthController,
  getProviderLaneController,
  getProviderReadinessController,
  getProviderStatusController,
  listProviderReadinessController,
  listProviderInvoicesController,
  listProviderLanesController,
  listProviderPayoutsController,
  preflightProviderActionController,
  listProvidersController,
  previewProviderInvoiceController,
  previewProviderPayoutController
} = require('../controllers/providerController');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireUserAuthIfConfigured } = require('../middleware/authenticateRequest');
const { requireIdempotencyKey } = require('../middleware/requireIdempotencyKey');

const router = express.Router();

router.get('/', requireUserAuthIfConfigured, asyncHandler(listProvidersController));
router.get('/readiness', requireUserAuthIfConfigured, asyncHandler(listProviderReadinessController));
router.get('/:provider', requireUserAuthIfConfigured, asyncHandler(getProviderController));
router.get('/:provider/readiness', requireUserAuthIfConfigured, asyncHandler(getProviderReadinessController));
router.get('/:provider/health', requireUserAuthIfConfigured, asyncHandler(getProviderHealthController));
router.get('/:provider/status', requireUserAuthIfConfigured, asyncHandler(getProviderStatusController));
router.get('/:provider/actions/:operation/preflight', requireUserAuthIfConfigured, asyncHandler(preflightProviderActionController));
router.get('/:provider/lanes', requireUserAuthIfConfigured, asyncHandler(listProviderLanesController));
router.get('/:provider/lanes/:laneId', requireUserAuthIfConfigured, asyncHandler(getProviderLaneController));
router.get('/:provider/invoices', requireUserAuthIfConfigured, asyncHandler(listProviderInvoicesController));
router.post('/:provider/invoices/preview', requireUserAuthIfConfigured, asyncHandler(previewProviderInvoiceController));
router.post('/:provider/invoices', requireUserAuthIfConfigured, asyncHandler(createProviderInvoiceController));
router.get('/:provider/payouts', requireUserAuthIfConfigured, asyncHandler(listProviderPayoutsController));
router.post('/:provider/payouts/preview', requireUserAuthIfConfigured, asyncHandler(previewProviderPayoutController));
router.post(
  '/:provider/payouts',
  requireUserAuthIfConfigured,
  requireIdempotencyKey,
  asyncHandler(createProviderPayoutController)
);
router.get('/:provider/balance', requireUserAuthIfConfigured, asyncHandler(getProviderBalanceController));
router.get('/:provider/activity', requireUserAuthIfConfigured, asyncHandler(getProviderActivityController));

module.exports = {
  providerRoutes: router
};
