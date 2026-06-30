const { resolveUserIdForRequest } = require('../middleware/authenticateRequest');
const { referralActionSchema } = require('../schemas/referralSchemas');
const { referralService } = require('../services/referralService');

async function referralController(request, response) {
  const body = referralActionSchema.parse(request.body || {});
  const userId = resolveUserIdForRequest(request, body.userId);

  if (body.action === 'claim') {
    const result = await referralService.claimReferral(userId, body.referralCode);
    response.status(201).json(result);
    return;
  }

  const result = await referralService.getStats(userId);
  response.json(result);
}

module.exports = {
  referralController
};
