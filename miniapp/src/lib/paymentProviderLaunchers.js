const providerAccent = {
  paypal: { bg: '#003087', fg: '#ffffff', soft: '#eef5ff', edge: '#bfd3f7' },
  stripe: { bg: '#635bff', fg: '#ffffff', soft: '#f1efff', edge: '#d7d2ff' },
  wise: { bg: '#14b8a6', fg: '#ecfeff', soft: '#ecfdf5', edge: '#b8efe4' },
  paystack: { bg: '#011b33', fg: '#ffffff', soft: '#eef7ff', edge: '#bfdcf6' },
  flutterwave: { bg: '#f5a623', fg: '#1f2937', soft: '#fff8e7', edge: '#f3d28b' },
  crypto: { bg: '#111827', fg: '#fef3c7', soft: '#f8fafc', edge: '#cbd5e1' }
};

function customDetailsLane(providerKey, providerName, bullets) {
  return {
    id: 'custom-details',
    title: 'Custom Details',
    subtitle: `Open the ${providerName} notification builder with ${providerName} context already applied.`,
    kind: 'custom',
    status: 'live',
    ctaLabel: 'Open Custom Details',
    to: `/dashboard/generate?type=email&service=${providerKey}&mailType=custom`,
    bullets
  };
}

function invoicesLane(status, subtitle, bullets) {
  return {
    id: 'invoices',
    title: 'Invoices',
    kind: 'invoice',
    status,
    adminOnly: true,
    subtitle,
    bullets
  };
}

function payoutsLane(status, subtitle, bullets) {
  return {
    id: 'payouts',
    title: 'Payouts',
    kind: 'payout',
    status,
    adminOnly: true,
    subtitle,
    bullets
  };
}

function walletLane(status, subtitle, bullets) {
  return {
    id: 'wallet-balance',
    title: 'Wallet Balance',
    kind: 'balance',
    status,
    adminOnly: true,
    subtitle,
    bullets
  };
}

function activityLane(status, subtitle, bullets) {
  return {
    id: 'provider-activity',
    title: 'Provider Activity',
    kind: 'activity',
    status,
    adminOnly: true,
    subtitle,
    bullets
  };
}

