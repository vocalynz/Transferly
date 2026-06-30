const config = require('../config');
const { platformConfigRepository } = require('../repositories/platformConfigRepository');
const { payoutRepository } = require('../repositories/payoutRepository');
const { ensurePositiveMoney } = require('../utils/money');
const { RISK_DECISION } = require('../utils/constants');

const decisionRank = {
  [RISK_DECISION.APPROVED]: 0,
  [RISK_DECISION.REVIEW]: 1,
  [RISK_DECISION.BLOCKED]: 2
};

function maxDecision(current, next) {
  return decisionRank[next] > decisionRank[current] ? next : current;
}

async function evaluateInvoice(input) {
  const haystack = [input.description || '', ...input.items.map((item) => `${item.name} ${item.description || ''}`)]
    .join(' ')
    .toLowerCase();

  const flags = config.SUSPICIOUS_INVOICE_KEYWORDS.flatMap((keyword) => {
    if (!haystack.includes(keyword)) {
      return [];
    }

    return [
      {
        ruleCode: 'SUSPICIOUS_INVOICE_DESCRIPTION',
        severity: 'MEDIUM',
        reason: `Invoice content matched suspicious keyword "${keyword}".`,
        metadata: { keyword }
      }
    ];
  });

  return {
    decision: flags.length ? RISK_DECISION.REVIEW : RISK_DECISION.APPROVED,
    flags
  };
}

async function evaluatePayout(input) {
  const flags = [];
  let decision = RISK_DECISION.APPROVED;
  const amountCents = ensurePositiveMoney(input.amountCents);
  const platformConfig = await platformConfigRepository.get();
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const lastHour = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const lastDay = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  if (amountCents > Math.round(config.MAX_SINGLE_PAYOUT * 100)) {
    flags.push({
      ruleCode: 'MAX_SINGLE_PAYOUT',
      severity: 'CRITICAL',
      reason: `Requested payout exceeds the configured single payout limit of ${config.MAX_SINGLE_PAYOUT}.`,
      metadata: { limit: config.MAX_SINGLE_PAYOUT }
    });
    decision = maxDecision(decision, RISK_DECISION.BLOCKED);
  }

  const dailySumCents = await payoutRepository.sumUserPayoutsSince(input.userId, startOfDay);
  if (dailySumCents + amountCents > Math.round(config.DAILY_PAYOUT_LIMIT * 100)) {
    flags.push({
      ruleCode: 'DAILY_PAYOUT_LIMIT',
      severity: 'HIGH',
      reason: `Requested payout exceeds the configured daily payout limit of ${config.DAILY_PAYOUT_LIMIT}.`,
      metadata: {
        currentDailySum: (dailySumCents / 100).toFixed(2),
        limit: config.DAILY_PAYOUT_LIMIT
      }
    });
    decision = maxDecision(decision, RISK_DECISION.BLOCKED);
  }

  const recentRecipient = await payoutRepository.findSuccessfulRecipientPayout(input.userId, input.receiver);
  if (!recentRecipient) {
    flags.push({
      ruleCode: 'NEW_RECIPIENT_HOLD',
      severity: 'MEDIUM',
      reason: 'Recipient has no successful prior payout history for this user.'
    });
    decision = maxDecision(decision, RISK_DECISION.REVIEW);
  }

  const duplicate = await payoutRepository.findRecentSimilarPayout(
    input.userId,
    input.receiver,
    amountCents,
    input.currencyCode,
    lastDay
  );
  if (duplicate) {
    flags.push({
      ruleCode: 'DUPLICATE_PAYOUT',
      severity: 'HIGH',
      reason: 'A similar payout already exists within the last 24 hours.',
      metadata: { duplicatePayoutId: duplicate.id }
    });
    decision = maxDecision(decision, RISK_DECISION.REVIEW);
  }

  const hourlyCount = await payoutRepository.countUserPayoutsSince(input.userId, lastHour);
  if (hourlyCount >= config.MAX_PAYOUTS_PER_HOUR) {
    flags.push({
      ruleCode: 'PAYOUT_VELOCITY',
      severity: 'HIGH',
      reason: `User exceeded the hourly payout velocity threshold of ${config.MAX_PAYOUTS_PER_HOUR}.`,
      metadata: { hourlyCount, limit: config.MAX_PAYOUTS_PER_HOUR }
    });
    decision = maxDecision(decision, RISK_DECISION.REVIEW);
  }

  if (
    Number(platformConfig.payout_manual_review_cents) > 0 &&
    amountCents >= Number(platformConfig.payout_manual_review_cents)
  ) {
    flags.push({
      ruleCode: 'PAYOUT_MANUAL_REVIEW_THRESHOLD',
      severity: 'HIGH',
      reason: `Requested payout meets the configured manual review threshold of ${(Number(platformConfig.payout_manual_review_cents) / 100).toFixed(2)}.`,
      metadata: {
        thresholdCents: Number(platformConfig.payout_manual_review_cents)
      }
    });
    decision = maxDecision(decision, RISK_DECISION.REVIEW);
  }

  if (input.receiverCountryCode && config.HIGH_RISK_COUNTRIES.includes(input.receiverCountryCode.toUpperCase())) {
    flags.push({
      ruleCode: 'HIGH_RISK_COUNTRY',
      severity: 'HIGH',
      reason: `Receiver country ${input.receiverCountryCode.toUpperCase()} is configured as high risk.`,
      metadata: { receiverCountryCode: input.receiverCountryCode.toUpperCase() }
    });
    decision = maxDecision(decision, RISK_DECISION.REVIEW);
  }

  if (config.HIGH_RISK_CURRENCIES.includes(input.currencyCode.toUpperCase())) {
    flags.push({
      ruleCode: 'HIGH_RISK_CURRENCY',
      severity: 'HIGH',
      reason: `Currency ${input.currencyCode.toUpperCase()} is configured as high risk.`,
      metadata: { currencyCode: input.currencyCode.toUpperCase() }
    });
    decision = maxDecision(decision, RISK_DECISION.REVIEW);
  }

  return {
    decision,
    flags
  };
}

module.exports = {
  riskService: {
    evaluateInvoice,
    evaluatePayout
  }
};
