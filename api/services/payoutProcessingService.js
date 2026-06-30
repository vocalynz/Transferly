const { payoutRepository } = require('../repositories/payoutRepository');
const { paypalPayoutService } = require('./paypalPayoutService');
const { providerPayoutService } = require('./providerPayoutService');

function isStripePayout(payout) {
  return String(payout?.metadata?.provider || '').toLowerCase() === 'stripe';
}

async function processQueuedPayout(payoutId) {
  const payout = await payoutRepository.findById(payoutId);
  if (isStripePayout(payout)) {
    return providerPayoutService.processQueuedPayout(payoutId);
  }

  return paypalPayoutService.processQueuedPayout(payoutId);
}

function isProviderPendingStatus(status) {
  return paypalPayoutService.isProviderPendingStatus(status) || providerPayoutService.isProviderPendingStatus(status);
}

module.exports = {
  payoutProcessingService: {
    processQueuedPayout,
    isProviderPendingStatus
  }
};
