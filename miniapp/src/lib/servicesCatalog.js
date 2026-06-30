export const serviceCatalog = [
  {
    slug: 'ai-reply',
    title: 'Support AI Reply',
    category: 'Featured',
    badge: 'New',
    status: 'available',
    description: 'Draft verified support replies, payout updates, and customer messages from one Telegram-ready workspace.',
    detail:
      'Use this flow when an operator needs a fast, consistent reply before sending a customer update. It keeps Transferly support language aligned with real invoices, payouts, and receipt status.',
    launchTo: '/miniapp/support',
    launchLabel: 'Open Support AI',
    accent: { bg: '#111827', fg: '#f8fafc', edge: '#374151', glow: 'rgba(17,24,39,0.28)' },
    mark: 'AI'
  },
  {
    slug: 'articles',
    title: 'Ops Playbooks',
    category: 'Knowledge Library',
    badge: 'Utility',
    status: 'available',
    description: 'Save premium operating guides, provider setup notes, and payout runbooks inside the same workspace.',
    detail:
      'This keeps article-style content as a safe knowledge surface for onboarding operators, resolving provider setup issues, and documenting repeatable workflows.',
    launchTo: '/transactions',
    launchLabel: 'View Orders',
    accent: { bg: '#0f172a', fg: '#f8fafc', edge: '#334155', glow: 'rgba(15,23,42,0.28)' },
    mark: 'AR'
  },
  {
    slug: 'faker-data',
    title: 'Sandbox Test Data',
    category: 'Sandbox Tools',
    badge: 'Utility',
    status: 'available',
    description: 'Create clearly marked demo payloads for QA, screenshots, and internal sandbox training.',
    detail:
      'This mirrors the utility shape without creating deceptive personal records. Outputs should stay visibly sandboxed and separated from production customer data.',
    launchTo: '/transactions',
    launchLabel: 'Open Activity',
    accent: { bg: '#164e63', fg: '#ecfeff', edge: '#0f766e', glow: 'rgba(8,145,178,0.22)' },
    mark: 'FD'
  },
  {
    slug: 'opay',
    title: 'Opay',
    category: 'Verified Wallets',
    badge: 'Popular',
    status: 'available',
    description: 'Open an Opay wallet record workspace for verified transfer notes and internal customer support.',
    detail:
      'Opay is treated as a first-click wallet workspace. It routes into the existing receipt studio while framing the output as a verified Transferly record, not a bank-issued document.',
    launchTo: '/dashboard/generate?type=bank&service=opay',
    launchLabel: 'Open Wallet Record Tool',
    accent: { bg: '#16a34a', fg: '#f0fdf4', edge: '#166534', glow: 'rgba(34,197,94,0.24)' },
    mark: 'OP'
  },
  {
    slug: 'kuda',
    title: 'Kuda',
    category: 'Verified Wallets',
    badge: 'Popular',
    status: 'available',
    description: 'Launch a Kuda wallet record workflow from a dedicated service page.',
    detail:
      'Kuda follows the same dedicated-entry pattern as Opay while keeping the output framed as a Transferly support record.',
    launchTo: '/dashboard/generate?type=bank&service=kuda',
    launchLabel: 'Open Wallet Record Tool',
    accent: { bg: '#7c3aed', fg: '#f5f3ff', edge: '#5b21b6', glow: 'rgba(124,58,237,0.22)' },
    mark: 'KU'
  },
  {
    slug: 'palmpay',
    title: 'Palmpay',
    category: 'Verified Wallets',
    badge: 'Soon',
    status: 'comingSoon',
    description: 'Preview the upcoming Palmpay wallet record flow.',
    detail:
      'This page preserves the coming-soon treatment without presenting unreleased wallet tooling as available.',
    launchTo: '',
    launchLabel: 'Coming Soon',
    accent: { bg: '#15803d', fg: '#f0fdf4', edge: '#14532d', glow: 'rgba(21,128,61,0.2)' },
    mark: 'PP'
  },
  {
    slug: 'binance',
    title: 'Binance',
    category: 'Verified Notifications',
    badge: 'Live',
    status: 'available',
    description: 'Open a Binance notification workspace for clearly marked Transferly status updates.',
    detail:
      'This dedicated page routes into the existing email-style receipt builder with Binance selected in context while keeping the output framed as a Transferly notification.',
    launchTo: '/dashboard/generate?type=email&service=binance',
    launchLabel: 'Open Notification Tool',
    accent: { bg: '#f59e0b', fg: '#1f2937', edge: '#b45309', glow: 'rgba(245,158,11,0.24)' },
    mark: 'BI'
  },
  {
    slug: 'bybit',
    title: 'Bybit',
    category: 'Verified Notifications',
    badge: 'Live',
    status: 'available',
    description: 'Bybit notification workflow for transactional or support-style Transferly outputs.',
    detail:
      'Bybit lives in the same verified notification family as Binance and Coinbase.',
    launchTo: '/dashboard/generate?type=email&service=bybit',
    launchLabel: 'Open Notification Tool',
    accent: { bg: '#111827', fg: '#fef3c7', edge: '#374151', glow: 'rgba(17,24,39,0.28)' },
    mark: 'BY'
  },
  {
    slug: 'coinbase',
    title: 'Coinbase',
    category: 'Verified Notifications',
    badge: 'Live',
    status: 'available',
    description: 'Coinbase notification service page routed into the Transferly notification builder.',
    detail:
      'Coinbase is kept as a first-class notification entry while reusing the current email-style receipt tooling.',
    launchTo: '/dashboard/generate?type=email&service=coinbase',
    launchLabel: 'Open Notification Tool',
    accent: { bg: '#2563eb', fg: '#eff6ff', edge: '#1d4ed8', glow: 'rgba(37,99,235,0.24)' },
    mark: 'CB'
  },
  {
    slug: 'paypal',
    title: 'PayPal',
    category: 'Payment Providers',
    badge: 'Live',
    status: 'available',
    description: 'PayPal provider workspace for invoices, payout review, notifications, and balance readiness.',
    detail:
      'PayPal stays prominent, but the service now prioritizes the production provider launcher and keeps notification-style outputs as a secondary workflow.',
    launchTo: '/services/paypal',
    launchLabel: 'Open PayPal Launcher',
    accent: { bg: '#003087', fg: '#eff6ff', edge: '#1d4ed8', glow: 'rgba(0,48,135,0.24)' },
    mark: 'PP'
  },
  {
    slug: 'stripe',
    title: 'Stripe Connect',
    category: 'Payment Providers',
    badge: 'Adapter',
    status: 'available',
    description: 'Stripe Connect provider launcher for invoices, payment links, connected-account payouts, and balance readiness.',
    detail:
      'Stripe is registered as a payment provider adapter. The launcher groups Custom Details, Invoices, Payouts, Wallet Balance, and setup state in one service page.',
    launchTo: '/services/stripe',
    launchLabel: 'Open Stripe Launcher',
    accent: { bg: '#635bff', fg: '#ffffff', edge: '#4f46e5', glow: 'rgba(99,91,255,0.24)' },
    mark: 'ST'
  },
  {
    slug: 'paystack',
    title: 'Paystack',
    category: 'Payment Providers',
    badge: 'Adapter',
    status: 'available',
    description: 'Paystack provider launcher for Payment Requests, transfers, wallet balance, and webhook readiness.',
    detail:
      'Paystack is registered as a payment provider adapter. The launcher groups invoice-like Payment Requests, transfers, Custom Details, and provider setup lanes.',
    launchTo: '/services/paystack',
    launchLabel: 'Open Paystack Launcher',
    accent: { bg: '#011b33', fg: '#ffffff', edge: '#0f3b61', glow: 'rgba(1,27,51,0.26)' },
    mark: 'PS'
  },
  {
    slug: 'flutterwave',
    title: 'Flutterwave',
    category: 'Payment Providers',
    badge: 'Adapter',
    status: 'available',
    description: 'Flutterwave provider launcher for hosted checkout links, transfers, transfer-rate previews, and wallet readiness.',
    detail:
      'Flutterwave is registered as a payment provider adapter. The launcher groups hosted checkout, payout transfers, Custom Details, balance readiness, and setup state.',
    launchTo: '/services/flutterwave',
    launchLabel: 'Open Flutterwave Launcher',
    accent: { bg: '#f5a623', fg: '#1f2937', edge: '#b87503', glow: 'rgba(245,166,35,0.24)' },
    mark: 'FL'
  },
  {
    slug: 'crypto',
    title: 'Crypto Commerce',
    category: 'Payment Providers',
    badge: 'Adapter',
    status: 'available',
    description: 'Crypto Commerce provider launcher for hosted crypto checkout, settlement review, and receipt-style custom details.',
    detail:
      'Crypto Commerce is registered as a hosted charge and checkout adapter. The launcher keeps crypto invoices, settlement safeguards, wallet review, and Custom Details grouped together.',
    launchTo: '/services/crypto',
    launchLabel: 'Open Crypto Launcher',
    accent: { bg: '#111827', fg: '#fef3c7', edge: '#374151', glow: 'rgba(17,24,39,0.28)' },
    mark: 'CR'
  },
  {
    slug: 'crypto-com',
    title: 'Crypto.com',
    category: 'Verified Notifications',
    badge: 'Live',
    status: 'available',
    description: 'Crypto.com notification surface with direct access into the Transferly notification builder.',
    detail:
      'Crypto.com is part of the verified notification set for exchange and wallet status updates.',
    launchTo: '/dashboard/generate?type=email&service=crypto-com',
    launchLabel: 'Open Notification Tool',
    accent: { bg: '#1d4ed8', fg: '#eff6ff', edge: '#1e40af', glow: 'rgba(29,78,216,0.24)' },
    mark: 'CC'
  },
  {
    slug: 'wise',
    title: 'Wise',
    category: 'Payment Providers',
    badge: 'Live',
    status: 'available',
    description: 'Wise provider launcher for transfer tracking, payout readiness, and customer-facing status updates.',
    detail:
      'Wise is surfaced as a production provider workspace instead of a deceptive mail generator.',
    launchTo: '/services/wise',
    launchLabel: 'Open Wise Launcher',
    accent: { bg: '#14b8a6', fg: '#ecfeff', edge: '#0f766e', glow: 'rgba(20,184,166,0.24)' },
    mark: 'WI'
  },
  {
    slug: 'cash-app',
    title: 'Cash App',
    category: 'Verified Notifications',
    badge: 'New',
    status: 'available',
    description: 'Cash App notification flow with a one-click service-page entry.',
    detail:
      'Cash App is available as a verified notification entry routed into the existing builder.',
    launchTo: '/dashboard/generate?type=email&service=cash-app',
    launchLabel: 'Open Notification Tool',
    accent: { bg: '#16a34a', fg: '#f0fdf4', edge: '#166534', glow: 'rgba(22,163,74,0.24)' },
    mark: 'CA'
  },
  {
    slug: 'zelle',
    title: 'Zelle',
    category: 'Verified Notifications',
    badge: 'New',
    status: 'available',
    description: 'Zelle notification service with its own branded landing page before launch.',
    detail:
      'Zelle keeps the service-page-first click model while using verified notification language.',
    launchTo: '/dashboard/generate?type=email&service=zelle',
    launchLabel: 'Open Notification Tool',
    accent: { bg: '#6d28d9', fg: '#f5f3ff', edge: '#5b21b6', glow: 'rgba(109,40,217,0.22)' },
    mark: 'ZE'
  },
  {
    slug: 'venmo',
    title: 'Venmo',
    category: 'Verified Notifications',
    badge: 'New',
    status: 'available',
    description: 'Venmo notification tool page with direct access into the Transferly builder.',
    detail:
      'Venmo is available as a first-class notification entry before the builder opens.',
    launchTo: '/dashboard/generate?type=email&service=venmo',
    launchLabel: 'Open Notification Tool',
    accent: { bg: '#1d4ed8', fg: '#eff6ff', edge: '#1e40af', glow: 'rgba(29,78,216,0.22)' },
    mark: 'VE'
  },
  {
    slug: 'trust-wallet',
    title: 'Trust Wallet',
    category: 'Verified Notifications',
    badge: 'New',
    status: 'available',
    description: 'Trust Wallet notification surface built into the same Transferly flow.',
    detail:
      'Trust Wallet is treated as a new verified notification service in the Transferly catalog.',
    launchTo: '/dashboard/generate?type=email&service=trust-wallet',
    launchLabel: 'Open Notification Tool',
    accent: { bg: '#2563eb', fg: '#eff6ff', edge: '#1d4ed8', glow: 'rgba(37,99,235,0.24)' },
    mark: 'TW'
  },
  {
    slug: 'gcash',
    title: 'GCash',
    category: 'Verified Notifications',
    badge: 'New',
    status: 'available',
    description: 'GCash notification flow with a dedicated catalog entry and branded landing page.',
    detail:
      'GCash stays visible as a newer notification entry even though the builder underneath is shared.',
    launchTo: '/dashboard/generate?type=email&service=gcash',
    launchLabel: 'Open Notification Tool',
    accent: { bg: '#0ea5e9', fg: '#ecfeff', edge: '#0369a1', glow: 'rgba(14,165,233,0.24)' },
    mark: 'GC'
  },
  {
    slug: 'crypto-receipts',
    title: 'Receipt Vault',
    category: 'Receipt Vault',
    badge: 'Live',
    status: 'available',
    description: 'Store crypto and provider receipt records in a searchable customer support vault.',
    detail:
      'This keeps crypto receipt review distinct from provider notifications and gives operators a safer way to inspect settlement evidence.',
    launchTo: '/miniapp/vault',
    launchLabel: 'Open Receipt Vault',
    accent: { bg: '#0f172a', fg: '#fef3c7', edge: '#334155', glow: 'rgba(15,23,42,0.3)' },
    mark: 'CR'
  },
  {
    slug: 'support-sites',
    title: 'Support Desk',
    category: 'Support Desk',
    badge: 'Suite',
    status: 'available',
    description: 'Manage help content, escalation states, and customer support work without cloning third-party pages.',
    detail:
      'This dedicated surface routes to Transferly support material and avoids any external brand impersonation.',
    launchTo: '/miniapp/support',
    launchLabel: 'Open Support Desk',
    accent: { bg: '#334155', fg: '#f8fafc', edge: '#0f172a', glow: 'rgba(51,65,85,0.24)' },
    mark: 'SS'
  },
  {
    slug: 'pass-clone',
    title: 'Security Center',
    category: 'Security Center',
    badge: 'Suite',
    status: 'available',
    description: 'Review account safety, provider readiness, webhook posture, and audit-sensitive actions.',
    detail:
      'This replaces credential-capture style tooling with a safe security command center for Transferly operators.',
    launchTo: '/miniapp/security',
    launchLabel: 'Open Security Center',
    accent: { bg: '#1f2937', fg: '#f8fafc', edge: '#111827', glow: 'rgba(31,41,55,0.24)' },
    mark: 'PC'
  },
  {
    slug: 'wallet-tracker',
    title: 'Provider Balance Tracker',
    category: 'Provider Balance Tracker',
    badge: 'New',
    status: 'available',
    description: 'Track provider balances, payout holds, settlement windows, and wallet activity in one lane.',
    detail:
      'This turns the wallet-tracker idea into an operations view for real Transferly provider balances and payout readiness.',
    launchTo: '/miniapp/wallet',
    launchLabel: 'Open Balance Tracker',
    accent: { bg: '#0f766e', fg: '#ecfeff', edge: '#115e59', glow: 'rgba(15,118,110,0.24)' },
    mark: 'WT'
  },
  {
    slug: 'qr-code',
    title: 'Payment QR',
    category: 'Payment QR',
    badge: 'New',
    status: 'available',
    description: 'Create branded payment QR entry points for invoices, payment links, and customer checkout handoff.',
    detail:
      'The captured live service grid treats QR Code as a separate utility entry, so this page makes it directly addressable and catalog-driven.',
    launchTo: '/miniapp/studio',
    launchLabel: 'Open QR Workspace',
    accent: { bg: '#ea580c', fg: '#fff7ed', edge: '#c2410c', glow: 'rgba(234,88,12,0.22)' },
    mark: 'QR'
  },
  {
    slug: 'link-shortener',
    title: 'Payment Link Shortener',
    category: 'Payment Links',
    badge: 'New',
    status: 'available',
    description: 'Turn long checkout, invoice, and receipt links into trackable payment links.',
    detail:
      'Link Shortener sits in the utility tail of the captured live list. The dedicated service route keeps it discoverable and aligned with the live IA.',
    launchTo: '/miniapp/activity',
    launchLabel: 'Open Payment Links',
    accent: { bg: '#7c2d12', fg: '#fff7ed', edge: '#9a3412', glow: 'rgba(124,45,18,0.22)' },
    mark: 'LS'
  },
  {
    slug: 'investinnova',
    title: 'Workflow Templates',
    category: 'Template Marketplace',
    badge: 'Premium',
    status: 'available',
    description: 'Premium reusable workflows for provider onboarding, support triage, and payout operations.',
    detail:
      'This mirrors the marketplace shape while keeping the product focused on safe Transferly operating templates instead of opaque scripts.',
    launchTo: '/miniapp/ops',
    launchLabel: 'Open Template Marketplace',
    accent: { bg: '#14532d', fg: '#f0fdf4', edge: '#166534', glow: 'rgba(20,83,45,0.24)' },
    mark: 'IN'
  }
];

