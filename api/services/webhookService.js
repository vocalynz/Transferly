const config = require('../config');
const { PayPalClient } = require('../adapters/paypalClient');
const { webhookEventRepository } = require('../repositories/webhookEventRepository');
const { auditLogService } = require('./auditLogService');
const { paypalWebhookHandlers } = require('../webhooks/paypalWebhookHandlers');
const { providerInvoiceWebhookHandlers } = require('../webhooks/providerInvoiceWebhookHandlers');
const { AppError } = require('../utils/errors');
const {
  verifyCoinbaseWebhookSignature,
  verifyStripeSignature
} = require('../utils/providerWebhookSignatures');
const { AUDIT_ACTOR_TYPE, WEBHOOK_PROCESSING_STATUS } = require('../utils/constants');

const paypalClient = new PayPalClient(
  config.PAYPAL_CLIENT_ID,
  config.PAYPAL_CLIENT_SECRET,
  config.PAYPAL_ENVIRONMENT
);

async function ingestPayPalEvent(headers, event) {
  const eventId = String(event.id || '');
  if (!eventId) {
    throw new AppError(400, 'INVALID_WEBHOOK_EVENT', 'Webhook event id is required.');
  }

  const existing = await webhookEventRepository.findByEventId(eventId);
  if (existing) {
    return {
      duplicate: true,
      webhookEvent: existing
    };
  }

  const webhookEvent = await webhookEventRepository.create({
    eventId,
    eventType: String(event.event_type || 'unknown'),
    resourceType: typeof event.resource_type === 'string' ? event.resource_type : null,
    transmissionId: headers.transmissionId,
    status: WEBHOOK_PROCESSING_STATUS.RECEIVED,
    payload: event,
    verificationPayload: null
  });

  const verificationPayload = {
    auth_algo: headers.authAlgo,
    cert_url: headers.certUrl,
    transmission_id: headers.transmissionId,
    transmission_sig: headers.transmissionSig,
    transmission_time: headers.transmissionTime,
    webhook_id: config.PAYPAL_WEBHOOK_ID,
    webhook_event: event
  };

  const verification = await paypalClient.verifyWebhookSignature(verificationPayload);
  if (verification.verification_status !== 'SUCCESS') {
    const rejected = await webhookEventRepository.update(webhookEvent.id, {
      status: WEBHOOK_PROCESSING_STATUS.REJECTED,
      verificationPayload,
      lastError: `Verification status: ${verification.verification_status}`
    });

    await auditLogService.log({
      actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
      action: 'webhook.rejected',
      entityType: 'webhook_event',
      entityId: rejected.id,
      metadata: {
        eventId,
        verificationStatus: verification.verification_status
      }
    });

    throw new AppError(400, 'INVALID_WEBHOOK_SIGNATURE', 'PayPal webhook signature verification failed.');
  }

  const verified = await webhookEventRepository.update(webhookEvent.id, {
    status: WEBHOOK_PROCESSING_STATUS.VERIFIED,
    verificationPayload,
    lastError: null
  });

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
    action: 'webhook.received',
    entityType: 'webhook_event',
    entityId: verified.id,
    metadata: {
      eventId
    }
  });

  return {
    duplicate: false,
    webhookEvent: verified
  };
}

async function ingestVerifiedProviderEvent(input) {
  const eventId = `${input.provider}:${String(input.eventId || '')}`;
  if (!input.eventId) {
    throw new AppError(400, 'INVALID_WEBHOOK_EVENT', 'Webhook event id is required.');
  }

  const existing = await webhookEventRepository.findByEventId(eventId);
  if (existing) {
    return {
      duplicate: true,
      webhookEvent: existing
    };
  }

  const webhookEvent = await webhookEventRepository.create({
    eventId,
    eventType: input.eventType || 'unknown',
    resourceType: input.resourceType || null,
    transmissionId: input.transmissionId || null,
    status: WEBHOOK_PROCESSING_STATUS.VERIFIED,
    payload: input.payload,
    verificationPayload: input.verificationPayload || null
  });

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
    action: 'webhook.received',
    entityType: 'webhook_event',
    entityId: webhookEvent.id,
    metadata: {
      provider: input.provider,
      eventId
    }
  });

  return {
    duplicate: false,
    webhookEvent
  };
}

async function ingestStripeEvent(headers, event, rawBody) {
  verifyStripeSignature(rawBody, headers.signature, config.STRIPE_WEBHOOK_SECRET);

  return ingestVerifiedProviderEvent({
    provider: 'stripe',
    eventId: event.id,
    eventType: String(event.type || 'unknown'),
    resourceType: event.data?.object?.object || null,
    transmissionId: headers.signature || null,
    payload: event,
    verificationPayload: {
      signature_header_present: Boolean(headers.signature)
    }
  });
}

