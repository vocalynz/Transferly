const { Queue, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');

const config = require('../config');

const redisConnection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null
});

const queueNames = Object.freeze({
  invoiceSend: 'invoice-send',
  payoutProcess: 'payout-process',
  webhookProcess: 'webhook-process',
  payoutRetry: 'payout-retry',
  reconciliation: 'payment-reconciliation',
  deadLetter: 'dead-letter'
});

const defaultJobOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 1000
  },
  removeOnComplete: 1000,
  removeOnFail: 5000
};

const invoiceSendQueue = new Queue(queueNames.invoiceSend, {
  connection: redisConnection,
  defaultJobOptions
});

const payoutProcessQueue = new Queue(queueNames.payoutProcess, {
  connection: redisConnection,
  defaultJobOptions
});

const webhookProcessQueue = new Queue(queueNames.webhookProcess, {
  connection: redisConnection,
  defaultJobOptions
});

const payoutRetryQueue = new Queue(queueNames.payoutRetry, {
  connection: redisConnection,
  defaultJobOptions
});

const reconciliationQueue = new Queue(queueNames.reconciliation, {
  connection: redisConnection,
  defaultJobOptions
});

const deadLetterQueue = new Queue(queueNames.deadLetter, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 5000,
    removeOnFail: 5000
  }
});

const invoiceSendQueueEvents = new QueueEvents(queueNames.invoiceSend, {
  connection: redisConnection
});

const payoutProcessQueueEvents = new QueueEvents(queueNames.payoutProcess, {
  connection: redisConnection
});

const reconciliationQueueEvents = new QueueEvents(queueNames.reconciliation, {
  connection: redisConnection
});

module.exports = {
  queueNames,
  invoiceSendQueue,
  payoutProcessQueue,
  webhookProcessQueue,
  payoutRetryQueue,
  reconciliationQueue,
  deadLetterQueue,
  invoiceSendQueueEvents,
  payoutProcessQueueEvents,
  reconciliationQueueEvents,
  redisConnection
};
