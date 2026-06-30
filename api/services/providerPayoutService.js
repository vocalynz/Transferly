const { randomUUID } = require('node:crypto');

const config = require('../config');
const { StripeClient } = require('../adapters/stripeClient');
const { presentPayout } = require('../presenters/paymentPresenter');
const { payoutRepository } = require('../repositories/payoutRepository');
const { riskFlagRepository } = require('../repositories/riskFlagRepository');
const { stripeConnectedAccountRepository } = require('../repositories/stripeConnectedAccountRepository');
const { AppError } = require('../utils/errors');
const { AUDIT_ACTOR_TYPE, PAYOUT_STATUS, RISK_DECISION } = require('../utils/constants');
const { ensurePositiveMoney, formatMoney, parseAmount } = require('../utils/money');
const { platformConfigRepository } = require('../repositories/platformConfigRepository');
const { userRepository } = require('../repositories/userRepository');
const { auditLogService } = require('./auditLogService');
const { ledgerService } = require('./ledgerService');
const { buildPayoutPricing } = require('./payoutPricingService');
const { providerBalanceService } = require('./providerBalanceService');
const { riskService } = require('./riskService');

const stripeClient = new StripeClient({
  secretKey: config.STRIPE_SECRET_KEY,
  apiVersion: config.STRIPE_API_VERSION,
  baseUrl: config.STRIPE_API_BASE_URL
});

function sumAvailableCurrency(balance, currency) {
  return (balance?.available || [])
    .filter((entry) => entry.currency === currency)
    .reduce((total, entry) => total + Number(entry.amount_cents || 0), 0);
}

function payoutTracking(payout) {
  return presentPayout(payout);
}

function isStripePayout(payout) {
  return String(payout?.metadata?.provider || '').toLowerCase() === 'stripe';
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
  return status === PAYOUT_STATUS.PENDING || status === PAYOUT_STATUS.PROCESSING || status === PAYOUT_STATUS.QUEUED;
}

function reservedAmountCentsForPayout(payout) {
  return Number(payout.metadata?.pricing?.total_debit_cents || payout.amountCents);
}

function resolveStripeDestinationAccount(input) {
  const destination =
    input.connectedAccountId ||
    input.metadata?.stripe_connected_account_id ||
    input.metadata?.connected_account_id ||
    (String(input.receiver || '').startsWith('acct_') ? input.receiver : '') ||
    config.STRIPE_CONNECTED_ACCOUNT_ID;

  if (!destination || !String(destination).startsWith('acct_')) {
    throw new AppError(
      400,
      'STRIPE_CONNECTED_ACCOUNT_REQUIRED',
      'Stripe payouts require a connected account id such as acct_123.'
    );
  }

  return destination;
}

function assertStripePayoutsEnabled() {
  if (!config.STRIPE_PAYOUTS_ENABLED) {
    throw new AppError(501, 'STRIPE_PAYOUT_SUBMISSION_DISABLED', 'Stripe payout submission is disabled.', {
      required_env: ['STRIPE_PAYOUTS_ENABLED=true'],
      payout_mode: config.STRIPE_PAYOUT_MODE
    });
  }
}

function normalizeStripeTransferStatus(transfer) {
  if (transfer && transfer.reversed) {
    return PAYOUT_STATUS.FAILED;
  }

  return PAYOUT_STATUS.SUCCESS;
}

function stripeTransferMetadata(payout, transfer, updates = {}) {
  return {
    ...(payout.metadata || {}),
    provider: 'stripe',
    provider_resource: 'transfer',
    provider_transfer_id: transfer?.id || payout.metadata?.provider_transfer_id || null,
    provider_item_status: transfer?.reversed ? 'REVERSED' : transfer ? 'TRANSFERRED' : payout.metadata?.provider_item_status || null,
    provider_batch_status: transfer?.reversed ? 'REVERSED' : transfer ? 'SUCCESS' : payout.metadata?.provider_batch_status || null,
    provider_issue_code: transfer?.reversed ? 'TRANSFER_REVERSED' : null,
    last_synced_at: new Date().toISOString(),
    stripe_transfer: transfer || payout.metadata?.stripe_transfer || null,
    ...updates
  };
}

