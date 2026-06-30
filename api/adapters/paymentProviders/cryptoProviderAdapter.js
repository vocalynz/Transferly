const { createProviderAdapter } = require('./baseProviderAdapter');

const cryptoProviderAdapter = createProviderAdapter({
  key: 'crypto',
  displayName: 'Crypto Commerce',
  requiredEnv: ['CRYPTO_COMMERCE_API_KEY', 'CRYPTO_COMMERCE_WEBHOOK_SECRET'],
  capabilities: {
    invoices: true,
    hosted_payment_links: true,
    payouts: false,
    balance: false,
    webhooks: true,
    refunds: false,
    disputes: false,
    recipients: false,
    quotes: false,
    crypto_payments: true
  },
  invoiceFeatures: {
    supported: true,
    provider_resource: 'crypto_charge',
    collection_method: 'crypto_checkout',
    workflow: 'create_charge_then_confirm_onchain_settlement',
    hosted_payment_link: true,
    draft_preview: true,
    line_items: false,
    taxes: false,
    due_date: false,
    customer_notification: false,
    pdf: false,
    manual_finalize: false,
    crypto_settlement: true,
    settlement_flow: 'confirmed_crypto_charge_to_internal_pending_balance_then_admin_release',
    required_fields: ['name', 'description', 'pricing_type', 'local_price'],
    optional_fields: ['metadata', 'redirect_url', 'cancel_url'],
    provider_link_field: 'hosted_url',
    provider_status_events: [
      'charge:created',
      'charge:pending',
      'charge:confirmed',
      'charge:failed',
      'charge:delayed',
      'charge:resolved'
    ],
    admin_actions: ['refresh', 'release_funds', 'open_hosted_link'],
    safeguards: ['confirmation_depth_policy', 'underpayment_detection', 'overpayment_review', 'network_mismatch_review']
  },
  supportedOperations: [
    'charge.create',
    'charge.refresh',
    'checkout.create',
    'webhook.verify'
  ],
  docs: [
    'https://docs.cdp.coinbase.com/commerce-onchain/docs/api',
    'https://docs.cdp.coinbase.com/commerce-onchain/docs/webhooks'
  ],
  configuredNextActions: [
    'Build a crypto charge adapter and map settlement confirmations into invoice payment states.',
    'Treat refunds and outgoing crypto payouts as unsupported until an approved custody/payout provider is chosen.'
  ],
  nextActions: [
    'Set CRYPTO_COMMERCE_API_KEY and CRYPTO_COMMERCE_WEBHOOK_SECRET.',
    'Decide which crypto checkout provider and settlement wallet model Transferly will support.',
    'Add confirmation-depth and underpayment/overpayment handling before marking invoices paid.'
  ],
  notes: [
    'This adapter is scoped to hosted crypto payment collection, not programmatic withdrawals.'
  ]
});

module.exports = {
  cryptoProviderAdapter
};
