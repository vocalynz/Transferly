import { expect, test } from '@playwright/test';

const adminUser = {
  id: 'admin-user',
  email: 'admin@transferly.test',
  displayName: 'Admin Operator',
  isAdmin: true
};

const adminProfile = {
  id: 'admin-user',
  name: 'Admin Operator',
  is_admin: true,
  points: 5000,
  wallet: {
    currencyCode: 'USD',
    availableBalanceCents: 125000,
    pendingBalanceCents: 18000,
    frozenBalanceCents: 5000,
    paidOutBalanceCents: 74000
  }
};

const invoiceRecord = {
  internal_invoice_id: 'inv_internal_1001',
  invoice_id: 'PAYPAL-INV-1001',
  provider: 'paypal',
  status: 'SENT',
  summary: {
    invoice_number: 'INV-1001',
    recipient_email: 'buyer@example.com',
    amount: '150.00',
    currency: 'USD',
    issue_date: '2026-05-10',
    due_date: '2026-05-17',
    auto_reminders_cancelled_at: null
  },
  official_paypal: {
    last_synced_at: '2026-05-10T12:00:00.000Z',
    qr: {
      image_url_png: 'https://example.test/invoice-qr.png'
    }
  },
  metadata: {}
};

const stripeInvoiceRecord = {
  internal_invoice_id: 'stripe_invoice_1002',
  invoice_id: 'STRIPE-INV-1002',
  provider: 'stripe',
  status: 'PAID',
  summary: {
    invoice_number: 'INV-1002',
    recipient_email: 'stripe-buyer@example.com',
    amount: '321.50',
    currency: 'USD',
    issue_date: '2026-05-11',
    due_date: '2026-05-18'
  },
  metadata: {
    provider: 'stripe'
  }
};

const payoutRecord = {
  payout_id: 'payout_1001',
  provider: 'paypal',
  status: 'PENDING_APPROVAL',
  risk_decision: 'REVIEW',
  summary: {
    receiver: 'recipient@example.com',
    recipient_type: 'EMAIL',
    amount: '75.00',
    currency: 'USD',
    total_debit: '76.25'
  },
  pricing: {
    fee: '1.25'
  },
  tracking: {
    sender_batch_id: 'batch_1001',
    payout_batch_id: 'paypal_batch_1001',
    payout_item_id: 'paypal_item_1001'
  },
  official_paypal: {
    provider_item_status: 'PENDING',
    provider_batch_status: 'PROCESSING',
    last_synced_at: '2026-05-10T12:00:00.000Z',
    remediation: {
      reason: 'Manual review required before provider submission.'
    }
  },
  metadata: {}
};

const cryptoPayoutRecord = {
  payout_id: 'crypto_payout_1002',
  provider: 'crypto',
  status: 'COMPLETED',
  summary: {
    receiver: 'wallet@example.com',
    recipient_type: 'WALLET',
    amount: '42.00',
    currency: 'USD',
    total_debit: '42.00'
  },
  metadata: {
    provider: 'crypto'
  }
};

const stripePaymentIssue = {
  payment_issue_id: 'issue_stripe_1001',
  provider: 'stripe',
  entity_type: 'invoice',
  entity_id: 'stripe_invoice_1002',
  issue_type: 'webhook_delay',
  severity: 'high',
  status: 'open',
  summary: 'Stripe webhook delivery is delayed',
  metadata: {
    provider: 'stripe'
  },
  created_at: '2026-05-11T12:04:00.000Z',
  updated_at: '2026-05-11T12:05:00.000Z'
};

const webhookEvents = [
  {
    webhook_event_id: 'webhook_stripe_1001',
    provider: 'stripe',
    event_type: 'stripe.invoice.paid',
    status: 'PROCESSED',
    created_at: '2026-05-11T12:01:00.000Z',
    processed_at: '2026-05-11T12:01:20.000Z'
  },
  {
    webhook_event_id: 'webhook_stripe_1002',
    provider: 'stripe',
    event_type: 'stripe.invoice.payment_failed',
    status: 'FAILED',
    last_error: 'Signature retry',
    created_at: '2026-05-11T12:02:00.000Z'
  }
];

const providerHealth = [
  {
    provider: 'paypal',
    display_name: 'PayPal',
    provider_status: 'ready',
    score: 96,
    status: 'healthy',
    failed_webhooks: 0,
    recent_webhooks: 1,
    unresolved_issues: 0,
    reasons: [],
    next_actions: []
  },
  {
    provider: 'stripe',
    display_name: 'Stripe',
    provider_status: 'degraded',
    score: 82,
    status: 'degraded',
    failed_webhooks: 1,
    recent_webhooks: 2,
    unresolved_issues: 1,
    reasons: ['1 failed or retrying webhook event'],
    next_actions: ['Replay or ignore failed Stripe webhooks']
  }
];

const deadLetterJobs = [
  {
    job_id: 'dead_letter_stripe_1001',
    name: 'process-approved-payout-dead-letter',
    source_queue: 'payout-process',
    source_job_id: 'payout_stripe_1001',
    failed_reason: 'Provider queue exhausted retries',
    data: {
      sourceQueue: 'payout-process',
      sourceJobId: 'payout_stripe_1001',
      payload: {
        provider: 'stripe',
        payout_id: 'payout_stripe_1001'
      }
    },
    recovery: null
  }
];