async function previewStripePayout(input) {
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
  const providerBalance = input.includeProviderBalance
    ? await providerBalanceService.getProviderBalance({
        provider: 'stripe',
        connectedAccountId: input.metadata?.connected_account_id || input.connectedAccountId,
        actorType: input.actorType,
        actorId: input.actorId
      })
    : null;
  const providerAvailableCents = providerBalance ? sumAvailableCurrency(providerBalance, currency) : null;
  const riskNextAction =
    riskResult.decision === RISK_DECISION.APPROVED
      ? 'READY_AFTER_SETUP'
      : riskResult.decision === RISK_DECISION.REVIEW
        ? 'MANUAL_REVIEW'
        : 'BLOCK';

  return {
    provider: 'stripe',
    submission_enabled: Boolean(config.STRIPE_PAYOUTS_ENABLED),
    blocked_reason:
      config.STRIPE_PAYOUTS_ENABLED
        ? null
        : 'Stripe payout submission is disabled until STRIPE_PAYOUTS_ENABLED=true is set after connected-account transfer policy review.',
    payout_mode: config.STRIPE_PAYOUT_MODE,
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
    provider_balance: providerBalance
      ? {
          ...providerBalance,
          available_for_currency_cents: providerAvailableCents,
          available_for_currency: formatMoney(providerAvailableCents),
          sufficient_for_requested_amount: providerAvailableCents >= pricing.requestedAmountCents
        }
      : null,
    risk_decision: riskResult.decision,
    risk_flags: riskResult.flags,
    next_action: config.STRIPE_PAYOUTS_ENABLED && riskNextAction === 'READY_AFTER_SETUP' ? 'PROCESS' : riskNextAction
  };
}

