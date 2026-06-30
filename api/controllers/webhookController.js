const { enqueueWebhookProcessing } = require('../jobs/dispatchers');
const {
  cryptoWebhookHeadersSchema,
  paypalWebhookHeadersSchema,
  stripeWebhookHeadersSchema
} = require('../schemas/webhookSchemas');
const { webhookService } = require('../services/webhookService');

async function handlePayPalWebhookController(request, response) {
  const headers = paypalWebhookHeadersSchema.parse(request.headers);
  const event = request.body;

  const result = await webhookService.ingestPayPalEvent(
    {
      authAlgo: headers['paypal-auth-algo'],
      certUrl: headers['paypal-cert-url'],
      transmissionId: headers['paypal-transmission-id'],
      transmissionSig: headers['paypal-transmission-sig'],
      transmissionTime: headers['paypal-transmission-time']
    },
    event
  );

  if (!result.duplicate) {
    await enqueueWebhookProcessing(result.webhookEvent.id, result.webhookEvent.eventId);
  }

  response.status(result.duplicate ? 200 : 202).json({
    received: true,
    duplicate: result.duplicate,
    event_id: result.webhookEvent.eventId
  });
}

async function handleStripeWebhookController(request, response) {
  const headers = stripeWebhookHeadersSchema.parse(request.headers);
  const event = request.body;

  const result = await webhookService.ingestStripeEvent(
    {
      signature: headers['stripe-signature']
    },
    event,
    request.rawBody || JSON.stringify(event)
  );

  if (!result.duplicate) {
    await enqueueWebhookProcessing(result.webhookEvent.id, result.webhookEvent.eventId);
  }

  response.status(result.duplicate ? 200 : 202).json({
    received: true,
    duplicate: result.duplicate,
    event_id: result.webhookEvent.eventId
  });
}

async function handleCryptoWebhookController(request, response) {
  const headers = cryptoWebhookHeadersSchema.parse(request.headers);
  const event = request.body;

  const result = await webhookService.ingestCryptoEvent(
    {
      signature: headers['x-hook0-signature'],
      hookId: headers['x-hook0-id']
    },
    event,
    request.rawBody || JSON.stringify(event),
    request.headers
  );

  if (!result.duplicate) {
    await enqueueWebhookProcessing(result.webhookEvent.id, result.webhookEvent.eventId);
  }

  response.status(result.duplicate ? 200 : 202).json({
    received: true,
    duplicate: result.duplicate,
    event_id: result.webhookEvent.eventId
  });
}

module.exports = {
  handlePayPalWebhookController,
  handleStripeWebhookController,
  handleCryptoWebhookController
};
