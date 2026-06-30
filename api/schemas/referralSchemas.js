const { z } = require('zod');

const referralActionSchema = z.object({
  action: z.enum(['stats', 'claim']).default('stats'),
  userId: z.string().trim().min(1).optional(),
  referralCode: z.string().trim().min(4).max(32).optional()
});

module.exports = {
  referralActionSchema
};