export const serviceGroups = [
  {
    title: 'Featured',
    description: 'Top-level support, knowledge, and sandbox surfaces shown first in the Transferly catalog.',
    slugs: ['ai-reply', 'articles', 'faker-data']
  },
  {
    title: 'Verified Wallets',
    description: 'Wallet-record workspaces with direct, brand-specific launch points for Transferly support records.',
    slugs: ['opay', 'kuda', 'palmpay']
  },
  {
    title: 'Payment Providers',
    description: 'Provider launchers group Custom Details, Invoices, Payouts, Wallet Balance, and setup state by provider.',
    slugs: ['paypal', 'stripe', 'wise', 'paystack', 'flutterwave', 'crypto']
  },
  {
    title: 'Verified Notifications',
    description: 'Exchange, wallet, and payment-brand notification flows framed as Transferly status updates.',
    slugs: [
      'binance',
      'bybit',
      'coinbase',
      'crypto-com',
      'cash-app',
      'zelle',
      'venmo',
      'trust-wallet',
      'gcash'
    ]
  },
  {
    title: 'Receipt Vault',
    description: 'Crypto and provider receipt review is surfaced as its own Transferly operations lane.',
    slugs: ['crypto-receipts']
  },
  {
    title: 'Support Desk',
    description: 'Support tooling keeps a dedicated group instead of being bundled with utilities.',
    slugs: ['support-sites']
  },
  {
    title: 'Security Center',
    description: 'Security, audit, and provider-readiness tooling is kept separate from support flows.',
    slugs: ['pass-clone']
  },
  {
    title: 'Provider Balance Tracker',
    description: 'Provider balance tracking is presented as its own new service lane.',
    slugs: ['wallet-tracker']
  },
  {
    title: 'Payment QR',
    description: 'QR generation is a standalone payment utility group in the service catalog.',
    slugs: ['qr-code']
  },
  {
    title: 'Payment Links',
    description: 'Link shortening is a standalone checkout and receipt utility group.',
    slugs: ['link-shortener']
  },
  {
    title: 'Template Marketplace',
    description: 'Standalone premium workflow templates surfaced below the main service tools.',
    slugs: ['investinnova']
  }
];

