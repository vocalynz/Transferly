const config = require('../config');
const { CoinbaseCommerceClient } = require('../adapters/coinbaseCommerceClient');
const { StripeClient } = require('../adapters/stripeClient');
const { presentInvoice } = require('../presenters/paymentPresenter');
const { invoiceRepository } = require('../repositories/invoiceRepository');
const { riskFlagRepository } = require('../repositories/riskFlagRepository');
const { userRepository } = require('../repositories/userRepository');
const { auditLogService } = require('./auditLogService');
const { invoiceTemplateService } = require('./invoiceTemplateService');
const { ledgerService } = require('./ledgerService');
const { paymentOpsIssueService } = require('./paymentOpsIssueService');
const { paypalInvoiceService } = require('./paypalInvoiceService');
const { riskService } = require('./riskService');
const { paymentProviderRegistry } = require('./paymentProviderRegistry');
const { AppError } = require('../utils/errors');
const { ensurePositiveMoney, formatMoney, sumInvoiceItems } = require('../utils/money');
const { AUDIT_ACTOR_TYPE, INVOICE_STATUS } = require('../utils/constants');

const stripeClient = new StripeClient({
  secretKey: config.STRIPE_SECRET_KEY,
  apiVersion: config.STRIPE_API_VERSION,
  baseUrl: config.STRIPE_API_BASE_URL
});

const cryptoCommerceClient = new CoinbaseCommerceClient({
  apiKey: config.CRYPTO_COMMERCE_API_KEY,
  baseUrl: config.CRYPTO_COMMERCE_API_BASE_URL
});

function normalizeProvider(provider) {
  return String(provider || 'paypal').trim().toLowerCase();
}

function getInvoiceProvider(invoice) {
  return normalizeProvider(invoice?.metadata?.provider || 'paypal');
}

function normalizeInvoiceDate(value) {
  if (!value) {
    return null;
  }

  return String(value).slice(0, 10);
}

function getDaysUntilDue(dueDate) {
  if (!dueDate) {
    return 30;
  }

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) {
    return 30;
  }

  const diffMs = due.getTime() - Date.now();
  return Math.max(1, Math.ceil(diffMs / 86400000));
}

function formatAmountForProvider(cents) {
  return formatMoney(cents);
}

function getLatestCryptoStatus(charge) {
  const timeline = Array.isArray(charge?.timeline) ? charge.timeline : [];
  return String(timeline.length ? timeline[timeline.length - 1].status : charge?.status || 'NEW').toUpperCase();
}

function normalizeStripeInvoiceStatus(status) {
  switch (String(status || '').toLowerCase()) {
    case 'paid':
      return INVOICE_STATUS.PAID;
    case 'void':
    case 'voided':
      return INVOICE_STATUS.CANCELLED;
    case 'draft':
      return INVOICE_STATUS.DRAFT;
    case 'open':
    case 'sent':
      return INVOICE_STATUS.SENT;
    case 'uncollectible':
      return INVOICE_STATUS.FAILED;
    default:
      return INVOICE_STATUS.UPDATED;
  }
}

function normalizeCryptoChargeStatus(status) {
  switch (String(status || '').toUpperCase()) {
    case 'CONFIRMED':
    case 'COMPLETED':
    case 'RESOLVED':
      return INVOICE_STATUS.PAID;
    case 'FAILED':
    case 'EXPIRED':
      return INVOICE_STATUS.FAILED;
    case 'PENDING':
    case 'SIGNED':
    case 'DELAYED':
      return INVOICE_STATUS.UPDATED;
    case 'NEW':
    default:
      return INVOICE_STATUS.SENT;
  }
}

function getStripePaidAt(remoteInvoice, fallback) {
  if (remoteInvoice?.status_transitions?.paid_at) {
    return new Date(remoteInvoice.status_transitions.paid_at * 1000).toISOString();
  }

  return fallback;
}

function mergeInvoiceMetadata(invoice, updates) {
  return {
    ...(invoice.metadata || {}),
    ...updates
  };
}

