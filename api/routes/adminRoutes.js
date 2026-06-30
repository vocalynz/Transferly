const express = require('express');

const {
  adjustAdminUserPointsController,
  addInvoiceNoteController,
  addPayoutNoteController,
  acknowledgePaymentOpsIssueController,
  approvePayoutController,
  cancelUnclaimedPayoutController,
  cancelTopUpOrderController,
  completeTopUpOrderController,
  createAdminFaqController,
  listInvoiceReminderConfigurationsController,
  updateInvoiceReminderConfigurationController,
  suspendInvoiceReminderConfigurationController,
  resumeInvoiceReminderConfigurationController,
  createAdminInvoiceTemplateController,
  createStripeConnectedAccountController,
  createStripeConnectedAccountOnboardingLinkController,
  createAdminTestimonialController,
  deleteAdminFaqController,
  deleteAdminInvoiceTemplateController,
  deleteAdminTestimonialController,
  getPaymentProviderBalanceController,
  getPaymentProviderInvoiceFeaturesController,
  getPaymentProviderController,
  getWebhookEventController,
  ignoreWebhookEventController,
  getQueueOverviewController,
  listAdminInvoiceTemplatesController,
  listAdminInvoicesController,
  listAdminUsersController,
  listTopUpOrdersController,
  listDeadLetterJobsController,
  listPaymentOpsIssuesController,
  listPaymentProviderHealthController,
  listPaymentProviderInvoiceFeaturesController,
  listPaymentProvidersController,
  listStripeConnectedAccountsController,
  reopenPaymentOpsIssueController,
  runPaymentReconciliationController,
  rejectPayoutController,
  recoverDeadLetterJobController,
  refreshAdminInvoiceController,
  refreshStripeConnectedAccountController,
  resolvePaymentOpsIssueController,
  releaseInvoiceFundsController,
  markInvoiceReviewRequiredController,
  listAdminPayoutsController,
  listRiskFlagsController,
  listWebhookEventsController,
  replayWebhookEventController,
  updateAdminConfigController,
  updateAdminFaqController,
  updateAdminInvoiceTemplateController,
  updateAdminTestimonialController,
  voidAdminInvoiceController
} = require('../controllers/adminController');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireAdminActor } = require('../middleware/requireAdminActor');
const { requireIdempotencyKey } = require('../middleware/requireIdempotencyKey');

const router = express.Router();

