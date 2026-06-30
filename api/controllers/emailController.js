const { assertCanAccessUserResource } = require('../middleware/authenticateRequest');
const { receiptRepository } = require('../repositories/receiptRepository');
const { sendEmailReceiptSchema } = require('../schemas/emailSchemas');
const { emailReceiptService } = require('../services/emailReceiptService');
const { AppError } = require('../utils/errors');

async function sendEmailReceiptController(request, response) {
  const body = sendEmailReceiptSchema.parse(request.body || {});
  const receipt = await receiptRepository.findById(body.receiptId);
  if (!receipt) {
    throw new AppError(404, 'RECEIPT_NOT_FOUND', 'Receipt not found.');
  }

  assertCanAccessUserResource(request, receipt.userId);
  const result = await emailReceiptService.sendReceiptEmail(body);
  response.status(201).json(result);
}

module.exports = {
  sendEmailReceiptController
};
