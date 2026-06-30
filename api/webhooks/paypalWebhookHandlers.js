const { invoiceRepository } = require('../repositories/invoiceRepository');
const { auditLogService } = require('../services/auditLogService');
const { ledgerService } = require('../services/ledgerService');
const { paypalInvoiceService } = require('../services/paypalInvoiceService');
const { paypalPayoutService } = require('../services/paypalPayoutService');
const { INVOICE_STATUS, AUDIT_ACTOR_TYPE } = require('../utils/constants');
const { parseAmount } = require('../utils/money');

function extractInvoiceId(event) {
  return event.resource?.invoice_id || event.resource?.id || event.resource?.invoice?.id || null;
}

function extractRefundAmount(event) {
  return (
    event.resource?.amount?.value ||
    event.resource?.invoice?.amount?.value ||
    event.resource?.amount?.breakdown?.refunded_amount?.value ||
    null
  );
}

function extractPayoutIdentifier(event) {
  return (
    event.resource?.payout_item_id ||
    event.resource?.payout_batch_id ||
    event.resource?.batch_header?.payout_batch_id ||
    event.resource?.sender_batch_header?.sender_batch_id ||
    null
  );
}

async function handleInvoicePaid(event) {
  const paypalInvoiceId = extractInvoiceId(event);
  const invoice = paypalInvoiceId ? await invoiceRepository.findByPaypalInvoiceId(paypalInvoiceId) : null;
  if (!invoice) {
    return;
  }

  await invoiceRepository.update(invoice.id, {
    status: INVOICE_STATUS.PAID,
    paidAt: new Date(event.create_time || Date.now()).toISOString(),
    paypalDetails: event
  });

  await ledgerService.creditPendingFromInvoice({
    userId: invoice.userId,
    invoiceId: invoice.id,
    amountCents: invoice.amountCents,
    currencyCode: invoice.currencyCode,
    eventId: event.id
  });

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
    action: 'invoice.paid',
    entityType: 'invoice',
    entityId: invoice.id,
    metadata: {
      eventId: event.id,
      paypalInvoiceId
    }
  });
}

async function handleInvoiceCancelled(event) {
  const paypalInvoiceId = extractInvoiceId(event);
  const invoice = paypalInvoiceId ? await invoiceRepository.findByPaypalInvoiceId(paypalInvoiceId) : null;
  if (!invoice) {
    return;
  }

  await invoiceRepository.update(invoice.id, {
    status: INVOICE_STATUS.CANCELLED,
    cancelledAt: new Date(event.create_time || Date.now()).toISOString(),
    paypalDetails: event
  });

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
    action: 'invoice.cancelled',
    entityType: 'invoice',
    entityId: invoice.id,
    metadata: {
      eventId: event.id
    }
  });
}

async function handleInvoiceRefunded(event) {
  const paypalInvoiceId = extractInvoiceId(event);
  const invoice = paypalInvoiceId ? await invoiceRepository.findByPaypalInvoiceId(paypalInvoiceId) : null;
  if (!invoice) {
    return;
  }

  await invoiceRepository.update(invoice.id, {
    status: INVOICE_STATUS.REFUNDED,
    refundedAt: new Date(event.create_time || Date.now()).toISOString(),
    paypalDetails: event
  });

  await ledgerService.adjustForInvoiceRefund({
    userId: invoice.userId,
    invoiceId: invoice.id,
    amountCents: extractRefundAmount(event) ? parseAmount(extractRefundAmount(event)) : invoice.amountCents,
    currencyCode: invoice.currencyCode,
    eventId: event.id
  });

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
    action: 'invoice.refunded',
    entityType: 'invoice',
    entityId: invoice.id,
    metadata: {
      eventId: event.id
    }
  });
}

async function handleInvoiceUpdated(event) {
  const paypalInvoiceId = extractInvoiceId(event);
  const invoice = paypalInvoiceId ? await invoiceRepository.findByPaypalInvoiceId(paypalInvoiceId) : null;
  if (!invoice) {
    return;
  }

  await invoiceRepository.update(invoice.id, {
    status: INVOICE_STATUS.UPDATED,
    paypalDetails: event
  });

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
    action: 'invoice.updated',
    entityType: 'invoice',
    entityId: invoice.id,
    metadata: {
      eventId: event.id
    }
  });
}

async function handleInvoiceCreated(event) {
  const paypalInvoiceId = extractInvoiceId(event);
  const invoice = paypalInvoiceId ? await invoiceRepository.findByPaypalInvoiceId(paypalInvoiceId) : null;
  if (!invoice) {
    return;
  }

  await paypalInvoiceService.refreshInvoice({
    invoiceId: invoice.id,
    actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
    actorId: null
  });
}

async function handleInvoiceScheduled(event) {
  const paypalInvoiceId = extractInvoiceId(event);
  const invoice = paypalInvoiceId ? await invoiceRepository.findByPaypalInvoiceId(paypalInvoiceId) : null;
  if (!invoice) {
    return;
  }

  await paypalInvoiceService.refreshInvoice({
    invoiceId: invoice.id,
    actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
    actorId: null
  });
}

async function handlePayoutEvent(event) {
  const payoutIdentifier = extractPayoutIdentifier(event);
  if (!payoutIdentifier) {
    return;
  }

  await paypalPayoutService.refreshPayout({
    payoutId: payoutIdentifier,
    actorType: AUDIT_ACTOR_TYPE.WEBHOOK,
    actorId: null
  });
}

module.exports = {
  paypalWebhookHandlers: {
    handleInvoiceCreated,
    handleInvoicePaid,
    handleInvoiceScheduled,
    handleInvoiceCancelled,
    handleInvoiceRefunded,
    handleInvoiceUpdated,
    handlePayoutEvent
  }
};
