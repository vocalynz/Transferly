const { createProviderAdapter } = require('./baseProviderAdapter');

const paystackProviderAdapter = createProviderAdapter({
  key: 'paystack',
  displayName: 'Paystack',
  requiredEnv: ['PAYSTACK_SECRET_KEY', 'PAYSTACK_WEBHOOK_SECRET'],
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
    provider_resource: 'payment_request',
    collection_method: 'hosted_payment_request',
    workflow: 'create_payment_request_then_notify_or_finalize',
    hosted_payment_link: true,
    draft_preview: true,
    line_items: true,
    taxes: true,
    due_date: true,
    customer_notification: true,
    pdf: true,
    manual_finalize: true,
    crypto_settlement: false,
    settlement_flow: 'paymentrequest_success_event_to_internal_pending_balance_then_admin_release',
    required_fields: ['customer', 'currency', 'amount_or_line_items'],
    optional_fields: ['description', 'due_date', 'line_items', 'tax', 'send_notification', 'draft', 'has_invoice'],
    provider_link_field: 'request_url',
    provider_status_events: [
      'paymentrequest.pending',
      'paymentrequest.success',
      'invoice.create',
      'invoice.update',
      'invoice.payment_failed'
    ],
    admin_actions: ['refresh', 'finalize', 'notify', 'archive', 'release_funds', 'open_hosted_link']
  },
  supportedOperations: [
    'payment_request.create',
    'transfer_recipient.create',
    'transfer.create',
    'transfer.finalize',
    'transfer.verify',
    'refund.create',
    'dispute.list',
    'webhook.verify'
  ],
  docs: [
    'https://paystack.com/docs/api/transfer/',
    'https://paystack.com/docs/payments/webhooks',
    'https://paystack.com/docs/api'
  ],
  configuredNextActions: [
    'Build recipient creation and transfer verification flows with Paystack references.',
    'Route transfer.success, transfer.failed, and transfer.reversed events into payout state transitions.'
  ],
  nextActions: [
    'Set PAYSTACK_SECRET_KEY and PAYSTACK_WEBHOOK_SECRET.',
    'Define supported countries and currencies before exposing the service to users.',
    'Decide whether OTP-protected transfers require an admin finalize action.'
  ],
  notes: [
    'Paystack amount units depend on currency; adapters must normalize minor units before ledger writes.'
  ]
});

module.exports = {
  paystackProviderAdapter
};
