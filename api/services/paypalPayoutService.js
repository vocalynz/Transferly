const { randomUUID } = require('node:crypto');

const config = require('../config');
const { PayPalClient } = require('../adapters/paypalClient');
const { presentPayout } = require('../presenters/paymentPresenter');
const { payoutBatchRepository } = require('../repositories/payoutBatchRepository');
const { payoutRepository } = require('../repositories/payoutRepository');
const { platformConfigRepository } = require('../repositories/platformConfigRepository');
const { riskFlagRepository } = require('../repositories/riskFlagRepository');
const { userRepository } = require('../repositories/userRepository');
const { auditLogService } = require('./auditLogService');
const { ledgerService } = require('./ledgerService');
const { paymentOpsIssueService } = require('./paymentOpsIssueService');
const { buildPayoutPricing } = require('./payoutPricingService');
const { riskService } = require('./riskService');
const { AppError } = require('../utils/errors');
const { ensurePositiveMoney, formatMoney, parseAmount } = require('../utils/money');
const { PAYOUT_STATUS, RISK_DECISION, AUDIT_ACTOR_TYPE } = require('../utils/constants');

const paypalClient = new PayPalClient(
  config.PAYPAL_CLIENT_ID,
  config.PAYPAL_CLIENT_SECRET,
  config.PAYPAL_ENVIRONMENT
);

function normalizePayoutStatus(status) {
  switch (String(status || '').toUpperCase()) {
    case 'SUCCESS':
      return PAYOUT_STATUS.SUCCESS;
    case 'FAILED':
    case 'CANCELED':
    case 'CANCELLED':
    case 'RETURNED':
    case 'REVERSED':
      return PAYOUT_STATUS.FAILED;
    case 'DENIED':
    case 'BLOCKED':
      return PAYOUT_STATUS.DENIED;
    case 'PENDING':
    case 'HELD':
    case 'UNCLAIMED':
    case 'ONHOLD':
    case 'PROCESSING':
      return PAYOUT_STATUS.PENDING;
    default:
      return PAYOUT_STATUS.PROCESSING;
  }
}

function payoutTracking(payout) {
  return presentPayout(payout);
}

function isTerminalPayoutStatus(status) {
  return (
    status === PAYOUT_STATUS.SUCCESS ||
    status === PAYOUT_STATUS.FAILED ||
    status === PAYOUT_STATUS.DENIED ||
    status === PAYOUT_STATUS.REJECTED
  );
}

function isProviderPendingStatus(status) {
  return status === PAYOUT_STATUS.PENDING || status === PAYOUT_STATUS.PROCESSING;
}

function mergePayoutMetadata(payout, updates) {
  return {
    ...(payout.metadata || {}),
    ...updates
  };
}

function providerItemStatusForPayout(payout) {
  return String(payout.metadata?.provider_item_status || '').toUpperCase();
}

function reservedAmountCentsForPayout(payout) {
  return Number(payout.metadata?.pricing?.total_debit_cents || payout.amountCents);
}

async function fetchPayoutBatchDetails(payout) {
  const createBatchResponse = payout.payoutBatch && payout.payoutBatch.paypalPayoutBatchId
    ? null
    : await paypalClient.request({
        method: 'POST',
        path: '/v1/payments/payouts',
        requestId: payout.senderBatchId,
        body: {
          sender_batch_header: {
            sender_batch_id: payout.senderBatchId,
            email_subject: 'You have a payout',
            email_message: 'You have received a payout from Transferly.'
          },
          items: [
            {
              recipient_type: payout.recipientType,
              amount: {
                value: (payout.amountCents / 100).toFixed(2),
                currency: payout.currencyCode
              },
              note: payout.note || 'Transferly payout',
              receiver: payout.receiver,
              sender_item_id: payout.id
            }
          ]
        }
      });

  const batchId =
    (payout.payoutBatch && payout.payoutBatch.paypalPayoutBatchId) ||
    (createBatchResponse && createBatchResponse.batch_header ? createBatchResponse.batch_header.payout_batch_id : null);

  const batchDetails = batchId
    ? await paypalClient.request({
        method: 'GET',
        path: `/v1/payments/payouts/${batchId}?fields=items`
      })
    : createBatchResponse;

  if (!batchDetails) {
    throw new AppError(502, 'PAYPAL_PAYOUT_RESPONSE_INVALID', 'PayPal payout response did not include batch details.');
  }

  return batchDetails;
}

