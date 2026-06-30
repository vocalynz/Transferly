const { z } = require('zod');

const telegramWebhookSchema = z.object({
  update_id: z.number().int().optional(),
  message: z.object({
    message_id: z.number().int().optional(),
    text: z.string().trim().min(1),
    chat: z.object({
      id: z.union([z.string(), z.number()]).transform((value) => String(value))
    }),
    from: z.object({
      id: z.union([z.string(), z.number()]).transform((value) => String(value)),
      username: z.string().trim().optional(),
      first_name: z.string().trim().optional(),
      last_name: z.string().trim().optional()
    })
  })
});

module.exports = {
  telegramWebhookSchema
};