function buildWebhookDetail(event, overrides = {}) {
  const source = event || webhookEvents[0];
  const isProcessed = source.status === 'PROCESSED';

  return {
    ...source,
    event_id: source.event_id || `stripe:${source.webhook_event_id}`,
    resource_type: 'invoice',
    processing_attempts: source.processing_attempts ?? (isProcessed ? 1 : 2),
    can_replay: source.status !== 'REJECTED',
    can_ignore: !['IGNORED', 'PROCESSED'].includes(source.status),
    sanitized_payload: {
      has_payload: true,
      id: source.webhook_event_id === 'webhook_stripe_1002' ? 'evt_stripe_1002' : 'evt_stripe_1001',
      type: source.event_type,
      provider: source.provider,
      resource_id: source.webhook_event_id === 'webhook_stripe_1002' ? 'stripe_invoice_1002' : 'stripe_invoice_1001',
      resource_type: 'invoice',
      top_level_keys: ['id', 'type', 'provider', 'data']
    },
    verification: {
      has_verification_payload: true,
      verification_status: 'verified',
      signature_header_present: true,
      transmission_id_present: false
    },
    ...overrides
  };
}

const receiptRecord = {
  id: 'receipt_existing_1001',
  type: 'bank',
  title: 'Bank Transfer Slip - Ada Lovelace',
  summary: {
    text: 'Project milestone payment'
  },
  data: {
    details: {
      senderName: 'Ada Lovelace',
      senderAccount: '1002003004',
      senderBank: 'Transferly Wallet',
      receiverName: 'Grace Hopper',
      receiverAccount: '4003002001',
      receiverBank: 'Opay',
      amount: '25000',
      transactionDate: '2026-05-28',
      transactionTime: '10:00',
      transactionRef: 'TRXEXISTING1001',
      narration: 'Project milestone payment',
      sessionId: 'SESSION1',
      status: 'Successful'
    }
  },
  created_at: '2026-05-28T10:00:00.000Z'
};

