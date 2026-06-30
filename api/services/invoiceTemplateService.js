const { transaction } = require('../db');
const { invoiceTemplateRepository } = require('../repositories/invoiceTemplateRepository');
const { AUDIT_ACTOR_TYPE } = require('../utils/constants');
const { AppError } = require('../utils/errors');
const { auditLogService } = require('./auditLogService');

async function getInvoiceTemplateOrThrow(id, client) {
  const template = await invoiceTemplateRepository.findById(id, client);
  if (!template) {
    throw new AppError(404, 'INVOICE_TEMPLATE_NOT_FOUND', 'Invoice template not found.');
  }

  return template;
}

function buildDueDateFromTemplate(template) {
  if (!template.default_due_days && template.default_due_days !== 0) {
    return null;
  }

  const dueDate = new Date();
  dueDate.setUTCDate(dueDate.getUTCDate() + Number(template.default_due_days));
  return dueDate.toISOString();
}

async function listTemplates(filters = {}) {
  return invoiceTemplateRepository.findAll(filters);
}

async function createTemplate({ input, adminActorId }) {
  return transaction(async (client) => {
    const template = await invoiceTemplateRepository.create(input, client);

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.ADMIN,
        actorId: adminActorId,
        action: 'invoice_template.created',
        entityType: 'invoice_template',
        entityId: template.id,
        metadata: {
          name: template.name,
          currency_code: template.currency_code,
          item_count: template.line_items.length
        }
      },
      client
    );

    return template;
  });
}

async function updateTemplate({ id, updates, adminActorId }) {
  return transaction(async (client) => {
    const existing = await getInvoiceTemplateOrThrow(id, client);
    const template = await invoiceTemplateRepository.update(id, updates, client);

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.ADMIN,
        actorId: adminActorId,
        action: 'invoice_template.updated',
        entityType: 'invoice_template',
        entityId: template.id,
        metadata: {
          previous_name: existing.name,
          updated_fields: Object.keys(updates)
        }
      },
      client
    );

    return template;
  });
}

async function deleteTemplate({ id, adminActorId }) {
  return transaction(async (client) => {
    const template = await getInvoiceTemplateOrThrow(id, client);
    await invoiceTemplateRepository.remove(id, client);

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.ADMIN,
        actorId: adminActorId,
        action: 'invoice_template.deleted',
        entityType: 'invoice_template',
        entityId: template.id,
        metadata: {
          name: template.name
        }
      },
      client
    );

    return { id, deleted: true };
  });
}

async function resolveInvoiceInput(input) {
  if (!input.templateId) {
    return {
      resolvedInput: input,
      template: null
    };
  }

  const template = await getInvoiceTemplateOrThrow(input.templateId);
  if (!template.is_active) {
    throw new AppError(409, 'INVOICE_TEMPLATE_INACTIVE', 'Invoice template is inactive.');
  }

  return {
    template,
    resolvedInput: {
      ...input,
      currency: input.currency || template.currency_code,
      description:
        Object.prototype.hasOwnProperty.call(input, 'description') && input.description !== undefined
          ? input.description
          : template.description,
      dueDate: input.dueDate || buildDueDateFromTemplate(template),
      items: input.items && input.items.length ? input.items : template.line_items,
      metadata: {
        ...(template.metadata || {}),
        ...(input.metadata || {}),
        invoice_template: {
          id: template.id,
          name: template.name
        }
      }
    }
  };
}

module.exports = {
  invoiceTemplateService: {
    listTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    resolveInvoiceInput
  }
};
