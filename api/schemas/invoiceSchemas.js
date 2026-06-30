const { z } = require('zod');

const invoiceDateSchema = z.union([
  z.string().datetime(),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
]);

const invoiceLineItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().max(1000).optional(),
  quantity: z.coerce.number().positive(),
  unitAmount: z.coerce.number().positive()
});

const createInvoiceSchema = z
  .object({
    userId: z.string().min(1),
    provider: z.enum(['paypal', 'stripe', 'crypto', 'paystack', 'flutterwave', 'wise']).default('paypal'),
    recipientEmail: z.string().email(),
    templateId: z.string().min(1).optional(),
    currency: z.string().length(3).optional(),
    description: z.string().max(1000).optional(),
    issueDate: invoiceDateSchema.optional(),
    dueDate: z.string().datetime().optional(),
    metadata: z.record(z.unknown()).optional(),
    items: z.array(invoiceLineItemSchema).min(1).optional()
  })
  .superRefine((input, context) => {
    if (!input.templateId && !input.currency) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['currency'],
        message: 'Currency is required when no invoice template is provided.'
      });
    }

    if (!input.templateId && (!input.items || input.items.length === 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['items'],
        message: 'At least one line item is required when no invoice template is provided.'
      });
    }

    if (input.issueDate && input.dueDate) {
      const issueDate = new Date(String(input.issueDate).slice(0, 10));
      const dueDate = new Date(input.dueDate);
      if (!Number.isNaN(issueDate.getTime()) && !Number.isNaN(dueDate.getTime()) && dueDate < issueDate) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dueDate'],
          message: 'Due date cannot be earlier than the invoice issue date.'
        });
      }
    }
  });

const listInvoicesQuerySchema = z.object({
  status: z.string().trim().min(1).optional(),
  recipient: z.string().trim().min(1).optional(),
  provider: z.enum(['paypal', 'stripe', 'crypto', 'paystack', 'flutterwave', 'wise']).optional(),
  providerInvoiceId: z.string().trim().min(1).optional(),
  templateId: z.string().trim().min(1).optional(),
  dateFrom: z.string().trim().min(1).optional(),
  dateTo: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(250).optional(),
  limit: z.coerce.number().int().positive().max(250).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'amount', 'recipient', 'status', 'dueDate']).default('createdAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc')
});

module.exports = {
  createInvoiceSchema,
  listInvoicesQuerySchema,
  invoiceLineItemSchema
};