async function mockTransferlyApi(page, options = {}) {
  const { seedTokens = true, onTelegramMiniAppLogin } = options;

  if (seedTokens) {
    await page.addInitScript(() => {
      window.localStorage.setItem('transferly_api_token', 'test-user-token');
      window.localStorage.setItem('transferly_admin_api_token', 'test-admin-token');
    });
  }

  await page.route(/\/api(\/|$)/, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Accept, Authorization, Content-Type, X-Request-Id, X-Telegram-Init-Data, X-Telegram-Start-Param, X-Transferly-Client',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    };

    const json = (payload) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify(payload)
      });

    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: corsHeaders,
        body: ''
      });
      return;
    }

    if (path === '/api/bootstrap') {
      await json({
        platform: {
          platform_name: 'Transferly',
          brand_color: '#f8812d',
          bank_slip_cost: 10,
          email_receipt_cost: 5
        },
        faqs: [],
        testimonials: []
      });
      return;
    }

    if (path === '/api/me') {
      await json({
        user: adminUser,
        profile: adminProfile,
        points: { balance: 5000 },
        referrals: {},
        receipts: [receiptRecord],
        topUpOrders: []
      });
      return;
    }

    if (path === '/api/auth/telegram-mini-app') {
      onTelegramMiniAppLogin?.(route.request().postDataJSON());
      await json({
        token: 'telegram-user-token',
        user: adminUser
      });
      return;
    }

    if (path === '/api/receipt/generate') {
      await json({
        receipt: {
          id: 'receipt_generated_1001',
          type: 'bank',
          title: 'Bank Transfer Slip - Ada Lovelace',
          summary: {
            text: 'Project milestone payment'
          },
          data: receiptRecord.data,
          created_at: '2026-05-28T10:00:00.000Z'
        },
        summary: {
          remaining_points: 4990
        }
      });
      return;
    }

    if (path === '/api/user/me/top-up-orders' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      await json({
        order: {
          order_id: 'order_miniapp_1001',
          points: body.points,
          amount_label: body.amountLabel,
          method_id: body.methodId,
          method_title: body.methodTitle,
          service_intent: body.serviceIntent,
          vendor_url: body.vendorUrl,
          instructions: body.instructions,
          status: 'pending',
          created_at: '2026-05-28T11:00:00.000Z'
        }
      });
      return;
    }

    if (path === '/api/admin/users') {
      await json({ data: [adminUser] });
      return;
    }

    if (path === '/api/admin/invoices' || path === '/api/invoices') {
      await json({
        data: [invoiceRecord, stripeInvoiceRecord],
        pagination: { page: 1, page_size: 50, total: 2, has_next_page: false }
      });
      return;
    }

    if (path === '/api/payouts' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      await json({
        payout_id: 'payout_miniapp_1001',
        provider: 'paypal',
        status: 'PENDING_APPROVAL',
        summary: {
          receiver: body.receiver,
          recipient_type: body.recipientType,
          amount: body.amount,
          currency: body.currency || 'USD',
          total_debit: body.amount
        },
        metadata: {
          note: body.note
        },
        created_at: '2026-05-28T11:30:00.000Z'
      });
      return;
    }

    if (path === '/api/admin/payouts' || path === '/api/payouts') {
      await json({
        data: [payoutRecord, cryptoPayoutRecord],
        pagination: { page: 1, page_size: 50, total: 2, has_next_page: false }
      });
      return;
    }

    if (path === '/api/admin/invoice-reminders') {
      await json({ data: [] });
      return;
    }

    if (path === '/api/admin/invoice-templates') {
      await json({
        data: [
          {
            id: 'template_1001',
            name: 'Standard Service Invoice',
            currency_code: 'USD',
            default_due_days: 7,
            is_active: true,
            line_items: [{ name: 'Service', quantity: 1, unitAmount: 150 }]
          }
        ]
      });
      return;
    }

    if (path === '/api/admin/payment-issues') {
      const provider = url.searchParams.get('provider');
      const issues = provider
        ? [stripePaymentIssue].filter((issue) => issue.provider === provider)
        : [stripePaymentIssue];
      await json({ data: issues });
      return;
    }

    if (path === '/api/admin/dead-letters/dead_letter_stripe_1001/recover' && route.request().method() === 'POST') {
      await json({
        dead_letter: {
          ...deadLetterJobs[0],
          recovery: {
            recovered_at: '2026-05-11T12:10:00.000Z',
            recovery_job_id: 'recovered_stripe_1001',
            recovery_job_name: 'process-approved-payout'
          }
        },
        recovery: {
          recovered_at: '2026-05-11T12:10:00.000Z',
          recovery_job_id: 'recovered_stripe_1001',
          recovery_job_name: 'process-approved-payout'
        }
      });
      return;
    }

    if (path === '/api/admin/dead-letters') {
      await json({ data: deadLetterJobs });
      return;
    }

    if (path === '/api/admin/top-up-orders') {
      await json({ data: [] });
      return;
    }

    if (path.startsWith('/api/admin/payment-providers/') && path.endsWith('/balance')) {
      const segments = path.split('/');
      const provider = segments[segments.length - 2];
      const balances = {
        paypal: { available_balance_cents: 125000, currency: 'USD' },
        stripe: { available_balance_cents: 321050, currency: 'USD' },
        crypto: { available_balance_cents: 8400, currency: 'USD' },
        paystack: { available_balance_cents: 0, currency: 'USD' },
        flutterwave: { available_balance_cents: 0, currency: 'USD' },
        wise: { available_balance_cents: 0, currency: 'USD' }
      };
      await json({ balance: balances[provider] || balances.paypal });
      return;
    }

    if (path === '/api/admin/payment-providers/health') {
      await json({ data: providerHealth, generated_at: '2026-05-11T12:10:00.000Z' });
      return;
    }

    if (path === '/api/admin/payment-providers') {
      await json({
        data: [
          { key: 'paypal', label: 'PayPal', status: 'ready', capabilities: ['invoices', 'payouts', 'webhooks'] },
          { key: 'stripe', label: 'Stripe', status: 'degraded', capabilities: ['invoices', 'connect', 'webhooks'] },
          { key: 'crypto', label: 'Crypto', status: 'ready', capabilities: ['charges', 'webhooks'] }
        ]
      });
      return;
    }

    if (path === '/api/admin/payment-providers/invoice-features') {
      await json({ data: [] });
      return;
    }

    if (path.startsWith('/api/admin/webhooks/')) {
      const segments = path.split('/').filter(Boolean);
      const webhookEventId = decodeURIComponent(segments[3] || '');
      const action = segments[4] || '';
      const event = webhookEvents.find((item) => item.webhook_event_id === webhookEventId || item.event_id === webhookEventId);

      if (action === 'replay') {
        await json({
          event: buildWebhookDetail(event, {
            status: 'IGNORED',
            last_error: null,
            processing_attempts: 3,
            can_ignore: false
          })
        });
        return;
      }

      if (action === 'ignore') {
        await json({
          event: buildWebhookDetail(event, {
            status: 'IGNORED',
            last_error: null,
            can_ignore: false
          })
        });
        return;
      }

      await json({ event: buildWebhookDetail(event) });
      return;
    }

    if (path === '/api/admin/webhooks') {
      const provider = url.searchParams.get('provider');
      const events = provider
        ? webhookEvents.filter((event) => event.provider === provider)
        : webhookEvents;
      await json({ data: events });
      return;
    }

    await json({ data: [] });
  });
}

async function primeMiniAppUi(page, options = {}) {
  const { theme = 'dark' } = options;

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((selectedTheme) => {
    window.localStorage.setItem('transferly_telegram_modal_dismissed', 'true');
    window.localStorage.setItem('transferly_miniapp_theme', selectedTheme);
  }, theme);
}

async function expectProviderWorkspace(page, providerName) {
  await expect(page.getByText('Transferly provider workspace', { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('heading', { level: 1, name: providerName })).toBeVisible();
}

async function expectNoHorizontalOverflow(page) {
  const hasOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth + 1;
  });

  expect(hasOverflow).toBe(false);
}

test('root route opens the Telegram mini app workspace', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/');

  await expect(page).toHaveTitle(/Transferly/i);
  await expect(page).toHaveURL(/\/miniapp$/);
  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Buy Points/i }).first()).toBeVisible();
});

