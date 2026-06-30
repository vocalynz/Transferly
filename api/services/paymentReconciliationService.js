const { invoiceRepository } = require('../repositories/invoiceRepository');
const { payoutRepository } = require('../repositories/payoutRepository');
const { providerInvoiceService } = require('./providerInvoiceService');
const { paypalPayoutService } = require('./paypalPayoutService');
const { providerPayoutService } = require('./providerPayoutService');
const { AUDIT_ACTOR_TYPE, INVOICE_STATUS, PAYOUT_STATUS } = require('../utils/constants');

const RECONCILABLE_INVOICE_STATUSES = new Set([
  INVOICE_STATUS.SENT,
  INVOICE_STATUS.SCHEDULED,
  INVOICE_STATUS.UPDATED
]);

const RECONCILABLE_PAYOUT_STATUSES = new Set([
  PAYOUT_STATUS.QUEUED,
  PAYOUT_STATUS.PROCESSING,
  PAYOUT_STATUS.PENDING
]);

async function reconcileInvoices(limit) {
  const invoices = await invoiceRepository.findMany({ limit });
  const reconciled = [];

  for (const invoice of invoices) {
    if (!RECONCILABLE_INVOICE_STATUSES.has(invoice.status)) {
      continue;
    }

    reconciled.push(
      await providerInvoiceService.refreshInvoice({
        invoiceId: invoice.id,
        actorType: AUDIT_ACTOR_TYPE.SYSTEM,
        actorId: null
      })
    );
  }

  return reconciled;
}

async function reconcilePayouts(limit) {
  const payouts = await payoutRepository.findMany({ limit });
  const reconciled = [];

  for (const payout of payouts) {
    if (!RECONCILABLE_PAYOUT_STATUSES.has(payout.status)) {
      continue;
    }

    reconciled.push(
      String(payout.metadata?.provider || '').toLowerCase() === 'stripe'
        ? await providerPayoutService.processQueuedPayout(payout.id)
        : await paypalPayoutService.refreshPayout({
            payoutId: payout.id,
            actorType: AUDIT_ACTOR_TYPE.SYSTEM,
            actorId: null
          })
    );
  }

  return reconciled;
}

async function runPaymentReconciliation(options = {}) {
  const invoiceLimit = options.invoiceLimit || 25;
  const payoutLimit = options.payoutLimit || 25;

  const [invoices, payouts] = await Promise.all([
    reconcileInvoices(invoiceLimit),
    reconcilePayouts(payoutLimit)
  ]);

  return {
    reconciled_at: new Date().toISOString(),
    invoices,
    payouts,
    summary: {
      invoice_count: invoices.length,
      payout_count: payouts.length
    }
  };
}

module.exports = {
  paymentReconciliationService: {
    runPaymentReconciliation
  },
  RECONCILABLE_INVOICE_STATUSES,
  RECONCILABLE_PAYOUT_STATUSES
};
