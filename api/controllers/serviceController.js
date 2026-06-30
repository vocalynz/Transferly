const { serviceCommandCenterService } = require('../services/serviceCommandCenterService');
const { serviceLaneActionIntentSchema } = require('../schemas/serviceSchemas');

async function getServiceCommandCenterSummaryController(request, response) {
  const result = await serviceCommandCenterService.getServiceCommandCenterSummary({
    userId: request.auth.userId,
    slug: request.params.slug
  });

  response.json(result);
}

async function getServiceLaneDetailController(request, response) {
  const result = await serviceCommandCenterService.getServiceLaneDetail({
    userId: request.auth.userId,
    slug: request.params.slug,
    laneId: request.params.laneId
  });

  response.json(result);
}

async function createServiceLaneActionIntentController(request, response) {
  const payload = serviceLaneActionIntentSchema.parse(request.body || {});
  const result = await serviceCommandCenterService.createServiceLaneActionIntent({
    userId: request.auth.userId,
    slug: request.params.slug,
    laneId: request.params.laneId,
    intent: payload.intent,
    source: payload.source,
    metadata: payload.metadata
  });

  response.status(201).json(result);
}

module.exports = {
  getServiceCommandCenterSummaryController,
  getServiceLaneDetailController,
  createServiceLaneActionIntentController
};
