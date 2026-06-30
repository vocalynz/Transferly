const RETRY_DELAYS_MS = Object.freeze({
  initialPayoutPoll: 60_000,
  followUpPayoutPoll: 5 * 60_000
});

function buildDeadLetterPayload(queueName, job, error) {
  if (!job) {
    return null;
  }

  return {
    sourceQueue: queueName,
    sourceJobId: job.id || null,
    payload: job.data,
    error: error.message
  };
}

async function enqueueDeadLetter(deadLetterQueue, queueName, job, error) {
  const payload = buildDeadLetterPayload(queueName, job, error);
  if (!payload) {
    return;
  }

  await deadLetterQueue.add(`${queueName}-dead-letter`, payload);
}

function hasExhaustedAttempts(job) {
  const attempts = typeof job?.opts?.attempts === 'number' ? job.opts.attempts : 1;
  return (job?.attemptsMade || 0) >= attempts;
}

async function schedulePayoutRetry(retryQueue, payoutId, delayMs, now = Date.now) {
  await retryQueue.add(
    'retry-payout-status-poll',
    { payoutId },
    {
      jobId: `retry-payout:${payoutId}:${now()}`,
      delay: delayMs
    }
  );
}

function createPayoutJobProcessor({ payoutService, retryQueue, retryDelayMs, now = Date.now }) {
  return async (job) => {
    const result = await payoutService.processQueuedPayout(job.data.payoutId);

    if (payoutService.isProviderPendingStatus(result.status)) {
      await schedulePayoutRetry(retryQueue, job.data.payoutId, retryDelayMs, now);
    }

    return result;
  };
}

function createWorkerFailureHandler({ queueName, deadLetterQueue }) {
  return async (job, error) => {
    if (!hasExhaustedAttempts(job)) {
      return;
    }

    await enqueueDeadLetter(deadLetterQueue, queueName, job, error);
  };
}

module.exports = {
  RETRY_DELAYS_MS,
  buildDeadLetterPayload,
  enqueueDeadLetter,
  hasExhaustedAttempts,
  schedulePayoutRetry,
  createPayoutJobProcessor,
  createWorkerFailureHandler
};
