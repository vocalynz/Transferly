const { providerInvoiceService } = require('../services/providerInvoiceService');
const { stripeConnectedAccountService } = require('../services/stripeConnectedAccountService');

async function handleStripeInvoiceEvent(event) {
  return providerInvoiceService.processProviderInvoiceEvent({
    provider: 'stripe',
    event,
    eventId: event.id,
    eventType: event.type
  });
}

async function handleCryptoChargeEvent(event) {
  return providerInvoiceService.processProviderInvoiceEvent({
    provider: 'crypto',
    event,
    eventId: event.id,
    eventType: event.type || event.event_type
  });
}

async function handleStripeAccountEvent(event) {
  return stripeConnectedAccountService.syncAccountUpdatedEvent(event);
}

module.exports = {
  providerInvoiceWebhookHandlers: {
    handleStripeInvoiceEvent,
    handleCryptoChargeEvent,
    handleStripeAccountEvent
  }
};