function getProviderReadinessOrThrow(provider) {
  const status = paymentProviderRegistry.getProviderStatus(provider);
  if (status.status !== 'configured') {
    throw new AppError(503, 'PAYMENT_PROVIDER_NOT_CONFIGURED', `${status.display_name} is not configured.`, {
      provider,
      missing_env: status.missing_env
    });
  }

  return status;
}

function assertInvoiceProviderSupported(provider) {
  const invoiceFeatures = paymentProviderRegistry.getProviderInvoiceFeatures(provider).invoice_features;
  if (!invoiceFeatures.supported) {
    throw new AppError(422, 'PAYMENT_PROVIDER_INVOICES_UNSUPPORTED', 'This provider does not support invoice collection.', {
      provider,
      reason: invoiceFeatures.reason || null
    });
  }

  if (!['paypal', 'stripe', 'crypto'].includes(provider)) {
    throw new AppError(501, 'PAYMENT_PROVIDER_INVOICE_NOT_IMPLEMENTED', 'Invoice creation is not implemented for this provider yet.', {
      provider
    });
  }
}

async function resolveInvoiceContext(input) {
  const { resolvedInput, template } = await invoiceTemplateService.resolveInvoiceInput(input);
  const user = await userRepository.findById(input.userId);
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', `User ${input.userId} not found.`);
  }

  const invoiceRisk = await riskService.evaluateInvoice({
    description: resolvedInput.description,
    items: resolvedInput.items.map((item) => ({
      name: item.name,
      description: item.description
    }))
  });

  const amountCents = ensurePositiveMoney(sumInvoiceItems(resolvedInput.items));
  const currency = resolvedInput.currency.toUpperCase();
  const invoiceDate = normalizeInvoiceDate(resolvedInput.issueDate) || new Date().toISOString().slice(0, 10);

  return {
    resolvedInput,
    template,
    user,
    invoiceRisk,
    amountCents,
    currency,
    invoiceDate
  };
}

async function createStripeInvoice(input, context) {
  const invoiceNumber = `STRIPE-INV-${Date.now()}`;
  const metadata = {
    provider: 'stripe',
    transferly_user_id: context.user.id,
    transferly_invoice_number: invoiceNumber,
    request_id: input.requestId || ''
  };
  const requestScope = input.requestId || invoiceNumber;
  const customer = await stripeClient.request({
    method: 'POST',
    path: '/v1/customers',
    idempotencyKey: `${requestScope}:stripe:customer`,
    body: {
      email: context.resolvedInput.recipientEmail.toLowerCase(),
      description: context.resolvedInput.description || invoiceNumber,
      metadata
    }
  });

  for (const [index, item] of context.resolvedInput.items.entries()) {
    await stripeClient.request({
      method: 'POST',
      path: '/v1/invoiceitems',
      idempotencyKey: `${requestScope}:stripe:item:${index}`,
      body: {
        customer: customer.id,
        amount: Math.round(Number(item.quantity) * Number(item.unitAmount) * 100),
        currency: context.currency.toLowerCase(),
        description: item.description ? `${item.name} - ${item.description}` : item.name,
        metadata: {
          ...metadata,
          item_name: item.name
        }
      }
    });
  }

  const draftInvoice = await stripeClient.request({
    method: 'POST',
    path: '/v1/invoices',
    idempotencyKey: `${requestScope}:stripe:invoice`,
    body: {
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: getDaysUntilDue(context.resolvedInput.dueDate),
      description: context.resolvedInput.description || invoiceNumber,
      metadata
    }
  });

  const finalizedInvoice = await stripeClient.request({
    method: 'POST',
    path: `/v1/invoices/${encodeURIComponent(draftInvoice.id)}/finalize`,
    idempotencyKey: `${requestScope}:stripe:finalize`
  });

  const sentInvoice = await stripeClient.request({
    method: 'POST',
    path: `/v1/invoices/${encodeURIComponent(finalizedInvoice.id)}/send`,
    idempotencyKey: `${requestScope}:stripe:send`
  });

  const invoiceUrl = sentInvoice.hosted_invoice_url || finalizedInvoice.hosted_invoice_url;
  if (!invoiceUrl) {
    throw new AppError(502, 'STRIPE_INVOICE_LINK_MISSING', 'Stripe invoice did not return a hosted invoice URL.');
  }

  return {
    providerInvoiceId: sentInvoice.id || finalizedInvoice.id,
    invoiceNumber: sentInvoice.number || finalizedInvoice.number || invoiceNumber,
    status: sentInvoice.status === 'paid' ? INVOICE_STATUS.PAID : INVOICE_STATUS.SENT,
    invoiceUrl,
    remoteDetails: {
      provider: 'stripe',
      customer,
      invoice: sentInvoice,
      finalized_invoice: finalizedInvoice
    },
    providerMetadata: {
      provider: 'stripe',
      provider_resource: 'invoice',
      provider_invoice_id: sentInvoice.id || finalizedInvoice.id,
      hosted_invoice_url: invoiceUrl,
      invoice_pdf: sentInvoice.invoice_pdf || finalizedInvoice.invoice_pdf || null,
      provider_status: sentInvoice.status || finalizedInvoice.status || null
    }
  };
}

