const config = require('../config');
const { StripeClient } = require('../adapters/stripeClient');
const { stripeConnectedAccountRepository } = require('../repositories/stripeConnectedAccountRepository');
const { auditLogService } = require('./auditLogService');
const { AppError } = require('../utils/errors');
const { AUDIT_ACTOR_TYPE } = require('../utils/constants');

const stripeClient = new StripeClient({
  secretKey: config.STRIPE_SECRET_KEY,
  apiVersion: config.STRIPE_API_VERSION,
  baseUrl: config.STRIPE_API_BASE_URL
});

function resolveConnectedAccountStatus(account) {
  const currentlyDue = account.requirements?.currently_due || [];
  const pastDue = account.requirements?.past_due || [];

  if (account.payouts_enabled && account.charges_enabled && currentlyDue.length === 0 && pastDue.length === 0) {
    return 'ready';
  }

  if (pastDue.length > 0 || account.requirements?.disabled_reason) {
    return 'restricted';
  }

  if (account.details_submitted) {
    return 'pending_review';
  }

  return 'onboarding_required';
}

function normalizeStripeAccount(account, overrides = {}) {
  return {
    userId: overrides.userId || null,
    stripeAccountId: account.id,
    email: account.email || overrides.email || null,
    countryCode: account.country || overrides.country || null,
    businessType: account.business_type || overrides.businessType || null,
    status: resolveConnectedAccountStatus(account),
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    requirements: account.requirements || {},
    capabilities: account.capabilities || {},
    disabledReason: account.requirements?.disabled_reason || null,
    metadata: {
      ...(overrides.metadata || {}),
      stripe_livemode: Boolean(account.livemode)
    },
    createdByActorId: overrides.adminActorId || null,
    lastSyncedAt: new Date().toISOString()
  };
}

function presentConnectedAccount(account) {
  return {
    id: account.id,
    user_id: account.userId || null,
    stripe_account_id: account.stripeAccountId,
    email: account.email || null,
    country_code: account.countryCode || null,
    business_type: account.businessType || null,
    status: account.status,
    charges_enabled: account.chargesEnabled,
    payouts_enabled: account.payoutsEnabled,
    details_submitted: account.detailsSubmitted,
    requirements: account.requirements || {},
    capabilities: account.capabilities || {},
    disabled_reason: account.disabledReason || null,
    metadata: account.metadata || {},
    last_onboarding_link_created_at: account.lastOnboardingLinkCreatedAt || null,
    last_synced_at: account.lastSyncedAt || null,
    created_at: account.createdAt,
    updated_at: account.updatedAt
  };
}

async function listConnectedAccounts(filters = {}) {
  const accounts = await stripeConnectedAccountRepository.findMany(filters);
  return accounts.map(presentConnectedAccount);
}

async function createConnectedAccount(input) {
  let remoteAccount;

  if (input.stripeAccountId) {
    remoteAccount = await stripeClient.retrieveAccount(input.stripeAccountId);
  } else {
    remoteAccount = await stripeClient.createAccount(
      {
        country: input.country,
        email: input.email,
        businessType: input.businessType,
        controller: {
          fees: {
            payer: 'application'
          },
          losses: {
            payments: 'application'
          },
          requirement_collection: 'stripe',
          stripe_dashboard: {
            type: 'express'
          }
        },
        capabilities: {
          transfers: {
            requested: true
          }
        },
        metadata: {
          ...(input.metadata || {}),
          transferly_user_id: input.userId || ''
        }
      },
      `stripe-account:${input.userId || input.email || 'admin'}:${Date.now()}`
    );
  }

  const account = await stripeConnectedAccountRepository.upsert(
    normalizeStripeAccount(remoteAccount, {
      userId: input.userId,
      email: input.email,
      country: input.country,
      businessType: input.businessType,
      metadata: input.metadata,
      adminActorId: input.adminActorId
    })
  );

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: input.adminActorId,
    action: 'stripe.connected_account.created',
    entityType: 'stripe_connected_account',
    entityId: account.id,
    metadata: {
      stripeAccountId: account.stripeAccountId,
      status: account.status,
      userId: account.userId || null
    }
  });

  return presentConnectedAccount(account);
}

