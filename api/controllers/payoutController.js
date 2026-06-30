const { dispatchPayoutProcessing } = require('../jobs/dispatchers');
const {
  assertCanAccessUserResource,
  resolveUserIdForRequest
} = require('../middleware/authenticateRequest');
const { presentPaymentTimelineEntry, presentPayout } = require('../presenters/paymentPresenter');
const { payoutRepository } = require('../repositories/payoutRepository');
const {
  createPayoutSchema,
  listPayoutsQuerySchema,
  paymentTimelineQuerySchema,
  payoutParamsSchema
} = require('../schemas/payoutSchemas');
const { paypalPayoutService } = require('../services/paypalPayoutService');
const { paymentTimelineService } = require('../services/paymentTimelineService');
const { providerPayoutService } = require('../services/providerPayoutService');
const { AUDIT_ACTOR_TYPE } = require('../utils/constants');

async function loadAccessiblePayout(request, response, payoutId) {
  const payout = await payoutRepository.findByIdentifier(payoutId);
  if (!payout) {
    response.status(404).json({
      code: 'PAYOUT_NOT_FOUND',
      message: 'Payout not found.'
    });
    return null;
  }

  assertCanAccessUserResource(request, payout.userId);
  return payout;
}

function resolveAuditActorType(request) {
  return request.auth && request.auth.role === 'ADMIN' ? AUDIT_ACTOR_TYPE.ADMIN : AUDIT_ACTOR_TYPE.USER;
}

function resolveAuditActorId(request) {
  return (request.auth && (request.auth.actorId || request.auth.userId)) || null;
}

async function createPayoutController(request, response) {
  const body = createPayoutSchema.parse(request.body);
  const userId = resolveUserIdForRequest(request, body.userId);

  if (body.provider !== 'paypal') {
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
        metadata: payout.metadata
      });
      return;
    }

    const result = await dispatchPayoutProcessing(
      payout.payout_id,
      `process-${body.provider}-payout`,
      `process-${body.provider}-payout:${payout.payout_id}`
    );
    response.status(201).json(result);
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
      risk_decision: payout.risk_decision
    });
    return;
  }

  const result = await dispatchPayoutProcessing(
    payout.payout_id,
    'process-payout',
    `process-payout:${payout.payout_id}`
  );
  response.status(201).json(result);
}

async function previewPayoutController(request, response) {
  const body = createPayoutSchema.parse(request.body);
  const userId = resolveUserIdForRequest(request, body.userId);

  if (body.provider !== 'paypal') {
    const preview = await providerPayoutService.previewPayout({
      ...body,
      userId,
      includeProviderBalance: request.auth?.role === 'ADMIN',
      actorType: resolveAuditActorType(request),
      actorId: resolveAuditActorId(request)
    });
    response.json(preview);
    return;
  }

  const preview = await paypalPayoutService.previewPayout({
    ...body,
    userId
  });
  response.json(preview);
}

async function getPayoutController(request, response) {
  const params = payoutParamsSchema.parse(request.params || {});
  const payout = await loadAccessiblePayout(request, response, params.id);
  if (!payout) {
    return;
  }

  response.json(presentPayout(payout));
}

async function listPayoutsController(request, response) {
  const query = listPayoutsQuerySchema.parse(request.query || {});
  const userId = request.auth && request.auth.role === 'USER' ? request.auth.userId : undefined;
  const pageSize = query.pageSize || query.limit || 50;
  const filters = {
    ...query,
    pageSize,
    offset: (query.page - 1) * pageSize
  };
  const scopedFilters = userId ? { ...filters, userId } : filters;
  const [payouts, total] = await Promise.all([
    payoutRepository.findMany(scopedFilters),
    payoutRepository.countMany(scopedFilters)
  ]);
  response.json({
    data: payouts.map(presentPayout),
    pagination: {
      page: query.page,
      page_size: pageSize,
      total,
      has_next_page: query.page * pageSize < total
    }
  });
}

async function refreshPayoutController(request, response) {
  const params = payoutParamsSchema.parse(request.params || {});
  const payout = await loadAccessiblePayout(request, response, params.id);
  if (!payout) {
    return;
  }

  const result = await paypalPayoutService.refreshPayout({
    payoutId: payout.id,
    actorType: resolveAuditActorType(request),
    actorId: resolveAuditActorId(request)
  });

  response.json(result);
}

async function getPayoutTimelineController(request, response) {
  const params = payoutParamsSchema.parse(request.params || {});
  const payout = await loadAccessiblePayout(request, response, params.id);
  if (!payout) {
    return;
  }

  const query = paymentTimelineQuerySchema.parse(request.query || {});
  const entries = await paymentTimelineService.getTimeline('payout', payout.id, query);
  response.json({
    data: entries.map(presentPaymentTimelineEntry)
  });
}

module.exports = {
  createPayoutController,
  previewPayoutController,
  getPayoutController,
  listPayoutsController,
  refreshPayoutController,
  getPayoutTimelineController
};
