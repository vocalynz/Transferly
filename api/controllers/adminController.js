const { dispatchPaymentReconciliation, dispatchPayoutProcessing } = require('../jobs/dispatchers');
const {
  adminAdjustUserPointsSchema,
  adminConfigUpdateSchema,
  adminFaqCreateSchema,
  adminFaqParamsSchema,
  adminFaqUpdateSchema,
  adminInvoiceTemplateCreateSchema,
  adminRecordNoteSchema,
  adminInvoiceReminderParamsSchema,
  adminInvoiceReminderUpdateSchema,
  adminInvoiceTemplateParamsSchema,
  adminInvoiceTemplateUpdateSchema,
  adminTestimonialCreateSchema,
  adminTestimonialParamsSchema,
  adminTestimonialUpdateSchema,
  adminUserIdParamsSchema,
  listPaymentOpsIssuesQuerySchema,
  listInvoiceReminderConfigurationsQuerySchema,
  listAdminInvoicesQuerySchema,
  listAdminPayoutsQuerySchema,
  listTopUpOrdersQuerySchema,
  listDeadLetterJobsQuerySchema,
  deadLetterJobParamsSchema,
  deadLetterRecoverySchema,
  listRiskFlagsQuerySchema,
  listWebhookEventsQuerySchema,
  paymentOpsIssueActionSchema,
  paymentOpsIssueParamsSchema,
  releaseInvoiceFundsSchema,
  markInvoiceReviewRequiredSchema,
  runPaymentReconciliationSchema,
  stripeAccountLinkCreateSchema,
  stripeConnectedAccountCreateSchema,
  stripeConnectedAccountListQuerySchema,
  stripeConnectedAccountParamsSchema,
  topUpOrderAdminActionSchema,
  topUpOrderParamsSchema,
  webhookEventActionSchema,
  webhookEventParamsSchema
} = require('../schemas/adminSchemas');
const {
  presentAdminPayout,
  presentAdminInvoice,
  presentAdminUser,
  presentDeadLetterJob,
  presentFundRelease,
  presentInvoiceReminderConfiguration,
  presentInvoiceTemplate,
  presentPaymentOpsIssue,
  presentProviderHealthReport,
  presentQueueOverview,
  presentRiskFlag,
  presentWebhookEvent,
  presentWebhookEventDetail
} = require('../presenters/adminPresenter');
const { invoiceRepository } = require('../repositories/invoiceRepository');
const { payoutRepository } = require('../repositories/payoutRepository');
const { riskFlagRepository } = require('../repositories/riskFlagRepository');
const { webhookEventRepository } = require('../repositories/webhookEventRepository');
const { payoutParamsSchema, rejectPayoutSchema } = require('../schemas/payoutSchemas');
const { adminContentService } = require('../services/adminContentService');
const { adminWebhookService } = require('../services/adminWebhookService');
const { auditLogService } = require('../services/auditLogService');
const { opsService } = require('../services/opsService');
const { paymentProviderRegistry } = require('../services/paymentProviderRegistry');
const { paypalInvoiceService } = require('../services/paypalInvoiceService');
const { providerBalanceService } = require('../services/providerBalanceService');
const { providerInvoiceService } = require('../services/providerInvoiceService');
const { invoiceTemplateService } = require('../services/invoiceTemplateService');
const { paymentOpsIssueService } = require('../services/paymentOpsIssueService');
const { providerHealthService } = require('../services/providerHealthService');
const { paypalPayoutService } = require('../services/paypalPayoutService');
const { providerPayoutService } = require('../services/providerPayoutService');
const { slipcraftUserService } = require('../services/slipcraftUserService');
const { stripeConnectedAccountService } = require('../services/stripeConnectedAccountService');
const { topUpOrderService } = require('../services/topUpOrderService');
const { AUDIT_ACTOR_TYPE } = require('../utils/constants');