async function fetchPayoutItemDetails(payout, batchDetails) {
  const batchItem = batchDetails.items ? batchDetails.items[0] : null;
  const payoutItemId =
    (batchItem && batchItem.payout_item_id) ||
    payout.paypalPayoutItemId ||
    null;

  if (!payoutItemId) {
    return {
      batchItem,
      itemDetails: null
    };
  }

  const itemDetails = await paypalClient.request({
    method: 'GET',
    path: `/v1/payments/payouts-item/${payoutItemId}`
  });

  return {
    batchItem,
    itemDetails
  };
}

function extractProviderFailureReason(batchItem, itemDetails) {
  return (
    (itemDetails && itemDetails.transaction_status) ||
    (itemDetails && itemDetails.payout_item && itemDetails.payout_item.note) ||
    (batchItem &&
      batchItem.errors &&
      (Array.isArray(batchItem.errors) ? batchItem.errors[0]?.message : batchItem.errors.message || batchItem.errors.name)) ||
    null
  );
}

function extractProviderIssueCode(batchItem, itemDetails) {
  return (
    (itemDetails && itemDetails.errors && itemDetails.errors.name) ||
    (batchItem &&
      batchItem.errors &&
      (Array.isArray(batchItem.errors) ? batchItem.errors[0]?.name : batchItem.errors.name)) ||
    null
  );
}

async function syncPayoutState(payout, { actorType, actorId, action }) {
  const batchDetails = await fetchPayoutBatchDetails(payout);
  const { batchItem, itemDetails } = await fetchPayoutItemDetails(payout, batchDetails);
  const mappedStatus = normalizePayoutStatus(
    (itemDetails && itemDetails.transaction_status) ||
      (batchItem && batchItem.transaction_status) ||
      (batchDetails.batch_header ? batchDetails.batch_header.batch_status : null)
  );

  const payoutBatch = await payoutBatchRepository.upsertBySenderBatchId({
    senderBatchId: payout.senderBatchId,
    paypalPayoutBatchId: batchDetails.batch_header ? batchDetails.batch_header.payout_batch_id : null,
    status: mappedStatus,
    batchCurrencyCode: payout.currencyCode,
    rawResponse: batchDetails
  });

  const updated = await payoutRepository.update(payout.id, {
    payoutBatchId: payoutBatch.id,
    paypalPayoutItemId: batchItem ? batchItem.payout_item_id : payout.paypalPayoutItemId,
    status: mappedStatus,
    failureReason: extractProviderFailureReason(batchItem, itemDetails),
    processedAt: isTerminalPayoutStatus(mappedStatus) ? new Date().toISOString() : null,
    metadata: mergePayoutMetadata(payout, {
      provider_batch_status: batchDetails.batch_header ? batchDetails.batch_header.batch_status : null,
      provider_item_status:
        (itemDetails && itemDetails.transaction_status) ||
        (batchItem && batchItem.transaction_status) ||
        null,
      provider_issue_code: extractProviderIssueCode(batchItem, itemDetails),
      last_synced_at: new Date().toISOString(),
      payout_item_details: itemDetails || null
    })
  });

  await paymentOpsIssueService.syncPayoutIssues(updated);

  if (mappedStatus === PAYOUT_STATUS.SUCCESS) {
    await ledgerService.settlePayout({
      userId: payout.userId,
      payoutId: payout.id,
      amountCents: reservedAmountCentsForPayout(payout),
      currencyCode: payout.currencyCode
    });
  }

  if (mappedStatus === PAYOUT_STATUS.FAILED || mappedStatus === PAYOUT_STATUS.DENIED) {
    await ledgerService.refundReservedPayout({
      userId: payout.userId,
      payoutId: payout.id,
      amountCents: reservedAmountCentsForPayout(payout),
      currencyCode: payout.currencyCode,
      reason: `PayPal payout ${mappedStatus.toLowerCase()} and reserved funds were restored.`
    });
  }

  await auditLogService.log({
    actorType,
    actorId,
    action,
    entityType: 'payout',
    entityId: payout.id,
    metadata: {
      status: mappedStatus,
      payoutBatchId: payoutBatch.paypalPayoutBatchId,
      payoutItemId: batchItem ? batchItem.payout_item_id : null
    }
  });

  return payoutTracking(updated);
}

