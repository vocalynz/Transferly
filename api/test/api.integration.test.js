const { rmSync } = require('node:fs');
const crypto = require('node:crypto');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const { Duplex } = require('node:stream');
const { after, before, beforeEach, describe, test } = require('node:test');

const sqlitePath = path.join(__dirname, '..', 'data', 'api-integration.sqlite');

process.env.NODE_ENV = 'test';
process.env.PORT = '3101';
process.env.SQLITE_DATABASE_PATH = sqlitePath;
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.INLINE_QUEUE_MODE = 'true';
process.env.PAYPAL_CLIENT_ID = 'paypal-client-id';
process.env.PAYPAL_CLIENT_SECRET = 'paypal-client-secret';
process.env.PAYPAL_ENVIRONMENT = 'sandbox';
process.env.PAYPAL_WEBHOOK_ID = 'paypal-webhook-id';
process.env.STRIPE_SECRET_KEY = 'sk_test_transferly';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_transferly';
process.env.STRIPE_API_BASE_URL = 'https://api.stripe.test';
process.env.STRIPE_PAYOUTS_ENABLED = 'true';
process.env.CRYPTO_COMMERCE_API_KEY = 'crypto-commerce-key';
process.env.CRYPTO_COMMERCE_WEBHOOK_SECRET = 'crypto-commerce-webhook-secret';
process.env.CRYPTO_COMMERCE_API_BASE_URL = 'https://api.commerce.coinbase.test';
process.env.TELEGRAM_BOT_TOKEN = '1234567890:test-mini-app-token';
process.env.TELEGRAM_MINI_APP_AUTH_EXPIRES_IN_SECONDS = '3600';
process.env.MAX_SINGLE_PAYOUT = '1000';
process.env.DAILY_PAYOUT_LIMIT = '5000';
process.env.MAX_PAYOUTS_PER_HOUR = '5';
process.env.HIGH_RISK_COUNTRIES = '';
process.env.HIGH_RISK_CURRENCIES = '';
process.env.SUSPICIOUS_INVOICE_KEYWORDS = 'crypto,investment';
process.env.API_RATE_LIMIT_MAX = '500';
process.env.API_RATE_LIMIT_WINDOW_MS = '60000';
process.env.AUTH_RATE_LIMIT_MAX = '500';
process.env.AUTH_RATE_LIMIT_WINDOW_MS = '60000';
process.env.JOB_WAIT_MS = '5000';
process.env.ADMIN_API_TOKEN = 'admin-secret-token';
process.env.ADMIN_API_ACTOR_ID = 'admin-api';
process.env.USER_API_TOKENS = 'demo-user:user-demo-token,secondary-user:user-secondary-token,demo-user:admin-secret-token';
process.env.SEED_USER_ID = 'demo-user';
process.env.SEED_USER_EMAIL = 'demo@flashing.local';
process.env.SEED_USER_NAME = 'Demo User';
process.env.SEED_USER_COUNTRY = 'US';
process.env.SEED_WALLET_CURRENCY = 'USD';
process.env.SEED_PENDING_BALANCE = '0';
process.env.SEED_AVAILABLE_BALANCE = '250000';
process.env.SEED_FROZEN_BALANCE = '0';
process.env.SEED_PAID_OUT_BALANCE = '0';
process.env.SEED_ADMIN_ACTOR_ID = 'admin-demo';

function removeSqliteArtifacts(filePath) {
  rmSync(filePath, { force: true });
  rmSync(`${filePath}-wal`, { force: true });
  rmSync(`${filePath}-shm`, { force: true });
}

removeSqliteArtifacts(sqlitePath);

const { createApp } = require('../app');
const { bootstrapService } = require('../services/bootstrapService');
const { close, db, initializeDatabase, loadSchemaSql } = require('../db');
const { auditLogRepository } = require('../repositories/auditLogRepository');
const { faqRepository } = require('../repositories/faqRepository');
const { invoiceRepository } = require('../repositories/invoiceRepository');
const { invoiceTemplateRepository } = require('../repositories/invoiceTemplateRepository');
const { payoutRepository } = require('../repositories/payoutRepository');
const { paymentOpsIssueRepository } = require('../repositories/paymentOpsIssueRepository');
const { platformConfigRepository } = require('../repositories/platformConfigRepository');
const { profileRepository } = require('../repositories/profileRepository');
const { receiptRepository } = require('../repositories/receiptRepository');
const { telegramRepository } = require('../repositories/telegramRepository');
const { testimonialRepository } = require('../repositories/testimonialRepository');
const { userRepository } = require('../repositories/userRepository');
const { webhookEventRepository } = require('../repositories/webhookEventRepository');
const { opsService } = require('../services/opsService');

const originalFetch = global.fetch;
const originalGetQueueOverview = opsService.getQueueOverview;
const originalListDeadLetterJobs = opsService.listDeadLetterJobs;
const originalRecoverDeadLetterJob = opsService.recoverDeadLetterJob;
let app;
let invoiceSequence = 0;
let stripeInvoiceSequence = 0;
let stripeAccountSequence = 0;
let stripeTransferSequence = 0;
let cryptoChargeSequence = 0;
const sandboxInvoices = new Map();
let payoutSequence = 0;
const sandboxPayouts = new Map();
let sandboxReminderConfigurations = [];
const userTokens = {
  demoUser: 'user-demo-token',
  secondaryUser: 'user-secondary-token'
};
const adminToken = 'admin-secret-token';

function createDefaultReminderConfigurations() {
  return [
    {
      id: 'RC-BEFOREDUE0000001',
      type: 'BEFORE_DUE',
      status: 'ACTIVE',
      interval: {
        unit: 'DAY',
        value: 2
      },
      repetition: 1,
      metadata: {
        created_time: '2026-01-28T03:31:53Z',
        updated_time: '2026-01-28T03:31:53Z'
      },
      notification: {
        send_to_invoicer: false
      },
      links: []
    },
    {
      id: 'RC-AFTERDUE00000002',
      type: 'AFTER_DUE',
      status: 'ACTIVE',
      interval: {
        unit: 'DAY',
        value: 3
      },
      repetition: 2,
      metadata: {
        created_time: '2026-01-28T03:31:53Z',
        updated_time: '2026-01-28T03:31:53Z'
      },
      notification: {
        send_to_invoicer: true
      },
      links: []
    }
  ];
}

function createSandboxPayoutRecord(requestBody) {
  payoutSequence += 1;
  const item = requestBody.items?.[0] || {};
  const receiver = item.receiver || 'receiver@example.com';
  const kind =
    receiver === 'unclaimed@example.com'
      ? 'UNCLAIMED'
      : receiver === 'held@example.com'
        ? 'HELD'
        : 'SUCCESS';

  const batchId =
    kind === 'UNCLAIMED'
      ? 'PAYOUT-BATCH-UNCLAIMED'
      : kind === 'HELD'
        ? 'PAYOUT-BATCH-HELD'
        : 'PAYOUT-BATCH-123';
  const itemId =
    kind === 'UNCLAIMED'
      ? 'PAYOUT-ITEM-UNCLAIMED'
      : kind === 'HELD'
        ? 'PAYOUT-ITEM-HELD'
        : 'PAYOUT-ITEM-123';
  const itemStatus = kind === 'HELD' ? 'ONHOLD' : kind;

  const record = {
    batchId,
    itemId,
    batchStatus: 'SUCCESS',
    itemStatus,
    receiver,
    senderItemId: item.sender_item_id || `payout-test-item-${payoutSequence}`,
    currency: item.amount?.currency || 'USD',
    value: item.amount?.value || '25.00'
  };

  sandboxPayouts.set(batchId, record);
  sandboxPayouts.set(itemId, record);
  return record;
}

function jsonResponse(body, init = {}) {
  const status = init.status || 200;
  const payload = status === 204 || status === 205 || status === 304 ? null : JSON.stringify(body);

  return new Response(payload, {
    status,
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {})
    }
  });
}

function normalizeHeaders(headers = {}) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
}

function createStripeSignature(payload, secret = process.env.STRIPE_WEBHOOK_SECRET) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

function createCoinbaseSignature(payload, headers, secret = process.env.CRYPTO_COMMERCE_WEBHOOK_SECRET) {
  const timestamp = Math.floor(Date.now() / 1000);
  const headerNames = 'content-type x-hook0-id';
  const normalizedHeaders = normalizeHeaders(headers);
  const headerValues = headerNames
    .split(' ')
    .map((name) => normalizedHeaders[name] || '')
    .join('.');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${headerNames}.${headerValues}.${payload}`, 'utf8')
    .digest('hex');
  return `t=${timestamp},h=${headerNames},v1=${signature}`;
}

function installFetchStub() {
  global.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const headers = normalizeHeaders(init.headers || {});

    if (url.hostname === 'api.stripe.test') {
      assert.equal(headers.authorization, 'Bearer sk_test_transferly');
      assert.equal(headers['stripe-version'], '2026-02-25.clover');
      if ((init.method || 'GET') !== 'GET' && url.pathname !== '/v1/account_links') {
        assert.ok(headers['idempotency-key']);
      }

      if (url.pathname === '/v1/balance' && (init.method || 'GET') === 'GET') {
        return jsonResponse({
          object: 'balance',
          livemode: false,
          available: [
            {
              amount: 125000,
              currency: 'usd',
              source_types: {
                card: 125000
              }
            }
          ],
          pending: [
            {
              amount: 25000,
              currency: 'usd',
              source_types: {
                card: 25000
              }
            }
          ],
          instant_available: []
        });
      }

      if (url.pathname === '/v1/accounts' && init.method === 'POST') {
        const body = new URLSearchParams(init.body);
        stripeAccountSequence += 1;
        assert.equal(body.get('country'), 'US');
        assert.equal(body.get('email'), 'recipient@example.com');
        assert.equal(body.get('capabilities[transfers][requested]'), 'true');
        return jsonResponse({
          id: `acct_connected_${String(stripeAccountSequence).padStart(3, '0')}`,
          object: 'account',
          business_type: body.get('business_type') || 'individual',
          charges_enabled: false,
          country: body.get('country'),
          details_submitted: false,
          email: body.get('email'),
          livemode: false,
          payouts_enabled: false,
          requirements: {
            currently_due: ['individual.first_name'],
            past_due: [],
            disabled_reason: null
          },
          capabilities: {
            transfers: 'pending'
          }
        });
      }

      if (url.pathname.startsWith('/v1/accounts/acct_connected_') && init.method === 'GET') {
        const accountId = url.pathname.split('/').pop();
        return jsonResponse({
          id: accountId,
          object: 'account',
          business_type: 'individual',
          charges_enabled: true,
          country: 'US',
          details_submitted: true,
          email: 'recipient@example.com',
          livemode: false,
          payouts_enabled: true,
          requirements: {
            currently_due: [],
            past_due: [],
            disabled_reason: null
          },
          capabilities: {
            transfers: 'active'
          }
        });
      }

      if (url.pathname === '/v1/account_links' && init.method === 'POST') {
        const body = new URLSearchParams(init.body);
        assert.ok(body.get('account').startsWith('acct_connected_'));
        assert.equal(body.get('type'), 'account_onboarding');
        assert.ok(body.get('return_url').startsWith('http'));
        assert.ok(body.get('refresh_url').startsWith('http'));
        return jsonResponse({
          object: 'account_link',
          created: 1773350400,
          expires_at: 1773354000,
          url: `https://connect.stripe.test/setup/${body.get('account')}`
        });
      }

      if (url.pathname === '/v1/transfers' && init.method === 'POST') {
        const body = new URLSearchParams(init.body);
        stripeTransferSequence += 1;
        assert.equal(body.get('amount'), '3500');
        assert.equal(body.get('currency'), 'usd');
        assert.equal(body.get('destination'), 'acct_connected_001');
        assert.equal(body.get('metadata[transferly_user_id]'), 'demo-user');
        return jsonResponse({
          id: `tr_transferly_${stripeTransferSequence}`,
          object: 'transfer',
          amount: Number(body.get('amount')),
          amount_reversed: 0,
          currency: body.get('currency'),
          destination: body.get('destination'),
          destination_payment: `py_transferly_${stripeTransferSequence}`,
          livemode: false,
          metadata: {
            transferly_payout_id: body.get('metadata[transferly_payout_id]'),
            transferly_user_id: body.get('metadata[transferly_user_id]')
          },
          reversed: false,
          transfer_group: body.get('transfer_group')
        });
      }

      if (url.pathname.startsWith('/v1/transfers/tr_transferly_') && init.method === 'GET') {
        const transferId = url.pathname.split('/').pop();
        return jsonResponse({
          id: transferId,
          object: 'transfer',
          amount: 3500,
          amount_reversed: 0,
          currency: 'usd',
          destination: 'acct_connected_001',
          destination_payment: 'py_transferly_1',
          livemode: false,
          metadata: {},
          reversed: false
        });
      }

      if (url.pathname === '/v1/customers' && init.method === 'POST') {
        const body = new URLSearchParams(init.body);
        assert.equal(body.get('email'), 'buyer@example.com');
        return jsonResponse({ id: 'cus_transferly_001', object: 'customer' });
      }

      if (url.pathname === '/v1/invoiceitems' && init.method === 'POST') {
        const body = new URLSearchParams(init.body);
        assert.equal(body.get('customer'), 'cus_transferly_001');
        assert.equal(body.get('amount'), '12500');
        assert.equal(body.get('currency'), 'usd');
        return jsonResponse({ id: 'ii_transferly_001', object: 'invoiceitem' });
      }

      if (url.pathname === '/v1/invoices' && init.method === 'POST') {
        const body = new URLSearchParams(init.body);
        stripeInvoiceSequence += 1;
        assert.equal(body.get('customer'), 'cus_transferly_001');
        assert.equal(body.get('collection_method'), 'send_invoice');
        assert.ok(Number(body.get('days_until_due')) >= 1);
        return jsonResponse({ id: `in_transferly_${stripeInvoiceSequence}`, object: 'invoice', status: 'draft' });
      }

      if (url.pathname.startsWith('/v1/invoices/in_transferly_') && url.pathname.endsWith('/finalize') && init.method === 'POST') {
        const invoiceId = url.pathname.split('/')[3];
        return jsonResponse({
          id: invoiceId,
          object: 'invoice',
          number: 'ST-0001',
          status: 'open',
          hosted_invoice_url: `https://invoice.stripe.test/${invoiceId}`,
          invoice_pdf: `https://invoice.stripe.test/${invoiceId}.pdf`
        });
      }

      if (url.pathname.startsWith('/v1/invoices/in_transferly_') && url.pathname.endsWith('/send') && init.method === 'POST') {
        const invoiceId = url.pathname.split('/')[3];
        return jsonResponse({
          id: invoiceId,
          object: 'invoice',
          number: 'ST-0001',
          status: 'open',
          hosted_invoice_url: `https://invoice.stripe.test/${invoiceId}`,
          invoice_pdf: `https://invoice.stripe.test/${invoiceId}.pdf`
        });
      }

      if (url.pathname.startsWith('/v1/invoices/in_transferly_') && url.pathname.endsWith('/void') && init.method === 'POST') {
        const invoiceId = url.pathname.split('/')[3];
        return jsonResponse({
          id: invoiceId,
          object: 'invoice',
          number: 'ST-0001',
          status: 'void',
          hosted_invoice_url: `https://invoice.stripe.test/${invoiceId}`,
          invoice_pdf: `https://invoice.stripe.test/${invoiceId}.pdf`
        });
      }

      if (url.pathname.startsWith('/v1/invoices/in_transferly_') && init.method === 'GET') {
        const invoiceId = url.pathname.split('/').pop();
        return jsonResponse({
          id: invoiceId,
          object: 'invoice',
          number: 'ST-0001',
          status: 'paid',
          hosted_invoice_url: `https://invoice.stripe.test/${invoiceId}`,
          invoice_pdf: `https://invoice.stripe.test/${invoiceId}.pdf`,
          status_transitions: {
            paid_at: 1773350400
          }
        });
      }

      throw new Error(`Unhandled Stripe fetch stub for ${init.method || 'GET'} ${url.toString()}`);
    }

    if (url.hostname === 'api.commerce.coinbase.test') {
      assert.equal(headers['x-cc-api-key'], 'crypto-commerce-key');

      if (url.pathname === '/charges' && init.method === 'POST') {
        const body = init.body ? JSON.parse(init.body) : {};
        cryptoChargeSequence += 1;
        assert.equal(body.pricing_type, 'fixed_price');
        assert.equal(body.local_price.amount, '125.00');
        assert.equal(body.local_price.currency, 'USD');
        return jsonResponse({
          data: {
            id: `charge-transferly-${cryptoChargeSequence}`,
            code: `CHARGE${cryptoChargeSequence}`,
            hosted_url: `https://commerce.coinbase.test/charges/CHARGE${cryptoChargeSequence}`,
            timeline: [{ status: 'NEW' }]
          }
        });
      }

      if (url.pathname.startsWith('/charges/') && init.method === 'GET') {
        const chargeId = url.pathname.split('/').pop();
        return jsonResponse({
          data: {
            id: chargeId,
            code: chargeId.startsWith('CHARGE') ? chargeId : 'CHARGE1',
            hosted_url: 'https://commerce.coinbase.test/charges/CHARGE1',
            timeline: [{ status: 'NEW' }, { status: 'CONFIRMED' }]
          }
        });
      }

      throw new Error(`Unhandled Coinbase Commerce fetch stub for ${init.method || 'GET'} ${url.toString()}`);
    }

    if (url.hostname !== 'api-m.sandbox.paypal.com') {
      return originalFetch(input, init);
    }

    const pathname = url.pathname;

    if (pathname === '/v1/oauth2/token' && init.method === 'POST') {
      return jsonResponse({ access_token: 'sandbox-token', expires_in: 3600 });
    }

    if (pathname === '/v2/invoicing/invoices' && init.method === 'POST') {
      const requestBody = init.body ? JSON.parse(init.body) : {};
      invoiceSequence += 1;
      const invoiceId = `PP-INV-${String(invoiceSequence).padStart(3, '0')}`;
      const invoiceNumber = `INV-TEST-${String(invoiceSequence).padStart(3, '0')}`;
      const invoiceDate = requestBody.detail?.invoice_date || new Date().toISOString().slice(0, 10);
      const remoteInvoice = {
        id: invoiceId,
        status: 'DRAFT',
        detail: {
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          payment_term: requestBody.detail?.payment_term || undefined,
          note: requestBody.detail?.note || undefined,
          memo: requestBody.detail?.memo || undefined,
          metadata: {
            recipient_view_url: `https://www.sandbox.paypal.com/invoice/p/#${invoiceId}`
          }
        },
        items: requestBody.items || []
      };

      sandboxInvoices.set(invoiceId, remoteInvoice);
      return jsonResponse({ id: invoiceId, status: 'DRAFT' }, { status: 201 });
    }

    if (pathname.startsWith('/v2/invoicing/invoices/') && pathname.endsWith('/send') && init.method === 'POST') {
      const invoiceId = pathname.split('/')[4];
      const remoteInvoice = sandboxInvoices.get(invoiceId);
      if (!remoteInvoice) {
        throw new Error(`Unhandled PayPal invoice send for ${invoiceId}`);
      }

      remoteInvoice.status =
        remoteInvoice.detail?.invoice_date > new Date().toISOString().slice(0, 10) ? 'SCHEDULED' : 'SENT';
      return jsonResponse({}, { status: 202 });
    }

    if (pathname.startsWith('/v2/invoicing/invoices/') && pathname.endsWith('/remind') && init.method === 'POST') {
      return jsonResponse({ status: 'REMINDER_SENT' }, { status: 202 });
    }

    if (pathname.startsWith('/v2/invoicing/invoices/') && pathname.endsWith('/cancel-reminders') && init.method === 'POST') {
      return jsonResponse({}, { status: 204 });
    }

    if (pathname.startsWith('/v2/invoicing/invoices/') && pathname.endsWith('/cancel') && init.method === 'POST') {
      const invoiceId = pathname.split('/')[4];
      const remoteInvoice = sandboxInvoices.get(invoiceId);
      if (!remoteInvoice) {
        throw new Error(`Unhandled PayPal invoice cancel for ${invoiceId}`);
      }

      remoteInvoice.status = 'CANCELLED';
      return jsonResponse({}, { status: 202 });
    }

    if (pathname.startsWith('/v2/invoicing/invoices/') && pathname.endsWith('/generate-qr-code') && init.method === 'POST') {
      const invoiceId = pathname.split('/')[4];
      return jsonResponse({
        image_url_png: `https://www.sandbox.paypal.com/qr/${invoiceId}.png`,
        image_url_svg: `https://www.sandbox.paypal.com/qr/${invoiceId}.svg`
      });
    }

    if (pathname.startsWith('/v2/invoicing/invoices/') && init.method === 'GET') {
      const invoiceId = pathname.split('/').pop();
      const remoteInvoice = sandboxInvoices.get(invoiceId);

      if (!remoteInvoice) {
        throw new Error(`Unhandled PayPal invoice lookup for ${invoiceId}`);
      }

      return jsonResponse(remoteInvoice);
    }

    if (pathname === '/v2/invoicing/reminders' && init.method === 'GET') {
      const type = url.searchParams.get('type');
      const configurations = type
        ? sandboxReminderConfigurations.filter((configuration) => configuration.type === type)
        : sandboxReminderConfigurations;

      return jsonResponse({
        configurations
      });
    }

    if (pathname.startsWith('/v2/invoicing/reminders/') && init.method === 'GET') {
      const configurationId = pathname.split('/').pop();
      const configuration = sandboxReminderConfigurations.find((entry) => entry.id === configurationId);
      if (!configuration) {
        throw new Error(`Unhandled PayPal reminder configuration lookup for ${configurationId}`);
      }

      return jsonResponse(configuration);
    }

    if (pathname.startsWith('/v2/invoicing/reminders/') && init.method === 'PUT') {
      const configurationId = pathname.split('/').pop();
      const requestBody = init.body ? JSON.parse(init.body) : {};
      sandboxReminderConfigurations = sandboxReminderConfigurations.map((configuration) =>
        configuration.id === configurationId
          ? {
              ...configuration,
              type: requestBody.type,
              interval: requestBody.interval,
              repetition: requestBody.repetition,
              notification: requestBody.notification || {},
              metadata: {
                ...configuration.metadata,
                updated_time: '2026-05-08T01:00:00Z'
              }
            }
          : configuration
      );

      return jsonResponse({}, { status: 204 });
    }

    if (pathname.startsWith('/v2/invoicing/reminders/') && pathname.endsWith('/suspend') && init.method === 'POST') {
      const configurationId = pathname.split('/')[4];
      sandboxReminderConfigurations = sandboxReminderConfigurations.map((configuration) =>
        configuration.id === configurationId
          ? {
              ...configuration,
              status: 'INACTIVE',
              metadata: {
                ...configuration.metadata,
                updated_time: '2026-05-08T01:05:00Z'
              }
            }
          : configuration
      );

      return jsonResponse({}, { status: 204 });
    }

    if (pathname.startsWith('/v2/invoicing/reminders/') && pathname.endsWith('/resume') && init.method === 'POST') {
      const configurationId = pathname.split('/')[4];
      sandboxReminderConfigurations = sandboxReminderConfigurations.map((configuration) =>
        configuration.id === configurationId
          ? {
              ...configuration,
              status: 'ACTIVE',
              metadata: {
                ...configuration.metadata,
                updated_time: '2026-05-08T01:10:00Z'
              }
            }
          : configuration
      );

      return jsonResponse({}, { status: 204 });
    }

    if (pathname === '/v1/notifications/verify-webhook-signature' && init.method === 'POST') {
      return jsonResponse({ verification_status: 'SUCCESS' });
    }

    if (pathname === '/v1/payments/payouts' && init.method === 'POST') {
      const requestBody = init.body ? JSON.parse(init.body) : {};
      const record = createSandboxPayoutRecord(requestBody);
      return jsonResponse(
        {
          batch_header: {
            payout_batch_id: record.batchId,
            batch_status: 'PENDING'
          }
        },
        { status: 201 }
      );
    }

    if (pathname.startsWith('/v1/payments/payouts/') && init.method === 'GET') {
      const batchId = pathname.split('/').pop();
      const record = sandboxPayouts.get(batchId);
      if (!record) {
        throw new Error(`Unhandled PayPal payout batch lookup for ${batchId}`);
      }

      return jsonResponse({
        batch_header: {
          payout_batch_id: record.batchId,
          batch_status: record.batchStatus
        },
        items: [
          {
            payout_item_id: record.itemId,
            transaction_status: record.itemStatus
          }
        ]
      });
    }

    if (pathname.startsWith('/v1/payments/payouts-item/') && pathname.endsWith('/cancel') && init.method === 'POST') {
      const payoutItemId = pathname.split('/')[4];
      const record = sandboxPayouts.get(payoutItemId);
      if (!record) {
        throw new Error(`Unhandled PayPal payout item cancel for ${payoutItemId}`);
      }

      record.itemStatus = 'RETURNED';
      sandboxPayouts.set(record.batchId, record);
      sandboxPayouts.set(record.itemId, record);
      return jsonResponse({}, { status: 201 });
    }

    if (pathname.startsWith('/v1/payments/payouts-item/') && init.method === 'GET') {
      const payoutItemId = pathname.split('/').pop();
      const record = sandboxPayouts.get(payoutItemId);
      if (!record) {
        throw new Error(`Unhandled PayPal payout item lookup for ${payoutItemId}`);
      }

      return jsonResponse({
        payout_item_id: record.itemId,
        transaction_status: record.itemStatus,
        errors: record.itemStatus === 'ONHOLD' ? { name: 'REGULATORY_PENDING' } : undefined,
        payout_item: {
          sender_item_id: record.senderItemId
        }
      });
    }

    throw new Error(`Unhandled fetch stub for ${init.method || 'GET'} ${url.toString()}`);
  };
}

