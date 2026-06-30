const { z } = require('zod');

const userPointsParamsSchema = z.object({
  id: z.string().trim().min(1)
});

const updateCurrentUserProfileSchema = z.object({
  name: z.string().trim().min(1).max(120)
});

const topUpOrderParamsSchema = z.object({
  id: z.string().trim().min(1)
});

const createTopUpOrderSchema = z.object({
  points: z.coerce.number().int().min(5).max(1000000),
  amountLabel: z.string().trim().min(1).max(80).optional(),
  methodId: z.string().trim().min(1).max(80),
  methodTitle: z.string().trim().min(1).max(120),
  serviceIntent: z.string().trim().max(120).optional().default(''),
  instructions: z.string().trim().max(500).optional().default(''),
  vendorUrl: z.string().trim().url().max(500).optional().or(z.literal('')).default(''),
  notes: z.string().trim().max(500).optional().default('')
});

const updateTopUpOrderStatusSchema = z.object({
  status: z.enum(['awaiting_confirmation', 'cancelled']),
  notes: z.string().trim().max(500).optional().default('')
});

module.exports = {
  createTopUpOrderSchema,
  topUpOrderParamsSchema,
  updateTopUpOrderStatusSchema,
  updateCurrentUserProfileSchema,
  userPointsParamsSchema
};
