const { z } = require('zod');

const providerKeySchema = z.enum(['paypal', 'stripe', 'wise', 'paystack', 'flutterwave', 'crypto']);

const providerParamsSchema = z.object({
  provider: providerKeySchema
});

const providerLaneParamsSchema = providerParamsSchema.extend({
  laneId: z.string().trim().min(1)
});

const providerOperationSchema = z.enum(['invoices', 'payouts', 'balance', 'activity']);

const providerOperationParamsSchema = providerParamsSchema.extend({
  operation: providerOperationSchema
});

const providerActivityQuerySchema = z.object({
  type: z.enum(['all', 'invoice', 'payout']).default('all'),
  status: z.string().trim().min(1).max(64).optional(),
  cursor: z.union([z.coerce.number().int().nonnegative(), z.string().trim().min(1)]).optional(),
  dateFrom: z.string().trim().min(1).optional(),
  dateTo: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(25)
});

module.exports = {
  providerActivityQuerySchema,
  providerKeySchema,
  providerLaneParamsSchema,
  providerOperationParamsSchema,
  providerOperationSchema,
  providerParamsSchema
};