export function getServiceBySlug(slug) {
  return serviceCatalog.find((service) => service.slug === slug) || null;
}

export function getServicesByGroup(group) {
  return group.slugs
    .map((slug) => getServiceBySlug(slug))
    .filter(Boolean);
}

const categoryPreviewDefaults = {
  'Verified Notifications': {
    eyebrow: 'Verified notification flow',
    headline: 'Open a branded Transferly notification builder with one clean export path.',
    bullets: ['Provider-focused framing', 'Shared receipt/export engine', 'Fast launch from services grid']
  },
  'Verified Wallets': {
    eyebrow: 'Wallet record flow',
    headline: 'Launch a branded wallet-record workspace with transaction-ready fields.',
    bullets: ['Wallet-specific framing', 'Downloadable support record', 'Point-based generation']
  },
  Featured: {
    eyebrow: 'Utility flow',
    headline: 'Keep lightweight tools in the same catalog rhythm as the live app.',
    bullets: ['Single-purpose workspace', 'Fast re-entry from dashboard', 'Catalog-first navigation']
  },
  'Template Marketplace': {
    eyebrow: 'Template listing',
    headline: 'Treat premium operating templates like product listings instead of generic generator cards.',
    bullets: ['High-value listing', 'Separate purchase context', 'Visible inside the main services board']
  },
  'Receipt Vault': {
    eyebrow: 'Receipt vault',
    headline: 'Keep provider and crypto receipt evidence searchable from one operator surface.',
    bullets: ['Settlement context', 'Customer support trail', 'Fast vault re-entry']
  },
  'Support Desk': {
    eyebrow: 'Support desk',
    headline: 'Route operators into safe support workflows without external page cloning.',
    bullets: ['Help content', 'Escalation framing', 'Customer-safe messaging']
  },
  'Security Center': {
    eyebrow: 'Security center',
    headline: 'Review sensitive provider and account posture without collecting credentials.',
    bullets: ['Audit posture', 'Provider readiness', 'Safe remediation paths']
  }
};

