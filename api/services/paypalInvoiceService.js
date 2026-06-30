const config = require('../config');
const { PayPalClient } = require('../adapters/paypalClient');
const { presentInvoice } = require('../presenters/paymentPresenter');
const { invoiceRepository } = require('../repositories/invoiceRepository');
const { riskFlagRepository } = require('../repositories/riskFlagRepository');
const { userRepository } = require('../repositories/userRepository');
const { auditLogService } = require('./auditLogService');
const { invoiceTemplateService } = require('./invoiceTemplateService');
const { ledgerService } = require('./ledgerService');
const { paymentOpsIssueService } = require('./paymentOpsIssueService');
const { riskService } = require('./riskService');
const { AppError } = require('../utils/errors');
const { ensurePositiveMoney, formatMoney, parseAmount, sumInvoiceItems } = require('../utils/money');
const { INVOICE_STATUS, AUDIT_ACTOR_TYPE } = require('../utils/constants');

const paypalClient = new PayPalClient(
  config.PAYPAL_CLIENT_ID,
  config.PAYPAL_CLIENT_SECRET,
  config.PAYPAL_ENVIRONMENT
);

function normalizeInvoiceStatus(status) {
  switch (String(status || '').toUpperCase()) {
    case 'PAID':
      return INVOICE_STATUS.PAID;
    case 'CANCELLED':
    case 'CANCELED':
      return INVOICE_STATUS.CANCELLED;
    case 'REFUNDED':
      return INVOICE_STATUS.REFUNDED;
    case 'SCHEDULED':
      return INVOICE_STATUS.SCHEDULED;
    case 'DRAFT':
      return INVOICE_STATUS.DRAFT;
    case 'MARKED_AS_PAID':
    case 'PARTIALLY_PAID':
    case 'SENT':
      return INVOICE_STATUS.SENT;
    case 'UPDATED':
    case 'PARTIALLY_REFUNDED':
    case 'PAYMENT_PENDING':
      return INVOICE_STATUS.UPDATED;
    default:
      return INVOICE_STATUS.FAILED;
  }
}

function extractInvoiceUrl(remoteInvoice) {
  return remoteInvoice && remoteInvoice.detail && remoteInvoice.detail.metadata
    ? remoteInvoice.detail.metadata.recipient_view_url || null
    : null;
}

function normalizeInvoiceDate(value) {
  if (!value) {
    return null;
  }

  return String(value).slice(0, 10);
}

function deriveInvoiceTransitionFields(invoice, remoteInvoice) {
  const nextStatus = normalizeInvoiceStatus(remoteInvoice.status);
  const remoteTimestamp = new Date().toISOString();

  return {
    status: nextStatus,
    issueDate: normalizeInvoiceDate(remoteInvoice?.detail?.invoice_date) || invoice.issueDate,
    dueDate: remoteInvoice?.detail?.payment_term?.due_date || invoice.dueDate,
    paidAt: nextStatus === INVOICE_STATUS.PAID ? invoice.paidAt || remoteTimestamp : invoice.paidAt,
    cancelledAt:
      nextStatus === INVOICE_STATUS.CANCELLED ? invoice.cancelledAt || remoteTimestamp : invoice.cancelledAt,
    refundedAt:
      nextStatus === INVOICE_STATUS.REFUNDED ? invoice.refundedAt || remoteTimestamp : invoice.refundedAt
  };
}

async function loadInvoiceOrThrow(invoiceId) {
  const invoice = await invoiceRepository.findByIdentifier(invoiceId);
  if (!invoice) {
    throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found.');
  }

  return invoice;
}

