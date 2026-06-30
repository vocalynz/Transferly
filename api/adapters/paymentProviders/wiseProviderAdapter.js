const { createProviderAdapter } = require('./baseProviderAdapter');

const wiseProviderAdapter = createProviderAdapter({
  key: 'wise',
  displayName: 'Wise Platform',
  requiredEnv: ['WISE_API_TOKEN', 'WISE_PROFILE_ID'],
  capabilities: {
    invoices: false,
    hosted_payment_links: false,
    payouts: true,
    balance: true,
    webhooks: true,
    refunds: false,
    disputes: false,
    recipients: true,
    quotes: true,
    crypto_payments: false
  },
  invoiceFeatures: {
    supported: false,
    provider_resource: 'none',
    collection_method: 'not_supported',
    reason: 'Wise is modeled as a payout, quote, transfer, and receipt provider; it is not an invoice collection provider in Transferly.',
    replacement_flow: 'Use another provider for invoice collection, then Wise for outbound settlement or recipient payouts.',
    admin_actions: []
  },
  supportedOperations: [
    'quote.create',
    'recipient.create',
    'transfer.create',
    'transfer.fund',
    'transfer.refresh',
    'receipt.fetch',
    'balance.retrieve',
    'webhook.verify'
  ],
  docs: [
    'https://docs.wise.com/api-docs/guides/payouts',
    'https://docs.wise.com/api-reference/quote',
    'https://docs.wise.com/api-reference/transfer'
  ],
  configuredNextActions: [
    'Build quote preview and recipient validation before transfer creation.',
    'Persist quote IDs, transfer IDs, funding state, and Wise receipt URLs.'
  ],
  nextActions: [
    'Set WISE_API_TOKEN and WISE_PROFILE_ID.',
    'Choose supported corridors and currencies for Transferly payouts.',
    'Add transfer requirements validation before collecting recipient details.'
  ],
  notes: [
    'Wise payouts should preview quote fees and exchange rates before committing transfer funds.'
  ]
});

module.exports = {
  wiseProviderAdapter
};
