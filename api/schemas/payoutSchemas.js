const { z } = require('zod');

const createPayoutSchema = z.object({
  provider: z.enum(['paypal', 'stripe']).default('paypal'),
  userId: z.string().min(1),
  receiver: z.string().min(1),
  recipientType: z.enum(['EMAIL', 'PHONE', 'PAYPAL_ID', 'STRIPE_ACCOUNT']).default('EMAIL'),
  receiverCountryCode: z.string().length(2).optional(),
  amount: z.coerce.number().positive(),
  currency: z.string().length(3),
  note: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional()
});

const rejectPayoutSchema = z.object({
  reason: z.string().max(1000).optional()
});

const payoutParamsSchema = z.object({
  id: z.string().trim().min(1)
});

const listPayoutsQuerySchema = z.object({
  provider: z.enum(['paypal', 'stripe', 'wise', 'paystack', 'flutterwave', 'crypto']).optional(),
  status: z.string().trim().min(1).optional(),
  riskDecision: z.string().trim().min(1).optional(),
  recipient: z.string().trim().min(1).optional(),
  providerState: z.string().trim().min(1).optional(),
  dateFrom: z.string().trim().min(1).optional(),
  dateTo: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(250).optional(),
  limit: z.coerce.number().int().positive().max(250).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'amount', 'receiver', 'status']).default('createdAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc')
});

const paymentTimelineQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(25)
});

module.exports = {
  createPayoutSchema,
  rejectPayoutSchema,
  listPayoutsQuerySchema,
  payoutParamsSchema,
  paymentTimelineQuerySchema
};