async function requestStripePayout(input) {
  assertStripePayoutsEnabled();

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

  const destinationAccountId = resolveStripeDestinationAccount(input);
  const connectedAccount = await stripeConnectedAccountRepository.findByStripeAccountId(destinationAccountId);
  if (connectedAccount && connectedAccount.status === 'restricted') {
    throw new AppError(409, 'STRIPE_CONNECTED_ACCOUNT_NOT_READY', 'Stripe connected account is restricted.', {
      stripe_account_id: destinationAccountId,
      status: connectedAccount.status,
      disabled_reason: connectedAccount.disabledReason,
      requirements: connectedAccount.requirements
    });
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

  const providerBalance = await providerBalanceService.getProviderBalance({
    provider: 'stripe',
    actorType: input.actorType,
    actorId: input.actorId
  });
  const providerAvailableCents = sumAvailableCurrency(providerBalance, currency);
  if (providerAvailableCents < amountCents) {
    throw new AppError(409, 'STRIPE_INSUFFICIENT_AVAILABLE_BALANCE', 'Stripe available balance is below the requested payout amount.', {
      currency,
      available_cents: providerAvailableCents,
      requested_cents: amountCents
    });
  }

  const riskResult = await riskService.evaluatePayout({
    userId: input.userId,
    receiver: input.receiver,
    receiverCountryCode: input.receiverCountryCode,
    amountCents,
    currencyCode: currency
  });

  const payoutId = randomUUID();
  const senderBatchId = `stripe_payout_${payoutId}`;
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
    recipientType: input.recipientType || 'STRIPE_ACCOUNT',
    receiver: input.receiver,
    receiverCountryCode: input.receiverCountryCode,
    amountCents,
    currencyCode: currency,
    note: input.note,
    metadata: {
      ...(input.metadata || {}),
      provider: 'stripe',
      provider_resource: 'transfer',
      provider_payout_mode: config.STRIPE_PAYOUT_MODE,
      stripe_destination_account_id: destinationAccountId,
      stripe_connected_account_local_id: connectedAccount?.id || null,
      stripe_connected_account_status: connectedAccount?.status || 'unregistered',
      provider_balance_checked_at: new Date().toISOString(),
      provider_available_cents: providerAvailableCents,
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
    actorType: input.actorType || AUDIT_ACTOR_TYPE.USER,
    actorId: input.actorId || input.userId,
    action: 'payout.requested',
    entityType: 'payout',
    entityId: payout.id,
    metadata: {
      provider: 'stripe',
      riskDecision: riskResult.decision,
      feeCents: pricing.feeCents,
      totalDebitCents: pricing.totalDebitCents,
      destinationAccountId
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
  const provider = String(input.provider || 'paypal').trim().toLowerCase();
  if (provider === 'stripe') {
    return previewStripePayout(input);
  }

  throw new AppError(501, 'PROVIDER_PAYOUT_PREVIEW_NOT_IMPLEMENTED', 'Provider payout preview is not implemented yet.', {
    provider,
    supported_providers: ['stripe']
  });
}

async function requestPayout(input) {
  const provider = String(input.provider || '').trim().toLowerCase();
  if (provider === 'stripe') {
    return requestStripePayout(input);
  }

  throw new AppError(501, 'PROVIDER_PAYOUT_SUBMISSION_DISABLED', 'Provider payout submission is not enabled yet.', {
    provider,
    supported_providers: ['stripe']
  });
}

async function approvePayout(payoutId, adminActorId) {
  const payout = await payoutRepository.findById(payoutId);
  if (!payout || !isStripePayout(payout)) {
    throw new AppError(404, 'PAYOUT_NOT_FOUND', 'Stripe payout not found.');
  }

  if (payout.status !== PAYOUT_STATUS.PENDING_APPROVAL) {
    throw new AppError(409, 'PAYOUT_NOT_PENDING_APPROVAL', 'Only pending approval payouts can be approved.');
  }

  const updated = await payoutRepository.update(payout.id, {
    status: PAYOUT_STATUS.QUEUED,
    approvedByActorId: adminActorId,
    approvedAt: new Date().toISOString()
  });

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: adminActorId,
    action: 'payout.approved',
    entityType: 'payout',
    entityId: payout.id,
    metadata: {
      provider: 'stripe'
    }
  });

  return {
    ...payoutTracking(updated),
    nextAction: 'PROCESS'
  };
}

async function rejectPayout(payoutId, adminActorId, reason) {
  const payout = await payoutRepository.findById(payoutId);
  if (!payout || !isStripePayout(payout)) {
    throw new AppError(404, 'PAYOUT_NOT_FOUND', 'Stripe payout not found.');
  }

  if (payout.status !== PAYOUT_STATUS.PENDING_APPROVAL) {
    throw new AppError(409, 'PAYOUT_NOT_PENDING_APPROVAL', 'Only pending approval payouts can be rejected.');
  }

  await ledgerService.refundReservedPayout({
    userId: payout.userId,
    payoutId: payout.id,
    amountCents: reservedAmountCentsForPayout(payout),
    currencyCode: payout.currencyCode,
    reason: reason || 'Rejected Stripe payout released reserved funds back to available balance.'
  });

  const updated = await payoutRepository.update(payout.id, {
    status: PAYOUT_STATUS.REJECTED,
    rejectedAt: new Date().toISOString(),
    failureReason: reason || 'Rejected by admin.'
  });

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: adminActorId,
    action: 'payout.rejected',
    entityType: 'payout',
    entityId: payout.id,
    metadata: {
      provider: 'stripe',
      reason: reason || 'Rejected by admin.'
    }
  });

  return payoutTracking(updated);
}