const servicePreviewOverrides = {
  paypal: {
    eyebrow: 'PayPal provider workspace',
    headline: 'Route into PayPal invoices, payouts, balance review, and notification-ready support flows.',
    bullets: ['PayPal service framing', 'Provider launcher', 'Best paired with a points top-up']
  },
  opay: {
    eyebrow: 'Opay wallet record',
    headline: 'Start from the Opay tile and drop straight into the wallet-record workflow.',
    bullets: ['Opay-specific positioning', 'Receipt studio underneath', 'Fast output download']
  },
  kuda: {
    eyebrow: 'Kuda wallet record',
    headline: 'Use a dedicated Kuda entry page before entering the shared wallet-record builder.',
    bullets: ['Kuda-branded click path', 'Shared generation engine', 'Points-based export']
  },
  investinnova: {
    eyebrow: 'Template marketplace',
    headline: 'Keep premium workflow templates visually distinct from the tool generators.',
    bullets: ['High-value listing', 'Catalog visibility', 'Purchase-oriented product surface']
  }
};

export function getServicePreview(service) {
  return servicePreviewOverrides[service.slug] || categoryPreviewDefaults[service.category] || {
    eyebrow: 'Service flow',
    headline: 'Give each catalog entry a focused preview before the user launches the underlying tool.',
    bullets: ['Dedicated service page', 'Stronger category framing', 'Clear next action']
  };
}

