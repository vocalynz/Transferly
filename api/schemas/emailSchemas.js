const { z } = require('zod');

const sendEmailReceiptSchema = z.object({
  receiptId: z.string().trim().min(1),
  toEmail: z.string().trim().email(),
  subject: z.string().trim().min(1).max(180).optional(),
  message: z.string().trim().min(1).max(2000).optional()
});

module.exports = {
  sendEmailReceiptSchema
};