function createMockSocket() {
  const socket = new Duplex({
    read() {},
    write(_chunk, _encoding, callback) {
      callback();
    },
    writev(_items, callback) {
      callback();
    }
  });
  const realDestroy = socket.destroy.bind(socket);

  socket.remoteAddress = '127.0.0.1';
  socket.writable = true;
  socket.readable = true;
  socket.destroy = (error) => {
    if (error) {
      return realDestroy(error);
    }

    return socket;
  };
  socket.destroySoon = socket.destroy.bind(socket);
  socket.forceDestroy = realDestroy;

  return socket;
}

async function injectRequest(targetApp, { method = 'GET', url = '/', headers = {}, body } = {}) {
  const bodyChunks = [];
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );

  const socket = createMockSocket();
  const request = new http.IncomingMessage(socket);
  request.method = method;
  request.url = url;
  request.headers = normalizedHeaders;
  request.connection = socket;
  request.socket = socket;
  request.httpVersion = '1.1';
  request.httpVersionMajor = 1;
  request.httpVersionMinor = 1;

  if (body) {
    request.push(Buffer.from(body));
  }

  request.push(null);

  const response = new http.ServerResponse(request);
  response.assignSocket(socket);

  const done = new Promise((resolve, reject) => {
    const originalWrite = response.write.bind(response);
    response.write = (chunk, encoding, callback) => {
      if (chunk) {
        bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      }

      return originalWrite(chunk, encoding, callback);
    };

    const originalEnd = response.end.bind(response);
    response.end = (chunk, encoding, callback) => {
      if (chunk) {
        bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      }

      const result = originalEnd(chunk, encoding, callback);

      setImmediate(() => {
        const payload = Buffer.concat(bodyChunks).toString('utf8');
        socket.forceDestroy();

        resolve({
          status: response.statusCode,
          headers: response.getHeaders(),
          bodyText: payload,
          json() {
            return payload ? JSON.parse(payload) : null;
          }
        });
      });

      return result;
    };

    response.on('error', reject);
  });

  targetApp.handle(request, response, (error) => {
    if (error) {
      response.destroy(error);
    }
  });

  return done;
}

function jsonHeaders(payload, headers = {}) {
  return {
    'content-type': 'application/json',
    'content-length': String(Buffer.byteLength(payload)),
    ...headers
  };
}

function bearerHeaders(token, headers = {}) {
  return {
    authorization: `Bearer ${token}`,
    ...headers
  };
}

function createTelegramMiniAppInitData({ botToken = process.env.TELEGRAM_BOT_TOKEN, user, authDate, startParam }) {
  const params = new URLSearchParams();
  params.set('auth_date', String(authDate || Math.floor(Date.now() / 1000)));
  params.set('user', JSON.stringify(user));
  if (startParam) {
    params.set('start_param', startParam);
  }

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  params.set('hash', hash);

  return params.toString();
}

function decodeDataUrl(dataUrl, prefix) {
  assert.ok(dataUrl.startsWith(prefix), `Expected data URL prefix ${prefix}`);
  return Buffer.from(dataUrl.slice(prefix.length), 'base64').toString('utf8');
}

function assertReceiptArtifactsInclude(result, expectedText) {
  const svg = decodeDataUrl(result.image_data_url, 'data:image/svg+xml;base64,');
  const pdf = decodeDataUrl(result.pdf_data_url, 'data:application/pdf;base64,');

  assert.ok(svg.includes(expectedText), `Expected SVG receipt artifact to include "${expectedText}"`);
  assert.ok(pdf.includes(expectedText), `Expected PDF receipt artifact to include "${expectedText}"`);
}

function assertReceiptLayout(result, providerName, category) {
  const notice = `Transferly generated record. Not an official ${providerName} receipt.`;

  assert.equal(result.receipt.data.layout.provider_name, providerName);
  assert.equal(result.receipt.data.layout.category, category);
  assert.equal(result.receipt.data.layout.notice, notice);
  assertReceiptArtifactsInclude(result, providerName);
  assertReceiptArtifactsInclude(result, category);
  assertReceiptArtifactsInclude(result, notice);
}

async function resetDatabase() {
  await db.exec(`
    DELETE FROM telegram_command_logs;
    DELETE FROM telegram_accounts;
    DELETE FROM risk_flags;
    DELETE FROM payment_ops_issues;
    DELETE FROM ledger_entries;
    DELETE FROM email_dispatches;
    DELETE FROM referral_events;
    DELETE FROM top_up_orders;
    DELETE FROM points_transactions;
    DELETE FROM receipts;
    DELETE FROM payouts;
    DELETE FROM payout_batches;
    DELETE FROM stripe_connected_accounts;
    DELETE FROM invoices;
    DELETE FROM audit_logs;
    DELETE FROM webhook_events;
    DELETE FROM testimonials;
    DELETE FROM faqs;
    DELETE FROM platform_config;
    DELETE FROM wallets;
    DELETE FROM users;
  `);
}

before(async () => {
  installFetchStub();
  await initializeDatabase();
  await db.exec(loadSchemaSql());

  app = createApp();
});

beforeEach(async () => {
  opsService.getQueueOverview = originalGetQueueOverview;
  opsService.listDeadLetterJobs = originalListDeadLetterJobs;
  opsService.recoverDeadLetterJob = originalRecoverDeadLetterJob;
  await resetDatabase();
  invoiceSequence = 0;
  stripeInvoiceSequence = 0;
  stripeAccountSequence = 0;
  stripeTransferSequence = 0;
  cryptoChargeSequence = 0;
  sandboxInvoices.clear();
  payoutSequence = 0;
  sandboxPayouts.clear();
  sandboxReminderConfigurations = createDefaultReminderConfigurations();
  await bootstrapService.ensureDemoAccount();
  await bootstrapService.ensureDemoAccount({
    userId: 'secondary-user',
    email: 'secondary@flashing.local',
    displayName: 'Secondary User',
    availableBalanceCents: 125000,
    adminActorId: 'admin-demo'
  });
});

after(async () => {
  global.fetch = originalFetch;
  opsService.getQueueOverview = originalGetQueueOverview;
  opsService.listDeadLetterJobs = originalListDeadLetterJobs;
  opsService.recoverDeadLetterJob = originalRecoverDeadLetterJob;
  await close();
  removeSqliteArtifacts(sqlitePath);
});

