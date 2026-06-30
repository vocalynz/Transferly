const { z } = require('zod');

const detailFieldSchema = z.object({
  label: z.string().trim().min(1).max(120),
  value: z.union([z.string(), z.number(), z.boolean()]).transform((value) => String(value))
});

const generateReceiptSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  type: z.enum(['bank', 'email']).default('bank'),
  title: z.string().trim().min(1).max(160).optional(),
  summary: z.string().trim().min(1).max(240).optional(),
  details: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  fields: z.array(detailFieldSchema).max(20).optional(),
  emailTo: z.string().trim().email().optional()
});

module.exports = {
  generateReceiptSchema
};