test('legacy auth routes redirect into the Telegram mini app', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);

  for (const path of ['/login', '/register', '/forgot-password']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/miniapp$/);
    await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Buy Points/i }).first()).toBeVisible();
  }
});

test('mini app command center renders with mocked account data', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/miniapp');

  await expect(page.getByText('Welcome back,')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
  await expect(page.getByLabel('Mini app session health')).toContainText('Session health');
  await expect(page.getByText(/Telegram session detected|Browser preview mode/).last()).toBeVisible();
  await expect(page.getByRole('link', { name: /AO Admin Operator/ })).toBeVisible();
  await expect(page.getByText('5,000 pts').last()).toBeVisible();
  await expect(page.getByRole('link', { name: /Buy Points/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Support AI Reply/i }).first()).toBeVisible();
});

test('mini app shows Telegram launch guidance without a session', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page, { seedTokens: false });
  await page.goto('/miniapp/wallet');

  await expect(page.getByRole('heading', { name: 'Open Transferly from Telegram' })).toBeVisible();
  await expect(page.getByText('Telegram required')).toBeVisible();
  await expect(page.getByRole('link', { name: /Open in Telegram/i })).toHaveAttribute(
    'href',
    'https://t.me/TransferlyBot'
  );
});

test('mini app service catalog routes tiles into native service detail screens', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/miniapp/services');

  await expect(page.getByRole('heading', { name: 'Services' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Flash Emails' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bank Slips' })).toBeVisible();
  await page.getByRole('link', { name: /PayPal Open workspace/i }).first().click();

  await expect(page).toHaveURL(/\/miniapp\/services\/paypal\/overview$/);
  await expectProviderWorkspace(page, 'PayPal');
  await expect(page.locator('a[href="/miniapp/services/paypal/invoices"]').first()).toBeVisible();
  await expect(page.locator('a[href="/miniapp/services/paypal/payouts"]').first()).toBeVisible();
  await expect(page.locator('a[href="/miniapp/services/paypal/developer"]').first()).toBeVisible();

  await page.goto('/miniapp/services/paypal/payment-links');
  await expect(page.getByRole('link', { name: 'PayPal home page' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Notifications 0' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Menu/i })).toBeVisible();
  await expect(page.locator('h1').filter({ hasText: '$5,000.00' })).toBeVisible();
  await expect(page.getByText('USD').first()).toBeVisible();
  await expect(page.locator('p').filter({ hasText: 'Available balance' }).first()).toBeVisible();
  await page.getByRole('button', { name: /Manage money/i }).click();
  await expect(page.getByRole('link', { name: /Transfer to bank/i })).toHaveAttribute('href', '/miniapp/wallet?service=paypal');
  await page.getByRole('button', { name: /Manage money/i }).click();
  await expect(page.getByText('Quick access')).toBeVisible();
  await expect(page.getByRole('link', { name: /Business Tools/i }).first()).toHaveAttribute('href', '/miniapp/services/paypal/overview');
  await expect(page.getByRole('link', { name: /Invoicing/i })).toHaveAttribute('href', '/miniapp/services/paypal/invoices');
  await expect(page.getByRole('link', { name: /Payment Links & Buttons/i })).toHaveAttribute(
    'href',
    '/miniapp/services/paypal/payment-links'
  );
  await expect(page.getByText('Business Performance')).toBeVisible();
  await expect(page.getByText('All comparisons to previous 30 days')).toBeVisible();
  await expect(page.getByText('Recent activity')).toBeVisible();
  await expect(page.getByText('Customer account')).toBeVisible();
  await expect(page.getByText('Create a Payment Link')).toBeVisible();
  await page.getByRole('button', { name: /Build It/i }).click();
  await expect(page.getByText('Enter a product or service name.')).toBeVisible();
  await expect(page.getByText('Enter an amount greater than 0.')).toBeVisible();
  await page.getByLabel('Product or service name').fill('Premium service');
  await page.getByLabel('Price').fill('25.50');
  await page.getByRole('button', { name: /Build It/i }).click();
  await expect(page.getByText('Payment link is ready')).toBeVisible();
  await expect(
    page.getByRole('status').getByText('transferly-paypal://usd/Premium%20service-25.50')
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Customize/i })).toHaveAttribute(
    'href',
    '/miniapp/services/paypal/mail?mode=custom-mail'
  );

  await page.getByRole('button', { name: /Menu/i }).click();
  await expect(page.getByRole('navigation', { name: 'PayPal service navigation' })).toContainText('Pay & Get Paid');
  await expect(page.getByRole('navigation', { name: 'PayPal service navigation' })).toContainText('Developer');
  await page.getByRole('button', { name: /Create/i }).click();
  await expect(page.getByRole('link', { name: /Payment Link or Button/i })).toHaveAttribute(
    'href',
    '/miniapp/services/paypal/payment-links'
  );
  await expect(page.getByRole('link', { name: /Custom Mail/i })).toHaveAttribute(
    'href',
    '/miniapp/services/paypal/mail?mode=custom-mail'
  );
  await expect(page.getByRole('link', { name: /Deposit Mail/i })).toHaveAttribute(
    'href',
    '/miniapp/services/paypal/mail?mode=deposit-mail'
  );
  await expect(page.getByRole('link', { name: /Mail History/i })).toHaveAttribute('href', '/miniapp/vault?service=paypal');
  await expect(page.getByRole('link', { name: /API credentials/i })).toHaveAttribute(
    'href',
    '/miniapp/services/paypal/developer'
  );
  await expect(page.getByRole('link', { name: /Back to Transferly/i })).toHaveAttribute('href', '/miniapp');
  await expect(page.getByText('Copyright © 1999-2026 PayPal. All rights reserved.')).toBeVisible();
});