describe('API integration flows', () => {
  test('user routes require bearer auth when USER_API_TOKENS are configured', async () => {
    const payload = JSON.stringify({
      userId: 'demo-user',
      recipientEmail: 'buyer@example.com',
      currency: 'USD',
      description: 'Consulting retainer',
      items: [
        {
          name: 'Consulting',
          description: 'April retainer',
          quantity: 1,
          unitAmount: 125
        }
      ]
    });

    const response = await injectRequest(app, {
      method: 'POST',
      url: '/api/invoices',
      headers: jsonHeaders(payload),
      body: payload
    });

    assert.equal(response.status, 401);
    const body = response.json();
    assert.equal(body.code, 'USER_AUTH_REQUIRED');
  });

  test('GET /api/bootstrap exposes public platform, FAQ, and testimonial content', async () => {
    const response = await injectRequest(app, {
      method: 'GET',
      url: '/api/bootstrap'
    });

    assert.equal(response.status, 200);
    const body = response.json();
    assert.equal(body.platform.platform_name, 'Transferly');
    assert.ok(Array.isArray(body.faqs));
    assert.ok(Array.isArray(body.testimonials));
  });

  test('GET /api/me requires a user identity and returns the current user snapshot', async () => {
    const unauthorizedResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/me'
    });

    assert.equal(unauthorizedResponse.status, 401);
    assert.equal(unauthorizedResponse.json().code, 'USER_AUTH_REQUIRED');

    const receiptPayload = JSON.stringify({
      type: 'bank',
      title: 'My first receipt',
      details: {
        merchant: 'SlipCraft Store',
        amount: '$19.99'
      }
    });

    const receiptResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/receipt/generate',
      headers: jsonHeaders(receiptPayload, bearerHeaders(userTokens.demoUser)),
      body: receiptPayload
    });

    assert.equal(receiptResponse.status, 201);

    await invoiceRepository.create({
      userId: 'demo-user',
      paypalInvoiceId: 'paypal-invoice-bootstrap-1',
      invoiceNumber: 'INV-BOOTSTRAP-1',
      status: 'PAID',
      amountCents: 199900,
      currencyCode: 'USD',
      recipientEmail: 'finance@example.test',
      description: 'Bootstrap invoice',
      invoiceUrl: 'https://www.paypal.com/invoice/p/#bootstrap',
      paypalDetails: { id: 'paypal-invoice-bootstrap-1' },
      metadata: { provider: 'paypal' },
      paidAt: new Date().toISOString()
    });

    await payoutRepository.create({
      userId: 'demo-user',
      idempotencyKey: 'bootstrap-payout-idempotency',
      senderBatchId: 'bootstrap-payout-batch',
      status: 'PENDING_APPROVAL',
      riskDecision: 'review',
      recipientType: 'EMAIL',
      receiver: 'operator@example.test',
      amountCents: 55000,
      currencyCode: 'USD',
      note: 'Bootstrap payout',
      metadata: { provider: 'paypal' }
    });

    const response = await injectRequest(app, {
      method: 'GET',
      url: '/api/me',
      headers: bearerHeaders(userTokens.demoUser)
    });

    assert.equal(response.status, 200);
    const body = response.json();
    assert.equal(body.user.id, 'demo-user');
    assert.equal(body.points.user_id, 'demo-user');
    assert.equal(body.points.receipt_count, 1);
    assert.equal(body.receipts.length, 1);
    assert.equal(body.referrals.user_id, 'demo-user');
    assert.ok(Array.isArray(body.topUpOrders));
    assert.equal(body.invoices.data.length, 1);
    assert.equal(body.invoices.data[0].summary.amount, '1999.00');
    assert.equal(body.invoices.data[0].summary.recipient_email, 'finance@example.test');
    assert.equal(body.payouts.data.length, 1);
    assert.equal(body.payouts.data[0].summary.amount, '550.00');
    assert.equal(body.payouts.data[0].summary.receiver, 'operator@example.test');
    assert.equal(body.financeSummary.invoice_count, 1);
    assert.equal(body.financeSummary.payout_count, 1);
    assert.equal(body.financeSummary.collected_cents, 199900);
    assert.equal(body.financeSummary.pending_payout_cents, 55000);

    const adminSessionResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/me',
      headers: bearerHeaders(adminToken)
    });

    assert.equal(adminSessionResponse.status, 200);
    assert.equal(adminSessionResponse.json().user.id, 'demo-user');
  });

  test('GET /api/services/:slug/command-center requires user auth and returns service lane metrics', async () => {
    const unauthorizedResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/services/opay/command-center'
    });

    assert.equal(unauthorizedResponse.status, 401);
    assert.equal(unauthorizedResponse.json().code, 'USER_AUTH_REQUIRED');

    await receiptRepository.create({
      userId: 'demo-user',
      type: 'bank',
      status: 'generated',
      title: 'Opay wallet record',
      summary: { text: 'Opay wallet record ready' },
      data: { details: { service: 'opay', amount: '100.00' } },
      pdfBase64: '',
      imageDataUrl: 'data:image/png;base64,test',
      costPoints: 10
    });

    await receiptRepository.create({
      userId: 'demo-user',
      type: 'email',
      status: 'generated',
      title: 'Binance notice',
      summary: { text: 'Binance notification ready' },
      data: { details: { service: 'binance' } },
      pdfBase64: '',
      imageDataUrl: 'data:image/png;base64,test',
      costPoints: 10
    });

    const response = await injectRequest(app, {
      method: 'GET',
      url: '/api/services/opay/command-center',
      headers: bearerHeaders(userTokens.demoUser)
    });

    assert.equal(response.status, 200);
    const body = response.json();
    assert.equal(body.service.slug, 'opay');
    assert.equal(body.service.payment_provider, false);
    assert.equal(body.activity.service_receipt_count, 1);
    assert.equal(body.activity.compatible_receipt_count, 1);
    assert.equal(body.wallet.available_balance_cents, 250000);
    assert.ok(body.command_center.live_metrics.some((metric) => metric.id === 'wallet'));
    const walletLane = body.command_center.lanes.find((lane) => lane.id === 'wallet-record');
    assert.ok(walletLane);
    assert.ok(walletLane.live_metrics.length >= 1);

    const laneResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/services/opay/lanes/wallet-record',
      headers: bearerHeaders(userTokens.demoUser)
    });

    assert.equal(laneResponse.status, 200);
    const laneBody = laneResponse.json();
    assert.equal(laneBody.service.slug, 'opay');
    assert.equal(laneBody.lane.id, 'wallet-record');
    assert.equal(laneBody.action.kind, 'generate');
    assert.equal(laneBody.action.route, '/dashboard/generate?type=bank&service=opay');
    assert.equal(laneBody.prefill.receipt_type, 'bank');
    assert.equal(laneBody.prefill.service_slug, 'opay');
    assert.ok(laneBody.readiness.some((check) => check.id === 'points' && check.status === 'ready'));
    assert.equal(laneBody.activity.service_receipt_count, 1);
    assert.equal(laneBody.activity.recent_receipts[0].title, 'Opay wallet record');
    assert.ok(Number(laneBody.support_context.points_available) > 0);

    const actionPayload = JSON.stringify({
      source: 'miniapp',
      intent: 'launch',
      metadata: { entry: 'lane-detail' }
    });
    const actionResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/services/opay/lanes/wallet-record/actions',
      headers: jsonHeaders(actionPayload, bearerHeaders(userTokens.demoUser)),
      body: actionPayload
    });

    assert.equal(actionResponse.status, 201);
    const actionBody = actionResponse.json();
    assert.equal(actionBody.action_intent.status, 'recorded');
    assert.equal(actionBody.action_intent.service_slug, 'opay');
    assert.equal(actionBody.action_intent.lane_id, 'wallet-record');
    assert.equal(actionBody.action_intent.intent, 'launch');
    assert.equal(actionBody.action_intent.source, 'miniapp');
    assert.equal(actionBody.action_intent.action.kind, 'generate');
    assert.equal(actionBody.action_intent.action.route, '/dashboard/generate?type=bank&service=opay');
    assert.equal(actionBody.action_intent.prefill.service_slug, 'opay');
    assert.equal(actionBody.action_intent.audit.entity_type, 'service_lane');

    const auditEntries = await auditLogRepository.findManyForEntity('service_lane', 'opay:wallet-record');
    assert.ok(
      auditEntries.some(
        (entry) =>
          entry.action === 'service_lane.action_intent_recorded' &&
          entry.actorId === 'demo-user' &&
          entry.metadata.action_intent_id === actionBody.action_intent.id &&
          entry.metadata.source === 'miniapp' &&
          entry.metadata.metadata.entry === 'lane-detail'
      )
    );

    const missingLaneResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/services/opay/lanes/not-real',
      headers: bearerHeaders(userTokens.demoUser)
    });

    assert.equal(missingLaneResponse.status, 404);
    assert.equal(missingLaneResponse.json().code, 'SERVICE_LANE_NOT_FOUND');

    const missingResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/services/missing-service/command-center',
      headers: bearerHeaders(userTokens.demoUser)
    });

    assert.equal(missingResponse.status, 404);
    assert.equal(missingResponse.json().code, 'SERVICE_NOT_FOUND');
  });

  test('top-up order endpoints persist user funding orders and require admin completion for point credit', async () => {
    const createPayload = JSON.stringify({
      points: 250,
      amountLabel: '250 pts',
      methodId: 'bank-transfer',
      methodTitle: 'Bank Transfer (P2P)',
      serviceIntent: 'paypal',
      instructions: 'Send proof to support',
      vendorUrl: 'https://t.me/example'
    });

    const createResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/user/me/top-up-orders',
      headers: jsonHeaders(createPayload, bearerHeaders(userTokens.demoUser)),
      body: createPayload
    });

    assert.equal(createResponse.status, 201);
    const createdOrder = createResponse.json().order;
    assert.equal(createdOrder.user_id, 'demo-user');
    assert.equal(createdOrder.status, 'pending');
    assert.equal(createdOrder.points, 250);

    const submitPayload = JSON.stringify({ status: 'awaiting_confirmation' });
    const submitResponse = await injectRequest(app, {
      method: 'PATCH',
      url: `/api/user/me/top-up-orders/${createdOrder.order_id}/status`,
      headers: jsonHeaders(submitPayload, bearerHeaders(userTokens.demoUser)),
      body: submitPayload
    });

    assert.equal(submitResponse.status, 200);
    assert.equal(submitResponse.json().order.status, 'awaiting_confirmation');

    const userCompletePayload = JSON.stringify({ status: 'completed' });
    const userCompleteResponse = await injectRequest(app, {
      method: 'PATCH',
      url: `/api/user/me/top-up-orders/${createdOrder.order_id}/status`,
      headers: jsonHeaders(userCompletePayload, bearerHeaders(userTokens.demoUser)),
      body: userCompletePayload
    });

    assert.equal(userCompleteResponse.status, 400);

    const adminListResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/admin/top-up-orders?status=awaiting_confirmation',
      headers: bearerHeaders(adminToken)
    });

    assert.equal(adminListResponse.status, 200);
    assert.equal(adminListResponse.json().data.length, 1);

    const completeResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/admin/top-up-orders/${createdOrder.order_id}/complete`,
      headers: jsonHeaders('{}', bearerHeaders(adminToken)),
      body: '{}'
    });

    assert.equal(completeResponse.status, 200);
    assert.equal(completeResponse.json().order.status, 'completed');

    const profile = await profileRepository.findByUserId('demo-user');
    assert.equal(profile.points, 750);

    const snapshotResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/me',
      headers: bearerHeaders(userTokens.demoUser)
    });

    assert.equal(snapshotResponse.status, 200);
    assert.equal(snapshotResponse.json().topUpOrders[0].status, 'completed');
  });

  test('PATCH /api/user/me/profile updates the authenticated user profile', async () => {
    const payload = JSON.stringify({
      name: 'Renamed Demo User'
    });

    const response = await injectRequest(app, {
      method: 'PATCH',
      url: '/api/user/me/profile',
      headers: jsonHeaders(payload, bearerHeaders(userTokens.demoUser)),
      body: payload
    });

    assert.equal(response.status, 200);
    const body = response.json();
    assert.equal(body.user.displayName, 'Renamed Demo User');

    const profile = await profileRepository.findByUserId('demo-user');
    assert.equal(profile.name, 'Renamed Demo User');

    const user = await userRepository.findById('demo-user');
    assert.equal(user.displayName, 'Renamed Demo User');
  });

  test('legacy email/password account endpoints are not exposed for mini app users', async () => {
    const registerPayload = JSON.stringify({
      email: 'password-rotate@example.com',
      password: 'strongpassword123',
      name: 'Password Rotate User',
      countryCode: 'US'
    });

    const registerResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/auth/register',
      headers: jsonHeaders(registerPayload),
      body: registerPayload
    });

    assert.equal(registerResponse.status, 404);

    const passwordPayload = JSON.stringify({
      newPassword: 'newstrongpassword456'
    });

    const passwordResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/user/me/password',
      headers: jsonHeaders(passwordPayload, bearerHeaders(userTokens.demoUser)),
      body: passwordPayload
    });

    assert.equal(passwordResponse.status, 404);

    const newLoginPayload = JSON.stringify({
      email: 'password-rotate@example.com',
      password: 'newstrongpassword456'
    });

    const newLoginResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/auth/login',
      headers: jsonHeaders(newLoginPayload),
      body: newLoginPayload
    });

    assert.equal(newLoginResponse.status, 404);
  });

  test('DELETE /api/user/me removes the authenticated account', async () => {
    const initData = createTelegramMiniAppInitData({
      user: {
        id: 77001,
        first_name: 'Delete',
        last_name: 'Me',
        username: 'delete_me'
      },
      startParam: 'profile'
    });
    const authPayload = JSON.stringify({
      initData,
      startParam: 'profile'
    });
    const authResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/auth/telegram-mini-app',
      headers: jsonHeaders(authPayload),
      body: authPayload
    });

    assert.equal(authResponse.status, 200);
    const authBody = authResponse.json();
    assert.ok(authBody.token);
    assert.equal(authBody.user.email, 'telegram-77001@telegram.transferly.local');

    const deleteResponse = await injectRequest(app, {
      method: 'DELETE',
      url: '/api/user/me',
      headers: bearerHeaders(authBody.token)
    });

    assert.equal(deleteResponse.status, 200);
    assert.equal(deleteResponse.json().deleted, true);

    const deletedUser = await userRepository.findById(authBody.user.id);
    assert.equal(deletedUser, null);
  });

  test('admin user endpoints enforce admin auth and allow manual point adjustments', async () => {
    const unauthorizedResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/admin/users',
      headers: bearerHeaders(userTokens.demoUser)
    });

    assert.equal(unauthorizedResponse.status, 401);
    assert.equal(unauthorizedResponse.json().code, 'ADMIN_AUTH_REQUIRED');

    const listResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/admin/users',
      headers: bearerHeaders(adminToken)
    });

    assert.equal(listResponse.status, 200);
    const listBody = listResponse.json();
    assert.ok(listBody.data.some((user) => user.user_id === 'demo-user'));

    const adjustmentPayload = JSON.stringify({
      delta: 15,
      reason: 'Support credit'
    });

    const adjustmentResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/admin/users/demo-user/points',
      headers: jsonHeaders(adjustmentPayload, bearerHeaders(adminToken)),
      body: adjustmentPayload
    });

    assert.equal(adjustmentResponse.status, 200);
    const adjustmentBody = adjustmentResponse.json();
    assert.equal(adjustmentBody.user.user_id, 'demo-user');
    assert.equal(adjustmentBody.user.points, 515);

    const pointsResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/user/demo-user/points',
      headers: bearerHeaders(userTokens.demoUser)
    });

    assert.equal(pointsResponse.status, 200);
    assert.equal(pointsResponse.json().points, 515);

    const profile = await profileRepository.findByUserId('demo-user');
    assert.equal(profile.points, 515);
  });

  test('PATCH /api/admin/config updates platform content settings', async () => {
    const payload = JSON.stringify({
      tagline: 'Receipts built faster',
      brand_color: '#ff7a18',
      bank_slip_cost: 19,
      payout_minimum_cents: 2500,
      payout_fee_fixed_cents: 175,
      payout_fee_percentage_bps: 150,
      payout_manual_review_cents: 50000,
      helpFAQ: [
        {
          question: 'Updated help',
          answer: 'Use the admin tools.'
        }
      ]
    });

    const response = await injectRequest(app, {
      method: 'PATCH',
      url: '/api/admin/config',
      headers: jsonHeaders(payload, bearerHeaders(adminToken)),
      body: payload
    });

    assert.equal(response.status, 200);
    const body = response.json();
    assert.equal(body.config.tagline, 'Receipts built faster');
    assert.equal(body.config.brand_color, '#ff7a18');
    assert.equal(body.config.bank_slip_cost, 19);
    assert.equal(body.config.payout_minimum_cents, 2500);
    assert.equal(body.config.payout_fee_fixed_cents, 175);
    assert.equal(body.config.payout_fee_percentage_bps, 150);
    assert.equal(body.config.payout_manual_review_cents, 50000);

    const config = await platformConfigRepository.get();
    assert.equal(config.tagline, 'Receipts built faster');
    assert.equal(config.brand_color, '#ff7a18');
    assert.equal(config.bank_slip_cost, 19);
    assert.equal(config.payout_minimum_cents, 2500);
    assert.equal(config.payout_fee_fixed_cents, 175);
    assert.equal(config.payout_fee_percentage_bps, 150);
    assert.equal(config.payout_manual_review_cents, 50000);
    assert.deepEqual(config.helpFAQ, [{ question: 'Updated help', answer: 'Use the admin tools.' }]);
    assert.equal(
      config.help_faq,
      JSON.stringify([{ question: 'Updated help', answer: 'Use the admin tools.' }])
    );
  });

  test('admin FAQ endpoints support create, update, and delete', async () => {
    const createPayload = JSON.stringify({
      question: 'How do I sync payouts?',
      answer: 'Open the payouts dashboard.',
      order_index: 7
    });

    const createResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/admin/faqs',
      headers: jsonHeaders(createPayload, bearerHeaders(adminToken)),
      body: createPayload
    });

    assert.equal(createResponse.status, 201);
    const createBody = createResponse.json();
    const faqId = createBody.faq.id;
    assert.equal(createBody.faq.order_index, 7);

    const updatePayload = JSON.stringify({
      answer: 'Use the admin dashboard sync action.',
      order_index: 8
    });

    const updateResponse = await injectRequest(app, {
      method: 'PATCH',
      url: `/api/admin/faqs/${faqId}`,
      headers: jsonHeaders(updatePayload, bearerHeaders(adminToken)),
      body: updatePayload
    });

    assert.equal(updateResponse.status, 200);
    const updateBody = updateResponse.json();
    assert.equal(updateBody.faq.answer, 'Use the admin dashboard sync action.');
    assert.equal(updateBody.faq.order_index, 8);

    const deleteResponse = await injectRequest(app, {
      method: 'DELETE',
      url: `/api/admin/faqs/${faqId}`,
      headers: bearerHeaders(adminToken)
    });

    assert.equal(deleteResponse.status, 200);
    assert.equal(deleteResponse.json().deleted, true);
    assert.equal(await faqRepository.findById(faqId), null);
  });

  test('admin testimonial endpoints support create, update, and delete', async () => {
    const createPayload = JSON.stringify({
      name: 'Jordan Vale',
      role: 'Seller',
      avatar: 'JV',
      content: 'This platform is fast.',
      rating: 5,
      order_index: 4,
      is_active: true
    });

    const createResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/admin/testimonials',
      headers: jsonHeaders(createPayload, bearerHeaders(adminToken)),
      body: createPayload
    });

    assert.equal(createResponse.status, 201);
    const createBody = createResponse.json();
    const testimonialId = createBody.testimonial.id;
    assert.equal(createBody.testimonial.order_index, 4);
    assert.equal(createBody.testimonial.avatar, 'JV');

    const updatePayload = JSON.stringify({
      content: 'This platform is fast and reliable.',
      order_index: 5,
      is_active: false
    });

    const updateResponse = await injectRequest(app, {
      method: 'PATCH',
      url: `/api/admin/testimonials/${testimonialId}`,
      headers: jsonHeaders(updatePayload, bearerHeaders(adminToken)),
      body: updatePayload
    });

    assert.equal(updateResponse.status, 200);
    const updateBody = updateResponse.json();
    assert.equal(updateBody.testimonial.content, 'This platform is fast and reliable.');
    assert.equal(updateBody.testimonial.order_index, 5);
    assert.equal(updateBody.testimonial.is_active, false);

    const deleteResponse = await injectRequest(app, {
      method: 'DELETE',
      url: `/api/admin/testimonials/${testimonialId}`,
      headers: bearerHeaders(adminToken)
    });

    assert.equal(deleteResponse.status, 200);
    assert.equal(deleteResponse.json().deleted, true);
    assert.equal(await testimonialRepository.findById(testimonialId), null);
  });

  test('admin invoice template endpoints support create, update, and delete', async () => {
    const createPayload = JSON.stringify({
      name: 'Consulting Retainer',
      description: 'Monthly consulting template',
      currency_code: 'USD',
      default_due_days: 14,
      line_items: [
        {
          name: 'Consulting',
          description: 'Monthly advisory',
          quantity: 1,
          unitAmount: 450
        }
      ],
      is_active: true
    });

    const createResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/admin/invoice-templates',
      headers: jsonHeaders(createPayload, bearerHeaders(adminToken)),
      body: createPayload
    });

    assert.equal(createResponse.status, 201);
    const createBody = createResponse.json();
    const templateId = createBody.template.id;
    assert.equal(createBody.template.currency_code, 'USD');
    assert.equal(createBody.template.line_items.length, 1);

    const updatePayload = JSON.stringify({
      description: 'Updated consulting template',
      is_active: false
    });

    const updateResponse = await injectRequest(app, {
      method: 'PATCH',
      url: `/api/admin/invoice-templates/${templateId}`,
      headers: jsonHeaders(updatePayload, bearerHeaders(adminToken)),
      body: updatePayload
    });

    assert.equal(updateResponse.status, 200);
    const updatedTemplate = updateResponse.json().template;
    assert.equal(updatedTemplate.description, 'Updated consulting template');
    assert.equal(updatedTemplate.is_active, false);

    const listResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/admin/invoice-templates',
      headers: bearerHeaders(adminToken)
    });

    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.json().data.length, 1);

    const deleteResponse = await injectRequest(app, {
      method: 'DELETE',
      url: `/api/admin/invoice-templates/${templateId}`,
      headers: bearerHeaders(adminToken)
    });

    assert.equal(deleteResponse.status, 200);
    assert.equal(deleteResponse.json().deleted, true);
    assert.equal(await invoiceTemplateRepository.findById(templateId), null);
  });

  test('admin invoice reminder configuration endpoints support list, update, suspend, and resume', async () => {
    const listResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/admin/invoice-reminders',
      headers: bearerHeaders(adminToken)
    });

    assert.equal(listResponse.status, 200);
    const configurations = listResponse.json().data;
    assert.equal(configurations.length, 2);

    const target = configurations.find((configuration) => configuration.type === 'AFTER_DUE');
    assert.ok(target);

    const updatePayload = JSON.stringify({
      type: 'AFTER_DUE',
      interval: {
        unit: 'DAY',
        value: 5
      },
      repetition: 3,
      notification: {
        send_to_invoicer: false
      }
    });

    const updateResponse = await injectRequest(app, {
      method: 'PUT',
      url: `/api/admin/invoice-reminders/${target.id}`,
      headers: jsonHeaders(updatePayload, bearerHeaders(adminToken)),
      body: updatePayload
    });

    assert.equal(updateResponse.status, 200);
    assert.equal(updateResponse.json().configuration.interval.value, 5);
    assert.equal(updateResponse.json().configuration.repetition, 3);
    assert.equal(updateResponse.json().configuration.notification.send_to_invoicer, false);

    const suspendResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/admin/invoice-reminders/${target.id}/suspend`,
      headers: bearerHeaders(adminToken)
    });

    assert.equal(suspendResponse.status, 200);
    assert.equal(suspendResponse.json().configuration.status, 'INACTIVE');

    const resumeResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/admin/invoice-reminders/${target.id}/resume`,
      headers: bearerHeaders(adminToken)
    });

    assert.equal(resumeResponse.status, 200);
    assert.equal(resumeResponse.json().configuration.status, 'ACTIVE');
  });

  test('POST /api/invoices can create an official PayPal invoice from a stored template', async () => {
    const template = await invoiceTemplateRepository.create({
      name: 'Template Invoice',
      description: 'Template-backed invoice',
      currency_code: 'USD',
      default_due_days: 7,
      line_items: [
        {
          name: 'Implementation',
          description: 'Phase 1',
          quantity: 2,
          unitAmount: 125
        }
      ],
      metadata: {
        department: 'ops'
      },
      is_active: true
    });

    const payload = JSON.stringify({
      userId: 'demo-user',
      recipientEmail: 'buyer@example.com',
      templateId: template.id
    });

    const response = await injectRequest(app, {
      method: 'POST',
      url: '/api/invoices',
      headers: jsonHeaders(payload, bearerHeaders(userTokens.demoUser)),
      body: payload
    });

    assert.equal(response.status, 201);
    const body = response.json();
    assert.equal(body.template_id, template.id);
    assert.equal(body.summary.amount, '250.00');
    assert.equal(body.summary.currency, 'USD');
    assert.equal(body.metadata.invoice_template.id, template.id);
    assert.equal(body.metadata.department, 'ops');

    const invoice = await invoiceRepository.findByPaypalInvoiceId(body.invoice_id);
    assert.equal(invoice.templateId, template.id);
    assert.equal(invoice.amountCents, 25000);
    assert.ok(invoice.dueDate);
  });

  test('POST /api/invoices/preview calculates draft totals and hosted-link intent without creating PayPal state', async () => {
    const template = await invoiceTemplateRepository.create({
      name: 'Preview Template',
      description: 'Preview-only invoice',
      currency_code: 'USD',
      default_due_days: 10,
      line_items: [
        {
          name: 'Implementation',
          description: 'Preview phase',
          quantity: 2,
          unitAmount: 125
        }
      ],
      is_active: true
    });

    const payload = JSON.stringify({
      userId: 'demo-user',
      recipientEmail: 'buyer@example.com',
      templateId: template.id
    });

    const response = await injectRequest(app, {
      method: 'POST',
      url: '/api/invoices/preview',
      headers: jsonHeaders(payload, bearerHeaders(userTokens.demoUser)),
      body: payload
    });

    assert.equal(response.status, 200);
    const preview = response.json();
    assert.equal(preview.template.id, template.id);
    assert.equal(preview.total, '250.00');
    assert.equal(preview.amount_cents, 25000);
    assert.equal(preview.line_items.length, 1);
    assert.equal(preview.hosted_link_will_be_created, true);
    assert.equal(sandboxInvoices.size, 0);
  });

  test('POST /api/invoices/preview supports configured Stripe invoice previews without provider state', async () => {
    const payload = JSON.stringify({
      userId: 'demo-user',
      provider: 'stripe',
      recipientEmail: 'buyer@example.com',
      currency: 'USD',
      description: 'Stripe consulting retainer',
      items: [
        {
          name: 'Consulting',
          description: 'Stripe preview',
          quantity: 1,
          unitAmount: 125
        }
      ]
    });

    const response = await injectRequest(app, {
      method: 'POST',
      url: '/api/invoices/preview',
      headers: jsonHeaders(payload, bearerHeaders(userTokens.demoUser)),
      body: payload
    });

    assert.equal(response.status, 200);
    const preview = response.json();
    assert.equal(preview.provider, 'stripe');
    assert.equal(preview.provider_status, 'configured');
    assert.deepEqual(preview.missing_env, []);
    assert.equal(preview.total, '125.00');
    assert.equal(preview.hosted_link_will_be_created, true);
    assert.equal(preview.settlement_review_required, false);
    assert.equal(stripeInvoiceSequence, 0);
  });

  test('GET /api/admin/payment-providers/stripe/balance returns normalized Stripe balances', async () => {
    const response = await injectRequest(app, {
      method: 'GET',
      url: '/api/admin/payment-providers/stripe/balance',
      headers: bearerHeaders(adminToken)
    });

    assert.equal(response.status, 200);
    const body = response.json();
    assert.equal(body.balance.provider, 'stripe');
    assert.equal(body.balance.mode, 'platform');
    assert.equal(body.balance.livemode, false);
    assert.deepEqual(body.balance.available[0], {
      amount_cents: 125000,
      amount: '1250.00',
      currency: 'USD',
      source_types: {
        card: 125000
      }
    });
    assert.equal(body.balance.pending[0].amount, '250.00');
  });

  test('GET /api/admin/payment-providers/health scores provider operations from issues and webhooks', async () => {
    await webhookEventRepository.create({
      eventId: 'stripe:evt_provider_health_failed_1',
      eventType: 'charge.failed',
      resourceType: 'charge',
      transmissionId: 'stripe-health-transmission-1',
      status: 'FAILED',
      payload: {
        provider: 'stripe',
        type: 'charge.failed',
        data: {
          object: {
            id: 'ch_failed_health_1'
          }
        }
      },
      verificationPayload: {
        stripe_signature_present: true
      },
      processingAttempts: 2,
      lastError: 'Signature verification failed'
    });
    await paymentOpsIssueRepository.upsert({
      entityType: 'webhook',
      entityId: 'stripe:evt_provider_health_failed_1',
      issueType: 'WEBHOOK_PROCESSING_FAILED',
      severity: 'HIGH',
      status: 'OPEN',
      summary: 'Stripe webhook processing failed and needs replay.',
      metadata: {
        provider: 'stripe'
      }
    });

    const response = await injectRequest(app, {
      method: 'GET',
      url: '/api/admin/payment-providers/health',
      headers: bearerHeaders(adminToken)
    });

    assert.equal(response.status, 200);
    const body = response.json();
    const stripe = body.data.find((provider) => provider.provider === 'stripe');
    assert.ok(stripe);
    assert.ok(stripe.score < 100);
    assert.equal(stripe.failed_webhooks, 1);
    assert.equal(stripe.unresolved_issues, 1);
    assert.ok(stripe.reasons.some((reason) => reason.includes('webhook')));
    assert.ok(stripe.next_actions.some((action) => action.includes('webhook')));
  });

  test('admin can create, onboard, refresh, and webhook-sync a Stripe connected account', async () => {
    const createPayload = JSON.stringify({
      userId: 'demo-user',
      email: 'recipient@example.com',
      country: 'US',
      businessType: 'individual',
      metadata: {
        operator_note: 'sandbox recipient'
      }
    });

    const createResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/admin/payment-providers/stripe/connected-accounts',
      headers: jsonHeaders(createPayload, bearerHeaders(adminToken)),
      body: createPayload
    });

    assert.equal(createResponse.status, 201);
    const created = createResponse.json().account;
    assert.equal(created.stripe_account_id, 'acct_connected_001');
    assert.equal(created.user_id, 'demo-user');
    assert.equal(created.status, 'onboarding_required');
    assert.equal(created.requirements.currently_due[0], 'individual.first_name');

    const linkPayload = JSON.stringify({
      returnUrl: 'http://localhost:3001/admin/stripe/return',
      refreshUrl: 'http://localhost:3001/admin/stripe/refresh'
    });
    const linkResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/admin/payment-providers/stripe/connected-accounts/${created.id}/onboarding-link`,
      headers: jsonHeaders(linkPayload, bearerHeaders(adminToken)),
      body: linkPayload
    });

    assert.equal(linkResponse.status, 201);
    const linkBody = linkResponse.json();
    assert.equal(linkBody.onboarding_link.url, 'https://connect.stripe.test/setup/acct_connected_001');
    assert.ok(linkBody.account.last_onboarding_link_created_at);

    const refreshResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/admin/payment-providers/stripe/connected-accounts/${created.id}/refresh`,
      headers: bearerHeaders(adminToken)
    });

    assert.equal(refreshResponse.status, 200);
    assert.equal(refreshResponse.json().account.status, 'ready');
    assert.equal(refreshResponse.json().account.payouts_enabled, true);

    const webhookPayload = JSON.stringify({
      id: 'evt_stripe_account_updated_1',
      type: 'account.updated',
      object: 'event',
      data: {
        object: {
          id: 'acct_connected_001',
          object: 'account',
          business_type: 'individual',
          charges_enabled: false,
          country: 'US',
          details_submitted: true,
          email: 'recipient@example.com',
          livemode: false,
          payouts_enabled: false,
          requirements: {
            currently_due: ['external_account'],
            past_due: [],
            disabled_reason: 'requirements.pending_verification'
          },
          capabilities: {
            transfers: 'pending'
          }
        }
      }
    });

    const webhookResponse = await injectRequest(app, {
      method: 'POST',
      url: '/webhooks/stripe',
      headers: jsonHeaders(webhookPayload, {
        'stripe-signature': createStripeSignature(webhookPayload)
      }),
      body: webhookPayload
    });

    assert.equal(webhookResponse.status, 202);

    const listResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/admin/payment-providers/stripe/connected-accounts?userId=demo-user',
      headers: bearerHeaders(adminToken)
    });

    assert.equal(listResponse.status, 200);
    const accounts = listResponse.json().data;
    assert.equal(accounts.length, 1);
    assert.equal(accounts[0].stripe_account_id, 'acct_connected_001');
    assert.equal(accounts[0].status, 'restricted');
    assert.equal(accounts[0].disabled_reason, 'requirements.pending_verification');
  });

  test('POST /api/invoices returns the PayPal payment link and persists the invoice', async () => {
    const payload = JSON.stringify({
      userId: 'demo-user',
      recipientEmail: 'buyer@example.com',
      currency: 'USD',
      description: 'Consulting retainer',
      items: [
        {
          name: 'Consulting',
          description: 'April retainer',
          quantity: 1,
          unitAmount: 125
        }
      ]
    });

    const response = await injectRequest(app, {
      method: 'POST',
      url: '/api/invoices',
      headers: jsonHeaders(payload, bearerHeaders(userTokens.demoUser)),
      body: payload
    });

    assert.equal(response.status, 201);
    const body = response.json();
    assert.equal(body.invoice_id, 'PP-INV-001');
    assert.equal(body.status, 'SENT');
    assert.equal(body.invoice_link, 'https://www.sandbox.paypal.com/invoice/p/#PP-INV-001');

    const invoice = await invoiceRepository.findByPaypalInvoiceId('PP-INV-001');
    assert.ok(invoice);
    assert.equal(invoice.invoiceUrl, body.invoice_link);
    assert.equal(invoice.amountCents, 12500);
  });

  test('POST /api/invoices can create and persist an official Stripe hosted invoice', async () => {
    const payload = JSON.stringify({
      userId: 'demo-user',
      provider: 'stripe',
      recipientEmail: 'buyer@example.com',
      currency: 'USD',
      description: 'Stripe consulting retainer',
      dueDate: '2099-01-15T00:00:00.000Z',
      items: [
        {
          name: 'Consulting',
          description: 'April retainer',
          quantity: 1,
          unitAmount: 125
        }
      ]
    });

    const response = await injectRequest(app, {
      method: 'POST',
      url: '/api/invoices',
      headers: jsonHeaders(payload, bearerHeaders(userTokens.demoUser)),
      body: payload
    });

    assert.equal(response.status, 201);
    const body = response.json();
    assert.equal(body.invoice_id, 'in_transferly_1');
    assert.equal(body.status, 'SENT');
    assert.equal(body.invoice_link, 'https://invoice.stripe.test/in_transferly_1');
    assert.equal(body.metadata.provider, 'stripe');
    assert.equal(body.metadata.provider_resource, 'invoice');
    assert.equal(body.metadata.invoice_pdf, 'https://invoice.stripe.test/in_transferly_1.pdf');

    const invoice = await invoiceRepository.findByPaypalInvoiceId('in_transferly_1');
    assert.ok(invoice);
    assert.equal(invoice.invoiceUrl, body.invoice_link);
    assert.equal(invoice.amountCents, 12500);
    assert.equal(invoice.metadata.provider, 'stripe');
    assert.equal(invoice.paypalDetails.provider, 'stripe');
  });

  test('POST /api/invoices can create hosted crypto charges with settlement safeguards', async () => {
    const payload = JSON.stringify({
      userId: 'demo-user',
      provider: 'crypto',
      recipientEmail: 'buyer@example.com',
      currency: 'USD',
      description: 'Crypto settlement invoice',
      items: [
        {
          name: 'Settlement',
          description: 'Crypto charge',
          quantity: 1,
          unitAmount: 125
        }
      ]
    });

    const response = await injectRequest(app, {
      method: 'POST',
      url: '/api/invoices',
      headers: jsonHeaders(payload, bearerHeaders(userTokens.demoUser)),
      body: payload
    });

    assert.equal(response.status, 201);
    const body = response.json();
    assert.equal(body.invoice_id, 'charge-transferly-1');
    assert.equal(body.status, 'SENT');
    assert.equal(body.invoice_link, 'https://commerce.coinbase.test/charges/CHARGE1');
    assert.equal(body.metadata.provider, 'crypto');
    assert.equal(body.metadata.provider_resource, 'crypto_charge');
    assert.equal(body.metadata.settlement_review_required, true);
    assert.ok(body.metadata.settlement_safeguards.includes('underpayment_detection'));

    const invoice = await invoiceRepository.findByPaypalInvoiceId('charge-transferly-1');
    assert.ok(invoice);
    assert.equal(invoice.invoiceUrl, body.invoice_link);
    assert.equal(invoice.metadata.provider, 'crypto');
    assert.equal(invoice.paypalDetails.provider, 'crypto');
  });

  test('POST /api/invoices schedules the official PayPal send when issueDate is in the future', async () => {
    const payload = JSON.stringify({
      userId: 'demo-user',
      recipientEmail: 'buyer@example.com',
      currency: 'USD',
      description: 'Scheduled consulting retainer',
      issueDate: '2099-01-15',
      items: [
        {
          name: 'Consulting',
          description: 'Future retainer',
          quantity: 1,
          unitAmount: 125
        }
      ]
    });

    const response = await injectRequest(app, {
      method: 'POST',
      url: '/api/invoices',
      headers: jsonHeaders(payload, bearerHeaders(userTokens.demoUser)),
      body: payload
    });

    assert.equal(response.status, 201);
    const body = response.json();
    assert.equal(body.status, 'SCHEDULED');
    assert.equal(body.summary.issue_date, '2099-01-15');

    const invoice = await invoiceRepository.findByPaypalInvoiceId(body.invoice_id);
    assert.equal(invoice.status, 'SCHEDULED');
    assert.equal(invoice.issueDate, '2099-01-15');
  });

  test('payment issues endpoint exposes overdue invoices found during official PayPal sync', async () => {
    const payload = JSON.stringify({
      userId: 'demo-user',
      recipientEmail: 'buyer@example.com',
      currency: 'USD',
      description: 'Overdue invoice',
      dueDate: '2020-01-01T00:00:00.000Z',
      items: [
        {
          name: 'Support',
          description: 'Legacy support',
          quantity: 1,
          unitAmount: 75
        }
      ]
    });

    const createResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/invoices',
      headers: jsonHeaders(payload, bearerHeaders(userTokens.demoUser)),
      body: payload
    });

    assert.equal(createResponse.status, 201);
    const createdInvoice = createResponse.json();

    const refreshResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/invoices/${createdInvoice.internal_invoice_id}/refresh`,
      headers: bearerHeaders(userTokens.demoUser)
    });

    assert.equal(refreshResponse.status, 200);

    const issuesResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/admin/payment-issues?status=OPEN',
      headers: bearerHeaders(adminToken)
    });

    assert.equal(issuesResponse.status, 200);
    const issuesBody = issuesResponse.json();
    assert.ok(issuesBody.data.some((issue) => issue.issue_type === 'INVOICE_OVERDUE'));

    const storedIssue = await paymentOpsIssueRepository.findByUniqueKey(
      'invoice',
      createdInvoice.internal_invoice_id,
      'INVOICE_OVERDUE'
    );
    assert.ok(storedIssue);
    assert.equal(storedIssue.status, 'OPEN');
  });

  test('admin provider filters scope webhook events and payment issues', async () => {
    await webhookEventRepository.create({
      eventId: 'WH-PROVIDER-PAYPAL-1',
      eventType: 'INVOICING.INVOICE.PAID',
      resourceType: 'invoices',
      transmissionId: 'paypal-transmission-provider-1',
      status: 'PROCESSED',
      payload: {
        id: 'WH-PROVIDER-PAYPAL-1',
        event_type: 'INVOICING.INVOICE.PAID'
      }
    });
    await webhookEventRepository.create({
      eventId: 'stripe:evt_provider_filter_1',
      eventType: 'invoice.paid',
      resourceType: 'invoice',
      transmissionId: 'stripe-signature-provider-1',
      status: 'PROCESSED',
      payload: {
        id: 'evt_provider_filter_1',
        type: 'invoice.paid',
        provider: 'stripe'
      }
    });

    await paymentOpsIssueRepository.upsert({
      entityType: 'invoice',
      entityId: 'provider-filter-legacy-paypal',
      issueType: 'LEGACY_PAYPAL_PROVIDER_FILTER',
      severity: 'MEDIUM',
      status: 'OPEN',
      summary: 'Legacy PayPal issue'
    });
    await paymentOpsIssueRepository.upsert({
      entityType: 'invoice',
      entityId: 'provider-filter-stripe',
      issueType: 'STRIPE_PROVIDER_FILTER',
      severity: 'HIGH',
      status: 'OPEN',
      summary: 'Stripe provider issue',
      metadata: {
        provider: 'stripe'
      }
    });

    const stripeWebhookResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/admin/webhooks?provider=stripe&status=PROCESSED&limit=10',
      headers: bearerHeaders(adminToken)
    });
    assert.equal(stripeWebhookResponse.status, 200);
    const stripeWebhookIds = stripeWebhookResponse.json().data.map((event) => event.event_id);
    assert.ok(stripeWebhookIds.includes('stripe:evt_provider_filter_1'));
    assert.equal(stripeWebhookIds.includes('WH-PROVIDER-PAYPAL-1'), false);

    const paypalWebhookResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/admin/webhooks?provider=paypal&status=PROCESSED&limit=10',
      headers: bearerHeaders(adminToken)
    });
    assert.equal(paypalWebhookResponse.status, 200);
    const paypalWebhookIds = paypalWebhookResponse.json().data.map((event) => event.event_id);
    assert.ok(paypalWebhookIds.includes('WH-PROVIDER-PAYPAL-1'));
    assert.equal(paypalWebhookIds.includes('stripe:evt_provider_filter_1'), false);

    const stripeIssueResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/admin/payment-issues?provider=stripe&status=OPEN&limit=10',
      headers: bearerHeaders(adminToken)
    });
    assert.equal(stripeIssueResponse.status, 200);
    const stripeIssueTypes = stripeIssueResponse.json().data.map((issue) => issue.issue_type);
    assert.ok(stripeIssueTypes.includes('STRIPE_PROVIDER_FILTER'));
    assert.equal(stripeIssueTypes.includes('LEGACY_PAYPAL_PROVIDER_FILTER'), false);

    const paypalIssueResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/admin/payment-issues?provider=paypal&status=OPEN&limit=10',
      headers: bearerHeaders(adminToken)
    });
    assert.equal(paypalIssueResponse.status, 200);
    const paypalIssueTypes = paypalIssueResponse.json().data.map((issue) => issue.issue_type);
    assert.ok(paypalIssueTypes.includes('LEGACY_PAYPAL_PROVIDER_FILTER'));
    assert.equal(paypalIssueTypes.includes('STRIPE_PROVIDER_FILTER'), false);
  });

  test('admin can inspect, replay, and ignore webhook events with sanitized metadata', async () => {
    const failedEvent = await webhookEventRepository.create({
      eventId: 'stripe:evt_admin_replay_1',
      eventType: 'provider.unknown',
      resourceType: 'invoice',
      transmissionId: 'stripe-signature-admin-replay',
      status: 'FAILED',
      payload: {
        id: 'evt_admin_replay_1',
        type: 'provider.unknown',
        provider: 'stripe',
        data: {
          object: {
            id: 'in_admin_1',
            object: 'invoice',
            secret: 'should-not-return'
          }
        }
      },
      verificationPayload: {
        stripe_signature_present: true
      },
      processingAttempts: 2,
      lastError: 'previous failure'
    });

    const detailResponse = await injectRequest(app, {
      method: 'GET',
      url: `/api/admin/webhooks/${failedEvent.id}`,
      headers: bearerHeaders(adminToken)
    });
    assert.equal(detailResponse.status, 200);
    const detail = detailResponse.json().event;
    assert.equal(detail.provider, 'stripe');
    assert.equal(detail.sanitized_payload.id, 'evt_admin_replay_1');
    assert.equal(detail.sanitized_payload.resource_id, 'in_admin_1');
    assert.equal(detail.sanitized_payload.secret, undefined);
    assert.equal(detail.payload, undefined);
    assert.equal(detail.verification.signature_header_present, true);
    assert.equal(detail.can_replay, true);
    assert.equal(detail.can_ignore, true);

    const replayPayload = JSON.stringify({ note: 'retry after provider recovery' });
    const replayResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/admin/webhooks/${failedEvent.id}/replay`,
      headers: jsonHeaders(replayPayload, bearerHeaders(adminToken)),
      body: replayPayload
    });
    assert.equal(replayResponse.status, 200);
    const replayed = replayResponse.json().event;
    assert.equal(replayed.status, 'IGNORED');
    assert.equal(replayed.last_error, null);
    assert.equal(replayed.processing_attempts, 3);
    assert.equal(replayed.sanitized_payload.resource_id, 'in_admin_1');

    const ignoredEvent = await webhookEventRepository.create({
      eventId: 'stripe:evt_admin_ignore_1',
      eventType: 'provider.unknown',
      resourceType: 'invoice',
      transmissionId: 'stripe-signature-admin-ignore',
      status: 'FAILED',
      payload: {
        id: 'evt_admin_ignore_1',
        type: 'provider.unknown',
        provider: 'stripe'
      },
      lastError: 'operator review'
    });
    const ignorePayload = JSON.stringify({ note: 'operator confirmed duplicate' });
    const ignoreResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/admin/webhooks/${ignoredEvent.id}/ignore`,
      headers: jsonHeaders(ignorePayload, bearerHeaders(adminToken)),
      body: ignorePayload
    });
    assert.equal(ignoreResponse.status, 200);
    const ignored = ignoreResponse.json().event;
    assert.equal(ignored.status, 'IGNORED');
    assert.equal(ignored.last_error, null);
    assert.equal(ignored.can_ignore, false);

    const rejectedEvent = await webhookEventRepository.create({
      eventId: 'stripe:evt_admin_rejected_1',
      eventType: 'provider.unknown',
      resourceType: 'invoice',
      transmissionId: 'stripe-signature-admin-rejected',
      status: 'REJECTED',
      payload: {
        id: 'evt_admin_rejected_1',
        type: 'provider.unknown',
        provider: 'stripe'
      }
    });
    const rejectedReplayPayload = JSON.stringify({ note: 'should fail' });
    const rejectedReplayResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/admin/webhooks/${rejectedEvent.id}/replay`,
      headers: jsonHeaders(rejectedReplayPayload, bearerHeaders(adminToken)),
      body: rejectedReplayPayload
    });
    assert.equal(rejectedReplayResponse.status, 409);
    assert.equal(rejectedReplayResponse.json().code, 'WEBHOOK_REPLAY_NOT_ALLOWED');
  });

  test('admins can acknowledge, resolve, and reopen payment issues without losing acknowledgement state on sync', async () => {
    const payload = JSON.stringify({
      userId: 'demo-user',
      recipientEmail: 'buyer@example.com',
      currency: 'USD',
      description: 'Issue lifecycle invoice',
      dueDate: '2020-01-01T00:00:00.000Z',
      items: [
        {
          name: 'Support',
          description: 'Lifecycle support',
          quantity: 1,
          unitAmount: 75
        }
      ]
    });

    const createResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/invoices',
      headers: jsonHeaders(payload, bearerHeaders(userTokens.demoUser)),
      body: payload
    });

    assert.equal(createResponse.status, 201);
    const createdInvoice = createResponse.json();

    const refreshResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/invoices/${createdInvoice.internal_invoice_id}/refresh`,
      headers: bearerHeaders(userTokens.demoUser)
    });

    assert.equal(refreshResponse.status, 200);

    const issue = await paymentOpsIssueRepository.findByUniqueKey(
      'invoice',
      createdInvoice.internal_invoice_id,
      'INVOICE_OVERDUE'
    );
    assert.ok(issue);

    const acknowledgePayload = JSON.stringify({
      note: 'Ops team investigating customer follow-up.'
    });
    const acknowledgeResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/admin/payment-issues/${issue.id}/acknowledge`,
      headers: jsonHeaders(acknowledgePayload, bearerHeaders(adminToken)),
      body: acknowledgePayload
    });

    assert.equal(acknowledgeResponse.status, 200);
    assert.equal(acknowledgeResponse.json().issue.status, 'ACKNOWLEDGED');
    assert.equal(
      acknowledgeResponse.json().issue.acknowledgement.acknowledgement_note,
      'Ops team investigating customer follow-up.'
    );

    const secondRefreshResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/invoices/${createdInvoice.internal_invoice_id}/refresh`,
      headers: bearerHeaders(userTokens.demoUser)
    });

    assert.equal(secondRefreshResponse.status, 200);

    const acknowledgedIssue = await paymentOpsIssueRepository.findById(issue.id);
    assert.equal(acknowledgedIssue.status, 'ACKNOWLEDGED');
    assert.equal(
      acknowledgedIssue.metadata.acknowledgement_note,
      'Ops team investigating customer follow-up.'
    );

    const resolvePayload = JSON.stringify({
      note: 'Customer contacted and manual retry scheduled.'
    });
    const resolveResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/admin/payment-issues/${issue.id}/resolve`,
      headers: jsonHeaders(resolvePayload, bearerHeaders(adminToken)),
      body: resolvePayload
    });

    assert.equal(resolveResponse.status, 200);
    assert.equal(resolveResponse.json().issue.status, 'RESOLVED');
    assert.equal(
      resolveResponse.json().issue.resolution.resolution_note,
      'Customer contacted and manual retry scheduled.'
    );

    const reopenPayload = JSON.stringify({
      note: 'Issue still active after follow-up.'
    });
    const reopenResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/admin/payment-issues/${issue.id}/reopen`,
      headers: jsonHeaders(reopenPayload, bearerHeaders(adminToken)),
      body: reopenPayload
    });

    assert.equal(reopenResponse.status, 200);
    assert.equal(reopenResponse.json().issue.status, 'OPEN');
    assert.equal(reopenResponse.json().issue.metadata.reopen_note, 'Issue still active after follow-up.');
  });

  test('POST /api/invoices/:id/refresh syncs the latest official PayPal invoice state', async () => {
    const payload = JSON.stringify({
      userId: 'demo-user',
      recipientEmail: 'buyer@example.com',
      currency: 'USD',
      description: 'Consulting retainer',
      items: [
        {
          name: 'Consulting',
          description: 'April retainer',
          quantity: 1,
          unitAmount: 125
        }
      ]
    });

    const createResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/invoices',
      headers: jsonHeaders(payload, bearerHeaders(userTokens.demoUser)),
      body: payload
    });

    assert.equal(createResponse.status, 201);
    const createdInvoice = createResponse.json();
    sandboxInvoices.get(createdInvoice.invoice_id).status = 'PAID';

    const refreshResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/invoices/${createdInvoice.internal_invoice_id}/refresh`,
      headers: bearerHeaders(userTokens.demoUser)
    });

    assert.equal(refreshResponse.status, 200);
    const refreshedInvoice = refreshResponse.json();
    assert.equal(refreshedInvoice.status, 'PAID');
    assert.ok(refreshedInvoice.official_paypal.last_synced_at);

    const storedInvoice = await invoiceRepository.findById(createdInvoice.internal_invoice_id);
    assert.equal(storedInvoice.status, 'PAID');
    assert.ok(storedInvoice.paypalSyncedAt);
  });

  test('POST /api/invoices/:id/remind triggers the official PayPal reminder flow', async () => {
    const payload = JSON.stringify({
      userId: 'demo-user',
      recipientEmail: 'buyer@example.com',
      currency: 'USD',
      description: 'Consulting retainer',
      items: [
        {
          name: 'Consulting',
          description: 'April retainer',
          quantity: 1,
          unitAmount: 125
        }
      ]
    });

    const createResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/invoices',
      headers: jsonHeaders(payload, bearerHeaders(userTokens.demoUser)),
      body: payload
    });

    assert.equal(createResponse.status, 201);
    const createdInvoice = createResponse.json();

    const remindResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/invoices/${createdInvoice.internal_invoice_id}/remind`,
      headers: bearerHeaders(userTokens.demoUser)
    });

    assert.equal(remindResponse.status, 200);
    const remindedInvoice = remindResponse.json();
    assert.equal(remindedInvoice.status, 'SENT');
    assert.ok(remindedInvoice.official_paypal.last_synced_at);
  });

  test('POST /api/invoices/:id/cancel-reminders records invoice-level PayPal reminder cancellation', async () => {
    const payload = JSON.stringify({
      userId: 'demo-user',
      recipientEmail: 'buyer@example.com',
      currency: 'USD',
      description: 'Reminder cancellation invoice',
      items: [
        {
          name: 'Consulting',
          description: 'Reminder cancellation item',
          quantity: 1,
          unitAmount: 125
        }
      ]
    });

    const createResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/invoices',
      headers: jsonHeaders(payload, bearerHeaders(userTokens.demoUser)),
      body: payload
    });

    assert.equal(createResponse.status, 201);
    const createdInvoice = createResponse.json();

    const cancelResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/invoices/${createdInvoice.internal_invoice_id}/cancel-reminders`,
      headers: bearerHeaders(userTokens.demoUser)
    });

    assert.equal(cancelResponse.status, 200);
    const cancelledReminderInvoice = cancelResponse.json();
    assert.ok(cancelledReminderInvoice.summary.auto_reminders_cancelled_at);

    const storedInvoice = await invoiceRepository.findById(createdInvoice.internal_invoice_id);
    assert.ok(storedInvoice.autoRemindersCancelledAt);
  });

  test('POST /api/invoices/:id/qr stores the official PayPal invoice QR details', async () => {
    const payload = JSON.stringify({
      userId: 'demo-user',
      recipientEmail: 'buyer@example.com',
      currency: 'USD',
      description: 'Consulting retainer',
      items: [
        {
          name: 'Consulting',
          description: 'April retainer',
          quantity: 1,
          unitAmount: 125
        }
      ]
    });

    const createResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/invoices',
      headers: jsonHeaders(payload, bearerHeaders(userTokens.demoUser)),
      body: payload
    });

    assert.equal(createResponse.status, 201);
    const createdInvoice = createResponse.json();

    const qrResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/invoices/${createdInvoice.internal_invoice_id}/qr`,
      headers: bearerHeaders(userTokens.demoUser)
    });

    assert.equal(qrResponse.status, 200);
    const qrInvoice = qrResponse.json();
    assert.equal(
      qrInvoice.official_paypal.qr.image_url_png,
      'https://www.sandbox.paypal.com/qr/PP-INV-001.png'
    );

    const storedInvoice = await invoiceRepository.findById(createdInvoice.internal_invoice_id);
    assert.equal(
      storedInvoice.paypalQrDetails.image_url_svg,
      'https://www.sandbox.paypal.com/qr/PP-INV-001.svg'
    );
  });

  test('POST /api/invoices/:id/cancel syncs the official PayPal cancelled state', async () => {
    const payload = JSON.stringify({
      userId: 'demo-user',
      recipientEmail: 'buyer@example.com',
      currency: 'USD',
      description: 'Cancelable invoice',
      items: [
        {
          name: 'Consulting',
          description: 'Cancelable invoice item',
          quantity: 1,
          unitAmount: 125
        }
      ]
    });

    const createResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/invoices',
      headers: jsonHeaders(payload, bearerHeaders(userTokens.demoUser)),
      body: payload
    });

    assert.equal(createResponse.status, 201);
    const createdInvoice = createResponse.json();

    const cancelResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/invoices/${createdInvoice.internal_invoice_id}/cancel`,
      headers: bearerHeaders(userTokens.demoUser)
    });

    assert.equal(cancelResponse.status, 200);
    const cancelledInvoice = cancelResponse.json();
    assert.equal(cancelledInvoice.status, 'CANCELLED');
    assert.ok(cancelledInvoice.summary.cancelled_at);
    assert.ok(cancelledInvoice.official_paypal.last_synced_at);

    const storedInvoice = await invoiceRepository.findById(createdInvoice.internal_invoice_id);
    assert.equal(storedInvoice.status, 'CANCELLED');
    assert.ok(storedInvoice.cancelledAt);
  });

  test('GET /api/invoices/:id/timeline exposes official invoice audit activity', async () => {
    const payload = JSON.stringify({
      userId: 'demo-user',
      recipientEmail: 'buyer@example.com',
      currency: 'USD',
      description: 'Timeline invoice',
      items: [
        {
          name: 'Consulting',
          description: 'Timeline invoice item',
          quantity: 1,
          unitAmount: 125
        }
      ]
    });

    const createResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/invoices',
      headers: jsonHeaders(payload, bearerHeaders(userTokens.demoUser)),
      body: payload
    });

    assert.equal(createResponse.status, 201);
    const createdInvoice = createResponse.json();

    await injectRequest(app, {
      method: 'POST',
      url: `/api/invoices/${createdInvoice.internal_invoice_id}/remind`,
      headers: bearerHeaders(userTokens.demoUser)
    });

    const notePayload = JSON.stringify({ note: 'Customer asked for a corrected PO number.' });
    const noteResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/admin/invoices/${createdInvoice.internal_invoice_id}/notes`,
      headers: jsonHeaders(notePayload, bearerHeaders(adminToken)),
      body: notePayload
    });

    assert.equal(noteResponse.status, 201);
    assert.equal(noteResponse.json().note, 'Customer asked for a corrected PO number.');

    const timelineResponse = await injectRequest(app, {
      method: 'GET',
      url: `/api/invoices/${createdInvoice.internal_invoice_id}/timeline?limit=10`,
      headers: bearerHeaders(userTokens.demoUser)
    });

    assert.equal(timelineResponse.status, 200);
    const timelineBody = timelineResponse.json();
    assert.ok(Array.isArray(timelineBody.data));
    assert.ok(timelineBody.data.some((entry) => entry.action === 'invoice.created'));
    assert.ok(timelineBody.data.some((entry) => entry.action === 'invoice.reminder_sent'));
    assert.ok(timelineBody.data.some((entry) => entry.action === 'invoice.note_added'));
  });

  test('telegram mini app auth, points lookup, receipt generation, email dispatch, referral stats, and telegram webhook all work through the SlipCraft endpoints', async () => {
    const initData = createTelegramMiniAppInitData({
      user: {
        id: 88001,
        first_name: 'SlipCraft',
        last_name: 'User',
        username: 'slipcraft_user'
      },
      startParam: 'dashboard'
    });
    const authPayload = JSON.stringify({
      initData,
      startParam: 'dashboard'
    });

    const authResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/auth/telegram-mini-app',
      headers: jsonHeaders(authPayload),
      body: authPayload
    });

    assert.equal(authResponse.status, 200);
    const authBody = authResponse.json();
    assert.ok(authBody.token);
    assert.equal(authBody.user.email, 'telegram-88001@telegram.transferly.local');
    assert.equal(authBody.user.profile.points, 50);

    const pointsResponse = await injectRequest(app, {
      method: 'GET',
      url: `/api/user/${authBody.user.id}/points`,
      headers: bearerHeaders(authBody.token)
    });

    assert.equal(pointsResponse.status, 200);
    assert.equal(pointsResponse.json().points, 50);

    const receiptPayload = JSON.stringify({
      type: 'bank',
      title: 'SlipCraft Demo Receipt',
      details: {
        merchant: 'SlipCraft Store',
        amount: '$19.99'
      }
    });

    const receiptResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/receipt/generate',
      headers: jsonHeaders(receiptPayload, bearerHeaders(authBody.token)),
      body: receiptPayload
    });

    assert.equal(receiptResponse.status, 201);
    const receiptBody = receiptResponse.json();
    assert.ok(receiptBody.receipt.id);
    assert.match(receiptBody.pdf_data_url, /^data:application\/pdf;base64,/);
    assert.match(receiptBody.image_data_url, /^data:image\/svg\+xml;base64,/);
    assert.equal(receiptBody.summary.remaining_points, 40);

    const emailPayload = JSON.stringify({
      receiptId: receiptBody.receipt.id,
      toEmail: 'recipient@example.com'
    });

    const emailResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/email/send',
      headers: jsonHeaders(emailPayload, bearerHeaders(authBody.token)),
      body: emailPayload
    });

    assert.equal(emailResponse.status, 201);
    const emailBody = emailResponse.json();
    assert.equal(emailBody.dispatch.status, 'LOCAL_ONLY');
    assert.equal(emailBody.receipt.status, 'EMAILED');

    const referralResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/referral',
      headers: jsonHeaders('{}', bearerHeaders(authBody.token)),
      body: '{}'
    });

    assert.equal(referralResponse.status, 200);
    const referralBody = referralResponse.json();
    assert.equal(referralBody.referral_count, 0);
    assert.ok(referralBody.referral_code);

    await telegramRepository.upsertAccount({
      userId: authBody.user.id,
      telegramUserId: '88001',
      chatId: 'tg-chat-1',
      username: 'slipcraft_bot_user',
      firstName: 'Slip',
      lastName: 'Craft'
    });

    const telegramPayload = JSON.stringify({
      update_id: 1,
      message: {
        text: '/balance',
        chat: {
          id: 'tg-chat-1'
        },
        from: {
          id: '88001',
          username: 'slipcraft_bot_user',
          first_name: 'Slip',
          last_name: 'Craft'
        }
      }
    });

    const telegramResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: jsonHeaders(telegramPayload, {
        'x-telegram-bot-api-secret-token': ''
      }),
      body: telegramPayload
    });

    assert.equal(telegramResponse.status, 200);
    const telegramBody = telegramResponse.json();
    assert.equal(telegramBody.command, '/balance');
    assert.equal(telegramBody.response.data.points, 40);

    const telegramMiniAppPayload = JSON.stringify({
      update_id: 4,
      message: {
        text: '/miniapp',
        chat: {
          id: 'tg-chat-1'
        },
        from: {
          id: '88001',
          username: 'slipcraft_bot_user',
          first_name: 'Slip',
          last_name: 'Craft'
        }
      }
    });

    const telegramMiniAppResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: jsonHeaders(telegramMiniAppPayload, {
        'x-telegram-bot-api-secret-token': ''
      }),
      body: telegramMiniAppPayload
    });

    assert.equal(telegramMiniAppResponse.status, 200);
    const telegramMiniAppBody = telegramMiniAppResponse.json();
    assert.equal(telegramMiniAppBody.command, '/miniapp');
    assert.ok(telegramMiniAppBody.response.data.reply_markup.inline_keyboard[0][0].web_app.url.includes('/miniapp?startapp=dashboard'));
    assert.ok(telegramMiniAppBody.response.data.launch_buttons.some((button) => button.section === 'activity'));
    assert.ok(telegramMiniAppBody.response.data.launch_buttons.some((button) => button.section === 'security'));

    const telegramGeneratePayload = JSON.stringify({
      update_id: 2,
      message: {
        text: '/generate_receipt bank {"service":"opay","amount":"25.00"}',
        chat: {
          id: 'tg-chat-1'
        },
        from: {
          id: '88001',
          username: 'slipcraft_bot_user',
          first_name: 'Slip',
          last_name: 'Craft'
        }
      }
    });

    const telegramGenerateResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: jsonHeaders(telegramGeneratePayload, {
        'x-telegram-bot-api-secret-token': ''
      }),
      body: telegramGeneratePayload
    });

    assert.equal(telegramGenerateResponse.status, 200);
    const telegramGenerateBody = telegramGenerateResponse.json();
    assert.equal(telegramGenerateBody.command, '/generate_receipt');
    assert.equal(telegramGenerateBody.response.data.receipt.data.details.service, 'opay');

    const telegramHistoryPayload = JSON.stringify({
      update_id: 3,
      message: {
        text: '/history opay',
        chat: {
          id: 'tg-chat-1'
        },
        from: {
          id: '88001',
          username: 'slipcraft_bot_user',
          first_name: 'Slip',
          last_name: 'Craft'
        }
      }
    });

    const telegramHistoryResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: jsonHeaders(telegramHistoryPayload, {
        'x-telegram-bot-api-secret-token': ''
      }),
      body: telegramHistoryPayload
    });

    assert.equal(telegramHistoryResponse.status, 200);
    const telegramHistoryBody = telegramHistoryResponse.json();
    assert.equal(telegramHistoryBody.command, '/history');
    assert.equal(telegramHistoryBody.response.data.length, 1);
    assert.equal(telegramHistoryBody.response.data[0].data.details.service, 'opay');

    const receipt = await receiptRepository.findById(receiptBody.receipt.id);
    assert.equal(receipt.status, 'EMAILED');

    const profile = await profileRepository.findByUserId(authBody.user.id);
    assert.equal(profile.points, 30);
  });

  test('POST /api/auth/telegram-mini-app validates Telegram init data and issues a user token', async () => {
    const initData = createTelegramMiniAppInitData({
      user: {
        id: 9001002,
        first_name: 'Mini',
        last_name: 'App',
        username: 'miniapp_user',
        language_code: 'en'
      },
      startParam: 'wallet'
    });
    const payload = JSON.stringify({
      initData,
      startParam: 'wallet'
    });

    const response = await injectRequest(app, {
      method: 'POST',
      url: '/api/auth/telegram-mini-app',
      headers: jsonHeaders(payload),
      body: payload
    });

    assert.equal(response.status, 200);
    const body = response.json();
    assert.ok(body.token);
    assert.equal(body.user.email, 'telegram-9001002@telegram.transferly.local');
    assert.equal(body.user.profile.name, 'Mini App');
    assert.equal(body.user.profile.points, 50);

    const account = await telegramRepository.findAccountByTelegramUserId(9001002);
    assert.equal(account.userId, body.user.id);
    assert.equal(account.username, 'miniapp_user');

    const meResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/me',
      headers: bearerHeaders(body.token)
    });

    assert.equal(meResponse.status, 200);
    assert.equal(meResponse.json().user.id, body.user.id);

    const tamperedInitData = `${initData.slice(0, -1)}${initData.endsWith('0') ? '1' : '0'}`;
    const tamperedPayload = JSON.stringify({
      initData: tamperedInitData
    });
    const tamperedResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/auth/telegram-mini-app',
      headers: jsonHeaders(tamperedPayload),
      body: tamperedPayload
    });

    assert.equal(tamperedResponse.status, 401);
    assert.equal(tamperedResponse.json().code, 'TELEGRAM_INIT_DATA_INVALID');
  });

  test('telegram receipt webhook preserves Transferly service-specific details and filters history by service', async () => {
    await profileRepository.updateByUserId('demo-user', { points: 500 });
    await telegramRepository.upsertAccount({
      userId: 'demo-user',
      telegramUserId: 'tg-transferly-services',
      chatId: 'tg-transferly-services-chat',
      username: 'transferly_services_user',
      firstName: 'Transferly',
      lastName: 'Services'
    });

    const serviceRequests = [
      {
        type: 'bank',
        providerName: 'Opay',
        category: 'Bank Slip Record',
        details: {
          service: 'opay',
          amount: '25.00',
          sender_name: 'Ada Sender',
          receiver_name: 'Ben Receiver',
          opay_transaction_id: 'OPAY-001'
        },
        artifactChecks: [
          ['Opay Transaction ID', 'OPAY-001']
        ]
      },
      {
        type: 'bank',
        providerName: 'Kuda',
        category: 'Bank Slip Record',
        details: {
          service: 'kuda',
          amount: '32.00',
          sender_name: 'Kuda Sender',
          beneficiary_name: 'Kuda Receiver',
          kuda_reference: 'KUDA-001'
        },
        artifactChecks: [
          ['Kuda Reference', 'KUDA-001']
        ]
      },
      {
        type: 'email',
        providerName: 'Binance',
        category: 'Crypto Transfer Record',
        details: {
          service: 'binance',
          recipient_email: 'binance@example.com',
          amount: '75.50',
          currency: 'USDT',
          network: 'TRC20',
          transaction_id: 'BINANCE-001'
        },
        artifactChecks: [
          ['Recipient Email', 'binance@example.com'],
          ['Transaction ID', 'BINANCE-001']
        ]
      },
      {
        type: 'email',
        providerName: 'Bybit',
        category: 'Crypto Transfer Record',
        details: {
          service: 'bybit',
          recipient_email: 'bybit@example.com',
          amount: '81.00',
          currency: 'USDT',
          order_id: 'BYBIT-ORDER-001',
          transaction_id: 'BYBIT-TXN-001'
        },
        artifactChecks: [
          ['Order ID', 'BYBIT-ORDER-001']
        ]
      },
      {
        type: 'email',
        providerName: 'Coinbase',
        category: 'Crypto Transfer Record',
        details: {
          service: 'coinbase',
          recipient_email: 'coinbase@example.com',
          amount: '44.25',
          currency: 'USD',
          transaction_hash: 'COINBASE-HASH-001'
        },
        artifactChecks: [
          ['Transaction Hash', 'COINBASE-HASH-001']
        ]
      },
      {
        type: 'email',
        providerName: 'PayPal',
        category: 'Payment Record',
        details: {
          service: 'paypal',
          mode: 'flash_email',
          recipient_email: 'paypal@example.com',
          amount: '19.99',
          currency: 'USD',
          invoice_or_transaction_id: 'PAYPAL-INV-001',
          payment_status: 'COMPLETED'
        },
        artifactChecks: [
          ['Invoice Or Transaction ID', 'PAYPAL-INV-001'],
          ['Payment Status', 'COMPLETED']
        ]
      },
      {
        type: 'email',
        providerName: 'Crypto.com',
        category: 'Crypto Transfer Record',
        details: {
          service: 'crypto-com',
          recipient_email: 'cryptocom@example.com',
          amount: '64.10',
          currency: 'USD',
          transaction_id: 'CRYPTOCOM-001'
        },
        artifactChecks: [
          ['Transaction ID', 'CRYPTOCOM-001']
        ]
      },
      {
        type: 'email',
        providerName: 'Wise',
        category: 'Transfer Record',
        details: {
          service: 'wise',
          recipient_email: 'wise@example.com',
          amount: '120.00',
          currency: 'GBP',
          transfer_number: 'WISE-001'
        },
        artifactChecks: [
          ['Transfer Number', 'WISE-001']
        ]
      },
      {
        type: 'email',
        providerName: 'Cash App',
        category: 'Payment Record',
        details: {
          service: 'cash-app',
          recipient: '$cashrecipient',
          amount: '42.00',
          currency: 'USD',
          cashtag_or_reference: 'CASHAPP-001'
        },
        artifactChecks: [
          ['Cashtag Or Reference', 'CASHAPP-001']
        ]
      },
      {
        type: 'email',
        providerName: 'Zelle',
        category: 'Payment Record',
        details: {
          service: 'zelle',
          recipient_email: 'zelle@example.com',
          amount: '58.00',
          currency: 'USD',
          confirmation_id: 'ZELLE-001'
        },
        artifactChecks: [
          ['Confirmation ID', 'ZELLE-001']
        ]
      },
      {
        type: 'email',
        providerName: 'Venmo',
        category: 'Payment Record',
        details: {
          service: 'venmo',
          recipient: '@venmorecipient',
          amount: '61.00',
          currency: 'USD',
          transaction_id: 'VENMO-001'
        },
        artifactChecks: [
          ['Transaction ID', 'VENMO-001']
        ]
      },
      {
        type: 'email',
        providerName: 'Trust Wallet',
        category: 'Wallet Transfer Record',
        details: {
          service: 'trust-wallet',
          wallet_address: '0x1234567890abcdef',
          amount: '90.00',
          currency: 'USDT',
          network: 'ERC20',
          transaction_hash: 'TRUST-HASH-001'
        },
        artifactChecks: [
          ['Wallet Address', '0x1234567890abcdef'],
          ['Transaction Hash', 'TRUST-HASH-001']
        ]
      },
      {
        type: 'email',
        providerName: 'GCash',
        category: 'Mobile Wallet Record',
        details: {
          service: 'gcash',
          recipient: 'GCash Receiver',
          amount: '1500.00',
          currency: 'PHP',
          reference_number: 'GCASH-001'
        },
        artifactChecks: [
          ['Reference Number', 'GCASH-001']
        ]
      },
      {
        type: 'email',
        providerName: 'Crypto',
        category: 'Blockchain Receipt Record',
        details: {
          service: 'crypto-receipts',
          wallet_address: 'TTransferlyWallet001',
          amount: '100.00',
          currency: 'USDT',
          network: 'TRC20',
          transaction_hash: 'CRYPTO-HASH-001'
        },
        artifactChecks: [
          ['Wallet Address', 'TTransferlyWallet001'],
          ['Transaction Hash', 'CRYPTO-HASH-001']
        ]
      }
    ];

    for (const [index, serviceRequest] of serviceRequests.entries()) {
      const telegramPayload = JSON.stringify({
        update_id: 3000 + index,
        message: {
          text: `/generate_receipt ${serviceRequest.type} ${JSON.stringify(serviceRequest.details)}`,
          chat: {
            id: 'tg-transferly-services-chat'
          },
          from: {
            id: 'tg-transferly-services',
            username: 'transferly_services_user',
            first_name: 'Transferly',
            last_name: 'Services'
          }
        }
      });

      const response = await injectRequest(app, {
        method: 'POST',
        url: '/api/telegram/webhook',
        headers: jsonHeaders(telegramPayload, {
          'x-telegram-bot-api-secret-token': ''
        }),
        body: telegramPayload
      });

      assert.equal(response.status, 200);
      const body = response.json();
      assert.equal(body.command, '/generate_receipt');
      assert.equal(body.response.data.receipt.data.details.service, serviceRequest.details.service);
      assertReceiptLayout(body.response.data, serviceRequest.providerName, serviceRequest.category);

      for (const [key, value] of Object.entries(serviceRequest.details)) {
        assert.equal(body.response.data.receipt.data.details[key], value);
      }

      for (const [label, value] of serviceRequest.artifactChecks) {
        assert.ok(
          body.response.data.receipt.data.fields.some((field) => field.label === label && field.value === value)
        );
        assertReceiptArtifactsInclude(body.response.data, label);
        assertReceiptArtifactsInclude(body.response.data, value);
      }
    }

    const paypalHistoryPayload = JSON.stringify({
      update_id: 4000,
      message: {
        text: '/history paypal',
        chat: {
          id: 'tg-transferly-services-chat'
        },
        from: {
          id: 'tg-transferly-services',
          username: 'transferly_services_user',
          first_name: 'Transferly',
          last_name: 'Services'
        }
      }
    });

    const paypalHistoryResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: jsonHeaders(paypalHistoryPayload, {
        'x-telegram-bot-api-secret-token': ''
      }),
      body: paypalHistoryPayload
    });

    assert.equal(paypalHistoryResponse.status, 200);
    const paypalHistoryBody = paypalHistoryResponse.json();
    assert.equal(paypalHistoryBody.response.data.length, 1);
    assert.equal(paypalHistoryBody.response.data[0].data.details.service, 'paypal');
    assert.equal(paypalHistoryBody.response.data[0].data.details.invoice_or_transaction_id, 'PAYPAL-INV-001');

    const cryptoHistoryPayload = JSON.stringify({
      update_id: 4001,
      message: {
        text: '/history crypto-receipts',
        chat: {
          id: 'tg-transferly-services-chat'
        },
        from: {
          id: 'tg-transferly-services',
          username: 'transferly_services_user',
          first_name: 'Transferly',
          last_name: 'Services'
        }
      }
    });

    const cryptoHistoryResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: jsonHeaders(cryptoHistoryPayload, {
        'x-telegram-bot-api-secret-token': ''
      }),
      body: cryptoHistoryPayload
    });

    assert.equal(cryptoHistoryResponse.status, 200);
    const cryptoHistoryBody = cryptoHistoryResponse.json();
    assert.equal(cryptoHistoryBody.response.data.length, 1);
    assert.equal(cryptoHistoryBody.response.data[0].data.details.service, 'crypto-receipts');
    assert.equal(cryptoHistoryBody.response.data[0].data.details.transaction_hash, 'CRYPTO-HASH-001');
  });

  test('user-scoped invoice access blocks cross-account reads and lists only owned records', async () => {
    const demoPayload = JSON.stringify({
      userId: 'demo-user',
      recipientEmail: 'demo-buyer@example.com',
      currency: 'USD',
      description: 'Demo invoice',
      items: [
        {
          name: 'Consulting',
          description: 'Demo user invoice',
          quantity: 1,
          unitAmount: 50
        }
      ]
    });

    const secondaryPayload = JSON.stringify({
      userId: 'secondary-user',
      recipientEmail: 'secondary-buyer@example.com',
      currency: 'USD',
      description: 'Secondary invoice',
      items: [
        {
          name: 'Support',
          description: 'Secondary user invoice',
          quantity: 1,
          unitAmount: 70
        }
      ]
    });

    const demoInvoiceResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/invoices',
      headers: jsonHeaders(demoPayload, bearerHeaders(userTokens.demoUser)),
      body: demoPayload
    });

    const secondaryInvoiceResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/invoices',
      headers: jsonHeaders(secondaryPayload, bearerHeaders(userTokens.secondaryUser)),
      body: secondaryPayload
    });

    assert.equal(demoInvoiceResponse.status, 201);
    assert.equal(secondaryInvoiceResponse.status, 201);

    const demoInvoice = demoInvoiceResponse.json();
    const secondaryInvoice = secondaryInvoiceResponse.json();

    const forbiddenGet = await injectRequest(app, {
      method: 'GET',
      url: `/api/invoices/${secondaryInvoice.internal_invoice_id}`,
      headers: bearerHeaders(userTokens.demoUser)
    });

    assert.equal(forbiddenGet.status, 403);
    assert.equal(forbiddenGet.json().code, 'USER_SCOPE_VIOLATION');

    const demoList = await injectRequest(app, {
      method: 'GET',
      url: '/api/invoices',
      headers: bearerHeaders(userTokens.demoUser)
    });

    assert.equal(demoList.status, 200);
    const listBody = demoList.json();
    assert.equal(listBody.data.length, 1);
    assert.equal(listBody.data[0].internal_invoice_id, demoInvoice.internal_invoice_id);

    const filteredList = await injectRequest(app, {
      method: 'GET',
      url: '/api/invoices?recipient=demo-buyer&pageSize=1&sortBy=recipient&sortDirection=asc',
      headers: bearerHeaders(userTokens.demoUser)
    });

    assert.equal(filteredList.status, 200);
    const filteredBody = filteredList.json();
    assert.equal(filteredBody.data.length, 1);
    assert.equal(filteredBody.data[0].internal_invoice_id, demoInvoice.internal_invoice_id);
    assert.deepEqual(filteredBody.pagination, {
      page: 1,
      page_size: 1,
      total: 1,
      has_next_page: false
    });

    const adminInvoiceList = await injectRequest(app, {
      method: 'GET',
      url: '/api/admin/invoices?recipient=buyer&pageSize=1&sortBy=recipient&sortDirection=asc',
      headers: bearerHeaders(adminToken)
    });

    assert.equal(adminInvoiceList.status, 200);
    const adminInvoiceBody = adminInvoiceList.json();
    assert.equal(adminInvoiceBody.data.length, 1);
    assert.equal(adminInvoiceBody.data[0].user_id, 'demo-user');
    assert.deepEqual(adminInvoiceBody.pagination, {
      page: 1,
      page_size: 1,
      total: 2,
      has_next_page: true
    });
  });

  test('payout review and approval flow settles reserved funds after admin approval', async () => {
    const requestPayload = JSON.stringify({
      userId: 'demo-user',
      receiver: 'recipient@example.com',
      recipientType: 'EMAIL',
      receiverCountryCode: 'US',
      amount: 25,
      currency: 'USD',
      note: 'Weekly payout'
    });

    const requestResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/payouts',
      headers: jsonHeaders(requestPayload, bearerHeaders(userTokens.demoUser, {
        'idempotency-key': 'payout-review-1'
      })),
      body: requestPayload
    });

    assert.equal(requestResponse.status, 201);
    const requestBody = requestResponse.json();
    assert.equal(requestBody.status, 'PENDING_APPROVAL');
    assert.equal(requestBody.risk_decision, 'REVIEW');

    let user = await userRepository.findById('demo-user');
    assert.equal(user.wallet.availableBalanceCents, 247500);
    assert.equal(user.wallet.frozenBalanceCents, 2500);

    const approvalResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/admin/payouts/${requestBody.payout_id}/approve`,
      headers: bearerHeaders(adminToken)
    });

    assert.equal(approvalResponse.status, 200);
    const approvalBody = approvalResponse.json();
    assert.equal(approvalBody.status, 'SUCCESS');
    assert.equal(approvalBody.tracking.payout_batch_id, 'PAYOUT-BATCH-123');
    assert.equal(approvalBody.tracking.payout_item_id, 'PAYOUT-ITEM-123');

    const payout = await payoutRepository.findById(requestBody.payout_id);
    assert.ok(payout);
    assert.equal(payout.status, 'SUCCESS');

    user = await userRepository.findById('demo-user');
    assert.equal(user.wallet.availableBalanceCents, 247500);
    assert.equal(user.wallet.frozenBalanceCents, 0);
    assert.equal(user.wallet.paidOutBalanceCents, 2500);
  });

  test('payout policy enforces minimums, reserves fees, and flags manual review thresholds', async () => {
    await platformConfigRepository.update({
      payout_minimum_cents: 3000,
      payout_fee_fixed_cents: 150,
      payout_fee_percentage_bps: 100,
      payout_manual_review_cents: 2000
    });

    const previewPayload = JSON.stringify({
      userId: 'demo-user',
      receiver: 'threshold@example.com',
      recipientType: 'EMAIL',
      receiverCountryCode: 'US',
      amount: 35,
      currency: 'USD',
      note: 'Preview policy payout'
    });

    const previewResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/payouts/preview',
      headers: jsonHeaders(previewPayload, bearerHeaders(userTokens.demoUser)),
      body: previewPayload
    });

    assert.equal(previewResponse.status, 200);
    const previewBody = previewResponse.json();
    assert.equal(previewBody.requested_amount, '35.00');
    assert.equal(previewBody.fee_amount, '1.85');
    assert.equal(previewBody.total_debit, '36.85');
    assert.equal(previewBody.balance.available_cents, 250000);
    assert.equal(previewBody.balance.remaining_available_cents, 246315);
    assert.equal(previewBody.balance.sufficient, true);
    assert.equal(previewBody.next_action, 'MANUAL_REVIEW');

    const belowMinimumPayload = JSON.stringify({
      userId: 'demo-user',
      receiver: 'threshold@example.com',
      recipientType: 'EMAIL',
      receiverCountryCode: 'US',
      amount: 25,
      currency: 'USD',
      note: 'Below minimum payout'
    });

    const belowMinimumResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/payouts',
      headers: jsonHeaders(belowMinimumPayload, bearerHeaders(userTokens.demoUser, {
        'idempotency-key': 'payout-policy-minimum-1'
      })),
      body: belowMinimumPayload
    });

    assert.equal(belowMinimumResponse.status, 409);
    assert.equal(belowMinimumResponse.json().code, 'PAYOUT_BELOW_MINIMUM');

    const requestPayload = JSON.stringify({
      userId: 'demo-user',
      receiver: 'threshold@example.com',
      recipientType: 'EMAIL',
      receiverCountryCode: 'US',
      amount: 35,
      currency: 'USD',
      note: 'Policy payout'
    });

    const requestResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/payouts',
      headers: jsonHeaders(requestPayload, bearerHeaders(userTokens.demoUser, {
        'idempotency-key': 'payout-policy-minimum-2'
      })),
      body: requestPayload
    });

    assert.equal(requestResponse.status, 201);
    const requestBody = requestResponse.json();
    assert.equal(requestBody.status, 'PENDING_APPROVAL');
    assert.equal(requestBody.risk_decision, 'REVIEW');

    let user = await userRepository.findById('demo-user');
    assert.equal(user.wallet.availableBalanceCents, 246315);
    assert.equal(user.wallet.frozenBalanceCents, 3685);

    const payoutDetailResponse = await injectRequest(app, {
      method: 'GET',
      url: `/api/payouts/${requestBody.payout_id}`,
      headers: bearerHeaders(userTokens.demoUser)
    });

    assert.equal(payoutDetailResponse.status, 200);
    const payoutBody = payoutDetailResponse.json();
    assert.equal(payoutBody.summary.amount, '35.00');
    assert.equal(payoutBody.summary.fee_amount, '1.85');
    assert.equal(payoutBody.summary.total_debit, '36.85');
    assert.equal(payoutBody.pricing.fee_amount, '1.85');
    assert.equal(payoutBody.pricing.total_debit, '36.85');
    assert.equal(payoutBody.pricing.fee_fixed_amount, '1.50');
    assert.equal(payoutBody.pricing.fee_percentage_bps, 100);

    const payoutFlags = await db.all('SELECT rule_code FROM risk_flags WHERE payout_id = ?', [requestBody.payout_id]);
    assert.ok(payoutFlags.some((flag) => flag.rule_code === 'PAYOUT_MANUAL_REVIEW_THRESHOLD'));

    const approvalResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/admin/payouts/${requestBody.payout_id}/approve`,
      headers: bearerHeaders(adminToken)
    });

    assert.equal(approvalResponse.status, 200);
    assert.equal(approvalResponse.json().status, 'SUCCESS');

    user = await userRepository.findById('demo-user');
    assert.equal(user.wallet.availableBalanceCents, 246315);
    assert.equal(user.wallet.frozenBalanceCents, 0);
    assert.equal(user.wallet.paidOutBalanceCents, 3685);
  });

  test('Stripe payout preview and approval create a guarded Connect transfer', async () => {
    await platformConfigRepository.update({
      payout_fee_fixed_cents: 150,
      payout_fee_percentage_bps: 100,
      payout_manual_review_cents: 2000
    });

    const previewPayload = JSON.stringify({
      provider: 'stripe',
      userId: 'demo-user',
      receiver: 'acct_connected_001',
      recipientType: 'STRIPE_ACCOUNT',
      receiverCountryCode: 'US',
      amount: 35,
      currency: 'USD',
      note: 'Stripe payout preview'
    });

    const previewResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/payouts/preview',
      headers: jsonHeaders(previewPayload, bearerHeaders(adminToken)),
      body: previewPayload
    });

    assert.equal(previewResponse.status, 200);
    const preview = previewResponse.json();
    assert.equal(preview.provider, 'stripe');
    assert.equal(preview.submission_enabled, true);
    assert.equal(preview.payout_mode, 'transfer_to_connected_account');
    assert.equal(preview.requested_amount, '35.00');
    assert.equal(preview.fee_amount, '1.85');
    assert.equal(preview.total_debit, '36.85');
    assert.equal(preview.provider_balance.available_for_currency_cents, 125000);
    assert.equal(preview.provider_balance.sufficient_for_requested_amount, true);
    assert.equal(preview.next_action, 'MANUAL_REVIEW');

    const requestResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/payouts',
      headers: jsonHeaders(previewPayload, bearerHeaders(adminToken, {
        'idempotency-key': 'stripe-payout-transfer-1'
      })),
      body: previewPayload
    });

    assert.equal(requestResponse.status, 201);
    const requestBody = requestResponse.json();
    assert.equal(requestBody.status, 'PENDING_APPROVAL');
    assert.equal(requestBody.risk_decision, 'REVIEW');
    assert.equal(requestBody.metadata.provider, 'stripe');
    assert.equal(requestBody.metadata.stripe_destination_account_id, 'acct_connected_001');

    let user = await userRepository.findById('demo-user');
    assert.equal(user.wallet.availableBalanceCents, 246315);
    assert.equal(user.wallet.frozenBalanceCents, 3685);

    const approvalResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/admin/payouts/${requestBody.payout_id}/approve`,
      headers: bearerHeaders(adminToken)
    });

    assert.equal(approvalResponse.status, 200);
    const approved = approvalResponse.json();
    assert.equal(approved.status, 'SUCCESS');
    assert.equal(approved.metadata.provider, 'stripe');
    assert.equal(approved.metadata.provider_transfer_id, 'tr_transferly_1');
    assert.equal(approved.metadata.provider_item_status, 'TRANSFERRED');
    assert.equal(stripeTransferSequence, 1);

    user = await userRepository.findById('demo-user');
    assert.equal(user.wallet.availableBalanceCents, 246315);
    assert.equal(user.wallet.frozenBalanceCents, 0);
    assert.equal(user.wallet.paidOutBalanceCents, 3685);
  });

  test('POST /api/payouts/:id/refresh and GET /api/payouts/:id/timeline expose payout sync activity', async () => {
    const requestPayload = JSON.stringify({
      userId: 'demo-user',
      receiver: 'recipient@example.com',
      recipientType: 'EMAIL',
      receiverCountryCode: 'US',
      amount: 25,
      currency: 'USD',
      note: 'Refresh payout'
    });

    const requestResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/payouts',
      headers: jsonHeaders(requestPayload, bearerHeaders(userTokens.demoUser, {
        'idempotency-key': 'payout-refresh-1'
      })),
      body: requestPayload
    });

    assert.equal(requestResponse.status, 201);
    const requestBody = requestResponse.json();
    assert.equal(requestBody.status, 'PENDING_APPROVAL');

    const approvalResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/admin/payouts/${requestBody.payout_id}/approve`,
      headers: bearerHeaders(adminToken)
    });

    assert.equal(approvalResponse.status, 200);

    const refreshResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/payouts/${requestBody.payout_id}/refresh`,
      headers: bearerHeaders(userTokens.demoUser)
    });

    assert.equal(refreshResponse.status, 200);
    const refreshedPayout = refreshResponse.json();
    assert.equal(refreshedPayout.status, 'SUCCESS');
    assert.equal(refreshedPayout.metadata.provider_item_status, 'SUCCESS');
    assert.ok(refreshedPayout.metadata.last_synced_at);

    const notePayload = JSON.stringify({ note: 'Confirmed recipient identity before release.' });
    const noteResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/admin/payouts/${requestBody.payout_id}/notes`,
      headers: jsonHeaders(notePayload, bearerHeaders(adminToken)),
      body: notePayload
    });

    assert.equal(noteResponse.status, 201);
    assert.equal(noteResponse.json().note, 'Confirmed recipient identity before release.');

    const timelineResponse = await injectRequest(app, {
      method: 'GET',
      url: `/api/payouts/${requestBody.payout_id}/timeline?limit=10`,
      headers: bearerHeaders(userTokens.demoUser)
    });

    assert.equal(timelineResponse.status, 200);
    const timelineBody = timelineResponse.json();
    assert.ok(timelineBody.data.some((entry) => entry.action === 'payout.requested'));
    assert.ok(
      timelineBody.data.some((entry) =>
        entry.action === 'payout.refreshed' || entry.action === 'payout.processed'
      )
    );
    assert.ok(timelineBody.data.some((entry) => entry.action === 'payout.note_added'));
  });

  test('admin can cancel an unclaimed PayPal payout item and restore funds to available balance', async () => {
    const requestPayload = JSON.stringify({
      userId: 'demo-user',
      receiver: 'unclaimed@example.com',
      recipientType: 'EMAIL',
      receiverCountryCode: 'US',
      amount: 25,
      currency: 'USD',
      note: 'Unclaimed payout'
    });

    const requestResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/payouts',
      headers: jsonHeaders(requestPayload, bearerHeaders(userTokens.demoUser, {
        'idempotency-key': 'payout-unclaimed-1'
      })),
      body: requestPayload
    });

    assert.equal(requestResponse.status, 201);
    const requestBody = requestResponse.json();
    assert.equal(requestBody.status, 'PENDING_APPROVAL');

    const approvalResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/admin/payouts/${requestBody.payout_id}/approve`,
      headers: bearerHeaders(adminToken)
    });

    assert.equal(approvalResponse.status, 200);
    assert.equal(approvalResponse.json().status, 'PENDING');
    assert.equal(approvalResponse.json().official_paypal.provider_item_status, 'UNCLAIMED');
    assert.equal(approvalResponse.json().official_paypal.remediation.action, 'cancel_unclaimed');

    let user = await userRepository.findById('demo-user');
    assert.equal(user.wallet.availableBalanceCents, 247500);
    assert.equal(user.wallet.frozenBalanceCents, 2500);

    const cancelResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/admin/payouts/${requestBody.payout_id}/cancel-unclaimed`,
      headers: bearerHeaders(adminToken)
    });

    assert.equal(cancelResponse.status, 200);
    const cancelledPayout = cancelResponse.json();
    assert.equal(cancelledPayout.status, 'FAILED');
    assert.equal(cancelledPayout.official_paypal.provider_item_status, 'RETURNED');

    user = await userRepository.findById('demo-user');
    assert.equal(user.wallet.availableBalanceCents, 250000);
    assert.equal(user.wallet.frozenBalanceCents, 0);
  });

  test('held payouts surface provider remediation guidance in admin listings', async () => {
    const requestPayload = JSON.stringify({
      userId: 'demo-user',
      receiver: 'held@example.com',
      recipientType: 'EMAIL',
      receiverCountryCode: 'US',
      amount: 25,
      currency: 'USD',
      note: 'Held payout'
    });

    const requestResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/payouts',
      headers: jsonHeaders(requestPayload, bearerHeaders(userTokens.demoUser, {
        'idempotency-key': 'payout-held-1'
      })),
      body: requestPayload
    });

    assert.equal(requestResponse.status, 201);
    const requestBody = requestResponse.json();

    const approvalResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/admin/payouts/${requestBody.payout_id}/approve`,
      headers: bearerHeaders(adminToken)
    });

    assert.equal(approvalResponse.status, 200);
    assert.equal(approvalResponse.json().status, 'PENDING');

    const adminListResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/admin/payouts?status=PENDING',
      headers: bearerHeaders(adminToken)
    });

    assert.equal(adminListResponse.status, 200);
    const heldPayout = adminListResponse.json().data.find((entry) => entry.payout_id === requestBody.payout_id);
    assert.ok(heldPayout);
    assert.equal(heldPayout.official_paypal.provider_item_status, 'ONHOLD');
    assert.equal(heldPayout.official_paypal.provider_issue_code, 'REGULATORY_PENDING');
    assert.equal(heldPayout.official_paypal.remediation.action, 'review_hold');

    const filteredListResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/admin/payouts?providerState=ONHOLD&recipient=held&pageSize=5&sortBy=amount&sortDirection=asc',
      headers: bearerHeaders(adminToken)
    });

    assert.equal(filteredListResponse.status, 200);
    assert.equal(filteredListResponse.json().data.length, 1);
    assert.equal(filteredListResponse.json().data[0].payout_id, requestBody.payout_id);

    const paypalProviderResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/admin/payouts?provider=paypal&pageSize=5',
      headers: bearerHeaders(adminToken)
    });

    assert.equal(paypalProviderResponse.status, 200);
    assert.ok(paypalProviderResponse.json().data.some((entry) => entry.payout_id === requestBody.payout_id));

    const stripeProviderResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/admin/payouts?provider=stripe&pageSize=5',
      headers: bearerHeaders(adminToken)
    });

    assert.equal(stripeProviderResponse.status, 200);
    assert.equal(stripeProviderResponse.json().data.some((entry) => entry.payout_id === requestBody.payout_id), false);
  });

  test('PayPal payout item webhooks trigger payout resync through official PayPal endpoints', async () => {
    const requestPayload = JSON.stringify({
      userId: 'demo-user',
      receiver: 'recipient@example.com',
      recipientType: 'EMAIL',
      receiverCountryCode: 'US',
      amount: 25,
      currency: 'USD',
      note: 'Webhook payout'
    });

    const requestResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/payouts',
      headers: jsonHeaders(requestPayload, bearerHeaders(userTokens.demoUser, {
        'idempotency-key': 'payout-webhook-1'
      })),
      body: requestPayload
    });

    assert.equal(requestResponse.status, 201);
    const requestBody = requestResponse.json();

    const approvalResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/admin/payouts/${requestBody.payout_id}/approve`,
      headers: bearerHeaders(adminToken)
    });

    assert.equal(approvalResponse.status, 200);

    const webhookPayload = JSON.stringify({
      id: 'WH-PAYOUT-1',
      event_type: 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED',
      resource_type: 'payout_item',
      create_time: '2026-05-05T00:00:00Z',
      resource: {
        payout_item_id: 'PAYOUT-ITEM-123'
      }
    });

    const webhookHeaders = {
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-cert-url': 'https://api-m.sandbox.paypal.com/certs/test',
      'paypal-transmission-id': 'transmission-payout-1',
      'paypal-transmission-sig': 'signature-payout-1',
      'paypal-transmission-time': '2026-05-05T00:00:00Z'
    };

    const webhookResponse = await injectRequest(app, {
      method: 'POST',
      url: '/webhooks/paypal',
      headers: jsonHeaders(webhookPayload, webhookHeaders),
      body: webhookPayload
    });

    assert.equal(webhookResponse.status, 202);

    const payout = await payoutRepository.findById(requestBody.payout_id);
    assert.equal(payout.status, 'SUCCESS');
    assert.equal(payout.paypalPayoutItemId, 'PAYOUT-ITEM-123');
    assert.equal(payout.metadata.provider_item_status, 'SUCCESS');
  });

  test('admin invoice release moves paid funds from pending to available and is surfaced in admin listings', async () => {
    const invoice = await invoiceRepository.create({
      userId: 'demo-user',
      paypalInvoiceId: 'PP-INV-RELEASE-1',
      invoiceNumber: 'INV-RELEASE-1',
      status: 'SENT',
      amountCents: 9100,
      currencyCode: 'USD',
      recipientEmail: 'buyer@example.com',
      description: 'Release test invoice',
      invoiceUrl: 'https://www.sandbox.paypal.com/invoice/p/#PP-INV-RELEASE-1',
      paypalDetails: {},
      metadata: {}
    });

    const webhookPayload = JSON.stringify({
      id: 'WH-EVENT-RELEASE-1',
      event_type: 'INVOICING.INVOICE.PAID',
      resource_type: 'invoice',
      create_time: '2026-05-05T00:00:00Z',
      resource: {
        invoice_id: invoice.paypalInvoiceId
      }
    });

    const webhookHeaders = {
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-cert-url': 'https://api-m.sandbox.paypal.com/certs/test',
      'paypal-transmission-id': 'transmission-release-1',
      'paypal-transmission-sig': 'signature-release-1',
      'paypal-transmission-time': '2026-05-05T00:00:00Z'
    };

    const webhookResponse = await injectRequest(app, {
      method: 'POST',
      url: '/webhooks/paypal',
      headers: jsonHeaders(webhookPayload, webhookHeaders),
      body: webhookPayload
    });

    assert.equal(webhookResponse.status, 202);

    let user = await userRepository.findById('demo-user');
    assert.equal(user.wallet.pendingBalanceCents, 9100);
    assert.equal(user.wallet.availableBalanceCents, 250000);

    const releasePayload = JSON.stringify({
      amount: 91,
      reason: 'Settlement window completed'
    });

    const releaseResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/admin/invoices/${invoice.id}/release`,
      headers: jsonHeaders(
        releasePayload,
        bearerHeaders(adminToken, {
          'idempotency-key': 'release-paid-invoice-1'
        })
      ),
      body: releasePayload
    });

    assert.equal(releaseResponse.status, 200);
    const releaseBody = releaseResponse.json();
    assert.equal(releaseBody.invoice_id, invoice.paypalInvoiceId);
    assert.equal(releaseBody.released_amount, '91.00');
    assert.equal(releaseBody.remaining_releasable_amount, '0.00');

    user = await userRepository.findById('demo-user');
    assert.equal(user.wallet.pendingBalanceCents, 0);
    assert.equal(user.wallet.availableBalanceCents, 259100);

    const webhookListResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/admin/webhooks?status=PROCESSED',
      headers: bearerHeaders(adminToken)
    });

    assert.equal(webhookListResponse.status, 200);
    const webhookList = webhookListResponse.json();
    assert.equal(webhookList.data.length, 1);
    assert.equal(webhookList.data[0].event_id, 'WH-EVENT-RELEASE-1');
  });

  test('admin operations endpoints expose payouts, risk flags, and webhook events for review queues', async () => {
    const invoicePayload = JSON.stringify({
      userId: 'demo-user',
      recipientEmail: 'buyer@example.com',
      currency: 'USD',
      description: 'Crypto settlement invoice',
      items: [
        {
          name: 'Advisory',
          description: 'Crypto treasury planning',
          quantity: 1,
          unitAmount: 40
        }
      ]
    });

    const invoiceResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/invoices',
      headers: jsonHeaders(invoicePayload, bearerHeaders(userTokens.demoUser)),
      body: invoicePayload
    });

    assert.equal(invoiceResponse.status, 201);

    const payoutPayload = JSON.stringify({
      userId: 'demo-user',
      receiver: 'review@example.com',
      recipientType: 'EMAIL',
      receiverCountryCode: 'US',
      amount: 25,
      currency: 'USD',
      note: 'Operations review payout'
    });

    const payoutResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/payouts',
      headers: jsonHeaders(
        payoutPayload,
        bearerHeaders(userTokens.demoUser, {
          'idempotency-key': 'payout-admin-list-1'
        })
      ),
      body: payoutPayload
    });

    assert.equal(payoutResponse.status, 201);
    assert.equal(payoutResponse.json().status, 'PENDING_APPROVAL');

    const payoutListResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/admin/payouts?status=PENDING_APPROVAL',
      headers: bearerHeaders(adminToken)
    });

    assert.equal(payoutListResponse.status, 200);
    const payoutList = payoutListResponse.json();
    assert.equal(payoutList.data.length, 1);
    assert.equal(payoutList.data[0].status, 'PENDING_APPROVAL');

    const riskFlagsResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/admin/risk-flags?severity=MEDIUM',
      headers: bearerHeaders(adminToken)
    });

    assert.equal(riskFlagsResponse.status, 200);
    const riskFlagsBody = riskFlagsResponse.json();
    assert.ok(riskFlagsBody.data.length >= 2);
    assert.ok(
      riskFlagsBody.data.some((flag) => flag.rule_code === 'SUSPICIOUS_INVOICE_DESCRIPTION')
    );
    assert.ok(riskFlagsBody.data.some((flag) => flag.rule_code === 'NEW_RECIPIENT_HOLD'));
  });

  test('admin ops endpoints expose queue health and dead-letter jobs', async () => {
    opsService.getQueueOverview = async () => ({
      generated_at: '2026-05-05T00:00:00.000Z',
      redis_status: 'ready',
      queues: [
        {
          key: 'payout_process',
          name: 'payout-process',
          counts: {
            waiting: 1,
            active: 0,
            completed: 4,
            failed: 0,
            delayed: 2,
            paused: 0
          }
        }
      ]
    });

    opsService.listDeadLetterJobs = async () => [
      {
        job_id: '17',
        name: 'payout-process-dead-letter',
        attempts_made: 5,
        failed_reason: 'Provider timeout',
        queue_name: 'dead-letter',
        source_queue: 'payout-process',
        source_job_id: 'payout-job-1',
        recovery: null,
        data: {
          sourceQueue: 'payout-process',
          sourceJobId: 'payout-job-1',
          payload: {
            payoutId: 'payout-1'
          }
        },
        created_at: '2026-05-05T00:00:00.000Z',
        finished_at: '2026-05-05T00:01:00.000Z'
      }
    ];
    opsService.recoverDeadLetterJob = async (jobId, input) => ({
      dead_letter: {
        job_id: jobId,
        name: 'payout-process-dead-letter',
        attempts_made: 5,
        failed_reason: 'Provider timeout',
        queue_name: 'dead-letter',
        source_queue: 'payout-process',
        source_job_id: 'payout-job-1',
        recovery: {
          recoveredAt: '2026-05-05T00:02:00.000Z',
          recoveredByActorId: input.adminActorId,
          note: input.note,
          recoveryJobId: 'recovered-job-1',
          recoveryJobName: 'process-approved-payout',
          sourceQueue: 'payout-process'
        },
        data: {
          sourceQueue: 'payout-process',
          sourceJobId: 'payout-job-1',
          payload: {
            payoutId: 'payout-1'
          }
        },
        created_at: '2026-05-05T00:00:00.000Z',
        finished_at: '2026-05-05T00:01:00.000Z'
      },
      recovery: {
        recovered_at: '2026-05-05T00:02:00.000Z',
        recovered_by_actor_id: input.adminActorId,
        note: input.note,
        source_queue: 'payout-process',
        recovery_job_id: 'recovered-job-1',
        recovery_job_name: 'process-approved-payout'
      }
    });

    const queueResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/admin/queues',
      headers: bearerHeaders(adminToken)
    });

    assert.equal(queueResponse.status, 200);
    const queueBody = queueResponse.json();
    assert.equal(queueBody.redis_status, 'ready');
    assert.equal(queueBody.queues.length, 1);
    assert.equal(queueBody.queues[0].name, 'payout-process');
    assert.equal(queueBody.queues[0].counts.delayed, 2);

    const deadLetterResponse = await injectRequest(app, {
      method: 'GET',
      url: '/api/admin/dead-letters?limit=10',
      headers: bearerHeaders(adminToken)
    });

    assert.equal(deadLetterResponse.status, 200);
    const deadLetterBody = deadLetterResponse.json();
    assert.equal(deadLetterBody.data.length, 1);
    assert.equal(deadLetterBody.data[0].job_id, '17');
    assert.equal(deadLetterBody.data[0].queue_name, 'dead-letter');
    assert.equal(deadLetterBody.data[0].source_queue, 'payout-process');

    const recoveryPayload = JSON.stringify({ note: 'retry after provider incident' });
    const recoveryResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/admin/dead-letters/17/recover',
      headers: jsonHeaders(recoveryPayload, bearerHeaders(adminToken)),
      body: recoveryPayload
    });

    assert.equal(recoveryResponse.status, 200);
    const recoveryBody = recoveryResponse.json();
    assert.equal(recoveryBody.dead_letter.job_id, '17');
    assert.equal(recoveryBody.recovery.source_queue, 'payout-process');
    assert.equal(recoveryBody.recovery.recovery_job_name, 'process-approved-payout');
    assert.equal(recoveryBody.recovery.note, 'retry after provider incident');

    opsService.getQueueOverview = originalGetQueueOverview;
    opsService.listDeadLetterJobs = originalListDeadLetterJobs;
    opsService.recoverDeadLetterJob = originalRecoverDeadLetterJob;
  });

  test('admin reconciliation trigger refreshes reconcilable invoice state through official PayPal sync', async () => {
    const payload = JSON.stringify({
      userId: 'demo-user',
      recipientEmail: 'buyer@example.com',
      currency: 'USD',
      description: 'Reconcilable invoice',
      items: [
        {
          name: 'Consulting',
          description: 'Reconciliation invoice',
          quantity: 1,
          unitAmount: 125
        }
      ]
    });

    const createResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/invoices',
      headers: jsonHeaders(payload, bearerHeaders(userTokens.demoUser)),
      body: payload
    });

    assert.equal(createResponse.status, 201);
    const createdInvoice = createResponse.json();
    sandboxInvoices.get(createdInvoice.invoice_id).status = 'PAID';

    const reconcileResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/admin/reconciliation/run',
      headers: jsonHeaders('{}', bearerHeaders(adminToken)),
      body: '{}'
    });

    assert.equal(reconcileResponse.status, 200);
    const reconcileBody = reconcileResponse.json();
    assert.equal(reconcileBody.summary.invoice_count, 1);
    assert.equal(reconcileBody.summary.payout_count, 0);
    assert.equal(reconcileBody.invoices[0].status, 'PAID');
  });

  test('Stripe invoice paid webhook verifies signature, settles pending funds, and deduplicates events and refreshes', async () => {
    const payload = JSON.stringify({
      userId: 'demo-user',
      provider: 'stripe',
      recipientEmail: 'buyer@example.com',
      currency: 'USD',
      description: 'Stripe webhook invoice',
      items: [
        {
          name: 'Consulting',
          description: 'Webhook invoice',
          quantity: 1,
          unitAmount: 125
        }
      ]
    });

    const createResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/invoices',
      headers: jsonHeaders(payload, bearerHeaders(userTokens.demoUser)),
      body: payload
    });

    assert.equal(createResponse.status, 201);
    const createdInvoice = createResponse.json();

    const webhookPayload = JSON.stringify({
      id: 'evt_stripe_invoice_paid_1',
      type: 'invoice.paid',
      data: {
        object: {
          id: createdInvoice.invoice_id,
          object: 'invoice',
          status: 'paid',
          hosted_invoice_url: createdInvoice.invoice_link,
          invoice_pdf: 'https://invoice.stripe.test/in_transferly_1.pdf',
          status_transitions: {
            paid_at: 1773350400
          }
        }
      }
    });
    const headers = {
      'content-type': 'application/json',
      'stripe-signature': createStripeSignature(webhookPayload)
    };

    const webhookResponse = await injectRequest(app, {
      method: 'POST',
      url: '/webhooks/stripe',
      headers: jsonHeaders(webhookPayload, headers),
      body: webhookPayload
    });

    assert.equal(webhookResponse.status, 202);
    assert.equal(webhookResponse.json().duplicate, false);

    let user = await userRepository.findById('demo-user');
    assert.equal(user.wallet.pendingBalanceCents, 12500);

    const duplicateResponse = await injectRequest(app, {
      method: 'POST',
      url: '/webhooks/stripe',
      headers: jsonHeaders(webhookPayload, headers),
      body: webhookPayload
    });

    assert.equal(duplicateResponse.status, 200);
    assert.equal(duplicateResponse.json().duplicate, true);

    const updatedInvoice = await invoiceRepository.findByPaypalInvoiceId(createdInvoice.invoice_id);
    assert.equal(updatedInvoice.status, 'PAID');
    assert.equal(updatedInvoice.metadata.provider, 'stripe');

    const webhookEvent = await webhookEventRepository.findByEventId('stripe:evt_stripe_invoice_paid_1');
    assert.ok(webhookEvent);
    assert.equal(webhookEvent.status, 'PROCESSED');

    user = await userRepository.findById('demo-user');
    assert.equal(user.wallet.pendingBalanceCents, 12500);

    const refreshResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/invoices/${createdInvoice.internal_invoice_id}/refresh`,
      headers: jsonHeaders('{}', bearerHeaders(userTokens.demoUser)),
      body: '{}'
    });

    assert.equal(refreshResponse.status, 200);
    user = await userRepository.findById('demo-user');
    assert.equal(user.wallet.pendingBalanceCents, 12500);
  });

  test('Crypto charge confirmed webhook verifies signature, deduplicates refreshes, and keeps settlement review required', async () => {
    const payload = JSON.stringify({
      userId: 'demo-user',
      provider: 'crypto',
      recipientEmail: 'buyer@example.com',
      currency: 'USD',
      description: 'Crypto webhook invoice',
      items: [
        {
          name: 'Crypto consulting',
          description: 'Webhook charge',
          quantity: 1,
          unitAmount: 125
        }
      ]
    });

    const createResponse = await injectRequest(app, {
      method: 'POST',
      url: '/api/invoices',
      headers: jsonHeaders(payload, bearerHeaders(userTokens.demoUser)),
      body: payload
    });

    assert.equal(createResponse.status, 201);
    const createdInvoice = createResponse.json();

    const webhookPayload = JSON.stringify({
      id: 'evt_crypto_charge_confirmed_1',
      type: 'charge:confirmed',
      data: {
        id: createdInvoice.invoice_id,
        code: 'CHARGE1',
        resource: 'charge',
        hosted_url: createdInvoice.invoice_link,
        timeline: [{ status: 'NEW' }, { status: 'CONFIRMED' }]
      }
    });
    const headers = {
      'content-type': 'application/json',
      'x-hook0-id': 'hook-crypto-1'
    };
    headers['x-hook0-signature'] = createCoinbaseSignature(webhookPayload, headers);

    const webhookResponse = await injectRequest(app, {
      method: 'POST',
      url: '/webhooks/crypto',
      headers: jsonHeaders(webhookPayload, headers),
      body: webhookPayload
    });

    assert.equal(webhookResponse.status, 202);
    assert.equal(webhookResponse.json().duplicate, false);

    const updatedInvoice = await invoiceRepository.findByPaypalInvoiceId(createdInvoice.invoice_id);
    assert.equal(updatedInvoice.status, 'PAID');
    assert.equal(updatedInvoice.metadata.provider, 'crypto');
    assert.equal(updatedInvoice.metadata.settlement_review_required, true);
    assert.ok(updatedInvoice.metadata.settlement_safeguards.includes('network_mismatch_review'));

    let user = await userRepository.findById('demo-user');
    assert.equal(user.wallet.pendingBalanceCents, 12500);

    const refreshResponse = await injectRequest(app, {
      method: 'POST',
      url: `/api/invoices/${createdInvoice.internal_invoice_id}/refresh`,
      headers: jsonHeaders('{}', bearerHeaders(userTokens.demoUser)),
      body: '{}'
    });

    assert.equal(refreshResponse.status, 200);
    user = await userRepository.findById('demo-user');
    assert.equal(user.wallet.pendingBalanceCents, 12500);
  });

  test('PayPal invoice paid webhook is idempotent for duplicate event ids', async () => {
    const invoice = await invoiceRepository.create({
      userId: 'demo-user',
      paypalInvoiceId: 'PP-INV-PAID-1',
      invoiceNumber: 'INV-PAID-1',
      status: 'SENT',
      amountCents: 8800,
      currencyCode: 'USD',
      recipientEmail: 'buyer@example.com',
      description: 'Paid invoice test',
      invoiceUrl: 'https://www.sandbox.paypal.com/invoice/p/#PP-INV-PAID-1',
      paypalDetails: {},
      metadata: {}
    });

    const webhookPayload = {
      id: 'WH-EVENT-1',
      event_type: 'INVOICING.INVOICE.PAID',
      resource_type: 'invoice',
      create_time: '2026-05-05T00:00:00Z',
      resource: {
        invoice_id: invoice.paypalInvoiceId
      }
    };

    const headers = {
      'content-type': 'application/json',
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-cert-url': 'https://api-m.sandbox.paypal.com/certs/test',
      'paypal-transmission-id': 'transmission-1',
      'paypal-transmission-sig': 'signature-1',
      'paypal-transmission-time': '2026-05-05T00:00:00Z'
    };

    const firstPayload = JSON.stringify(webhookPayload);

    const firstResponse = await injectRequest(app, {
      method: 'POST',
      url: '/webhooks/paypal',
      headers: jsonHeaders(firstPayload, headers),
      body: firstPayload
    });

    assert.equal(firstResponse.status, 202);
    const firstBody = firstResponse.json();
    assert.equal(firstBody.duplicate, false);

    let user = await userRepository.findById('demo-user');
    assert.equal(user.wallet.pendingBalanceCents, 8800);

    const duplicateResponse = await injectRequest(app, {
      method: 'POST',
      url: '/webhooks/paypal',
      headers: jsonHeaders(firstPayload, headers),
      body: firstPayload
    });

    assert.equal(duplicateResponse.status, 200);
    const duplicateBody = duplicateResponse.json();
    assert.equal(duplicateBody.duplicate, true);

    const webhookEvent = await webhookEventRepository.findByEventId('WH-EVENT-1');
    assert.ok(webhookEvent);
    assert.equal(webhookEvent.status, 'PROCESSED');

    const updatedInvoice = await invoiceRepository.findById(invoice.id);
    assert.equal(updatedInvoice.status, 'PAID');

    user = await userRepository.findById('demo-user');
    assert.equal(user.wallet.pendingBalanceCents, 8800);
  });

  test('admin routes require an admin bearer token when admin auth is configured', async () => {
    const response = await injectRequest(app, {
      method: 'GET',
      url: '/api/admin/payouts'
    });

    assert.equal(response.status, 401);
    assert.equal(response.json().code, 'ADMIN_AUTH_REQUIRED');
  });
});