async function requestPayout(input) {
  const existing = await payoutRepository.findByIdempotencyKey(input.idempotencyKey);
  if (existing) {
    return {
      ...payoutTracking(existing),
      nextAction: 'NONE'
    };
  }

  const user = await userRepository.findById(input.userId);
  if (!user || !user.wallet) {
    throw new AppError(404, 'USER_OR_WALLET_NOT_FOUND', 'User or wallet not found.');
  }

  const currency = input.currency.toUpperCase();
  const amountCents = ensurePositiveMoney(parseAmount(input.amount));
  const platformConfig = await platformConfigRepository.get();
  const payoutMinimumCents = Number(platformConfig.payout_minimum_cents || 0);
  if (payoutMinimumCents > 0 && amountCents < payoutMinimumCents) {
    throw new AppError(
      409,
      'PAYOUT_BELOW_MINIMUM',
      `Payout amount must be at least ${(payoutMinimumCents / 100).toFixed(2)}.`
    );
  }

  const pricing = buildPayoutPricing(amountCents, platformConfig);
  if (user.wallet.availableBalanceCents < pricing.totalDebitCents) {
    throw new AppError(409, 'INSUFFICIENT_AVAILABLE_BALANCE', 'Insufficient available balance for payout.');
  }

  const riskResult = await riskService.evaluatePayout({
    userId: input.userId,
    receiver: input.receiver,
    receiverCountryCode: input.receiverCountryCode,
    amountCents,
    currencyCode: currency
  });

  const payoutId = randomUUID();
  const senderBatchId = `payout_${payoutId}`;
  const initialStatus =
    riskResult.decision === RISK_DECISION.APPROVED
      ? PAYOUT_STATUS.QUEUED
      : riskResult.decision === RISK_DECISION.REVIEW
        ? PAYOUT_STATUS.PENDING_APPROVAL
        : PAYOUT_STATUS.DENIED;

  const payout = await payoutRepository.create({
    id: payoutId,
    userId: input.userId,
    idempotencyKey: input.idempotencyKey,
    senderBatchId,
    status: initialStatus,
    riskDecision: riskResult.decision,
    recipientType: input.recipientType,
    receiver: input.receiver,
    receiverCountryCode: input.receiverCountryCode,
    amountCents,
    currencyCode: currency,
    note: input.note,
    metadata: {
      ...(input.metadata || {}),
      pricing: {
        requested_amount_cents: pricing.requestedAmountCents,
        fee_cents: pricing.feeCents,
        total_debit_cents: pricing.totalDebitCents,
        fee_fixed_cents: pricing.feeFixedCents,
        fee_percentage_bps: pricing.feePercentageBps
      }
    }
  });

  await riskFlagRepository.createMany(
    riskResult.flags.map((flag) => ({
      userId: input.userId,
      payoutId: payout.id,
      ruleCode: flag.ruleCode,
      severity: flag.severity,
      reason: flag.reason,
      metadata: flag.metadata || {}
    }))
  );

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.USER,
    actorId: input.userId,
    action: 'payout.requested',
    entityType: 'payout',
    entityId: payout.id,
    metadata: {
      riskDecision: riskResult.decision,
      feeCents: pricing.feeCents,
      totalDebitCents: pricing.totalDebitCents
    }
  });

  if (riskResult.decision === RISK_DECISION.BLOCKED) {
    return {
      ...payoutTracking(payout),
      nextAction: 'NONE'
    };
  }

  await ledgerService.reservePayoutFunds({
    userId: input.userId,
    payoutId: payout.id,
    amountCents: pricing.totalDebitCents,
    currencyCode: currency
  });

  return {
    ...payoutTracking(payout),
    nextAction: riskResult.decision === RISK_DECISION.APPROVED ? 'PROCESS' : 'NONE'
  };
}

