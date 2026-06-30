const { auditLogRepository } = require('../repositories/auditLogRepository');

async function getTimeline(entityType, entityId, options = {}) {
  const entries = await auditLogRepository.findManyForEntity(entityType, entityId, options);
  return entries;
}

module.exports = {
  paymentTimelineService: {
    getTimeline
  }
};
