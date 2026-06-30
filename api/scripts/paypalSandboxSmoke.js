const { close, db, initializeDatabase, loadSchemaSql } = require('../db');
const config = require('../config');
const { bootstrapService } = require('../services/bootstrapService');
const { paypalInvoiceService } = require('../services/paypalInvoiceService');
const { paypalPayoutService } = require('../services/paypalPayoutService');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for PayPal sandbox smoke verification.`);
  }

  return value;
}

function parsePositiveAmount(value, fallback) {
  const resolved = value || fallback;
  const amount = Number(resolved);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid amount "${resolved}". Expected a positive decimal number.`);
  }

  return amount;
}

function output(section, payload) {
  process.stdout.write(`\n[${section}]\n`);
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

async function run() {
  const invoiceRecipientEmail = requireEnv('PAYPAL_SANDBOX_INVOICE_RECIPIENT_EMAIL');
  const payoutReceiver = requireEnv('PAYPAL_SANDBOX_PAYOUT_RECEIVER');
  const currency = (process.env.PAYPAL_SANDBOX_CURRENCY || 'USD').toUpperCase();
  const invoiceAmount = parsePositiveAmount(process.env.PAYPAL_SANDBOX_INVOICE_AMOUNT, '12.50');
  const payoutAmount = parsePositiveAmount(process.env.PAYPAL_SANDBOX_PAYOUT_AMOUNT, '5.00');

  await initializeDatabase();
  await db.exec(loadSchemaSql());

  const bootstrap = await bootstrapService.ensureDemoAccount({
    userId: config.SEED_USER_ID || 'demo-user',
    email: config.SEED_USER_EMAIL || 'demo@transferly.local',
    displayName: config.SEED_USER_NAME || 'Demo User',
    countryCode: config.SEED_USER_COUNTRY || 'US',
    currencyCode: currency
  });

  output('bootstrap', bootstrap);

  const invoice = await paypalInvoiceService.createAndSendInvoice({
    userId: bootstrap.user.id,
    recipientEmail: invoiceRecipientEmail,
    currency,
    description: 'Sandbox verification invoice',
    items: [
      {
        name: 'Sandbox verification invoice',
        description: 'Manual invoice payment validation for Transferly.',
        quantity: 1,
        unitAmount: invoiceAmount
      }
    ],
    metadata: {
      smokeTest: true
    }
  });

  output('invoice', invoice);

  const payout = await paypalPayoutService.requestPayout({
    userId: bootstrap.user.id,
    receiver: payoutReceiver,
    recipientType: 'EMAIL',
    receiverCountryCode: bootstrap.user.countryCode || 'US',
    amount: payoutAmount,
    currency,
    note: 'Sandbox verification payout',
    metadata: {
      smokeTest: true
    },
    idempotencyKey: `sandbox-smoke-${Date.now()}`
  });

  output('payout-request', payout);

  let finalPayout = payout;

  if (payout.status === 'PENDING_APPROVAL') {
    const approval = await paypalPayoutService.approvePayout(
      payout.payout_id,
      config.DEFAULT_ADMIN_ACTOR_ID
    );

    output('payout-approval', approval);
    finalPayout = await paypalPayoutService.processQueuedPayout(payout.payout_id);
  } else if (payout.nextAction === 'PROCESS') {
    finalPayout = await paypalPayoutService.processQueuedPayout(payout.payout_id);
  }

  output('payout-final', finalPayout);

  process.stdout.write('\n[manual-next-steps]\n');
  process.stdout.write(
    [
      `1. Open the PayPal invoice link and pay it with a sandbox buyer account: ${invoice.invoice_link}`,
      '2. Confirm PayPal delivers the corresponding INVOICING.INVOICE.PAID webhook to /webhooks/paypal.',
      '3. After the webhook is processed, release funds with POST /api/admin/invoices/:id/release using an Idempotency-Key.',
      '4. If the payout remains PENDING, re-run this script or GET /api/payouts/:id to confirm the latest provider state.'
    ].join('\n')
  );
  process.stdout.write('\n');
}

run()
  .catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await close().catch(() => {});
  });