async function previewPayout(input) {
  const user = await userRepository.findById(input.userId);
  if (!user || !user.wallet) {
    throw new AppError(404, 'USER_OR_WALLET_NOT_FOUND', 'User or wallet not found.');
  }

  const currency = input.currency.toUpperCase();
  const amountCents = ensurePositiveMoney(parseAmount(input.amount));
  const platformConfig = await platformConfigRepository.get();
  const pricing = buildPayoutPricing(amountCents, platformConfig);
  const payoutMinimumCents = Number(platformConfig.payout_minimum_cents || 0);
  const riskResult = await riskService.evaluatePayout({
    userId: input.userId,
    receiver: input.receiver,
    receiverCountryCode: input.receiverCountryCode,
    amountCents,
    currencyCode: currency
  });
  const availableBalanceCents = Number(user.wallet.availableBalanceCents || 0);

  return {
    requested_amount: formatMoney(pricing.requestedAmountCents),
    fee_amount: formatMoney(pricing.feeCents),
    total_debit: formatMoney(pricing.totalDebitCents),
    currency,
    requested_amount_cents: pricing.requestedAmountCents,
    fee_cents: pricing.feeCents,
    total_debit_cents: pricing.totalDebitCents,
    fee_fixed_cents: pricing.feeFixedCents,
    fee_percentage_bps: pricing.feePercentageBps,
    minimum_amount_cents: payoutMinimumCents,
    balance: {
      available_cents: availableBalanceCents,
      available: formatMoney(availableBalanceCents),
      remaining_available_cents: availableBalanceCents - pricing.totalDebitCents,
      remaining_available: formatMoney(availableBalanceCents - pricing.totalDebitCents),
      sufficient: availableBalanceCents >= pricing.totalDebitCents
    },
    risk_decision: riskResult.decision,
    risk_flags: riskResult.flags,
    next_action:
      riskResult.decision === RISK_DECISION.APPROVED
        ? 'PROCESS'
        : riskResult.decision === RISK_DECISION.REVIEW
          ? 'MANUAL_REVIEW'
          : 'BLOCK'
  };
}

async function approvePayout(payoutId, adminActorId) {
  const payout = await payoutRepository.findById(payoutId);
  if (!payout) {
    throw new AppError(404, 'PAYOUT_NOT_FOUND', 'Payout not found.');
  }

  if (payout.status !== PAYOUT_STATUS.PENDING_APPROVAL) {
    throw new AppError(409, 'PAYOUT_NOT_PENDING_APPROVAL', 'Only pending approval payouts can be approved.');
  }

  const updated = await payoutRepository.update(payoutId, {
    status: PAYOUT_STATUS.QUEUED,
    approvedByActorId: adminActorId,
    approvedAt: new Date().toISOString()
  });

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: adminActorId,
    action: 'payout.approved',
    entityType: 'payout',
    entityId: payoutId
  });

  return {
    ...payoutTracking(updated),
    nextAction: 'PROCESS'
  };
}