async function createCryptoCharge(input, context) {
  const invoiceNumber = `CRYPTO-INV-${Date.now()}`;
  const charge = await cryptoCommerceClient.request({
    method: 'POST',
    path: '/charges',
    body: {
      name: invoiceNumber,
      description: context.resolvedInput.description || `Transferly invoice ${invoiceNumber}`,
      pricing_type: 'fixed_price',
      local_price: {
        amount: formatAmountForProvider(context.amountCents),
        currency: context.currency
      },
      metadata: {
        provider: 'crypto',
        transferly_user_id: context.user.id,
        transferly_invoice_number: invoiceNumber,
        request_id: input.requestId || ''
      }
    }
  });

  if (!charge.hosted_url) {
    throw new AppError(502, 'CRYPTO_CHARGE_LINK_MISSING', 'Crypto Commerce charge did not return a hosted URL.');
  }

  return {
    providerInvoiceId: charge.id || charge.code,
    invoiceNumber,
    status: INVOICE_STATUS.SENT,
    invoiceUrl: charge.hosted_url,
    remoteDetails: {
      provider: 'crypto',
      charge
    },
    providerMetadata: {
      provider: 'crypto',
      provider_resource: 'crypto_charge',
      provider_invoice_id: charge.id || charge.code,
      charge_code: charge.code || null,
      hosted_url: charge.hosted_url,
      provider_status: Array.isArray(charge.timeline) && charge.timeline[0] ? charge.timeline[0].status : 'NEW',
      settlement_review_required: true,
      settlement_safeguards: [
        'confirmation_depth_policy',
        'underpayment_detection',
        'overpayment_review',
        'network_mismatch_review'
      ]
    }
  };
}

async function persistProviderInvoice(input, context, providerResult) {
  const invoice = await invoiceRepository.create({
    userId: context.user.id,
    templateId: context.template ? context.template.id : null,
    paypalInvoiceId: providerResult.providerInvoiceId,
    invoiceNumber: providerResult.invoiceNumber,
    status: providerResult.status,
    amountCents: context.amountCents,
    currencyCode: context.currency,
    recipientEmail: context.resolvedInput.recipientEmail.toLowerCase(),
    description: context.resolvedInput.description,
    invoiceUrl: providerResult.invoiceUrl,
    paypalDetails: providerResult.remoteDetails,
    paypalQrDetails: null,
    paypalSyncedAt: new Date().toISOString(),
    metadata: {
      ...(context.resolvedInput.metadata || {}),
      ...providerResult.providerMetadata,
      invoice_template: context.template ? { id: context.template.id, name: context.template.name } : null
    },
    issueDate: context.invoiceDate,
    dueDate: context.resolvedInput.dueDate || null
  });

  await riskFlagRepository.createMany(
    context.invoiceRisk.flags.map((flag) => ({
      userId: context.user.id,
      invoiceId: invoice.id,
      ruleCode: flag.ruleCode,
      severity: flag.severity,
      reason: flag.reason,
      metadata: flag.metadata || {}
    }))
  );

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.SYSTEM,
    action: 'invoice.created',
    entityType: 'invoice',
    entityId: invoice.id,
    metadata: {
      provider: providerResult.providerMetadata.provider,
      providerInvoiceId: providerResult.providerInvoiceId,
      invoiceUrl: providerResult.invoiceUrl,
      riskDecision: context.invoiceRisk.decision,
      templateId: context.template ? context.template.id : null,
      requestId: input.requestId || null
    }
  });

  return presentInvoice(invoice);
}

