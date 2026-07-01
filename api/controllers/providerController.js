const { dispatchInvoiceCreation, dispatchPayoutProcessing } = require('../jobs/dispatchers');
const { resolveUserIdForRequest } = require('../middleware/authenticateRequest');
const { presentInvoice, presentPayout } = require('../presenters/paymentPresenter');
const { invoiceRepository } = require('../repositories/invoiceRepository');
const { payoutRepository } = require('../repositories/payoutRepository');
const { createInvoiceSchema, listInvoicesQuerySchema } = require('../schemas/invoiceSchemas');
const { createPayoutSchema, listPayoutsQuerySchema } = require('../schemas/payoutSchemas');
const {
  providerActivityQuerySchema,
  providerLaneParamsSchema,
  providerOperationParamsSchema,
  providerParamsSchema
} = require('../schemas/providerSchemas');
const { paypalPayoutService } = require('../services/paypalPayoutService');
const { providerActivityService } = require('../services/providerActivityService');
const { providerBalanceService } = require('../services/providerBalanceService');
const { providerCapabilityService } = require('../services/providerCapabilityService');
const { providerInvoiceService } = require('../services/providerInvoiceService');
const { providerPayoutService } = require('../services/providerPayoutService');
const { providerHealthService } = require('../services/providerHealthService');
const { providerReadinessService } = require('../services/providerReadinessService');
const { providerStatusService } = require('../services/providerStatusService');
const { PROVIDER_CONTRACT_VERSION } = require('../constants/providerWorkspaceContract');
const { AUDIT_ACTOR_TYPE } = require('../utils/constants');
const { logger } = require('../utils/logger');

function resolveAuditActorType(request) {
  return request.auth && request.auth.role === 'ADMIN' ? AUDIT_ACTOR_TYPE.ADMIN : AUDIT_ACTOR_TYPE.USER;
}

function resolveAuditActorId(request) {
  return (request.auth && (request.auth.actorId || request.auth.userId)) || null;
}

function resolveScopedUserId(request) {
  return request.auth && request.auth.role === 'USER' ? request.auth.userId : undefined;
}

function buildPagination(query, total, pageSize) {
  return {
    page: query.page,
    page_size: pageSize,
    total,
    has_next_page: query.page * pageSize < total
  };
}

function parseProviderParams(request) {
  return providerParamsSchema.parse(request.params || {});
}

function buildProviderQuery(request, schema, provider) {
  return schema.parse({
    ...(request.query || {}),
    provider
  });
}

function logProviderOperation(request, provider, operation, extra = {}) {
  logger.info(
    {
      requestId: request.id,
      provider,
      operation,
      actorRole: request.auth?.role || 'anonymous',
      ...extra
    },
    'provider operation requested'
  );
}

function buildProviderContractMeta(request, extra = {}) {
  return {
    contract_version: PROVIDER_CONTRACT_VERSION,
    requestId: request.id,
    ...extra
  };
}

function withProviderContractMeta(payload, request, extra = {}) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return {
      ...payload,
      ...buildProviderContractMeta(request, extra)
    };
  }

  return {
    data: payload,
    ...buildProviderContractMeta(request, extra)
  };
}

function buildMutationMeta(request, provider) {
  return buildProviderContractMeta(request, {
    provider,
    operation_id: request.id,
    idempotency_key_present: Boolean(request.idempotencyKey)
  });
}

async function listProvidersController(request, response) {
  response.json({
    data: providerCapabilityService.listProviderCapabilities(),
    ...buildProviderContractMeta(request)
  });
}

async function listProviderReadinessController(request, response) {
  response.json({
    data: providerReadinessService.listProviderReadiness(),
    ...buildProviderContractMeta(request)
  });
}

async function getProviderController(request, response) {
  const { provider } = parseProviderParams(request);
  response.json({
    data: providerCapabilityService.getProviderCapabilities(provider),
    provider,
    ...buildProviderContractMeta(request)
  });
}

async function getProviderReadinessController(request, response) {
  const { provider } = parseProviderParams(request);
  response.json({
    data: providerReadinessService.getProviderReadiness(provider),
    provider,
    ...buildProviderContractMeta(request)
  });
}

