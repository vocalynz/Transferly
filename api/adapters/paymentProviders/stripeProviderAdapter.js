const { createProviderAdapter } = require('./baseProviderAdapter');

const stripeProviderAdapter = createProviderAdapter({
  key: 'stripe',
  displayName: 'Stripe Connect',
  requiredEnv: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
  capabilities: {
    invoices: true,
    hosted_payment_links: true,
    payouts: true,
    balance: true,
    webhooks: true,
    refunds: true,
    disputes: true,
    recipients: true,
    quotes: false,
    crypto_payments: false
  },
  invoiceFeatures: {
    supported: true,
    provider_resource: 'invoice_or_payment_link',
    collection_method: 'hosted_invoice_page',
    workflow: 'create_customer_invoice_items_finalize_and_send',
    hosted_payment_link: true,
    draft_preview: true,
    line_items: true,
    taxes: true,
    due_date: true,
    customer_notification: true,
    pdf: true,
    manual_finalize: true,
    crypto_settlement: false,
    settlement_flow: 'stripe_invoice_paid_event_to_internal_pending_balance_then_admin_release',
    required_fields: ['customer', 'currency', 'line_items'],
    optional_fields: ['description', 'due_date', 'metadata', 'connected_account_id', 'automatic_tax'],
    provider_link_field: 'hosted_invoice_url',
    provider_status_events: [
      'invoice.finalized',
      'invoice.paid',
      'invoice.payment_failed',
      'invoice.voided',
      'checkout.session.completed'
    ],
    admin_actions: ['refresh', 'void', 'release_funds', 'open_hosted_link']
  },
  supportedOperations: [
    'account.onboard',
    'account.create',
    'account.retrieve',
    'account_link.create',
    'balance.retrieve',
    'invoice.create',
    'payment_link.create',
    'transfer.create',
    'payout.preview',
    'payout.transfer_to_connected_account',
    'refund.create',
    'dispute.list',
    'webhook.verify'
  ],
  docs: [
    'https://docs.stripe.com/connect',
    'https://docs.stripe.com/connect/payouts-connected-accounts',
    'https://docs.stripe.com/webhooks'
  ],
  configuredNextActions: [
    'Set STRIPE_PAYOUTS_ENABLED=true only after connected-account transfer policy is approved.',
    'Map Stripe transfer reversal, payout, payment, refund, and dispute events into payment ops issues.'
  ],
  nextActions: [
    'Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.',
    'Confirm whether Transferly will use Standard, Express, or Custom connected accounts.',
    'Define refund and dispute handling before enabling broader Stripe money movement.'
  ],
  notes: [
    'Stripe Connect separates platform balance, connected account balance, transfers, and bank payouts; Transferly currently supports gated transfers to connected accounts.'
  ]
});

module.exports = {
  stripeProviderAdapter
};
