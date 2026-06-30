const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { StripeClient, encodeFormBody } = require('../adapters/stripeClient');

describe('Stripe client helpers', () => {
  test('encodeFormBody serializes nested metadata and skips empty values', () => {
    const encoded = new URLSearchParams(
      encodeFormBody({
        customer: 'cus_123',
        amount: 12500,
        currency: 'usd',
        description: '',
        metadata: {
          provider: 'stripe',
          request_id: 'req_123'
        },
        discounts: [
          {
            coupon: 'coupon_123'
          }
        ]
      })
    );

    assert.equal(encoded.get('customer'), 'cus_123');
    assert.equal(encoded.get('amount'), '12500');
    assert.equal(encoded.get('currency'), 'usd');
    assert.equal(encoded.get('description'), null);
    assert.equal(encoded.get('metadata[provider]'), 'stripe');
    assert.equal(encoded.get('metadata[request_id]'), 'req_123');
    assert.equal(encoded.get('discounts[0][coupon]'), 'coupon_123');
  });

  test('retrieveBalance can scope requests to a connected account', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url, init = {}) => {
      assert.equal(url, 'https://api.stripe.test/v1/balance');
      assert.equal(init.method, 'GET');
      assert.equal(init.headers.Authorization, 'Bearer sk_test_123');
      assert.equal(init.headers['Stripe-Version'], '2026-02-25.clover');
      assert.equal(init.headers['Stripe-Account'], 'acct_123');
      return new Response(JSON.stringify({
        object: 'balance',
        available: [],
        pending: []
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    };

    try {
      const client = new StripeClient({
        secretKey: 'sk_test_123',
        apiVersion: '2026-02-25.clover',
        baseUrl: 'https://api.stripe.test'
      });
      const balance = await client.retrieveBalance({ stripeAccount: 'acct_123' });
      assert.equal(balance.object, 'balance');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
