const assert = require('node:assert/strict');
const test = require('node:test');

process.env.PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || 'paypal-client-id';
process.env.PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || 'paypal-client-secret';
process.env.PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || 'paypal-webhook-id';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_transferly';
process.env.CRYPTO_COMMERCE_API_KEY = process.env.CRYPTO_COMMERCE_API_KEY || 'crypto-commerce-key';

const { providerCapabilityService } = require('../services/providerCapabilityService');
const { providerReadinessService } = require('../services/providerReadinessService');
const { AppError } = require('../utils/errors');

test('providerCapabilityService lists provider capabilities without exposing secrets', () => {
  const providers = providerCapabilityService.listProviderCapabilities();
  const providerSlugs = providers.map((provider) => provider.slug);

  assert.deepEqual(providerSlugs, ['paypal', 'stripe', 'wise', 'paystack', 'flutterwave', 'crypto']);
  assert.ok(providers.every((provider) => Array.isArray(provider.lanes)));
  assert.equal(providers.find((provider) => provider.slug === 'paypal').operations.invoices.implemented, true);
  assert.equal(providers.find((provider) => provider.slug === 'stripe').operations.balance.implemented, true);

  const serialized = JSON.stringify(providers);
  assert.equal(serialized.includes('paypal-client-secret'), false);
  assert.equal(serialized.includes('sk_test_transferly'), false);
  assert.equal(serialized.includes('crypto-commerce-key'), false);
});

test('providerCapabilityService allows implemented provider operations', () => {
  assert.deepEqual(providerCapabilityService.assertProviderOperation('stripe', 'payouts'), {
    provider: 'stripe',
    operation: 'payouts',
    status: 'live'
  });
  assert.deepEqual(providerCapabilityService.assertProviderOperation('crypto', 'invoices'), {
    provider: 'crypto',
    operation: 'invoices',
    status: 'live'
  });
});

test('providerCapabilityService reports setup and unsupported operations with supported providers', () => {
  assert.throws(
    () => providerCapabilityService.assertProviderOperation('wise', 'payouts'),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 501);
      assert.equal(error.code, 'PROVIDER_OPERATION_NOT_AVAILABLE');
      assert.equal(error.details.provider, 'wise');
      assert.equal(error.details.status, 'setup');
      assert.deepEqual(error.details.supported_providers, ['paypal', 'stripe']);
      return true;
    }
  );

  assert.throws(
    () => providerCapabilityService.assertProviderOperation('crypto', 'payouts'),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 501);
      assert.equal(error.details.status, 'unsupported');
      assert.deepEqual(error.details.supported_providers, ['paypal', 'stripe']);
      return true;
    }
  );
});

test('providerCapabilityService returns provider lane contracts and typed missing-lane errors', () => {
  const lanes = providerCapabilityService.listProviderLanes('paypal');
  assert.ok(lanes.some((lane) => lane.id === 'invoices'));

  const lane = providerCapabilityService.getProviderLaneCapability('paypal', 'invoices');
  assert.equal(lane.id, 'invoices');
  assert.equal(typeof lane.label, 'string');

  assert.throws(
    () => providerCapabilityService.getProviderLaneCapability('paypal', 'missing-lane'),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, 'PROVIDER_LANE_NOT_FOUND');
      assert.equal(error.details.provider, 'paypal');
      assert.ok(error.details.available_lanes.includes('invoices'));
      return true;
    }
  );
});

test('providerReadinessService summarizes provider operations and next steps safely', () => {
  const readiness = providerReadinessService.getProviderReadiness('stripe');

  assert.equal(readiness.provider, 'stripe');
  assert.equal(readiness.display_name, 'Stripe');
  assert.equal(typeof readiness.ready, 'boolean');
  assert.ok(readiness.operations.some((operation) => operation.operation === 'balance'));
  assert.ok(Array.isArray(readiness.lanes));
  assert.ok(Array.isArray(readiness.recommended_next_steps));

  const serialized = JSON.stringify(readiness);
  assert.equal(serialized.includes('sk_test_transferly'), false);
});

test('providerReadinessService lists all provider readiness contracts', () => {
  const readiness = providerReadinessService.listProviderReadiness();

  assert.deepEqual(readiness.map((provider) => provider.provider), ['paypal', 'stripe', 'wise', 'paystack', 'flutterwave', 'crypto']);
  assert.ok(readiness.every((provider) => Array.isArray(provider.operations)));
  assert.ok(readiness.every((provider) => Array.isArray(provider.recommended_next_steps)));
});
