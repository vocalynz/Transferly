const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
process.env.SQLITE_DATABASE_PATH = process.env.SQLITE_DATABASE_PATH || './data/payment-provider-registry.sqlite';
process.env.PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || 'paypal-client-id';
process.env.PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || 'paypal-client-secret';
process.env.PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || 'paypal-webhook-id';

const { paymentProviderRegistry } = require('../services/paymentProviderRegistry');
const { AppError } = require('../utils/errors');

describe('paymentProviderRegistry', () => {
  test('lists every registered payment provider without secret values', () => {
    const providers = paymentProviderRegistry.listProviders();
    const keys = providers.map((provider) => provider.key);

    assert.deepEqual(keys, ['paypal', 'stripe', 'wise', 'paystack', 'flutterwave', 'crypto']);

    const serialized = JSON.stringify(providers);
    assert.doesNotMatch(serialized, /paypal-client-secret/);
    assert.doesNotMatch(serialized, /STRIPE_SECRET_KEY=/);
  });

  test('reports PayPal as configured when required environment exists', () => {
    const paypal = paymentProviderRegistry.getProviderStatus('paypal');

    assert.equal(paypal.status, 'configured');
    assert.equal(paypal.capabilities.invoices, true);
    assert.equal(paypal.capabilities.payouts, true);
    assert.deepEqual(paypal.missing_env, []);
  });

  test('reports missing environment for providers that are not configured', () => {
    const stripe = paymentProviderRegistry.getProviderStatus('stripe');

    assert.equal(stripe.status, 'not_configured');
    assert.deepEqual(stripe.missing_env, ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']);
    assert.equal(stripe.capabilities.payouts, true);
  });

  test('exposes provider-specific invoice feature contracts including crypto', () => {
    const features = paymentProviderRegistry.listInvoiceFeatures();
    const byProvider = Object.fromEntries(features.map((entry) => [entry.provider.key, entry]));

    assert.equal(byProvider.paypal.invoice_features.collection_method, 'hosted_invoice');
    assert.equal(byProvider.stripe.invoice_features.provider_resource, 'invoice_or_payment_link');
    assert.equal(byProvider.paystack.invoice_features.provider_resource, 'payment_request');
    assert.equal(byProvider.flutterwave.invoice_features.collection_method, 'hosted_checkout_link');
    assert.equal(byProvider.wise.invoice_features.supported, false);
    assert.equal(byProvider.crypto.invoice_features.crypto_settlement, true);
    assert.equal(byProvider.crypto.invoice_features.collection_method, 'crypto_checkout');
    assert.ok(byProvider.crypto.invoice_features.safeguards.includes('underpayment_detection'));
  });

  test('returns one provider invoice feature contract by key', () => {
    const crypto = paymentProviderRegistry.getProviderInvoiceFeatures('crypto');

    assert.equal(crypto.provider.key, 'crypto');
    assert.equal(crypto.invoice_features.provider_link_field, 'hosted_url');
    assert.ok(crypto.invoice_features.provider_status_events.includes('charge:confirmed'));
  });

  test('throws a typed 404 for unknown providers', () => {
    assert.throws(
      () => paymentProviderRegistry.getProviderStatus('missing-provider'),
      (error) => {
        assert.equal(error instanceof AppError, true);
        assert.equal(error.statusCode, 404);
        assert.equal(error.code, 'PAYMENT_PROVIDER_NOT_FOUND');
        assert.deepEqual(error.details.available_providers, [
          'paypal',
          'stripe',
          'wise',
          'paystack',
          'flutterwave',
          'crypto'
        ]);
        return true;
      }
    );
  });
});
