const { z } = require('zod');

const telegramMiniAppLoginSchema = z.object({
  initData: z.string().trim().min(1).max(8192),
  startParam: z.string().trim().max(512).optional()
});

module.exports = {
  telegramMiniAppLoginSchema
};
