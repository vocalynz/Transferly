const { createProviderAdapter } = require('./baseProviderAdapter');

const flutterwaveProviderAdapter = createProviderAdapter({
  key: 'flutterwave',
  displayName: 'Flutterwave',
  requiredEnv: ['FLUTTERWAVE_SECRET_KEY', 'FLUTTERWAVE_WEBHOOK_SECRET'],
  capabilities: {
    invoices: true,
    hosted_payment_links: true,
    payouts: true,
    balance: true,
    webhooks: true,
    refunds: true,
    disputes: false,
    recipients: true,
    quotes: true,
    crypto_payments: false
  },
  invoiceFeatures: {
    supported: true,
    provider_resource: 'payment_link',
    collection_method: 'hosted_checkout_link',
    workflow: 'create_standard_payment_link_then_verify_transaction',
    hosted_payment_link: true,
    draft_preview: true,
    line_items: false,
    taxes: false,
    due_date: false,
    customer_notification: false,
    pdf: false,
    manual_finalize: false,
    crypto_settlement: false,
    settlement_flow: 'verified_successful_transaction_to_internal_pending_balance_then_admin_release',
    required_fields: ['amount', 'currency', 'customer.email', 'tx_ref', 'redirect_url'],
    optional_fields: ['customer.name', 'customizations.title', 'customizations.description', 'payment_options', 'meta'],
    provider_link_field: 'link',
    provider_status_events: ['charge.completed', 'transfer.completed'],
    admin_actions: ['refresh', 'disable_link', 'release_funds', 'open_hosted_link']
  },
  supportedOperations: [
    'payment_link.create',
    'transfer_recipient.create',
    'transfer.create',
    'transfer.refresh',
    'transfer_rate.quote',
    'refund.create',
    'webhook.verify'
  ],
  docs: [
    'https://developer.flutterwave.com/docs/general-transfer-flow',
    'https://developer.flutterwave.com/v3.0/reference/create-a-transfer',
    'https://developer.flutterwave.com/docs/webhooks'
  ],
  configuredNextActions: [
    'Build transfer recipient, transfer quote, and transfer status adapters.',
    'Map Flutterwave transfer webhooks into payout success, failure, and review states.'
  ],
  nextActions: [
    'Set FLUTTERWAVE_SECRET_KEY and FLUTTERWAVE_WEBHOOK_SECRET.',
    'Choose sandbox or live base URL policy and supported payout corridors.',
    'Add idempotency key handling before exposing transfers.'
  ],
  notes: [
    'Flutterwave supports several African bank and mobile-money payout corridors; supported fields vary by transfer type.'
  ]
});

module.exports = {
  flutterwaveProviderAdapter
};