async function processQueuedPayout(payoutId) {
  let payout = await payoutRepository.findById(payoutId);
  if (!payout || !isStripePayout(payout)) {
    throw new AppError(404, 'PAYOUT_NOT_FOUND', 'Stripe payout not found.');
  }

  if (isTerminalPayoutStatus(payout.status)) {
    return payoutTracking(payout);
  }

  if (payout.status === PAYOUT_STATUS.PENDING_APPROVAL) {
    return payoutTracking(payout);
  }

  if (payout.status === PAYOUT_STATUS.QUEUED) {
    payout = await payoutRepository.update(payout.id, {
      status: PAYOUT_STATUS.PROCESSING,
      metadata: {
        ...(payout.metadata || {}),
        provider_item_status: 'PROCESSING',
        last_synced_at: new Date().toISOString()
      }
    });
  }

  try {
    const transfer =
      payout.metadata?.provider_transfer_id
        ? await stripeClient.retrieveTransfer(payout.metadata.provider_transfer_id)
        : await stripeClient.createTransfer(
            {
              amount: payout.amountCents,
              currency: payout.currencyCode.toLowerCase(),
              destination: payout.metadata.stripe_destination_account_id,
              description: payout.note || `Transferly payout ${payout.id}`,
              transferGroup: payout.senderBatchId,
              metadata: {
                transferly_payout_id: payout.id,
                transferly_user_id: payout.userId,
                sender_batch_id: payout.senderBatchId
              }
            },
            `stripe-transfer:${payout.id}`
          );
    const mappedStatus = normalizeStripeTransferStatus(transfer);
    const updated = await payoutRepository.update(payout.id, {
      status: mappedStatus,
      processedAt: mappedStatus === PAYOUT_STATUS.SUCCESS ? new Date().toISOString() : null,
      failureReason: mappedStatus === PAYOUT_STATUS.FAILED ? 'Stripe transfer was reversed.' : null,
      metadata: stripeTransferMetadata(payout, transfer)
    });

    if (mappedStatus === PAYOUT_STATUS.SUCCESS) {
      await ledgerService.settlePayout({
        userId: payout.userId,
        payoutId: payout.id,
        amountCents: reservedAmountCentsForPayout(payout),
        currencyCode: payout.currencyCode
      });
    }

    await auditLogService.log({
      actorType: AUDIT_ACTOR_TYPE.SYSTEM,
      actorId: null,
      action: 'payout.processed',
      entityType: 'payout',
      entityId: payout.id,
      metadata: {
        provider: 'stripe',
        status: mappedStatus,
        transferId: transfer.id
      }
    });

    return payoutTracking(updated);
  } catch (error) {
    await ledgerService.refundReservedPayout({
      userId: payout.userId,
      payoutId: payout.id,
      amountCents: reservedAmountCentsForPayout(payout),
      currencyCode: payout.currencyCode,
      reason: 'Stripe transfer failed and reserved funds were restored.'
    });

    const failed = await payoutRepository.update(payout.id, {
      status: PAYOUT_STATUS.FAILED,
      failureReason: error.message || 'Stripe transfer failed.',
      processedAt: new Date().toISOString(),
      metadata: {
        ...(payout.metadata || {}),
        provider_item_status: 'FAILED',
        provider_batch_status: 'FAILED',
        provider_issue_code: error.code || 'STRIPE_TRANSFER_FAILED',
        last_synced_at: new Date().toISOString(),
        stripe_error: error.details || { message: error.message }
      }
    });

    await auditLogService.log({
      actorType: AUDIT_ACTOR_TYPE.SYSTEM,
      actorId: null,
      action: 'payout.failed',
      entityType: 'payout',
      entityId: payout.id,
      metadata: {
        provider: 'stripe',
        errorCode: error.code || null,
        errorMessage: error.message
      }
    });

    return payoutTracking(failed);
  }
}

module.exports = {
  providerPayoutService: {
    previewPayout,
    requestPayout,
    approvePayout,
    rejectPayout,
    processQueuedPayout,
    isProviderPendingStatus
  }
};
