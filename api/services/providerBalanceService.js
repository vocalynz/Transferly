const config = require('../config');
const { StripeClient } = require('../adapters/stripeClient');
const { AppError } = require('../utils/errors');
const { AUDIT_ACTOR_TYPE } = require('../utils/constants');
const { auditLogService } = require('./auditLogService');
const { paymentProviderRegistry } = require('./paymentProviderRegistry');

const stripeClient = new StripeClient({
  secretKey: config.STRIPE_SECRET_KEY,
  apiVersion: config.STRIPE_API_VERSION,
  baseUrl: config.STRIPE_API_BASE_URL
});

function normalizeStripeBalanceEntry(entry) {
  return {
    amount_cents: Number(entry.amount || 0),
    amount: (Number(entry.amount || 0) / 100).toFixed(2),
    currency: String(entry.currency || '').toUpperCase(),
    source_types: entry.source_types || {}
  };
}

function normalizeStripeBalance(balance, stripeAccount) {
  return {
    provider: 'stripe',
    mode: stripeAccount ? 'connected_account' : 'platform',
    connected_account_id: stripeAccount || null,
    livemode: Boolean(balance.livemode),
    available: Array.isArray(balance.available) ? balance.available.map(normalizeStripeBalanceEntry) : [],
    pending: Array.isArray(balance.pending) ? balance.pending.map(normalizeStripeBalanceEntry) : [],
    instant_available: Array.isArray(balance.instant_available)
      ? balance.instant_available.map(normalizeStripeBalanceEntry)
      : [],
    connect_reserved: Array.isArray(balance.connect_reserved)
      ? balance.connect_reserved.map(normalizeStripeBalanceEntry)
      : []
  };
}

async function getProviderBalance(input = {}) {
  const provider = String(input.provider || '').trim().toLowerCase();
  const providerStatus = paymentProviderRegistry.getProviderStatus(provider);

  if (provider !== 'stripe') {
    throw new AppError(501, 'PROVIDER_BALANCE_NOT_IMPLEMENTED', 'Provider balance retrieval is not implemented yet.', {
      provider,
      supported_providers: ['stripe']
    });
  }

  if (providerStatus.status !== 'configured') {
    throw new AppError(503, 'PAYMENT_PROVIDER_NOT_CONFIGURED', 'Payment provider is not configured.', {
      provider,
      missing_env: providerStatus.missing_env
    });
  }

  const stripeAccount = input.connectedAccountId || config.STRIPE_CONNECTED_ACCOUNT_ID || '';
  const balance = normalizeStripeBalance(await stripeClient.retrieveBalance({ stripeAccount }), stripeAccount);

  if (input.actorId) {
    await auditLogService.log({
      actorType: input.actorType || AUDIT_ACTOR_TYPE.ADMIN,
      actorId: input.actorId,
      action: 'provider.balance_retrieved',
      entityType: 'payment_provider',
      entityId: provider,
      metadata: {
        provider,
        mode: balance.mode,
        connectedAccountId: stripeAccount || null,
        availableCurrencies: balance.available.map((entry) => entry.currency),
        pendingCurrencies: balance.pending.map((entry) => entry.currency)
      }
    });
  }

  return balance;
}

module.exports = {
  providerBalanceService: {
    getProviderBalance
  }
};
