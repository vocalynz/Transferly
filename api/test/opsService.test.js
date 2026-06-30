const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { buildQueueSnapshot, mapDeadLetterJob } = require('../services/opsService');

describe('opsService', () => {
  test('buildQueueSnapshot normalizes queue counts', async () => {
    const snapshot = await buildQueueSnapshot({
      key: 'payout_retry',
      name: 'payout-retry',
      queue: {
        async getJobCounts() {
          return {
            waiting: 2,
            completed: 7,
            delayed: 1
          };
        }
      }
    });

    assert.deepEqual(snapshot, {
      key: 'payout_retry',
      name: 'payout-retry',
      counts: {
        waiting: 2,
        active: 0,
        completed: 7,
        failed: 0,
        delayed: 1,
        paused: 0
      }
    });
  });

  test('mapDeadLetterJob presents queue failure metadata predictably', () => {
    const mapped = mapDeadLetterJob({
      id: '41',
      name: 'payout-process-dead-letter',
      attemptsMade: 5,
      failedReason: 'Provider timeout',
      queueName: 'dead-letter',
      data: {
        queueName: 'payout-process',
        payload: {
          payoutId: 'payout-1'
        }
      },
      timestamp: Date.parse('2026-05-05T00:00:00Z'),
      finishedOn: Date.parse('2026-05-05T00:01:30Z')
    });

    assert.deepEqual(mapped, {
      job_id: '41',
      name: 'payout-process-dead-letter',
      attempts_made: 5,
      failed_reason: 'Provider timeout',
      queue_name: 'dead-letter',
      source_queue: 'payout-process',
      source_job_id: null,
      recovery: null,
      data: {
        queueName: 'payout-process',
        payload: {
          payoutId: 'payout-1'
        }
      },
      created_at: '2026-05-05T00:00:00.000Z',
      finished_at: '2026-05-05T00:01:30.000Z'
    });
  });
});