async function creditPaidInvoiceOnce(invoice, eventId) {
  await ledgerService.creditPendingFromInvoice({
    userId: invoice.userId,
    invoiceId: invoice.id,
    amountCents: invoice.amountCents,
    currencyCode: invoice.currencyCode,
    eventId
  });
}

function getStripeInvoiceSettlementKey(invoice) {
  return `stripe:invoice:${invoice.paypalInvoiceId}:paid`;
}

function getCryptoChargeSettlementKey(invoice) {
  return `crypto:charge:${invoice.paypalInvoiceId}:paid`;
}

async function syncStripeInvoice(invoice, remoteInvoice, options = {}) {
  const now = new Date().toISOString();
  const nextStatus = normalizeStripeInvoiceStatus(remoteInvoice.status);
  const syncedInvoice = await invoiceRepository.update(invoice.id, {
    status: nextStatus,
    invoiceUrl: remoteInvoice.hosted_invoice_url || invoice.invoiceUrl,
    paypalDetails: {
      provider: 'stripe',
      invoice: remoteInvoice
    },
    paypalSyncedAt: now,
    paidAt: nextStatus === INVOICE_STATUS.PAID ? invoice.paidAt || getStripePaidAt(remoteInvoice, now) : invoice.paidAt,
    cancelledAt: nextStatus === INVOICE_STATUS.CANCELLED ? invoice.cancelledAt || now : invoice.cancelledAt,
    metadata: mergeInvoiceMetadata(invoice, {
      provider: 'stripe',
      provider_resource: 'invoice',
      provider_invoice_id: remoteInvoice.id || invoice.paypalInvoiceId,
      hosted_invoice_url: remoteInvoice.hosted_invoice_url || invoice.invoiceUrl,
      invoice_pdf: remoteInvoice.invoice_pdf || invoice.metadata?.invoice_pdf || null,
      provider_status: remoteInvoice.status || null,
      last_provider_event_id: options.eventId || invoice.metadata?.last_provider_event_id || null
    })
  });

  if (nextStatus === INVOICE_STATUS.PAID) {
    await creditPaidInvoiceOnce(syncedInvoice, getStripeInvoiceSettlementKey(syncedInvoice));
  }

  await paymentOpsIssueService.syncInvoiceIssues(syncedInvoice);
  return syncedInvoice;
}

async function syncCryptoCharge(invoice, charge, options = {}) {
  const now = new Date().toISOString();
  const providerStatus = getLatestCryptoStatus(charge);
  const nextStatus = normalizeCryptoChargeStatus(providerStatus);
  const syncedInvoice = await invoiceRepository.update(invoice.id, {
    status: nextStatus,
    invoiceUrl: charge.hosted_url || invoice.invoiceUrl,
    paypalDetails: {
      provider: 'crypto',
      charge
    },
    paypalSyncedAt: now,
    paidAt: nextStatus === INVOICE_STATUS.PAID ? invoice.paidAt || now : invoice.paidAt,
    metadata: mergeInvoiceMetadata(invoice, {
      provider: 'crypto',
      provider_resource: 'crypto_charge',
      provider_invoice_id: charge.id || charge.code || invoice.paypalInvoiceId,
      charge_code: charge.code || invoice.metadata?.charge_code || null,
      hosted_url: charge.hosted_url || invoice.invoiceUrl,
      provider_status: providerStatus,
      settlement_review_required: nextStatus === INVOICE_STATUS.PAID,
      settlement_safeguards: invoice.metadata?.settlement_safeguards || [
        'confirmation_depth_policy',
        'underpayment_detection',
        'overpayment_review',
        'network_mismatch_review'
      ],
      last_provider_event_id: options.eventId || invoice.metadata?.last_provider_event_id || null
    })
  });

  if (nextStatus === INVOICE_STATUS.PAID) {
    await creditPaidInvoiceOnce(syncedInvoice, getCryptoChargeSettlementKey(syncedInvoice));
  }

  await paymentOpsIssueService.syncInvoiceIssues(syncedInvoice);
  return syncedInvoice;
}