test('mini app PayPal sandbox operations complete payment workflows', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/miniapp/services/paypal/payment-links');

  await expect(page.getByRole('heading', { name: 'Payments, invoices, payouts, and tracking' })).toBeVisible();
  await expect(page.getByText('Sandbox / test money only')).toBeVisible();
  await expect(page.getByText(/Backend contract mirrors the PayPal Sandbox API paths configured in Transferly/)).toBeVisible();
  await expect(page.locator('[aria-label="Send money navigation"]').getByRole('button', { name: 'Send' })).toBeVisible();
  await expect(page.locator('[aria-label="Payment flow steps"]').getByText('Send')).toBeVisible();

  await page.getByRole('button', { name: /Validate/i }).click();
  await expect(page.getByRole('status').getByText('Sandbox Personal Buyer')).toBeVisible();
  await expect(page.getByRole('status').getByText('Verified')).toBeVisible();
  await expect(page.getByRole('status').getByText('Personal Account')).toBeVisible();
  await expect(page.locator('[aria-label="Payment flow steps"]').getByText('Preview')).toBeVisible();

  await page.getByLabel('Amount').fill('88.25');
  await page.getByLabel('Payment note').fill('QA payout validation');
  await page.getByRole('button', { name: /Send sandbox payment/i }).click();

  await expect(page.getByRole('heading', { name: 'Payment Confirmation' })).toBeVisible();
  await expect(page.getByText('Sandbox / Test Payment Confirmation')).toBeVisible();
    await expect(page.getByRole('status').getByText('Business Account').first()).toBeVisible();
  await expect(page.getByText(/\$88\.25 USD/)).toBeVisible();
  await expect(page.getByText(/PAYPAL-TXN-/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Download image/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Download PDF/i })).toBeVisible();
  await expect(page.locator('[aria-label="Payment flow steps"]').getByText('Confirmation')).toBeVisible();

  await page.getByRole('tab', { name: /Invoices/i }).click();
  await expect(page.getByRole('heading', { name: 'Invoicing' })).toBeVisible();
  await page.getByLabel('Search invoices').fill('1001');
  await expect(page.getByText('INV2-PAYP-1001')).toBeVisible();
  await expect(page.getByText('INV2-PAYP-1002')).not.toBeVisible();
  await expect(page.getByText('POST /v2/invoicing/invoices')).toBeVisible();

  await page.getByRole('tab', { name: /Payouts/i }).click();
  await expect(page.getByRole('heading', { name: 'Send a payout' })).toBeVisible();
  await page.getByRole('button', { name: /Choose CSV\/TXT file/i }).click();
  await expect(page.getByText('paypal-sandbox-payouts.csv')).toBeVisible();
  await expect(page.getByRole('button', { name: /Continue/i })).toBeDisabled();
  await page.getByLabel(/I confirm this sandbox payout file/i).check();
  await expect(page.getByRole('button', { name: /Continue/i })).toBeEnabled();
  await expect(page.getByText('BATCH-PAYPAL-783912')).toBeVisible();
  await expect(page.getByText('ITEM-PAYPAL-48102')).toBeVisible();

  await page.getByRole('tab', { name: /Track/i }).click();
  await page.getByRole('button', { name: /Track payment/i }).click();
  await expect(page.getByText('Recipient validated')).toBeVisible();
  await expect(page.getByText('Payment completed', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
  await page.getByLabel('Search transactions').fill('PAYPAL-TXN-1001');
  await page.getByRole('button', { name: /Details PAYPAL-TXN-1001/i }).click();
  await expect(page.getByText('Sandbox payment completed with zero fee.')).toBeVisible();
});

test('mini app service detail handles missing service slugs', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/miniapp/services/not-real');

  await expect(page.getByText('Missing service')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Service not found' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to Services' })).toHaveAttribute('href', '/miniapp/services');
});