async function rejectPayout(payoutId, adminActorId, reason) {
  const payout = await payoutRepository.findById(payoutId);
  if (!payout) {
    throw new AppError(404, 'PAYOUT_NOT_FOUND', 'Payout not found.');
  }

  if (payout.status !== PAYOUT_STATUS.PENDING_APPROVAL) {
    throw new AppError(409, 'PAYOUT_NOT_PENDING_APPROVAL', 'Only pending approval payouts can be rejected.');
  }

  await ledgerService.refundReservedPayout({
    userId: payout.userId,
    payoutId: payout.id,
    amountCents: reservedAmountCentsForPayout(payout),
    currencyCode: payout.currencyCode,
    reason: reason || 'Rejected payout released reserved funds back to available balance.'
  });

  const updated = await payoutRepository.update(payoutId, {
    status: PAYOUT_STATUS.REJECTED,
    rejectedAt: new Date().toISOString(),
    failureReason: reason || 'Rejected by admin.'
  });

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: adminActorId,
    action: 'payout.rejected',
    entityType: 'payout',
    entityId: payoutId,
    metadata: {
      reason: reason || 'Rejected by admin.'
    }
  });

  return payoutTracking(updated);
}

async function processQueuedPayout(payoutId) {
  const payout = await payoutRepository.findById(payoutId);
  if (!payout) {
    throw new AppError(404, 'PAYOUT_NOT_FOUND', 'Payout not found.');
  }

  if (isTerminalPayoutStatus(payout.status)) {
    return payoutTracking(payout);
  }

  return syncPayoutState(payout, {
    actorType: AUDIT_ACTOR_TYPE.SYSTEM,
    actorId: null,
    action: 'payout.processed'
  });
}

async function cancelUnclaimedPayout(input) {
  let payout = await payoutRepository.findByIdentifier(input.payoutId);
  if (!payout) {
    throw new AppError(404, 'PAYOUT_NOT_FOUND', 'Payout not found.');
  }

  if (!payout.paypalPayoutItemId || !providerItemStatusForPayout(payout)) {
    await syncPayoutState(payout, {
      actorType: input.actorType,
      actorId: input.actorId,
      action: 'payout.refreshed'
    });
    payout = await payoutRepository.findById(payout.id);
  }

  if (!payout.paypalPayoutItemId) {
    throw new AppError(
      409,
      'PAYOUT_ITEM_NOT_READY',
      'PayPal payout item details are not available yet for cancellation.'
    );
  }

  if (providerItemStatusForPayout(payout) !== 'UNCLAIMED') {
    throw new AppError(
      409,
      'PAYOUT_NOT_UNCLAIMED',
      'Only unclaimed PayPal payout items can be cancelled.'
    );
  }

  await paypalClient.request({
    method: 'POST',
    path: `/v1/payments/payouts-item/${payout.paypalPayoutItemId}/cancel`,
    requestId: `${payout.paypalPayoutItemId}:cancel-unclaimed`,
    body: {}
  });

  return syncPayoutState(payout, {
    actorType: input.actorType,
    actorId: input.actorId,
    action: 'payout.unclaimed_cancelled'
  });
}

async function refreshPayout(input) {
  const payout = await payoutRepository.findByIdentifier(input.payoutId);
  if (!payout) {
    throw new AppError(404, 'PAYOUT_NOT_FOUND', 'Payout not found.');
  }

  if (payout.status === PAYOUT_STATUS.PENDING_APPROVAL || payout.status === PAYOUT_STATUS.REJECTED) {
    return payoutTracking(payout);
  }

  if (!payout.payoutBatch && payout.status === PAYOUT_STATUS.QUEUED) {
    return processQueuedPayout(payout.id);
  }

  return syncPayoutState(payout, {
    actorType: input.actorType,
    actorId: input.actorId,
    action: 'payout.refreshed'
  });
}

module.exports = {
  paypalPayoutService: {
    requestPayout,
    previewPayout,
    approvePayout,
    rejectPayout,
    processQueuedPayout,
    cancelUnclaimedPayout,
    refreshPayout,
    isProviderPendingStatus
  }
};