async function ingestCryptoEvent(headers, event, rawBody, requestHeaders = {}) {
  verifyCoinbaseWebhookSignature(
    rawBody,
    headers.signature,
    config.CRYPTO_COMMERCE_WEBHOOK_SECRET,
    requestHeaders
  );

  return ingestVerifiedProviderEvent({
    provider: 'crypto',
    eventId: event.id || headers.hookId,
    eventType: String(event.type || event.event_type || 'unknown'),
    resourceType: event.data?.resource || event.resource || 'crypto_charge',
    transmissionId: headers.hookId || null,
    payload: event,
    verificationPayload: {
      signature_header_present: Boolean(headers.signature),
      hook_id: headers.hookId || null
    }
  });
}

async function processWebhookEvent(webhookEventId) {
  const webhookEvent = await webhookEventRepository.findById(webhookEventId);
  if (!webhookEvent) {
    throw new AppError(404, 'WEBHOOK_EVENT_NOT_FOUND', 'Webhook event not found.');
  }

  const nextAttempt = webhookEvent.processingAttempts + 1;
  await webhookEventRepository.update(webhookEvent.id, {
    processingAttempts: nextAttempt
  });

  const event = webhookEvent.payload;

  try {
    switch (webhookEvent.eventType) {
      case 'invoice.finalized':
      case 'invoice.sent':
      case 'invoice.paid':
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed':
      case 'invoice.updated':
      case 'invoice.voided':
        await providerInvoiceWebhookHandlers.handleStripeInvoiceEvent(event);
        break;
      case 'account.updated':
        await providerInvoiceWebhookHandlers.handleStripeAccountEvent(event);
        break;
      case 'charge:created':
      case 'charge:pending':
      case 'charge:confirmed':
      case 'charge:failed':
      case 'charge:delayed':
      case 'charge:resolved':
      case 'checkout.payment.success':
      case 'checkout.payment.failed':
      case 'checkout.payment.expired':
        await providerInvoiceWebhookHandlers.handleCryptoChargeEvent(event);
        break;
      case 'INVOICING.INVOICE.CREATED':
        await paypalWebhookHandlers.handleInvoiceCreated(event);
        break;
      case 'INVOICING.INVOICE.SCHEDULED':
        await paypalWebhookHandlers.handleInvoiceScheduled(event);
        break;
      case 'INVOICING.INVOICE.PAID':
        await paypalWebhookHandlers.handleInvoicePaid(event);
        break;
      case 'INVOICING.INVOICE.CANCELLED':
        await paypalWebhookHandlers.handleInvoiceCancelled(event);
        break;
      case 'INVOICING.INVOICE.REFUNDED':
        await paypalWebhookHandlers.handleInvoiceRefunded(event);
        break;
      case 'INVOICING.INVOICE.UPDATED':
        await paypalWebhookHandlers.handleInvoiceUpdated(event);
        break;
      case 'PAYMENT.PAYOUTSBATCH.PROCESSING':
      case 'PAYMENT.PAYOUTSBATCH.SUCCESS':
      case 'PAYMENT.PAYOUTSBATCH.DENIED':
      case 'PAYMENT.PAYOUTS-ITEM.BLOCKED':
      case 'PAYMENT.PAYOUTS-ITEM.CANCELED':
      case 'PAYMENT.PAYOUTS-ITEM.DENIED':
      case 'PAYMENT.PAYOUTS-ITEM.FAILED':
      case 'PAYMENT.PAYOUTS-ITEM.HELD':
      case 'PAYMENT.PAYOUTS-ITEM.PROCESSING':
      case 'PAYMENT.PAYOUTS-ITEM.REFUNDED':
      case 'PAYMENT.PAYOUTS-ITEM.RETURNED':
      case 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED':
      case 'PAYMENT.PAYOUTS-ITEM.UNCLAIMED':
        await paypalWebhookHandlers.handlePayoutEvent(event);
        break;
      default:
        await webhookEventRepository.update(webhookEvent.id, {
          status: WEBHOOK_PROCESSING_STATUS.IGNORED,
          processedAt: new Date().toISOString(),
          lastError: null
        });
        return {
          status: WEBHOOK_PROCESSING_STATUS.IGNORED
        };
    }
  } catch (error) {
    await webhookEventRepository.update(webhookEvent.id, {
      status: WEBHOOK_PROCESSING_STATUS.FAILED,
      lastError: error.message
    });
    throw error;
  }

  await webhookEventRepository.update(webhookEvent.id, {
    status: WEBHOOK_PROCESSING_STATUS.PROCESSED,
    processedAt: new Date().toISOString(),
    lastError: null
  });

  return {
    status: WEBHOOK_PROCESSING_STATUS.PROCESSED
  };
}

module.exports = {
  webhookService: {
    ingestPayPalEvent,
    ingestStripeEvent,
    ingestCryptoEvent,
    processWebhookEvent
  }
};