async function syncRemoteInvoice(invoice, remoteInvoice) {
  const transitionFields = deriveInvoiceTransitionFields(invoice, remoteInvoice);

  const syncedInvoice = await invoiceRepository.update(invoice.id, {
    status: transitionFields.status,
    invoiceUrl: extractInvoiceUrl(remoteInvoice) || invoice.invoiceUrl,
    paypalDetails: remoteInvoice,
    paypalSyncedAt: new Date().toISOString(),
    issueDate: transitionFields.issueDate,
    dueDate: transitionFields.dueDate,
    paidAt: transitionFields.paidAt,
    cancelledAt: transitionFields.cancelledAt,
    refundedAt: transitionFields.refundedAt
  });

  await paymentOpsIssueService.syncInvoiceIssues(syncedInvoice);
  return syncedInvoice;
}

async function createAndSendInvoice(input) {
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
  const invoiceNumber = `INV-${Date.now()}`;
  const invoiceDate = normalizeInvoiceDate(resolvedInput.issueDate) || new Date().toISOString().slice(0, 10);
  const createRequestId = input.requestId ? `${input.requestId}:invoice:create` : invoiceNumber;

  const draftInvoice = await paypalClient.request({
    method: 'POST',
    path: '/v2/invoicing/invoices',
    requestId: createRequestId,
    body: {
      detail: {
        currency_code: currency,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        note: resolvedInput.description,
        memo: resolvedInput.description,
        payment_term: resolvedInput.dueDate
          ? {
              due_date: resolvedInput.dueDate.slice(0, 10)
            }
          : undefined
      },
      primary_recipients: [
        {
          billing_info: {
            email_address: resolvedInput.recipientEmail
          }
        }
      ],
      items: resolvedInput.items.map((item) => ({
        name: item.name,
        description: item.description,
        quantity: String(item.quantity),
        unit_amount: {
          currency_code: currency,
          value: Number(item.unitAmount).toFixed(2)
        }
      }))
    }
  });

  await paypalClient.request({
    method: 'POST',
    path: `/v2/invoicing/invoices/${draftInvoice.id}/send`,
    requestId: `${draftInvoice.id}:send`,
    body: {
      send_to_recipient: true,
      send_to_invoicer: true
    }
  });

  const remoteInvoice = await paypalClient.request({
    method: 'GET',
    path: `/v2/invoicing/invoices/${draftInvoice.id}`
  });

  const invoiceUrl = extractInvoiceUrl(remoteInvoice);
  if (!invoiceUrl) {
    throw new AppError(502, 'PAYPAL_INVOICE_LINK_MISSING', 'PayPal invoice did not return a recipient payment link.');
  }

  const invoice = await invoiceRepository.create({
    userId: user.id,
    templateId: template ? template.id : null,
    paypalInvoiceId: remoteInvoice.id,
    invoiceNumber: (remoteInvoice.detail && remoteInvoice.detail.invoice_number) || invoiceNumber,
    status: normalizeInvoiceStatus(remoteInvoice.status),
    amountCents,
    currencyCode: currency,
    recipientEmail: resolvedInput.recipientEmail.toLowerCase(),
    description: resolvedInput.description,
    invoiceUrl,
    paypalDetails: remoteInvoice,
    paypalQrDetails: null,
    paypalSyncedAt: new Date().toISOString(),
    metadata: resolvedInput.metadata || {},
    issueDate: invoiceDate,
    dueDate: resolvedInput.dueDate || null
  });

  await riskFlagRepository.createMany(
    invoiceRisk.flags.map((flag) => ({
      userId: user.id,
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
      paypalInvoiceId: invoice.paypalInvoiceId,
      invoiceUrl,
      riskDecision: invoiceRisk.decision,
      templateId: template ? template.id : null
    }
  });

  return presentInvoice(invoice);
}

async function previewInvoice(input) {
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

  return {
    recipient_email: resolvedInput.recipientEmail.toLowerCase(),
    template: template
      ? {
          id: template.id,
          name: template.name
        }
      : null,
    currency,
    subtotal: formatMoney(amountCents),
    total: formatMoney(amountCents),
    amount_cents: amountCents,
    issue_date: normalizeInvoiceDate(resolvedInput.issueDate) || new Date().toISOString().slice(0, 10),
    due_date: resolvedInput.dueDate || null,
    line_items: resolvedInput.items.map((item) => ({
      name: item.name,
      description: item.description || null,
      quantity: Number(item.quantity),
      unit_amount: formatMoney(Math.round(Number(item.unitAmount) * 100)),
      subtotal: formatMoney(Math.round(Number(item.quantity) * Number(item.unitAmount) * 100))
    })),
    risk_decision: invoiceRisk.decision,
    risk_flags: invoiceRisk.flags,
    hosted_link_will_be_created: true
  };
}

async function refreshInvoice(input) {
  const invoice = await loadInvoiceOrThrow(input.invoiceId);
  const remoteInvoice = await paypalClient.request({
    method: 'GET',
    path: `/v2/invoicing/invoices/${invoice.paypalInvoiceId}`
  });

  const syncedInvoice = await syncRemoteInvoice(invoice, remoteInvoice);

  await auditLogService.log({
    actorType: input.actorType,
    actorId: input.actorId || null,
    action: 'invoice.refreshed',
    entityType: 'invoice',
    entityId: invoice.id,
    metadata: {
      paypalInvoiceId: invoice.paypalInvoiceId,
      remoteStatus: remoteInvoice.status || null
    }
  });

  return presentInvoice(syncedInvoice);
}

async function sendInvoiceReminder(input) {
  const invoice = await loadInvoiceOrThrow(input.invoiceId);
  if (![INVOICE_STATUS.SENT, INVOICE_STATUS.UPDATED].includes(invoice.status)) {
    throw new AppError(
      409,
      'INVOICE_NOT_REMINDABLE',
      'Only sent or updated invoices can receive a PayPal reminder.'
    );
  }

  await paypalClient.request({
    method: 'POST',
    path: `/v2/invoicing/invoices/${invoice.paypalInvoiceId}/remind`,
    requestId: `${invoice.paypalInvoiceId}:remind`,
    body: {
      subject: `Reminder for invoice ${invoice.invoiceNumber}`,
      note: 'Please complete your payment through the official PayPal invoice.'
    }
  });

  const remoteInvoice = await paypalClient.request({
    method: 'GET',
    path: `/v2/invoicing/invoices/${invoice.paypalInvoiceId}`
  });
  const syncedInvoice = await syncRemoteInvoice(invoice, remoteInvoice);

  await auditLogService.log({
    actorType: input.actorType,
    actorId: input.actorId || null,
    action: 'invoice.reminder_sent',
    entityType: 'invoice',
    entityId: invoice.id,
    metadata: {
      paypalInvoiceId: invoice.paypalInvoiceId
    }
  });

  return presentInvoice(syncedInvoice);
}

async function cancelInvoiceAutoReminders(input) {
  const invoice = await loadInvoiceOrThrow(input.invoiceId);

  await paypalClient.request({
    method: 'POST',
    path: `/v2/invoicing/invoices/${invoice.paypalInvoiceId}/cancel-reminders`,
    requestId: `${invoice.paypalInvoiceId}:cancel-reminders`,
    body: {}
  });

  const remoteInvoice = await paypalClient.request({
    method: 'GET',
    path: `/v2/invoicing/invoices/${invoice.paypalInvoiceId}`
  });

  const syncedRemoteInvoice = await syncRemoteInvoice(invoice, remoteInvoice);
  const syncedInvoice = await invoiceRepository.update(syncedRemoteInvoice.id, {
    autoRemindersCancelledAt: new Date().toISOString()
  });

  await auditLogService.log({
    actorType: input.actorType,
    actorId: input.actorId || null,
    action: 'invoice.auto_reminders_cancelled',
    entityType: 'invoice',
    entityId: invoice.id,
    metadata: {
      paypalInvoiceId: invoice.paypalInvoiceId
    }
  });

  return presentInvoice(syncedInvoice);
}

async function getReminderConfigurationOrThrow(configurationId) {
  const reminder = await paypalClient.request({
    method: 'GET',
    path: `/v2/invoicing/reminders/${configurationId}`
  });

  if (!reminder || !reminder.id) {
    throw new AppError(502, 'PAYPAL_REMINDER_CONFIGURATION_MISSING', 'PayPal reminder configuration could not be loaded.');
  }

  return reminder;
}

function presentReminderConfiguration(configuration) {
  return {
    id: configuration.id,
    type: configuration.type,
    status: configuration.status || null,
    interval: configuration.interval || null,
    repetition: configuration.repetition ?? null,
    notification: configuration.notification || {},
    metadata: configuration.metadata || {},
    links: configuration.links || []
  };
}

async function listReminderConfigurations(input = {}) {
  const query = new URLSearchParams();
  if (input.type) {
    query.set('type', input.type);
  }

  const response = await paypalClient.request({
    method: 'GET',
    path: `/v2/invoicing/reminders${query.toString() ? `?${query.toString()}` : ''}`
  });

  return {
    data: Array.isArray(response?.configurations)
      ? response.configurations.map(presentReminderConfiguration)
      : []
  };
}

async function updateReminderConfiguration(input) {
  await paypalClient.request({
    method: 'PUT',
    path: `/v2/invoicing/reminders/${input.configurationId}`,
    headers: {
      Prefer: 'return=representation'
    },
    body: {
      type: input.type,
      interval: input.interval,
      repetition: input.repetition,
      notification: input.notification || undefined
    }
  });

  const configuration = presentReminderConfiguration(
    await getReminderConfigurationOrThrow(input.configurationId)
  );

  await auditLogService.log({
    actorType: input.actorType,
    actorId: input.actorId || null,
    action: 'invoice_reminder_configuration.updated',
    entityType: 'invoice_reminder_configuration',
    entityId: configuration.id,
    metadata: {
      type: configuration.type,
      interval: configuration.interval,
      repetition: configuration.repetition,
      status: configuration.status
    }
  });

  return configuration;
}

async function suspendReminderConfiguration(input) {
  await paypalClient.request({
    method: 'POST',
    path: `/v2/invoicing/reminders/${input.configurationId}/suspend`,
    body: {}
  });

  const configuration = presentReminderConfiguration(
    await getReminderConfigurationOrThrow(input.configurationId)
  );

  await auditLogService.log({
    actorType: input.actorType,
    actorId: input.actorId || null,
    action: 'invoice_reminder_configuration.suspended',
    entityType: 'invoice_reminder_configuration',
    entityId: configuration.id,
    metadata: {
      type: configuration.type,
      status: configuration.status
    }
  });

  return configuration;
}

async function resumeReminderConfiguration(input) {
  await paypalClient.request({
    method: 'POST',
    path: `/v2/invoicing/reminders/${input.configurationId}/resume`,
    body: {}
  });

  const configuration = presentReminderConfiguration(
    await getReminderConfigurationOrThrow(input.configurationId)
  );

  await auditLogService.log({
    actorType: input.actorType,
    actorId: input.actorId || null,
    action: 'invoice_reminder_configuration.resumed',
    entityType: 'invoice_reminder_configuration',
    entityId: configuration.id,
    metadata: {
      type: configuration.type,
      status: configuration.status
    }
  });

  return configuration;
}

async function generateInvoiceQr(input) {
  const invoice = await loadInvoiceOrThrow(input.invoiceId);
  if (![INVOICE_STATUS.SENT, INVOICE_STATUS.UPDATED, INVOICE_STATUS.PAID].includes(invoice.status)) {
    throw new AppError(
      409,
      'INVOICE_QR_NOT_AVAILABLE',
      'PayPal QR codes are only available after the invoice is in a payable or paid state.'
    );
  }
  const qrDetails = await paypalClient.request({
    method: 'POST',
    path: `/v2/invoicing/invoices/${invoice.paypalInvoiceId}/generate-qr-code`,
    requestId: `${invoice.paypalInvoiceId}:qr`,
    body: {}
  });

  const remoteInvoice = await paypalClient.request({
    method: 'GET',
    path: `/v2/invoicing/invoices/${invoice.paypalInvoiceId}`
  });

  const syncedInvoice = await invoiceRepository.update(invoice.id, {
    status: normalizeInvoiceStatus(remoteInvoice.status),
    invoiceUrl: extractInvoiceUrl(remoteInvoice) || invoice.invoiceUrl,
    paypalDetails: remoteInvoice,
    paypalQrDetails: qrDetails,
    paypalSyncedAt: new Date().toISOString()
  });
  await paymentOpsIssueService.syncInvoiceIssues(syncedInvoice);

  await auditLogService.log({
    actorType: input.actorType,
    actorId: input.actorId || null,
    action: 'invoice.qr_generated',
    entityType: 'invoice',
    entityId: invoice.id,
    metadata: {
      paypalInvoiceId: invoice.paypalInvoiceId,
      hasQrPayload: Boolean(qrDetails)
    }
  });

  return presentInvoice(syncedInvoice);
}

async function cancelInvoice(input) {
  const invoice = await loadInvoiceOrThrow(input.invoiceId);

  await paypalClient.request({
    method: 'POST',
    path: `/v2/invoicing/invoices/${invoice.paypalInvoiceId}/cancel`,
    requestId: `${invoice.paypalInvoiceId}:cancel`
  });

  const remoteInvoice = await paypalClient.request({
    method: 'GET',
    path: `/v2/invoicing/invoices/${invoice.paypalInvoiceId}`
  });
  const syncedInvoice = await syncRemoteInvoice(invoice, remoteInvoice);

  await auditLogService.log({
    actorType: input.actorType,
    actorId: input.actorId || null,
    action: 'invoice.cancelled',
    entityType: 'invoice',
    entityId: invoice.id,
    metadata: {
      paypalInvoiceId: invoice.paypalInvoiceId
    }
  });

  return presentInvoice(syncedInvoice);
}

async function releaseInvoiceFunds(input) {
  const invoice = await invoiceRepository.findByIdentifier(input.invoiceId);
  if (!invoice) {
    throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found.');
  }

  if (invoice.status !== INVOICE_STATUS.PAID) {
    throw new AppError(409, 'INVOICE_NOT_RELEASEABLE', 'Only paid invoices can release funds.');
  }

  const releasedFundsCents = await ledgerService.getReleasedFundsForInvoice(invoice.id);
  const releasableCents = Math.max(invoice.amountCents - releasedFundsCents, 0);
  if (releasableCents <= 0) {
    throw new AppError(409, 'INVOICE_ALREADY_RELEASED', 'No releasable funds remain for this invoice.');
  }

  const amountCents = input.amount ? ensurePositiveMoney(parseAmount(input.amount)) : releasableCents;
  if (amountCents > releasableCents) {
    throw new AppError(
      409,
      'RELEASE_AMOUNT_EXCEEDS_INVOICE_BALANCE',
      'Release amount exceeds the remaining releasable invoice balance.'
    );
  }

  const wallet = await ledgerService.releasePendingFunds({
    userId: invoice.userId,
    invoiceId: invoice.id,
    amountCents,
    currencyCode: invoice.currencyCode,
    idempotencyKey: input.idempotencyKey
  });

  const remainingReleasableCents = releasableCents - amountCents;

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: input.adminActorId,
    action: 'invoice.funds_released',
    entityType: 'invoice',
    entityId: invoice.id,
    metadata: {
      amountCents,
      reason: input.reason || null,
      remainingReleasableCents,
      requestId: input.requestId || null
    }
  });

  return {
    invoice,
    wallet,
    amountCents,
    remainingReleasableCents
  };
}

module.exports = {
  paypalInvoiceService: {
    createAndSendInvoice,
    previewInvoice,
    refreshInvoice,
    sendInvoiceReminder,
    cancelInvoiceAutoReminders,
    listReminderConfigurations,
    updateReminderConfiguration,
    suspendReminderConfiguration,
    resumeReminderConfiguration,
    generateInvoiceQr,
    cancelInvoice,
    releaseInvoiceFunds
  }
};