test('mini app route audit stays nonblank and responsive across core screens', async ({ page }) => {
  // The route matrix checks every core screen across phone, tablet, and desktop viewports.
  test.setTimeout(150000);

  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      pageErrors.push(message.text());
    }
  });
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);

  const routes = [
    '/miniapp',
    '/miniapp/services',
    '/miniapp/services/paypal',
    '/miniapp/services/paypal/overview',
    '/miniapp/services/paypal/invoices',
    '/miniapp/services/paypal/payouts',
    '/miniapp/services/paypal/activity',
    '/miniapp/services/paypal/developer',
    '/miniapp/services/stripe/overview',
    '/miniapp/services/stripe/payments',
    '/miniapp/services/stripe/connect',
    '/miniapp/services/wise/receive',
    '/miniapp/services/paystack/collections',
    '/miniapp/services/flutterwave/transfers',
    '/miniapp/services/crypto/send',
    '/miniapp/services/paypal/payment-links',
    '/miniapp/services/paypal/mail?mode=custom-mail',
    '/miniapp/services/paypal/mail?mode=deposit-mail',
    '/miniapp/services/paypal/settings',
    '/miniapp/studio',
    '/miniapp/invoices',
    '/miniapp/payouts',
    '/miniapp/activity',
    '/miniapp/analytics',
    '/miniapp/notifications',
    '/miniapp/clients',
    '/miniapp/risk',
    '/miniapp/security',
    '/miniapp/vault',
    '/miniapp/orders',
    '/miniapp/wallet',
    '/miniapp/ops',
    '/miniapp/support?from=wallet',
    '/miniapp/profile',
    '/miniapp/settings'
  ];

  const viewports = [
    { width: 390, height: 844 },
    { width: 820, height: 1180 },
    { width: 1440, height: 900 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);

    for (const route of routes) {
      pageErrors.length = 0;
      await page.goto(route, { waitUntil: 'domcontentloaded' });

      const main = page.locator('main').first();
      await expect(main).toBeVisible();
      await expect.poll(async () => (await main.innerText()).trim().length).toBeGreaterThan(80);
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      await expectNoHorizontalOverflow(page);
      expect(pageErrors, `${route} at ${viewport.width}px`).toEqual([]);
    }
  }
});

test.describe('mini app visual regression', () => {
  test('PayPal service detail desktop baseline', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await primeMiniAppUi(page);
    await mockTransferlyApi(page);
    await page.goto('/miniapp/services/paypal/payment-links');

    await expect(page.getByRole('link', { name: 'PayPal home page' })).toBeVisible();
    await expect(page.getByText('Business Performance')).toBeVisible();
    await expect(page.getByText('Create a Payment Link')).toBeVisible();
    await expect(page.getByText('Copyright © 1999-2026 PayPal. All rights reserved.')).toBeVisible();
    await expect(page).toHaveScreenshot('miniapp-service-paypal-desktop.png', {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: 0.08
    });
  });

  test('wallet mobile baseline', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await primeMiniAppUi(page);
    await mockTransferlyApi(page);
    await page.goto('/miniapp/wallet?service=paypal');

    await expect(page.getByText('points ready to spend')).toBeVisible();
    await expect(page).toHaveScreenshot('miniapp-wallet-mobile.png', {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: 0.08
    });
  });
});

test('mini app provider command center scopes provider operations', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/miniapp/ops?provider=paypal');

  await expect(page.getByRole('heading', { name: 'Provider Command Center' })).toBeVisible();
  await expect(page.getByRole('button', { name: /PayPal/i })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /Stripe/i })).toBeVisible();

  await page.getByRole('button', { name: /Stripe/i }).click();

  await expect(page.getByText('Stripe webhook delivery is delayed')).toBeVisible();
  await expect(
    page
      .locator('section')
      .filter({ hasText: 'Provider invoices' })
      .getByRole('article')
      .filter({ hasText: 'stripe_invoice_1002' })
  ).toBeVisible();
  await expect(page.getByText('$3,210.50')).toBeVisible();
  await expect(page.getByText('82/100').first()).toBeVisible();
  await expect(page.getByText('Webhook health', { exact: true })).toBeVisible();
  await expect(page.getByText('Dead-letter recovery', { exact: true })).toBeVisible();
  await expect(page.getByText('payout-process')).toBeVisible();

  const failedWebhook = page
    .getByRole('article')
    .filter({ hasText: 'stripe.invoice.payment_failed' })
    .first();
  await failedWebhook.getByRole('button', { name: /Details/i }).click();
  const webhookDetail = page.getByRole('article').filter({ hasText: 'Webhook detail' });
  await expect(webhookDetail).toBeVisible();
  await expect(webhookDetail.getByText('evt_stripe_1002')).toBeVisible();
  await expect(webhookDetail.getByText('Signature retry')).toBeVisible();

  await webhookDetail.getByRole('button', { name: /Replay/i }).click();
  await expect(page.getByText('Webhook replay queued')).toBeVisible();

  const deadLetterLane = page.locator('section').filter({ hasText: 'Dead-letter recovery' });
  await deadLetterLane.getByRole('button', { name: /^Recover$/ }).click();
  await expect(page.getByText('Dead-letter job recovered')).toBeVisible();
});