async function approvePayoutController(request, response) {
  const payout = await payoutRepository.findByIdentifier(request.params.id);
  const approval =
    String(payout?.metadata?.provider || '').toLowerCase() === 'stripe'
      ? await providerPayoutService.approvePayout(payout.id, request.adminActorId)
      : await paypalPayoutService.approvePayout(request.params.id, request.adminActorId);
  const result = await dispatchPayoutProcessing(
    approval.payout_id,
    'process-approved-payout',
    `process-approved-payout:${approval.payout_id}`
  );
  response.json(result);
}

async function rejectPayoutController(request, response) {
  const body = rejectPayoutSchema.parse(request.body || {});
  const payout = await payoutRepository.findByIdentifier(request.params.id);
  const result =
    String(payout?.metadata?.provider || '').toLowerCase() === 'stripe'
      ? await providerPayoutService.rejectPayout(payout.id, request.adminActorId, body.reason)
      : await paypalPayoutService.rejectPayout(request.params.id, request.adminActorId, body.reason);
  response.json(result);
}

async function cancelUnclaimedPayoutController(request, response) {
  const params = payoutParamsSchema.parse(request.params || {});
  const result = await paypalPayoutService.cancelUnclaimedPayout({
    payoutId: params.id,
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId
  });
  response.json(result);
}

async function releaseInvoiceFundsController(request, response) {
  const body = releaseInvoiceFundsSchema.parse(request.body || {});
  const result = await paypalInvoiceService.releaseInvoiceFunds({
    invoiceId: request.params.id,
    amount: body.amount,
    reason: body.reason,
    idempotencyKey: request.idempotencyKey,
    adminActorId: request.adminActorId,
    requestId: request.id
  });

  response.json(presentFundRelease(result));
}

async function refreshAdminInvoiceController(request, response) {
  const result = await providerInvoiceService.refreshInvoice({
    invoiceId: request.params.id,
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId
  });

  response.json(result);
}

async function voidAdminInvoiceController(request, response) {
  const result = await providerInvoiceService.cancelInvoice({
    invoiceId: request.params.id,
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId,
    requestId: request.id
  });

  response.json(result);
}

async function markInvoiceReviewRequiredController(request, response) {
  const body = markInvoiceReviewRequiredSchema.parse(request.body || {});
  const result = await providerInvoiceService.markInvoiceReviewRequired({
    invoiceId: request.params.id,
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId,
    reason: body.reason
  });

  response.json(result);
}

async function listAdminPayoutsController(request, response) {
  const query = listAdminPayoutsQuerySchema.parse(request.query || {});
  const pageSize = query.pageSize || query.limit || 50;
  const filters = {
    ...query,
    pageSize,
    offset: (query.page - 1) * pageSize
  };
  const [payouts, total] = await Promise.all([
    payoutRepository.findMany(filters),
    payoutRepository.countMany(filters)
  ]);
  response.json({
    data: payouts.map(presentAdminPayout),
    pagination: {
      page: query.page,
      page_size: pageSize,
      total,
      has_next_page: query.page * pageSize < total
    }
  });
}

async function listAdminInvoicesController(request, response) {
  const query = listAdminInvoicesQuerySchema.parse(request.query || {});
  const pageSize = query.pageSize || query.limit || 50;
  const filters = {
    ...query,
    pageSize,
    offset: (query.page - 1) * pageSize
  };
  const [invoices, total] = await Promise.all([
    invoiceRepository.findMany(filters),
    invoiceRepository.countMany(filters)
  ]);
  response.json({
    data: invoices.map(presentAdminInvoice),
    pagination: {
      page: query.page,
      page_size: pageSize,
      total,
      has_next_page: query.page * pageSize < total
    }
  });
}

async function listPaymentProvidersController(_request, response) {
  response.json({
    data: paymentProviderRegistry.listProviders()
  });
}

async function listPaymentProviderHealthController(_request, response) {
  const report = await providerHealthService.getProviderHealthReport();
  response.json(presentProviderHealthReport(report));
}

