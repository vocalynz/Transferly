const { dispatchInvoiceCreation } = require('../jobs/dispatchers');
const {
  assertCanAccessUserResource,
  resolveUserIdForRequest
} = require('../middleware/authenticateRequest');
const { presentInvoice, presentPaymentTimelineEntry } = require('../presenters/paymentPresenter');
const { invoiceRepository } = require('../repositories/invoiceRepository');
const { createInvoiceSchema, listInvoicesQuerySchema } = require('../schemas/invoiceSchemas');
const { paypalInvoiceService } = require('../services/paypalInvoiceService');
const { providerInvoiceService } = require('../services/providerInvoiceService');
const { paymentTimelineService } = require('../services/paymentTimelineService');
const { paymentTimelineQuerySchema } = require('../schemas/payoutSchemas');
const { AUDIT_ACTOR_TYPE } = require('../utils/constants');

async function loadAccessibleInvoice(request, response, invoiceId) {
  const invoice = await invoiceRepository.findByIdentifier(invoiceId);
  if (!invoice) {
    response.status(404).json({
      code: 'INVOICE_NOT_FOUND',
      message: 'Invoice not found.'
    });
    return null;
  }

  assertCanAccessUserResource(request, invoice.userId);
  return invoice;
}

function resolveAuditActorType(request) {
  return request.auth && request.auth.role === 'ADMIN' ? AUDIT_ACTOR_TYPE.ADMIN : AUDIT_ACTOR_TYPE.USER;
}

function resolveAuditActorId(request) {
  return (request.auth && (request.auth.actorId || request.auth.userId)) || null;
}

async function createInvoiceController(request, response) {
  const body = createInvoiceSchema.parse(request.body);
  const result = await dispatchInvoiceCreation({
    ...body,
    userId: resolveUserIdForRequest(request, body.userId),
    requestId: request.id
  });
  response.status(201).json(result);
}

async function previewInvoiceController(request, response) {
  const body = createInvoiceSchema.parse(request.body);
  const preview = await providerInvoiceService.previewInvoice({
    ...body,
    userId: resolveUserIdForRequest(request, body.userId)
  });
  response.json(preview);
}

async function getInvoiceController(request, response) {
  const invoice = await loadAccessibleInvoice(request, response, request.params.id);
  if (!invoice) {
    return;
  }

  response.json(presentInvoice(invoice));
}

async function listInvoicesController(request, response) {
  const query = listInvoicesQuerySchema.parse(request.query || {});
  const userId = request.auth && request.auth.role === 'USER' ? request.auth.userId : undefined;
  const pageSize = query.pageSize || query.limit || 50;
  const filters = {
    ...query,
    pageSize,
    offset: (query.page - 1) * pageSize
  };
  const scopedFilters = userId ? { ...filters, userId } : filters;
  const [invoices, total] = await Promise.all([
    invoiceRepository.findMany(scopedFilters),
    invoiceRepository.countMany(scopedFilters)
  ]);
  response.json({
    data: invoices.map(presentInvoice),
    pagination: {
      page: query.page,
      page_size: pageSize,
      total,
      has_next_page: query.page * pageSize < total
    }
  });
}

async function refreshInvoiceController(request, response) {
  const invoice = await loadAccessibleInvoice(request, response, request.params.id);
  if (!invoice) {
    return;
  }

  const result = await providerInvoiceService.refreshInvoice({
    invoiceId: invoice.id,
    actorType: resolveAuditActorType(request),
    actorId: resolveAuditActorId(request)
  });
  response.json(result);
}

async function sendInvoiceReminderController(request, response) {
  const invoice = await loadAccessibleInvoice(request, response, request.params.id);
  if (!invoice) {
    return;
  }

  const result = await paypalInvoiceService.sendInvoiceReminder({
    invoiceId: invoice.id,
    actorType: resolveAuditActorType(request),
    actorId: resolveAuditActorId(request)
  });
  response.json(result);
}

async function cancelInvoiceAutoRemindersController(request, response) {
  const invoice = await loadAccessibleInvoice(request, response, request.params.id);
  if (!invoice) {
    return;
  }

  const result = await paypalInvoiceService.cancelInvoiceAutoReminders({
    invoiceId: invoice.id,
    actorType: resolveAuditActorType(request),
    actorId: resolveAuditActorId(request)
  });
  response.json(result);
}

async function generateInvoiceQrController(request, response) {
  const invoice = await loadAccessibleInvoice(request, response, request.params.id);
  if (!invoice) {
    return;
  }

  const result = await paypalInvoiceService.generateInvoiceQr({
    invoiceId: invoice.id,
    actorType: resolveAuditActorType(request),
    actorId: resolveAuditActorId(request)
  });
  response.json(result);
}

async function cancelInvoiceController(request, response) {
  const invoice = await loadAccessibleInvoice(request, response, request.params.id);
  if (!invoice) {
    return;
  }

  const result = await providerInvoiceService.cancelInvoice({
    invoiceId: invoice.id,
    actorType: resolveAuditActorType(request),
    actorId: resolveAuditActorId(request),
    requestId: request.id
  });
  response.json(result);
}

async function getInvoiceTimelineController(request, response) {
  const invoice = await loadAccessibleInvoice(request, response, request.params.id);
  if (!invoice) {
    return;
  }

  const query = paymentTimelineQuerySchema.parse(request.query || {});
  const entries = await paymentTimelineService.getTimeline('invoice', invoice.id, query);
  response.json({
    data: entries.map(presentPaymentTimelineEntry)
  });
}

module.exports = {
  createInvoiceController,
  previewInvoiceController,
  getInvoiceController,
  listInvoicesController,
  refreshInvoiceController,
  sendInvoiceReminderController,
  cancelInvoiceAutoRemindersController,
  generateInvoiceQrController,
  cancelInvoiceController,
  getInvoiceTimelineController
};