for (const width of [360, 390, 430]) {
  test(`mini app provider command center remains usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await primeMiniAppUi(page);
    await mockTransferlyApi(page);
    await page.goto('/miniapp/ops');

    await expect(page.getByRole('heading', { name: 'Provider Command', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Stripe/i })).toBeVisible();

    await page.getByRole('button', { name: /Stripe/i }).click();

    await expect(page.getByText('Stripe webhook delivery is delayed')).toBeVisible();
    await expect(page.getByText('$3,210.50')).toBeVisible();
    await expect(page.getByText('82/100').first()).toBeVisible();
    await expect(page.getByText('Webhook health', { exact: true })).toBeVisible();
    await expect(page.getByText('Dead-letter recovery', { exact: true })).toBeVisible();
  });
}

test('mini app exchanges Telegram init data for a Transferly session on launch', async ({ page }) => {
  let telegramLoginBody = null;

  await mockTransferlyApi(page, {
    seedTokens: false,
    onTelegramMiniAppLogin: (body) => {
      telegramLoginBody = body;
    }
  });

  await page.route('https://telegram.org/js/telegram-web-app.js', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        const initData = 'query_id=telegram-test&user=%7B%22id%22%3A9001%2C%22first_name%22%3A%22Mini%22%2C%22last_name%22%3A%22User%22%7D&auth_date=1770000000&hash=test-signature';
        window.Telegram = {
          WebApp: {
            initData,
            initDataUnsafe: {
              start_param: 'wallet',
              user: {
                id: 9001,
                first_name: 'Mini',
                last_name: 'User',
                username: 'mini_user'
              }
            },
            themeParams: {},
            ready() {},
            expand() {},
            setHeaderColor() {},
            setBackgroundColor() {},
            BackButton: {
              show() {},
              hide() {},
              onClick() {},
              offClick() {}
            },
            SettingsButton: {
              show() {},
              hide() {},
              onClick() {},
              offClick() {}
            },
            MainButton: {
              setText() {},
              enable() {},
              show() {},
              hide() {},
              onClick() {},
              offClick() {},
              hideProgress() {}
            },
            HapticFeedback: {
              impactOccurred() {},
              notificationOccurred() {}
            }
          }
        };
      `
    });
  });

  await page.goto('/miniapp#tgWebAppStartParam=wallet');

  await expect.poll(() => Boolean(telegramLoginBody?.initData?.includes('query_id=telegram-test'))).toBe(true);
  expect(telegramLoginBody.startParam).toBe('wallet');
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('transferly_api_token'))).toBe('telegram-user-token');
  await expect(page.getByText('Telegram session secured').last()).toBeVisible();
  await expect(page.getByRole('link', { name: /MU Mini User/ })).toBeVisible();
});

test('mini app honors Telegram launch hash parameters', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/miniapp#tgWebAppStartParam=wallet');

  await expect(page.getByText('points ready to spend')).toBeVisible();
  await expect(page.getByRole('button', { name: /Create point order/i })).toBeVisible();
});

