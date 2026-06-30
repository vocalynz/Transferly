const QUEUE_COUNT_STATES = Object.freeze([
  'waiting',
  'active',
  'completed',
  'failed',
  'delayed',
  'paused'
]);

const { auditLogService } = require('./auditLogService');
const { AUDIT_ACTOR_TYPE } = require('../utils/constants');
const { AppError } = require('../utils/errors');

const RECOVERY_JOB_NAMES = Object.freeze({
  'invoice-send': 'create-and-send-invoice',
  'payout-process': 'process-approved-payout',
  'webhook-process': 'process-paypal-webhook',
  'payout-retry': 'retry-payout-status-poll',
  'payment-reconciliation': 'run-payment-reconciliation'
});

function getQueueRuntime() {
  return require('../jobs/queues');
}

function buildQueueRegistry(runtime) {
  return [
    { key: 'invoice_send', name: runtime.queueNames.invoiceSend, queue: runtime.invoiceSendQueue },
    { key: 'payout_process', name: runtime.queueNames.payoutProcess, queue: runtime.payoutProcessQueue },
    { key: 'webhook_process', name: runtime.queueNames.webhookProcess, queue: runtime.webhookProcessQueue },
    { key: 'payout_retry', name: runtime.queueNames.payoutRetry, queue: runtime.payoutRetryQueue },
    { key: 'payment_reconciliation', name: runtime.queueNames.reconciliation, queue: runtime.reconciliationQueue },
    { key: 'dead_letter', name: runtime.queueNames.deadLetter, queue: runtime.deadLetterQueue }
  ];
}

function presentQueueCounts(counts) {
  return QUEUE_COUNT_STATES.reduce((result, state) => {
    result[state] = counts[state] || 0;
    return result;
  }, {});
}

async function buildQueueSnapshot(entry) {
  const counts = await entry.queue.getJobCounts(...QUEUE_COUNT_STATES);
  return {
    key: entry.key,
    name: entry.name,
    counts: presentQueueCounts(counts)
  };
}

function mapDeadLetterJob(job) {
  const data = job.data || {};

  return {
    job_id: job.id,
    name: job.name,
    attempts_made: job.attemptsMade,
    failed_reason: job.failedReason || null,
    queue_name: job.queueName,
    source_queue: data.sourceQueue || data.source_queue || data.queueName || null,
    source_job_id: data.sourceJobId || data.source_job_id || null,
    recovery: data.recovery || null,
    data,
    created_at: job.timestamp ? new Date(job.timestamp).toISOString() : null,
    finished_at: job.finishedOn ? new Date(job.finishedOn).toISOString() : null
  };
}

function getQueueByName(runtime, queueName) {
  return buildQueueRegistry(runtime).find((entry) => entry.name === queueName)?.queue || null;
}

function resolveRecoveryJobName(sourceQueue, deadLetterJob) {
  return RECOVERY_JOB_NAMES[sourceQueue] || String(deadLetterJob.name || '').replace(/-dead-letter$/, '') || `${sourceQueue}-recovered`;
}

async function getQueueOverview() {
  const runtime = getQueueRuntime();
  const queues = await Promise.all(buildQueueRegistry(runtime).map(buildQueueSnapshot));
  return {
    generated_at: new Date().toISOString(),
    redis_status: runtime.redisConnection.status,
    queues
  };
}

async function listDeadLetterJobs(limit = 50) {
  const runtime = getQueueRuntime();
  const jobs = await runtime.deadLetterQueue.getJobs(
    ['waiting', 'delayed', 'active', 'completed', 'failed'],
    0,
    Math.max(limit - 1, 0),
    false
  );

  return jobs.map(mapDeadLetterJob);
}

async function recoverDeadLetterJob(jobId, { adminActorId, note } = {}) {
  const runtime = getQueueRuntime();
  const deadLetterJob = await runtime.deadLetterQueue.getJob(jobId);
  if (!deadLetterJob) {
    throw new AppError(404, 'DEAD_LETTER_JOB_NOT_FOUND', 'Dead-letter job not found.');
  }

  const sourceQueue = deadLetterJob.data?.sourceQueue || deadLetterJob.data?.source_queue || deadLetterJob.data?.queueName;
  const payload = deadLetterJob.data?.payload;
  const targetQueue = sourceQueue ? getQueueByName(runtime, sourceQueue) : null;

  if (!sourceQueue || sourceQueue === runtime.queueNames.deadLetter || !targetQueue) {
    throw new AppError(422, 'DEAD_LETTER_SOURCE_UNRECOVERABLE', 'Dead-letter job source queue cannot be recovered.');
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new AppError(422, 'DEAD_LETTER_PAYLOAD_UNRECOVERABLE', 'Dead-letter job payload cannot be recovered.');
  }

  const recoveredAt = new Date().toISOString();
  const recoveryJobName = resolveRecoveryJobName(sourceQueue, deadLetterJob);
  const recoveryJob = await targetQueue.add(recoveryJobName, payload, {
    jobId: `recovered:${sourceQueue}:${deadLetterJob.id}:${Date.now()}`
  });
  const recovery = {
    recovered_at: recoveredAt,
    recovered_by_actor_id: adminActorId || null,
    note: note || null,
    source_queue: sourceQueue,
    recovery_job_id: recoveryJob.id,
    recovery_job_name: recoveryJobName
  };

  const updatedDeadLetterData = {
    ...(deadLetterJob.data || {}),
    recovery: {
      recoveredAt,
      recoveredByActorId: adminActorId || null,
      note: note || null,
      recoveryJobId: recoveryJob.id,
      recoveryJobName,
      sourceQueue
    }
  };

  if (typeof deadLetterJob.updateData === 'function') {
    await deadLetterJob.updateData(updatedDeadLetterData);
  }
  deadLetterJob.data = updatedDeadLetterData;

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: adminActorId,
    action: 'dead_letter.recovered',
    entityType: 'dead_letter_job',
    entityId: String(deadLetterJob.id),
    metadata: {
      source_queue: sourceQueue,
      source_job_id: deadLetterJob.data?.sourceJobId || deadLetterJob.data?.source_job_id || null,
      recovery_job_id: recoveryJob.id,
      recovery_job_name: recoveryJobName,
      note: note || null
    }
  });

  return {
    dead_letter: mapDeadLetterJob(deadLetterJob),
    recovery
  };
}

const opsService = {
  getQueueOverview,
  listDeadLetterJobs,
  recoverDeadLetterJob
};

module.exports = {
  opsService,
  QUEUE_COUNT_STATES,
  buildQueueSnapshot,
  getQueueOverview,
  listDeadLetterJobs,
  recoverDeadLetterJob,
  mapDeadLetterJob
};