async function getPaymentProviderController(request, response) {
  response.json({
    provider: paymentProviderRegistry.getProviderStatus(request.params.provider)
  });
}

async function getPaymentProviderBalanceController(request, response) {
  const balance = await providerBalanceService.getProviderBalance({
    provider: request.params.provider,
    connectedAccountId: request.query?.connectedAccountId,
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId
  });
  response.json({
    balance
  });
}

async function listPaymentProviderInvoiceFeaturesController(_request, response) {
  response.json({
    data: paymentProviderRegistry.listInvoiceFeatures()
  });
}

async function getPaymentProviderInvoiceFeaturesController(request, response) {
  response.json({
    provider: paymentProviderRegistry.getProviderInvoiceFeatures(request.params.provider)
  });
}

async function listStripeConnectedAccountsController(request, response) {
  const query = stripeConnectedAccountListQuerySchema.parse(request.query || {});
  response.json({
    data: await stripeConnectedAccountService.listConnectedAccounts(query)
  });
}

async function createStripeConnectedAccountController(request, response) {
  const body = stripeConnectedAccountCreateSchema.parse(request.body || {});
  const account = await stripeConnectedAccountService.createConnectedAccount({
    ...body,
    adminActorId: request.adminActorId
  });
  response.status(201).json({ account });
}

async function refreshStripeConnectedAccountController(request, response) {
  const params = stripeConnectedAccountParamsSchema.parse(request.params || {});
  const account = await stripeConnectedAccountService.refreshConnectedAccount({
    id: params.id,
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId
  });
  response.json({ account });
}

async function createStripeConnectedAccountOnboardingLinkController(request, response) {
  const params = stripeConnectedAccountParamsSchema.parse(request.params || {});
  const body = stripeAccountLinkCreateSchema.parse(request.body || {});
  const result = await stripeConnectedAccountService.createOnboardingLink({
    id: params.id,
    ...body,
    adminActorId: request.adminActorId
  });
  response.status(201).json(result);
}

async function addInvoiceNoteController(request, response) {
  const invoice = await invoiceRepository.findByIdentifier(request.params.id);
  if (!invoice) {
    response.status(404).json({
      code: 'INVOICE_NOT_FOUND',
      message: 'Invoice not found.'
    });
    return;
  }

  const body = adminRecordNoteSchema.parse(request.body || {});
  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId,
    action: 'invoice.note_added',
    entityType: 'invoice',
    entityId: invoice.id,
    metadata: {
      note: body.note
    }
  });
  response.status(201).json({ note: body.note });
}

async function addPayoutNoteController(request, response) {
  const payout = await payoutRepository.findByIdentifier(request.params.id);
  if (!payout) {
    response.status(404).json({
      code: 'PAYOUT_NOT_FOUND',
      message: 'Payout not found.'
    });
    return;
  }

  const body = adminRecordNoteSchema.parse(request.body || {});
  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId,
    action: 'payout.note_added',
    entityType: 'payout',
    entityId: payout.id,
    metadata: {
      note: body.note
    }
  });
  response.status(201).json({ note: body.note });
}

async function listRiskFlagsController(request, response) {
  const query = listRiskFlagsQuerySchema.parse(request.query || {});
  const flags = await riskFlagRepository.findMany(query);
  response.json({
    data: flags.map(presentRiskFlag)
  });
}

async function listWebhookEventsController(request, response) {
  const query = listWebhookEventsQuerySchema.parse(request.query || {});
  const events = await webhookEventRepository.findMany(query);
  response.json({
    data: events.map(presentWebhookEvent)
  });
}

async function getWebhookEventController(request, response) {
  const params = webhookEventParamsSchema.parse(request.params || {});
  const event = await adminWebhookService.getWebhookEvent(params.id);
  response.json({
    event: presentWebhookEventDetail(event)
  });
}

