const { z } = require('zod');

const paypalWebhookHeadersSchema = z.object({
  'paypal-auth-algo': z.string().min(1),
  'paypal-cert-url': z.string().url(),
  'paypal-transmission-id': z.string().min(1),
  'paypal-transmission-sig': z.string().min(1),
  'paypal-transmission-time': z.string().min(1)
});

const stripeWebhookHeadersSchema = z.object({
  'stripe-signature': z.string().min(1)
});

const cryptoWebhookHeadersSchema = z.object({
  'x-hook0-signature': z.string().min(1),
  'x-hook0-id': z.string().min(1).optional()
});

module.exports = {
  paypalWebhookHeadersSchema,
  stripeWebhookHeadersSchema,
  cryptoWebhookHeadersSchema
};
