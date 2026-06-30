const { Worker } = require('bullmq');

const { close, initializeDatabase } = require('../db');
const {
  deadLetterQueue,
  payoutRetryQueue,
  queueNames,
  redisConnection
} = require('./queues');
const {
  RETRY_DELAYS_MS,
  createPayoutJobProcessor,
  createWorkerFailureHandler
} = require('./workerHelpers');
const { logger } = require('../utils/logger');
const { providerInvoiceService } = require('../services/providerInvoiceService');
const { paymentReconciliationService } = require('../services/paymentReconciliationService');
const { payoutProcessingService } = require('../services/payoutProcessingService');
const { webhookService } = require('../services/webhookService');

const invoiceWorker = new Worker(
  queueNames.invoiceSend,
  async (job) => providerInvoiceService.createAndSendInvoice(job.data),
  {
    connection: redisConnection,
    concurrency: 2
  }
);

const payoutWorker = new Worker(
  queueNames.payoutProcess,
  createPayoutJobProcessor({
    payoutService: payoutProcessingService,
    retryQueue: payoutRetryQueue,
    retryDelayMs: RETRY_DELAYS_MS.initialPayoutPoll
  }),
  {
    connection: redisConnection,
    concurrency: 2
  }
);

const payoutRetryWorker = new Worker(
  queueNames.payoutRetry,
  createPayoutJobProcessor({
    payoutService: payoutProcessingService,
    retryQueue: payoutRetryQueue,
    retryDelayMs: RETRY_DELAYS_MS.followUpPayoutPoll
  }),
  {
    connection: redisConnection,
    concurrency: 1
  }
);

const webhookWorker = new Worker(
  queueNames.webhookProcess,
  async (job) => webhookService.processWebhookEvent(job.data.webhookEventId),
  {
    connection: redisConnection,
    concurrency: 2
  }
);

const reconciliationWorker = new Worker(
  queueNames.reconciliation,
  async (job) => paymentReconciliationService.runPaymentReconciliation(job.data),
  {
    connection: redisConnection,
    concurrency: 1
  }
);

for (const [queueName, worker] of [
  [queueNames.invoiceSend, invoiceWorker],
  [queueNames.payoutProcess, payoutWorker],
  [queueNames.payoutRetry, payoutRetryWorker],
  [queueNames.webhookProcess, webhookWorker],
  [queueNames.reconciliation, reconciliationWorker]
]) {
  worker.on(
    'failed',
    createWorkerFailureHandler({
      queueName,
      deadLetterQueue
    })
  );
}

async function bootstrap() {
  await initializeDatabase();

  await Promise.all([
    invoiceWorker.waitUntilReady(),
    payoutWorker.waitUntilReady(),
    payoutRetryWorker.waitUntilReady(),
    webhookWorker.waitUntilReady(),
    reconciliationWorker.waitUntilReady()
  ]);

  logger.info('Workers are ready.');
}

async function shutdown() {
  await Promise.all([
    invoiceWorker.close(),
    payoutWorker.close(),
    payoutRetryWorker.close(),
    webhookWorker.close(),
    reconciliationWorker.close()
  ]);
  await redisConnection.quit();
  await close();
  process.exit(0);
}

bootstrap().catch(async (error) => {
  logger.error({ err: error }, 'Worker bootstrap failed');
  try {
    await redisConnection.quit();
    await close();
  } catch (_closeError) {
    // Ignore shutdown noise after bootstrap failures.
  }
  process.exit(1);
});

process.on('SIGINT', () => {
  void shutdown();
});

process.on('SIGTERM', () => {
  void shutdown();
});