async function replayWebhookEventController(request, response) {
  const params = webhookEventParamsSchema.parse(request.params || {});
  const body = webhookEventActionSchema.parse(request.body || {});
  const event = await adminWebhookService.replayWebhookEvent({
    webhookEventId: params.id,
    adminActorId: request.adminActorId,
    note: body.note
  });
  response.json({
    event: presentWebhookEventDetail(event)
  });
}

async function ignoreWebhookEventController(request, response) {
  const params = webhookEventParamsSchema.parse(request.params || {});
  const body = webhookEventActionSchema.parse(request.body || {});
  const event = await adminWebhookService.ignoreWebhookEvent({
    webhookEventId: params.id,
    adminActorId: request.adminActorId,
    note: body.note
  });
  response.json({
    event: presentWebhookEventDetail(event)
  });
}

async function listPaymentOpsIssuesController(request, response) {
  const query = listPaymentOpsIssuesQuerySchema.parse(request.query || {});
  const issues = await paymentOpsIssueService.listIssues(query);
  response.json({
    data: issues.map(presentPaymentOpsIssue)
  });
}

async function acknowledgePaymentOpsIssueController(request, response) {
  const params = paymentOpsIssueParamsSchema.parse(request.params || {});
  const body = paymentOpsIssueActionSchema.parse(request.body || {});
  const issue = await paymentOpsIssueService.acknowledgeIssue({
    issueId: params.id,
    adminActorId: request.adminActorId,
    note: body.note
  });
  response.json({ issue: presentPaymentOpsIssue(issue) });
}

async function resolvePaymentOpsIssueController(request, response) {
  const params = paymentOpsIssueParamsSchema.parse(request.params || {});
  const body = paymentOpsIssueActionSchema.parse(request.body || {});
  const issue = await paymentOpsIssueService.resolveIssue({
    issueId: params.id,
    adminActorId: request.adminActorId,
    note: body.note
  });
  response.json({ issue: presentPaymentOpsIssue(issue) });
}

async function reopenPaymentOpsIssueController(request, response) {
  const params = paymentOpsIssueParamsSchema.parse(request.params || {});
  const body = paymentOpsIssueActionSchema.parse(request.body || {});
  const issue = await paymentOpsIssueService.reopenIssue({
    issueId: params.id,
    adminActorId: request.adminActorId,
    note: body.note
  });
  response.json({ issue: presentPaymentOpsIssue(issue) });
}

async function getQueueOverviewController(_request, response) {
  const overview = await opsService.getQueueOverview();
  response.json(presentQueueOverview(overview));
}

async function listDeadLetterJobsController(request, response) {
  const query = listDeadLetterJobsQuerySchema.parse(request.query || {});
  const jobs = await opsService.listDeadLetterJobs(query.limit);
  response.json({
    data: jobs.map(presentDeadLetterJob)
  });
}

async function recoverDeadLetterJobController(request, response) {
  const params = deadLetterJobParamsSchema.parse(request.params || {});
  const body = deadLetterRecoverySchema.parse(request.body || {});
  const result = await opsService.recoverDeadLetterJob(params.id, {
    adminActorId: request.adminActorId,
    note: body.note
  });
  response.json({
    dead_letter: presentDeadLetterJob(result.dead_letter),
    recovery: result.recovery
  });
}

async function runPaymentReconciliationController(request, response) {
  const input = runPaymentReconciliationSchema.parse(request.body || {});
  const result = await dispatchPaymentReconciliation(input);
  response.json(result);
}

async function listAdminUsersController(_request, response) {
  const users = await slipcraftUserService.listUsers();
  response.json({
    data: users.map(presentAdminUser)
  });
}

async function listTopUpOrdersController(request, response) {
  const query = listTopUpOrdersQuerySchema.parse(request.query || {});
  const orders = await topUpOrderService.listOrders(query);
  response.json({ data: orders });
}

