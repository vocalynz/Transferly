const { enqueueWebhookProcessing } = require('../jobs/dispatchers');
const { webhookEventRepository } = require('../repositories/webhookEventRepository');
const { auditLogService } = require('./auditLogService');
const { AppError } = require('../utils/errors');
const { AUDIT_ACTOR_TYPE, WEBHOOK_PROCESSING_STATUS } = require('../utils/constants');

async function getWebhookEventOrThrow(webhookEventId) {
  const event = await webhookEventRepository.findByIdentifier(webhookEventId);
  if (!event) {
    throw new AppError(404, 'WEBHOOK_EVENT_NOT_FOUND', 'Webhook event not found.');
  }

  return event;
}

async function getWebhookEvent(webhookEventId) {
  return getWebhookEventOrThrow(webhookEventId);
}

async function replayWebhookEvent({ webhookEventId, adminActorId, note }) {
  const event = await getWebhookEventOrThrow(webhookEventId);
  if (event.status === WEBHOOK_PROCESSING_STATUS.REJECTED) {
    throw new AppError(
      409,
      'WEBHOOK_REPLAY_NOT_ALLOWED',
      'Rejected webhook events cannot be replayed from admin controls.'
    );
  }

  const replayReady = await webhookEventRepository.update(event.id, {
    status: WEBHOOK_PROCESSING_STATUS.VERIFIED,
    lastError: null,
    processedAt: null
  });

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: adminActorId,
    action: 'webhook.replay_requested',
    entityType: 'webhook_event',
    entityId: event.id,
    metadata: {
      event_id: event.eventId,
      event_type: event.eventType,
      previous_status: event.status,
      note: note || null
    }
  });

  await enqueueWebhookProcessing(replayReady.id, replayReady.eventId);
  return getWebhookEventOrThrow(event.id);
}

async function ignoreWebhookEvent({ webhookEventId, adminActorId, note }) {
  const event = await getWebhookEventOrThrow(webhookEventId);
  const updated = await webhookEventRepository.update(event.id, {
    status: WEBHOOK_PROCESSING_STATUS.IGNORED,
    lastError: null,
    processedAt: new Date().toISOString()
  });

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: adminActorId,
    action: 'webhook.ignored',
    entityType: 'webhook_event',
    entityId: event.id,
    metadata: {
      event_id: event.eventId,
      event_type: event.eventType,
      previous_status: event.status,
      note: note || null
    }
  });

  return updated;
}

module.exports = {
  adminWebhookService: {
    getWebhookEvent,
    ignoreWebhookEvent,
    replayWebhookEvent
  }
};
