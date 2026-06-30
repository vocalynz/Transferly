const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const {
  RETRY_DELAYS_MS,
  buildDeadLetterPayload,
  createPayoutJobProcessor,
  createWorkerFailureHandler,
  hasExhaustedAttempts
} = require('../jobs/workerHelpers');

describe('worker helpers', () => {
  test('payout job processor schedules a retry when the provider status is pending', async () => {
    const retryCalls = [];
    const payoutService = {
      async processQueuedPayout(payoutId) {
        return {
          payout_id: payoutId,
          status: 'PENDING'
        };
      },
      isProviderPendingStatus(status) {
        return status === 'PENDING';
      }
    };

    const processor = createPayoutJobProcessor({
      payoutService,
      retryQueue: {
        async add(name, payload, options) {
          retryCalls.push({ name, payload, options });
        }
      },
      retryDelayMs: RETRY_DELAYS_MS.initialPayoutPoll,
      now: () => 123456
    });

    const result = await processor({
      data: {
        payoutId: 'payout-1'
      }
    });

    assert.equal(result.status, 'PENDING');
    assert.deepEqual(retryCalls, [
      {
        name: 'retry-payout-status-poll',
        payload: {
          payoutId: 'payout-1'
        },
        options: {
          jobId: 'retry-payout:payout-1:123456',
          delay: RETRY_DELAYS_MS.initialPayoutPoll
        }
      }
    ]);
  });

  test('payout job processor skips retry scheduling for terminal statuses', async () => {
    const payoutService = {
      async processQueuedPayout(payoutId) {
        return {
          payout_id: payoutId,
          status: 'SUCCESS'
        };
      },
      isProviderPendingStatus() {
        return false;
      }
    };

    let addCalled = false;
    const processor = createPayoutJobProcessor({
      payoutService,
      retryQueue: {
        async add() {
          addCalled = true;
        }
      },
      retryDelayMs: RETRY_DELAYS_MS.followUpPayoutPoll
    });

    const result = await processor({
      data: {
        payoutId: 'payout-2'
      }
    });

    assert.equal(result.status, 'SUCCESS');
    assert.equal(addCalled, false);
  });

  test('failure handler sends exhausted jobs to the dead-letter queue', async () => {
    const deadLetterCalls = [];
    const onFailure = createWorkerFailureHandler({
      queueName: 'payout-process',
      deadLetterQueue: {
        async add(name, payload) {
          deadLetterCalls.push({ name, payload });
        }
      }
    });

    await onFailure(
      {
        id: 'job-1',
        data: { payoutId: 'payout-3' },
        attemptsMade: 5,
        opts: { attempts: 5 }
      },
      new Error('processing failed')
    );

    assert.deepEqual(deadLetterCalls, [
      {
        name: 'payout-process-dead-letter',
        payload: {
          sourceQueue: 'payout-process',
          sourceJobId: 'job-1',
          payload: { payoutId: 'payout-3' },
          error: 'processing failed'
        }
      }
    ]);
  });

  test('failure handler skips dead-letter writes before attempts are exhausted', async () => {
    let addCalled = false;
    const onFailure = createWorkerFailureHandler({
      queueName: 'invoice-send',
      deadLetterQueue: {
        async add() {
          addCalled = true;
        }
      }
    });

    await onFailure(
      {
        id: 'job-2',
        data: { invoiceId: 'invoice-1' },
        attemptsMade: 2,
        opts: { attempts: 5 }
      },
      new Error('still retrying')
    );

    assert.equal(addCalled, false);
  });

  test('dead-letter payloads and attempt exhaustion are computed predictably', () => {
    const payload = buildDeadLetterPayload(
      'webhook-process',
      {
        id: 'job-3',
        data: { webhookEventId: 'evt-1' }
      },
      new Error('boom')
    );

    assert.deepEqual(payload, {
      sourceQueue: 'webhook-process',
      sourceJobId: 'job-3',
      payload: { webhookEventId: 'evt-1' },
      error: 'boom'
    });
    assert.equal(hasExhaustedAttempts({ attemptsMade: 1, opts: { attempts: 1 } }), true);
    assert.equal(hasExhaustedAttempts({ attemptsMade: 0, opts: { attempts: 1 } }), false);
  });
});