async function completeTopUpOrderController(request, response) {
  const params = topUpOrderParamsSchema.parse(request.params || {});
  const body = topUpOrderAdminActionSchema.parse(request.body || {});
  const order = await topUpOrderService.completeOrder({
    orderId: params.id,
    adminActorId: request.adminActorId,
    notes: body.notes
  });
  response.json({ order });
}

async function cancelTopUpOrderController(request, response) {
  const params = topUpOrderParamsSchema.parse(request.params || {});
  const body = topUpOrderAdminActionSchema.parse(request.body || {});
  const order = await topUpOrderService.cancelOrder({
    orderId: params.id,
    adminActorId: request.adminActorId,
    notes: body.notes
  });
  response.json({ order });
}

async function adjustAdminUserPointsController(request, response) {
  const params = adminUserIdParamsSchema.parse(request.params || {});
  const body = adminAdjustUserPointsSchema.parse(request.body || {});
  const user = await slipcraftUserService.adjustUserPoints({
    targetUserId: params.id,
    delta: body.delta,
    reason: body.reason,
    adminActorId: request.adminActorId
  });

  response.json({ user: presentAdminUser(user) });
}

async function updateAdminConfigController(request, response) {
  const updates = adminConfigUpdateSchema.parse(request.body || {});
  const config = await adminContentService.updateConfig({
    updates,
    adminActorId: request.adminActorId
  });

  response.json({ config });
}

async function createAdminFaqController(request, response) {
  const input = adminFaqCreateSchema.parse(request.body || {});
  const faq = await adminContentService.createFaq({
    input,
    adminActorId: request.adminActorId
  });

  response.status(201).json({ faq });
}

async function updateAdminFaqController(request, response) {
  const params = adminFaqParamsSchema.parse(request.params || {});
  const updates = adminFaqUpdateSchema.parse(request.body || {});
  const faq = await adminContentService.updateFaq({
    id: params.id,
    updates,
    adminActorId: request.adminActorId
  });

  response.json({ faq });
}

async function deleteAdminFaqController(request, response) {
  const params = adminFaqParamsSchema.parse(request.params || {});
  const result = await adminContentService.deleteFaq({
    id: params.id,
    adminActorId: request.adminActorId
  });

  response.json(result);
}

async function createAdminTestimonialController(request, response) {
  const input = adminTestimonialCreateSchema.parse(request.body || {});
  const testimonial = await adminContentService.createTestimonial({
    input,
    adminActorId: request.adminActorId
  });

  response.status(201).json({ testimonial });
}

async function updateAdminTestimonialController(request, response) {
  const params = adminTestimonialParamsSchema.parse(request.params || {});
  const updates = adminTestimonialUpdateSchema.parse(request.body || {});
  const testimonial = await adminContentService.updateTestimonial({
    id: params.id,
    updates,
    adminActorId: request.adminActorId
  });

  response.json({ testimonial });
}

async function deleteAdminTestimonialController(request, response) {
  const params = adminTestimonialParamsSchema.parse(request.params || {});
  const result = await adminContentService.deleteTestimonial({
    id: params.id,
    adminActorId: request.adminActorId
  });

  response.json(result);
}

async function listAdminInvoiceTemplatesController(_request, response) {
  const templates = await invoiceTemplateService.listTemplates();
  response.json({ data: templates.map(presentInvoiceTemplate) });
}

async function listInvoiceReminderConfigurationsController(request, response) {
  const query = listInvoiceReminderConfigurationsQuerySchema.parse(request.query || {});
  const result = await paypalInvoiceService.listReminderConfigurations(query);
  response.json({
    data: result.data.map(presentInvoiceReminderConfiguration)
  });
}

async function updateInvoiceReminderConfigurationController(request, response) {
  const params = adminInvoiceReminderParamsSchema.parse(request.params || {});
  const input = adminInvoiceReminderUpdateSchema.parse(request.body || {});
  const configuration = await paypalInvoiceService.updateReminderConfiguration({
    configurationId: params.id,
    ...input,
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId
  });

  response.json({ configuration: presentInvoiceReminderConfiguration(configuration) });
}

