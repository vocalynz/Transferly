const {
  resolveUserIdForRequest
} = require('../middleware/authenticateRequest');
const { generateReceiptSchema } = require('../schemas/slipcraftReceiptSchemas');
const { slipcraftReceiptService } = require('../services/slipcraftReceiptService');

async function generateReceiptController(request, response) {
  const body = generateReceiptSchema.parse(request.body || {});
  const result = await slipcraftReceiptService.generateReceipt({
    ...body,
    userId: resolveUserIdForRequest(request, body.userId)
  });

  response.status(201).json(result);
}

module.exports = {
  generateReceiptController
};