export const paymentProviderLaunchers = {
  paypal: {
    key: 'paypal',
    title: 'PayPal',
    eyebrow: 'Official provider workspace',
    statusLabel: 'Live PayPal adapter',
    description:
      'Use PayPal as the production-facing workspace for hosted invoices, payout review, provider-state sync, verified notifications, and release controls.',
    accent: providerAccent.paypal,
    capabilities: ['Hosted invoices', 'Official payouts', 'Verified notifications', 'Provider webhooks'],
    lanes: [
      customDetailsLane('paypal', 'PayPal', ['PayPal-styled sender', 'Editable receipt body', 'Deposit or custom notification context']),
      invoicesLane('live', 'Create, send, refresh, release, and open official hosted PayPal invoice links.', [
        'Hosted invoice links',
        'QR generation',
        'Reminder cadence'
      ]),
      payoutsLane('live', 'Approve, reject, refresh, and cancel unclaimed PayPal payouts from the embedded operations console.', [
        'Provider-state tracking',
        'Review queue actions',
        'Funding release alignment'
      ]),
      walletLane('setup', 'Use the internal Transferly ledger for operator balance decisions while direct PayPal balance retrieval remains disabled.', [
        'Internal wallet source',
        'Payout debit preview',
        'Release-controlled availability'
      ]),
      activityLane('live', 'Track PayPal webhook ingestion, invoice state changes, payout refreshes, and payment ops issues from the admin workspace.', [
        'Verified webhooks',
        'Invoice and payout timelines',
        'Payment ops audit trail'
      ])
    ]
  },
  stripe: {
    key: 'stripe',
    title: 'Stripe Connect',
    eyebrow: 'Provider adapter workspace',
    statusLabel: 'Adapter registered',
    description:
      'Operate Stripe as a provider workspace for hosted invoices today, while connected-account payouts, balance views, refunds, and disputes remain behind setup lanes.',
    accent: providerAccent.stripe,
    capabilities: ['Hosted invoices', 'Payment links', 'Connected payouts', 'Refunds and disputes'],
    lanes: [
      customDetailsLane('stripe', 'Stripe', ['Stripe-styled sender', 'Editable payment notice', 'Shared receipt builder']),
      invoicesLane('live', 'Create, refresh, void, release, and open official Stripe hosted invoice pages from the embedded operations console.', [
        'Customer invoice flow',
        'Hosted invoice URL and PDF',
        'Invoice paid or failed webhooks'
      ]),
      payoutsLane('live', 'Preview and submit gated Stripe Connect transfers to connected accounts when Stripe payout submission is enabled.', [
        'Connected account payouts',
        'Platform balance checks',
        'Transfer reconciliation'
      ]),
      walletLane('live', 'Inspect Stripe platform or configured connected-account balance with available and pending payout capacity.', [
        'Platform balance',
        'Connected account balance',
        'Payout availability'
      ]),
      activityLane('live', 'Stripe invoice webhooks are verified and mapped into provider invoice state, payment ops, and release workflows.', [
        'Signed webhook intake',
        'Invoice paid or failed state',
        'Idempotent ledger settlement'
      ])
    ]
  },
  wise: {
    key: 'wise',
    title: 'Wise',
    eyebrow: 'Payout provider workspace',
    statusLabel: 'Adapter registered',
    description:
      'Use Wise as a future payout, quote, transfer, receipt, and balance provider. Invoice collection stays with PayPal, Stripe, Paystack, Flutterwave, or Crypto.',
    accent: providerAccent.wise,
    capabilities: ['Quotes', 'Recipients', 'Transfers', 'Receipts'],
    lanes: [
      customDetailsLane('wise', 'Wise', ['Wise-styled sender', 'Transfer notice body', 'Deposit or custom notification context']),
      invoicesLane('setup', 'Wise is payout-first in Transferly, so this lane explains why invoice collection should use another provider.', [
        'No invoice collection',
        'Use hosted invoice providers',
        'Pair with outbound transfer'
      ]),
      payoutsLane('setup', 'Wise payout lanes will start with quote preview, recipient validation, transfer creation, funding, and receipt retrieval.', [
        'Quote preview',
        'Recipient validation',
        'Transfer receipt'
      ]),
      walletLane('setup', 'Wise balance checks will show available balances by profile and currency before transfer submission.', [
        'Profile balance',
        'Currency balance',
        'Funding readiness'
      ]),
      activityLane('setup', 'Wise activity will track quote creation, recipient validation, transfer funding, transfer state, and receipt retrieval.', [
        'Transfer status sync',
        'Receipt retrieval',
        'Webhook verification'
      ])
    ]
  },
  paystack: {
    key: 'paystack',
    title: 'Paystack',
    eyebrow: 'Provider adapter workspace',
    statusLabel: 'Adapter registered',
    description:
      'Prepare Paystack as a provider workspace for payment requests, invoice-like hosted collection, transfers, refunds, disputes, and webhooks.',
    accent: providerAccent.paystack,
    capabilities: ['Payment requests', 'Transfers', 'Refunds', 'Disputes'],
    lanes: [
      customDetailsLane('paystack', 'Paystack', ['Paystack-styled sender', 'Editable payment notice', 'Shared receipt builder']),
      invoicesLane('setup', 'Paystack Payment Requests will map to Transferly invoice collection with finalize and notify actions.', [
        'Payment request draft',
        'Finalize and notify',
        'Payment request webhooks'
      ]),
      payoutsLane('setup', 'Paystack transfers will support recipient setup, transfer verify, and OTP-aware admin flows.', [
        'Transfer recipients',
        'Transfer verification',
        'OTP finalize path'
      ]),
      walletLane('setup', 'Balance views will show Paystack funding readiness before transfer submission.', [
        'Provider balance',
        'Currency readiness',
        'Transfer capacity'
      ]),
      activityLane('setup', 'Paystack activity will track payment request events, transfer state, disputes, refunds, and webhook verification.', [
        'Payment request events',
        'Transfer state mapping',
        'Refund and dispute review'
      ])
    ]
  },
  flutterwave: {
    key: 'flutterwave',
    title: 'Flutterwave',
    eyebrow: 'Provider adapter workspace',
    statusLabel: 'Adapter registered',
    description:
      'Prepare Flutterwave as a hosted checkout, payment link, transfer, FX-rate, mobile-money, and webhook provider workspace.',
    accent: providerAccent.flutterwave,
    capabilities: ['Hosted checkout', 'Transfers', 'Transfer rates', 'Mobile money'],
    lanes: [
      customDetailsLane('flutterwave', 'Flutterwave', ['Flutterwave-styled sender', 'Editable payment notice', 'Shared receipt builder']),
      invoicesLane('setup', 'Flutterwave hosted checkout links will map to Transferly invoice collection and transaction verification.', [
        'Hosted checkout link',
        'Transaction verification',
        'Charge webhooks'
      ]),
      payoutsLane('setup', 'Flutterwave transfer lanes will support recipient fields, transfer rates, and payout status sync.', [
        'Transfer recipient',
        'Transfer rate preview',
        'Payout status sync'
      ]),
      walletLane('setup', 'Balance and funding readiness will be shown before hosted checkout settlement or transfer submission.', [
        'Wallet balance',
        'Currency readiness',
        'Transfer funding'
      ]),
      activityLane('setup', 'Flutterwave activity will track charge verification, transfer updates, payout issues, and webhook processing.', [
        'Charge verification',
        'Transfer updates',
        'Webhook processing'
      ])
    ]
  },
  crypto: {
    key: 'crypto',
    title: 'Crypto Commerce',
    eyebrow: 'Crypto checkout workspace',
    statusLabel: 'Adapter registered',
    description:
      'Use Crypto Commerce as a hosted charge and checkout provider for invoice-style crypto collection with settlement safeguards.',
    accent: providerAccent.crypto,
    capabilities: ['Crypto checkout', 'Hosted charges', 'Settlement review', 'Webhook confirmation'],
    lanes: [
      customDetailsLane('crypto', 'Crypto Commerce', ['Crypto-styled sender', 'Editable payment notice', 'Shared receipt builder']),
      invoicesLane('live', 'Create, refresh, review, release, and open hosted crypto charge links with settlement safeguards.', [
        'Hosted crypto charge',
        'Confirmation review',
        'Underpayment and overpayment checks'
      ]),
      payoutsLane('setup', 'Outgoing crypto payouts stay disabled until an approved custody or withdrawal provider is selected.', [
        'Custody provider required',
        'Withdrawal risk controls',
        'Manual settlement policy'
      ]),
      walletLane('setup', 'Settlement wallet and confirmation-state views will be added before crypto release controls go live.', [
        'Settlement wallet',
        'Confirmation status',
        'Network mismatch review'
      ]),
      activityLane('live', 'Crypto charge webhooks are verified and mapped into settlement review, provider state, and guarded release flows.', [
        'Signed webhook intake',
        'Charge confirmation state',
        'Settlement safeguards'
      ])
    ]
  }
};

export function getPaymentProviderLauncher(slug) {
  return paymentProviderLaunchers[slug] || null;
}

export function normalizePaymentProviderView(view) {
  if (view === 'official-invoicing') return 'invoices';
  if (view === 'official-payouts') return 'payouts';
  if (view === 'webhooks' || view === 'activity') return 'provider-activity';
  return view || '';
}