async function suspendInvoiceReminderConfigurationController(request, response) {
  const params = adminInvoiceReminderParamsSchema.parse(request.params || {});
  const configuration = await paypalInvoiceService.suspendReminderConfiguration({
    configurationId: params.id,
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId
  });

  response.json({ configuration: presentInvoiceReminderConfiguration(configuration) });
}

async function resumeInvoiceReminderConfigurationController(request, response) {
  const params = adminInvoiceReminderParamsSchema.parse(request.params || {});
  const configuration = await paypalInvoiceService.resumeReminderConfiguration({
    configurationId: params.id,
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId
  });

  response.json({ configuration: presentInvoiceReminderConfiguration(configuration) });
}

async function createAdminInvoiceTemplateController(request, response) {
  const input = adminInvoiceTemplateCreateSchema.parse(request.body || {});
  const template = await invoiceTemplateService.createTemplate({
    input,
    adminActorId: request.adminActorId
  });

  response.status(201).json({ template: presentInvoiceTemplate(template) });
}

async function updateAdminInvoiceTemplateController(request, response) {
  const params = adminInvoiceTemplateParamsSchema.parse(request.params || {});
  const updates = adminInvoiceTemplateUpdateSchema.parse(request.body || {});
  const template = await invoiceTemplateService.updateTemplate({
    id: params.id,
    updates,
    adminActorId: request.adminActorId
  });

  response.json({ template: presentInvoiceTemplate(template) });
}

async function deleteAdminInvoiceTemplateController(request, response) {
  const params = adminInvoiceTemplateParamsSchema.parse(request.params || {});
  const result = await invoiceTemplateService.deleteTemplate({
    id: params.id,
    adminActorId: request.adminActorId
  });

  response.json(result);
}

module.exports = {
  acknowledgePaymentOpsIssueController,
  adjustAdminUserPointsController,
  approvePayoutController,
  addInvoiceNoteController,
  addPayoutNoteController,
  cancelTopUpOrderController,
  cancelUnclaimedPayoutController,
  completeTopUpOrderController,
  createAdminFaqController,
  listInvoiceReminderConfigurationsController,
  updateInvoiceReminderConfigurationController,
  suspendInvoiceReminderConfigurationController,
  resumeInvoiceReminderConfigurationController,
  createAdminInvoiceTemplateController,
  createAdminTestimonialController,
  deleteAdminFaqController,
  deleteAdminInvoiceTemplateController,
  deleteAdminTestimonialController,
  rejectPayoutController,
  refreshAdminInvoiceController,
  releaseInvoiceFundsController,
  markInvoiceReviewRequiredController,
  listAdminUsersController,
  listTopUpOrdersController,
  listAdminInvoiceTemplatesController,
  listAdminPayoutsController,
  listAdminInvoicesController,
  listPaymentOpsIssuesController,
  listRiskFlagsController,
  listWebhookEventsController,
  getWebhookEventController,
  ignoreWebhookEventController,
  replayWebhookEventController,
  reopenPaymentOpsIssueController,
  resolvePaymentOpsIssueController,
  getQueueOverviewController,
  listPaymentProviderHealthController,
  getPaymentProviderInvoiceFeaturesController,
  getPaymentProviderBalanceController,
  getPaymentProviderController,
  listDeadLetterJobsController,
  recoverDeadLetterJobController,
  listPaymentProviderInvoiceFeaturesController,
  listPaymentProvidersController,
  listStripeConnectedAccountsController,
  runPaymentReconciliationController,
  createStripeConnectedAccountController,
  createStripeConnectedAccountOnboardingLinkController,
  refreshStripeConnectedAccountController,
  updateAdminConfigController,
  updateAdminFaqController,
  updateAdminInvoiceTemplateController,
  updateAdminTestimonialController,
  voidAdminInvoiceController
};