export function getServiceEstimatedCost(service, config) {
  if (service.category === 'Verified Wallets' || service.launchTo?.includes('type=bank')) {
    return Number(config?.bank_slip_cost || 10);
  }

  if (service.category === 'Verified Notifications' || service.launchTo?.includes('type=email')) {
    return Number(config?.email_receipt_cost || 5);
  }

  if (service.category === 'Template Marketplace') {
    return 95000;
  }

  return null;
}

export function getRecommendedPointPacks(service, config) {
  const baseline = getServiceEstimatedCost(service, config);

  if (!baseline) {
    return [50, 100, 250, 500];
  }

  const multipliers = baseline >= 1000 ? [1, 2, 3, 5] : [2, 5, 10, 25];
  return [...new Set(multipliers.map((multiplier) => baseline * multiplier))]
    .sort((left, right) => left - right);
}

export function getRelatedServices(slug, limit = 3) {
  const current = getServiceBySlug(slug);
  if (!current) {
    return [];
  }

  return serviceCatalog
    .filter((service) => service.slug !== slug)
    .filter((service) => service.category === current.category || service.status === current.status)
    .slice(0, limit);
}

export const dashboardPreviewSlugs = [
  'crypto-receipts',
  'paypal',
  'kuda',
  'support-sites',
  'pass-clone',
  'qr-code',
  'link-shortener',
  'cash-app',
  'zelle',
  'venmo',
  'trust-wallet',
  'wise',
  'faker-data',
  'wallet-tracker',
  'binance',
  'coinbase'
];