async function refreshInvoice(input) {
  const invoice = await invoiceRepository.findByIdentifier(input.invoiceId);
  if (!invoice) {
    throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found.');
  }

  const provider = getInvoiceProvider(invoice);
  if (provider === 'paypal') {
    return paypalInvoiceService.refreshInvoice(input);
  }

  getProviderReadinessOrThrow(provider);
  const syncedInvoice =
    provider === 'stripe'
      ? await syncStripeInvoice(invoice, await stripeClient.retrieveInvoice(invoice.paypalInvoiceId), {
          eventId: `stripe:refresh:${invoice.paypalInvoiceId}`
        })
      : await syncCryptoCharge(invoice, await cryptoCommerceClient.retrieveCharge(invoice.metadata?.charge_code || invoice.paypalInvoiceId), {
          eventId: `crypto:refresh:${invoice.paypalInvoiceId}`
        });

  await auditLogService.log({
    actorType: input.actorType || AUDIT_ACTOR_TYPE.SYSTEM,
    actorId: input.actorId || null,
    action: 'invoice.refreshed',
    entityType: 'invoice',
    entityId: invoice.id,
    metadata: {
      provider,
      providerInvoiceId: invoice.paypalInvoiceId,
      providerStatus: syncedInvoice.metadata?.provider_status || null
    }
  });

  return presentInvoice(syncedInvoice);
}

async function cancelInvoice(input) {
  const invoice = await invoiceRepository.findByIdentifier(input.invoiceId);
  if (!invoice) {
    throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found.');
  }

  const provider = getInvoiceProvider(invoice);
  if (provider === 'paypal') {
    return paypalInvoiceService.cancelInvoice(input);
  }

  if (provider === 'crypto') {
    throw new AppError(409, 'CRYPTO_CHARGE_CANCEL_UNSUPPORTED', 'Crypto Commerce charges cannot be cancelled after creation.');
  }

  getProviderReadinessOrThrow(provider);
  const remoteInvoice = await stripeClient.voidInvoice(
    invoice.paypalInvoiceId,
    input.requestId ? `${input.requestId}:stripe:void` : `${invoice.paypalInvoiceId}:stripe:void`
  );
  const syncedInvoice = await syncStripeInvoice(invoice, remoteInvoice, {
    eventId: `stripe:void:${invoice.paypalInvoiceId}`
  });

  await auditLogService.log({
    actorType: input.actorType || AUDIT_ACTOR_TYPE.ADMIN,
    actorId: input.actorId || null,
    action: 'invoice.cancelled',
    entityType: 'invoice',
    entityId: invoice.id,
    metadata: {
      provider,
      providerInvoiceId: invoice.paypalInvoiceId
    }
  });

  return presentInvoice(syncedInvoice);
}

async function markInvoiceReviewRequired(input) {
  const invoice = await invoiceRepository.findByIdentifier(input.invoiceId);
  if (!invoice) {
    throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found.');
  }

  const syncedInvoice = await invoiceRepository.update(invoice.id, {
    metadata: mergeInvoiceMetadata(invoice, {
      settlement_review_required: true,
      settlement_review_reason: input.reason || 'Manual provider settlement review requested.',
      settlement_review_requested_at: new Date().toISOString()
    })
  });

  await auditLogService.log({
    actorType: input.actorType || AUDIT_ACTOR_TYPE.ADMIN,
    actorId: input.actorId || null,
    action: 'invoice.review_required',
    entityType: 'invoice',
    entityId: invoice.id,
    metadata: {
      provider: getInvoiceProvider(invoice),
      reason: input.reason || null
    }
  });

  return presentInvoice(syncedInvoice);
}

