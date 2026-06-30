const { z } = require('zod');

const serviceLaneActionIntentSchema = z.object({
  intent: z.string().trim().min(1).max(80).optional(),
  source: z.string().trim().min(1).max(40).optional(),
  metadata: z.record(z.unknown()).optional()
});

module.exports = {
  serviceLaneActionIntentSchema
};