async function refreshConnectedAccount(input) {
  const existing = await stripeConnectedAccountRepository.findById(input.id);
  if (!existing) {
    throw new AppError(404, 'STRIPE_CONNECTED_ACCOUNT_NOT_FOUND', 'Stripe connected account not found.');
  }

  const remoteAccount = await stripeClient.retrieveAccount(existing.stripeAccountId);
  const account = await stripeConnectedAccountRepository.upsert(
    normalizeStripeAccount(remoteAccount, {
      userId: existing.userId,
      metadata: existing.metadata,
      adminActorId: existing.createdByActorId
    })
  );

  await auditLogService.log({
    actorType: input.actorType || AUDIT_ACTOR_TYPE.ADMIN,
    actorId: input.actorId || null,
    action: 'stripe.connected_account.refreshed',
    entityType: 'stripe_connected_account',
    entityId: account.id,
    metadata: {
      stripeAccountId: account.stripeAccountId,
      status: account.status
    }
  });

  return presentConnectedAccount(account);
}

async function createOnboardingLink(input) {
  const existing = await stripeConnectedAccountRepository.findById(input.id);
  if (!existing) {
    throw new AppError(404, 'STRIPE_CONNECTED_ACCOUNT_NOT_FOUND', 'Stripe connected account not found.');
  }

  const returnUrl =
    input.returnUrl ||
    `${config.FRONTEND_URL.replace(/\/$/, '')}/admin?tab=payments&provider=stripe&account=${encodeURIComponent(existing.id)}`;
  const refreshUrl =
    input.refreshUrl ||
    `${config.FRONTEND_URL.replace(/\/$/, '')}/admin?tab=payments&provider=stripe&account=${encodeURIComponent(existing.id)}&refresh=onboarding`;
  const link = await stripeClient.createAccountLink({
    account: existing.stripeAccountId,
    returnUrl,
    refreshUrl,
    collect: input.collect
  });
  const account = await stripeConnectedAccountRepository.markOnboardingLinkCreated(existing.id);

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: input.adminActorId,
    action: 'stripe.connected_account.onboarding_link_created',
    entityType: 'stripe_connected_account',
    entityId: existing.id,
    metadata: {
      stripeAccountId: existing.stripeAccountId,
      expiresAt: link.expires_at || null
    }
  });

  return {
    account: presentConnectedAccount(account),
    onboarding_link: {
      object: link.object || 'account_link',
      created: link.created || null,
      expires_at: link.expires_at || null,
      url: link.url
    }
  };
}

async function syncAccountUpdatedEvent(event) {
  const accountPayload = event.data?.object;
  if (!accountPayload || !accountPayload.id) {
    throw new AppError(400, 'STRIPE_ACCOUNT_EVENT_INVALID', 'Stripe account event is missing account data.');
  }

  const existing = await stripeConnectedAccountRepository.findByStripeAccountId(accountPayload.id);
  const account = await stripeConnectedAccountRepository.upsert(
    normalizeStripeAccount(accountPayload, {
      userId: existing?.userId,
      metadata: existing?.metadata || {},
      adminActorId: existing?.createdByActorId || null
    })
  );

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
    actorId: event.id || null,
    action: 'stripe.connected_account.webhook_synced',
    entityType: 'stripe_connected_account',
    entityId: account.id,
    metadata: {
      stripeAccountId: account.stripeAccountId,
      status: account.status,
      eventType: event.type
    }
  });

  return presentConnectedAccount(account);
}

module.exports = {
  stripeConnectedAccountService: {
    listConnectedAccounts,
    createConnectedAccount,
    refreshConnectedAccount,
    createOnboardingLink,
    syncAccountUpdatedEvent,
    presentConnectedAccount
  }
};