async function processProviderInvoiceEvent(input) {
  const provider = normalizeProvider(input.provider);
  const event = input.event || {};
  const resource = provider === 'stripe' ? event.data?.object : event.data || event.resource || event;
  const providerInvoiceId =
    provider === 'stripe'
      ? resource?.id
      : resource?.id || resource?.code || resource?.charge?.id || resource?.charge?.code;

  if (!providerInvoiceId) {
    return { status: 'ignored', reason: 'missing_provider_invoice_id' };
  }

  const invoice = await invoiceRepository.findByPaypalInvoiceId(providerInvoiceId);
  if (!invoice) {
    return { status: 'ignored', reason: 'invoice_not_found' };
  }

  const eventId = `${provider}:${event.id || input.eventId || providerInvoiceId}`;
  const syncedInvoice =
    provider === 'stripe'
      ? await syncStripeInvoice(invoice, resource, { eventId })
      : await syncCryptoCharge(invoice, resource, { eventId });

  const action = syncedInvoice.status === INVOICE_STATUS.PAID ? 'invoice.paid' : 'invoice.updated';
  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
    action,
    entityType: 'invoice',
    entityId: invoice.id,
    metadata: {
      provider,
      eventId,
      eventType: event.type || input.eventType || null,
      providerStatus: syncedInvoice.metadata?.provider_status || null
    }
  });

  return {
    status: 'processed',
    invoice: presentInvoice(syncedInvoice)
  };
}

async function createAndSendInvoice(input) {
  const provider = normalizeProvider(input.provider);
  if (provider === 'paypal') {
    return paypalInvoiceService.createAndSendInvoice(input);
  }

  assertInvoiceProviderSupported(provider);
  getProviderReadinessOrThrow(provider);

  const context = await resolveInvoiceContext(input);
  const providerResult =
    provider === 'stripe'
      ? await createStripeInvoice(input, context)
      : await createCryptoCharge(input, context);

  return persistProviderInvoice(input, context, providerResult);
}

async function previewInvoice(input) {
  const provider = normalizeProvider(input.provider);
  if (provider === 'paypal') {
    return paypalInvoiceService.previewInvoice(input);
  }

  assertInvoiceProviderSupported(provider);
  const readiness = paymentProviderRegistry.getProviderStatus(provider);
  const context = await resolveInvoiceContext(input);
  return {
    recipient_email: context.resolvedInput.recipientEmail.toLowerCase(),
    provider,
    provider_status: readiness.status,
    missing_env: readiness.missing_env,
    template: context.template
      ? {
          id: context.template.id,
          name: context.template.name
        }
      : null,
    currency: context.currency,
    subtotal: formatMoney(context.amountCents),
    total: formatMoney(context.amountCents),
    amount_cents: context.amountCents,
    issue_date: context.invoiceDate,
    due_date: context.resolvedInput.dueDate || null,
    line_items: context.resolvedInput.items.map((item) => ({
      name: item.name,
      description: item.description || null,
      quantity: Number(item.quantity),
      unit_amount: formatMoney(Math.round(Number(item.unitAmount) * 100)),
      subtotal: formatMoney(Math.round(Number(item.quantity) * Number(item.unitAmount) * 100))
    })),
    risk_decision: context.invoiceRisk.decision,
    risk_flags: context.invoiceRisk.flags,
    hosted_link_will_be_created: true,
    settlement_review_required: provider === 'crypto'
  };
}

module.exports = {
  providerInvoiceService: {
    createAndSendInvoice,
    previewInvoice,
    refreshInvoice,
    cancelInvoice,
    markInvoiceReviewRequired,
    processProviderInvoiceEvent
  }
};