test('mini app support desk renders attached handoff context', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/miniapp/support?from=wallet');

  await expect(page.locator('p').filter({ hasText: /^Support desk$/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Guided help with context' })).toBeVisible();
  await expect(page.getByText('Ready for support handoff')).toBeVisible();
  await expect(page.getByText('Screen: wallet')).toBeVisible();
  await expect(page.getByText('Transferly user: admin@transferly.test')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy support context' })).toBeVisible();
});

test('mini app exposes Telegram settings and saves local preferences', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.route('https://telegram.org/js/telegram-web-app.js', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.__telegramSettings = { shown: false, click: null };
        window.Telegram = {
          WebApp: {
            initData: 'query_id=test',
            initDataUnsafe: {
              user: {
                id: 1001,
                first_name: 'Admin',
                username: 'admin_operator'
              }
            },
            themeParams: {},
            ready() {},
            expand() {},
            SettingsButton: {
              show() {
                window.__telegramSettings.shown = true;
              },
              hide() {
                window.__telegramSettings.shown = false;
              },
              onClick(callback) {
                window.__telegramSettings.click = callback;
              },
              offClick(callback) {
                if (window.__telegramSettings.click === callback) {
                  window.__telegramSettings.click = null;
                }
              }
            },
            MainButton: {
              setText() {},
              enable() {},
              show() {},
              hide() {},
              onClick() {},
              offClick() {},
              hideProgress() {}
            },
            HapticFeedback: {
              impactOccurred() {},
              notificationOccurred() {}
            }
          }
        };
      `
    });
  });

  await page.goto('/miniapp');
  await expect.poll(() => page.evaluate(() => window.__telegramSettings.shown)).toBe(true);
  await expect.poll(() => page.evaluate(() => typeof window.__telegramSettings.click)).toBe('function');

  await page.evaluate(() => window.__telegramSettings.click());
  await expect(page).toHaveURL(/\/miniapp\/settings/);
  await expect(page.getByText('Mini App settings')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Telegram-native preferences' })).toBeVisible();

  const hapticsSwitch = page.getByRole('switch', { name: 'Telegram haptics' });
  await expect(hapticsSwitch).toHaveAttribute('aria-checked', 'true');
  await hapticsSwitch.click();
  await expect(hapticsSwitch).toHaveAttribute('aria-checked', 'false');
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('transferly_miniapp_haptics_enabled'))).toBe('false');

  await page.locator('section').filter({ hasText: 'Default screen' }).getByRole('button', { name: 'Wallet' }).click();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('transferly_miniapp_default_screen'))).toBe('wallet');
});

test('mini app receipt studio generates from the native wizard', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/miniapp/studio');

  await expect(page.getByRole('heading', { name: 'Receipt Studio' })).toBeVisible();
  await page.getByRole('button', { name: /Continue/i }).click();

  await page.getByLabel('Sender name').fill('Ada Lovelace');
  await page.getByLabel('Receiver name').fill('Grace Hopper');
  await page.getByLabel('Amount').fill('25000');
  await page.getByLabel('Narration').fill('Project milestone payment');
  await page.getByRole('button', { name: /Continue/i }).click();

  await expect(page.getByText('100%')).toBeVisible();
  await page.getByRole('button', { name: /Generate receipt/i }).click();
  await expect(page.getByText('Receipt saved to vault')).toBeVisible();
});

test('mini app receipt vault searches and duplicates a receipt', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/miniapp/vault');

  await expect(page.getByRole('heading', { name: 'Your transactions' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Ada Lovelace to Grace Hopper/i })).toBeVisible();

  await page.getByLabel('Search transactions').fill('Grace');
  await expect(page.getByRole('button', { name: /Ada Lovelace to Grace Hopper/i })).toBeVisible();

  await page.getByRole('button', { name: /Duplicate as template/i }).click();
  await expect(page.getByText('Receipt duplicated')).toBeVisible();
});

test('mini app points wallet creates a native top-up order', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/miniapp/wallet');

  await expect(page.getByText('points ready to spend')).toBeVisible();
  await expect(page.getByLabel('Point order readiness')).toContainText('Account linked');

  await page.getByRole('button', { name: /250/i }).click();
  await page.getByRole('button', { name: /Crypto Payment/i }).click();
  await page.getByRole('button', { name: /Create point order/i }).click();

  await expect(page.getByRole('main').getByText('Point order created')).toBeVisible();
  const order = page.getByRole('article').filter({ hasText: 'order_miniapp_1001' });
  await expect(order).toBeVisible();
  await expect(order.getByText('250 pts')).toBeVisible();
  await expect(order.getByText('Payment pending')).toBeVisible();
  await expect(order.getByRole('link', { name: /Vendor chat/i })).toBeVisible();
});

test('mini app payout request requires readiness confirmation', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/miniapp/payouts');

  await expect(page.getByLabel('Payout readiness')).toContainText('Review queue');

  await page.getByRole('button', { name: /Request payout/i }).click();
  const composer = page.locator('section').filter({ hasText: 'Submit for review' });
  await composer.getByLabel('Receiver email').fill('recipient@example.com');
  await composer.getByLabel('Amount').fill('125');

  const requestButton = composer.getByRole('button', { name: /^Request payout$/ });
  await expect(requestButton).toBeDisabled();

  await composer.getByLabel(/I confirm this payout request is ready for review/i).check();
  await expect(requestButton).toBeEnabled();
  await requestButton.click();

  await expect(page.getByText('Payout requested')).toBeVisible();
  await expect(page.getByRole('article').filter({ hasText: 'payout_miniapp_1001' })).toBeVisible();
});

test('admin payments workspace loads and opens an invoice detail drawer', async ({ page }) => {
  await mockTransferlyApi(page);
  await page.goto('/admin?tab=payments&section=invoices');

  await expect(page.getByRole('heading', { name: 'PayPal Operations' })).toBeVisible();
  await expect(page.getByText('INV-1001', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Details' }).first().click();

  await expect(page.getByText('Invoice Detail')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'INV-1001' })).toBeVisible();
});

test('provider-first routes and legacy redirects land in provider workspaces', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);

  await page.goto('/miniapp/services/paypal');
  await expect(page).toHaveURL(/\/miniapp\/services\/paypal\/overview$/);
  await expectProviderWorkspace(page, 'PayPal');
  await expect(page.getByRole('region', { name: 'PayPal brand resources' })).toBeVisible();
  await expect(page.getByRole('link', { name: /PayPal media resources/i })).toHaveAttribute(
    'href',
    'https://newsroom.paypal-corp.com/media-resources'
  );
  await expect(page.getByText('Transferly shell stays primary')).toBeVisible();

  await page.goto('/services/paypal?view=invoices&status=sent');
  await expect(page).toHaveURL(/\/miniapp\/services\/paypal\/invoices\?status=sent$/);
  await expect(page.getByRole('heading', { name: 'Invoice lane' })).toBeVisible({ timeout: 10000 });

  await page.goto('/services/paypal?view=payouts');
  await expect(page).toHaveURL(/\/miniapp\/services\/paypal\/payouts$/);
  await expect(page.getByRole('heading', { name: 'Payout lane' })).toBeVisible({ timeout: 10000 });

  await page.goto('/miniapp/invoices?provider=stripe&status=paid');
  await expect(page).toHaveURL(/\/miniapp\/services\/stripe\/payments\?status=paid$/);
  await expectProviderWorkspace(page, 'Stripe Connect');

  await page.goto('/miniapp/payouts?provider=crypto');
  await expect(page).toHaveURL(/\/miniapp\/services\/crypto\/send$/);
  await expectProviderWorkspace(page, 'Crypto Commerce');
});

test('legacy PayPal invoice launcher opens the PayPal provider invoice lane', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/services/paypal?view=invoices');

  await expect(page).toHaveURL(/\/miniapp\/services\/paypal\/invoices/);
  await expect(page.getByRole('heading', { name: 'Invoice lane' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Available invoice actions')).toBeVisible();
  await expect(page.getByText('INV-1001', { exact: true })).toBeVisible();
});

test('legacy PayPal payout launcher opens the PayPal provider payout lane', async ({ page }) => {
  await primeMiniAppUi(page);
  await mockTransferlyApi(page);
  await page.goto('/services/paypal?view=payouts');

  await expect(page).toHaveURL(/\/miniapp\/services\/paypal\/payouts/);
  await expect(page.getByRole('heading', { name: 'Payout lane' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Available payout actions')).toBeVisible();
  await expect(page.getByText('Review', { exact: true })).toBeVisible();
});