router.get('/users', requireAdminActor, asyncHandler(listAdminUsersController));
router.post('/users/:id/points', requireAdminActor, asyncHandler(adjustAdminUserPointsController));
router.get('/top-up-orders', requireAdminActor, asyncHandler(listTopUpOrdersController));
router.post('/top-up-orders/:id/complete', requireAdminActor, asyncHandler(completeTopUpOrderController));
router.post('/top-up-orders/:id/cancel', requireAdminActor, asyncHandler(cancelTopUpOrderController));
router.get('/invoice-reminders', requireAdminActor, asyncHandler(listInvoiceReminderConfigurationsController));
router.put('/invoice-reminders/:id', requireAdminActor, asyncHandler(updateInvoiceReminderConfigurationController));
router.post('/invoice-reminders/:id/suspend', requireAdminActor, asyncHandler(suspendInvoiceReminderConfigurationController));
router.post('/invoice-reminders/:id/resume', requireAdminActor, asyncHandler(resumeInvoiceReminderConfigurationController));
router.get('/invoice-templates', requireAdminActor, asyncHandler(listAdminInvoiceTemplatesController));
router.post('/invoice-templates', requireAdminActor, asyncHandler(createAdminInvoiceTemplateController));
router.patch('/invoice-templates/:id', requireAdminActor, asyncHandler(updateAdminInvoiceTemplateController));
router.delete('/invoice-templates/:id', requireAdminActor, asyncHandler(deleteAdminInvoiceTemplateController));
router.get('/invoices', requireAdminActor, asyncHandler(listAdminInvoicesController));
router.get('/payouts', requireAdminActor, asyncHandler(listAdminPayoutsController));
router.get('/payment-providers', requireAdminActor, asyncHandler(listPaymentProvidersController));
router.get(
  '/payment-providers/stripe/connected-accounts',
  requireAdminActor,
  asyncHandler(listStripeConnectedAccountsController)
);
router.post(
  '/payment-providers/stripe/connected-accounts',
  requireAdminActor,
  asyncHandler(createStripeConnectedAccountController)
);
router.post(
  '/payment-providers/stripe/connected-accounts/:id/refresh',
  requireAdminActor,
  asyncHandler(refreshStripeConnectedAccountController)
);
router.post(
  '/payment-providers/stripe/connected-accounts/:id/onboarding-link',
  requireAdminActor,
  asyncHandler(createStripeConnectedAccountOnboardingLinkController)
);
router.get(
  '/payment-providers/invoice-features',
  requireAdminActor,
  asyncHandler(listPaymentProviderInvoiceFeaturesController)
);
router.get('/payment-providers/health', requireAdminActor, asyncHandler(listPaymentProviderHealthController));
router.get(
  '/payment-providers/:provider/invoice-features',
  requireAdminActor,
  asyncHandler(getPaymentProviderInvoiceFeaturesController)
);
router.get(
  '/payment-providers/:provider/balance',
  requireAdminActor,
  asyncHandler(getPaymentProviderBalanceController)
);
router.get('/payment-providers/:provider', requireAdminActor, asyncHandler(getPaymentProviderController));
router.get('/payment-issues', requireAdminActor, asyncHandler(listPaymentOpsIssuesController));
router.post('/payment-issues/:id/acknowledge', requireAdminActor, asyncHandler(acknowledgePaymentOpsIssueController));
router.post('/payment-issues/:id/resolve', requireAdminActor, asyncHandler(resolvePaymentOpsIssueController));
router.post('/payment-issues/:id/reopen', requireAdminActor, asyncHandler(reopenPaymentOpsIssueController));
router.post('/payouts/:id/approve', requireAdminActor, asyncHandler(approvePayoutController));
router.post('/payouts/:id/cancel-unclaimed', requireAdminActor, asyncHandler(cancelUnclaimedPayoutController));
router.post('/payouts/:id/reject', requireAdminActor, asyncHandler(rejectPayoutController));
router.post('/payouts/:id/notes', requireAdminActor, asyncHandler(addPayoutNoteController));
router.get('/risk-flags', requireAdminActor, asyncHandler(listRiskFlagsController));
router.get('/webhooks', requireAdminActor, asyncHandler(listWebhookEventsController));
router.get('/webhooks/:id', requireAdminActor, asyncHandler(getWebhookEventController));
router.post('/webhooks/:id/replay', requireAdminActor, asyncHandler(replayWebhookEventController));
router.post('/webhooks/:id/ignore', requireAdminActor, asyncHandler(ignoreWebhookEventController));
router.get('/queues', requireAdminActor, asyncHandler(getQueueOverviewController));
router.get('/dead-letters', requireAdminActor, asyncHandler(listDeadLetterJobsController));
router.post('/dead-letters/:id/recover', requireAdminActor, asyncHandler(recoverDeadLetterJobController));
router.post('/reconciliation/run', requireAdminActor, asyncHandler(runPaymentReconciliationController));
router.patch('/config', requireAdminActor, asyncHandler(updateAdminConfigController));
router.post('/faqs', requireAdminActor, asyncHandler(createAdminFaqController));
router.patch('/faqs/:id', requireAdminActor, asyncHandler(updateAdminFaqController));
router.delete('/faqs/:id', requireAdminActor, asyncHandler(deleteAdminFaqController));
router.post('/testimonials', requireAdminActor, asyncHandler(createAdminTestimonialController));
router.patch('/testimonials/:id', requireAdminActor, asyncHandler(updateAdminTestimonialController));
router.delete('/testimonials/:id', requireAdminActor, asyncHandler(deleteAdminTestimonialController));
router.post('/invoices/:id/release', requireAdminActor, requireIdempotencyKey, asyncHandler(releaseInvoiceFundsController));
router.post('/invoices/:id/refresh', requireAdminActor, asyncHandler(refreshAdminInvoiceController));
router.post('/invoices/:id/void', requireAdminActor, asyncHandler(voidAdminInvoiceController));
router.post('/invoices/:id/review-required', requireAdminActor, asyncHandler(markInvoiceReviewRequiredController));
router.post('/invoices/:id/notes', requireAdminActor, asyncHandler(addInvoiceNoteController));

module.exports = {
  adminRoutes: router
};