async function getProviderHealthController(request, response) {
  const { provider } = parseProviderParams(request);
  providerCapabilityService.getProviderCapabilities(provider);
  response.json({
    data: await providerHealthService.getProviderHealth(provider),
    provider,
    ...buildProviderContractMeta(request)
  });
}

async function getProviderStatusController(request, response) {
  const { provider } = parseProviderParams(request);
  response.json({
    data: await providerStatusService.getProviderStatus(provider),
    provider,
    ...buildProviderContractMeta(request)
  });
}

async function preflightProviderActionController(request, response) {
  const { provider, operation } = providerOperationParamsSchema.parse(request.params || {});
  response.json({
    data: await providerStatusService.preflightProviderAction(provider, operation),
    provider,
    ...buildProviderContractMeta(request)
  });
}

async function listProviderLanesController(request, response) {
  const { provider } = parseProviderParams(request);
  response.json({
    data: providerCapabilityService.listProviderLanes(provider),
    provider,
    ...buildProviderContractMeta(request)
  });
}

async function getProviderLaneController(request, response) {
  const { provider, laneId } = providerLaneParamsSchema.parse(request.params || {});
  response.json({
    data: providerCapabilityService.getProviderLaneCapability(provider, laneId),
    provider,
    ...buildProviderContractMeta(request)
  });
}

async function listProviderInvoicesController(request, response) {
  const { provider } = parseProviderParams(request);
  providerCapabilityService.assertProviderOperation(provider, 'invoices');
  const query = buildProviderQuery(request, listInvoicesQuerySchema, provider);
  const pageSize = query.pageSize || query.limit || 50;
  const filters = {
    ...query,
    pageSize,
    offset: (query.page - 1) * pageSize
  };
  const userId = resolveScopedUserId(request);
  const scopedFilters = userId ? { ...filters, userId } : filters;
  const [invoices, total] = await Promise.all([
    invoiceRepository.findMany(scopedFilters),
    invoiceRepository.countMany(scopedFilters)
  ]);

  response.json({
    data: invoices.map(presentInvoice),
    pagination: buildPagination(query, total, pageSize),
    provider,
    ...buildProviderContractMeta(request)
  });
}

async function previewProviderInvoiceController(request, response) {
  const { provider } = parseProviderParams(request);
  providerCapabilityService.assertProviderOperation(provider, 'invoices');
  logProviderOperation(request, provider, 'invoice_preview');
  const body = createInvoiceSchema.parse({
    ...(request.body || {}),
    provider
  });
  const preview = await providerInvoiceService.previewInvoice({
    ...body,
    userId: resolveUserIdForRequest(request, body.userId)
  });
  response.json(withProviderContractMeta(preview, request, { provider }));
}

async function createProviderInvoiceController(request, response) {
  const { provider } = parseProviderParams(request);
  providerCapabilityService.assertProviderOperation(provider, 'invoices');
  logProviderOperation(request, provider, 'invoice_create');
  const body = createInvoiceSchema.parse({
    ...(request.body || {}),
    provider
  });
  const result = await dispatchInvoiceCreation({
    ...body,
    userId: resolveUserIdForRequest(request, body.userId),
    requestId: request.id
  });
  response.status(201).json(withProviderContractMeta(result, request, buildMutationMeta(request, provider)));
}

async function listProviderPayoutsController(request, response) {
  const { provider } = parseProviderParams(request);
  providerCapabilityService.assertProviderOperation(provider, 'payouts');
  const query = buildProviderQuery(request, listPayoutsQuerySchema, provider);
  const pageSize = query.pageSize || query.limit || 50;
  const filters = {
    ...query,
    pageSize,
    offset: (query.page - 1) * pageSize
  };
  const userId = resolveScopedUserId(request);
  const scopedFilters = userId ? { ...filters, userId } : filters;
  const [payouts, total] = await Promise.all([
    payoutRepository.findMany(scopedFilters),
    payoutRepository.countMany(scopedFilters)
  ]);

  response.json({
    data: payouts.map(presentPayout),
    pagination: buildPagination(query, total, pageSize),
    provider,
    ...buildProviderContractMeta(request)
  });
}

async function previewProviderPayoutController(request, response) {
  const { provider } = parseProviderParams(request);
  providerCapabilityService.assertProviderOperation(provider, 'payouts');
  logProviderOperation(request, provider, 'payout_preview');
  const body = createPayoutSchema.parse({
    ...(request.body || {}),
    provider
  });
  const userId = resolveUserIdForRequest(request, body.userId);

  if (provider !== 'paypal') {
    const preview = await providerPayoutService.previewPayout({
      ...body,
      userId,
      includeProviderBalance: request.auth?.role === 'ADMIN',
      actorType: resolveAuditActorType(request),
      actorId: resolveAuditActorId(request)
    });
    response.json(withProviderContractMeta(preview, request, { provider }));
    return;
  }

  const preview = await paypalPayoutService.previewPayout({
    ...body,
    userId
  });
  response.json(withProviderContractMeta(preview, request, { provider }));
}

async function createProviderPayoutController(request, response) {
  const { provider } = parseProviderParams(request);
  providerCapabilityService.assertProviderOperation(provider, 'payouts');
  logProviderOperation(request, provider, 'payout_create', {
    idempotencyKeyPresent: Boolean(request.idempotencyKey)
  });
  const body = createPayoutSchema.parse({
    ...(request.body || {}),
    provider
  });
  const userId = resolveUserIdForRequest(request, body.userId);

  if (provider !== 'paypal') {
    const payout = await providerPayoutService.requestPayout({
      ...body,
      userId,
      actorType: resolveAuditActorType(request),
      actorId: resolveAuditActorId(request),
      idempotencyKey: request.idempotencyKey
    });

    if (payout.nextAction !== 'PROCESS') {
      response.status(201).json({
        payout_id: payout.payout_id,
        status: payout.status,
        tracking: payout.tracking,
        risk_decision: payout.risk_decision,
        metadata: payout.metadata,
        ...buildMutationMeta(request, provider)
      });
      return;
    }

    const result = await dispatchPayoutProcessing(
      payout.payout_id,
      `process-${provider}-payout`,
      `process-${provider}-payout:${payout.payout_id}`
    );
    response.status(201).json(withProviderContractMeta(result, request, buildMutationMeta(request, provider)));
    return;
  }

  const payout = await paypalPayoutService.requestPayout({
    ...body,
    userId,
    idempotencyKey: request.idempotencyKey
  });

  if (payout.nextAction !== 'PROCESS') {
    response.status(201).json({
      payout_id: payout.payout_id,
      status: payout.status,
      tracking: payout.tracking,
      risk_decision: payout.risk_decision,
      ...buildMutationMeta(request, provider)
    });
    return;
  }

  const result = await dispatchPayoutProcessing(
    payout.payout_id,
    'process-payout',
    `process-payout:${payout.payout_id}`
  );
  response.status(201).json(withProviderContractMeta(result, request, buildMutationMeta(request, provider)));
}

async function getProviderBalanceController(request, response) {
  const { provider } = parseProviderParams(request);
  providerCapabilityService.assertProviderOperation(provider, 'balance');
  logProviderOperation(request, provider, 'balance_lookup');
  const balance = await providerBalanceService.getProviderBalance({
    provider,
    connectedAccountId: request.query?.connectedAccountId,
    actorType: resolveAuditActorType(request),
    actorId: resolveAuditActorId(request)
  });
  response.json({
    data: balance,
    provider,
    ...buildProviderContractMeta(request)
  });
}

async function getProviderActivityController(request, response) {
  const { provider } = parseProviderParams(request);
  providerCapabilityService.assertProviderOperation(provider, 'activity');
  const query = providerActivityQuerySchema.parse(request.query || {});
  const activity = await providerActivityService.listProviderActivity({
    ...query,
    provider,
    userId: resolveScopedUserId(request)
  });
  response.json({
    data: activity.items,
    pagination: activity.pagination,
    provider,
    ...buildProviderContractMeta(request)
  });
}

module.exports = {
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
};
