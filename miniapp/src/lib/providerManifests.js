import { getPaymentProviderLauncher } from './paymentProviderLaunchers.js';

// Provider manifests are Transferly-owned workspace metadata. They keep provider
// identity lightweight and secondary while routing each provider into shared lanes.
export const providerWorkspaceLaneDefinitions = [
  {
    id: 'overview',
    label: 'Overview',
    shortLabel: 'Overview',
    description: 'Transferly workspace summary for readiness, supported operations, and next actions.'
  },
  {
    id: 'custom-details',
    label: 'Custom Details',
    shortLabel: 'Details',
    description: 'Provider-aware notification and receipt detail builder.'
  },
  {
    id: 'invoices',
    label: 'Collections',
    shortLabel: 'Collect',
    description: 'Invoice, payment link, hosted checkout, or charge collection lane.'
  },
  {
    id: 'payouts',
    label: 'Sending',
    shortLabel: 'Send',
    description: 'Payout, transfer, or withdrawal preparation lane.'
  },
  {
    id: 'wallet',
    label: 'Wallet',
    shortLabel: 'Wallet',
    description: 'Provider balance, funding, and settlement readiness lane.'
  },
  {
    id: 'activity',
    label: 'Activity',
    shortLabel: 'Activity',
    description: 'Provider webhooks, state changes, audit events, and operational issues.'
  },
  {
    id: 'payments',
    label: 'Payments',
    shortLabel: 'Payments',
    description: 'Payment collection, hosted payment surfaces, and payment state tracking.'
  },
  {
    id: 'billing',
    label: 'Billing',
    shortLabel: 'Billing',
    description: 'Recurring billing, hosted invoices, subscription readiness, and billing operations.'
  },
  {
    id: 'connect',
    label: 'Connect',
    shortLabel: 'Connect',
    description: 'Connected account, transfer, onboarding, and platform balance operations.'
  },
  {
    id: 'receive',
    label: 'Receive',
    shortLabel: 'Receive',
    description: 'Provider-native receiving, collection, account detail, or hosted payment intake lane.'
  },
  {
    id: 'send',
    label: 'Send',
    shortLabel: 'Send',
    description: 'Provider-native transfer, payout, withdrawal, or money movement lane.'
  },
  {
    id: 'balances',
    label: 'Balances',
    shortLabel: 'Balances',
    description: 'Balance, currency, funding, and settlement readiness lane.'
  },
  {
    id: 'compliance',
    label: 'Compliance',
    shortLabel: 'Compliance',
    description: 'Recipient checks, quote constraints, identity posture, and compliance readiness.'
  },
  {
    id: 'collections',
    label: 'Collections',
    shortLabel: 'Collect',
    description: 'Payment collection, hosted checkout, payment request, and authorization flows.'
  },
  {
    id: 'customers',
    label: 'Customers',
    shortLabel: 'Customers',
    description: 'Customer records, reusable recipients, payment profiles, and customer activity.'
  },
  {
    id: 'virtual-accounts',
    label: 'Virtual Accounts',
    shortLabel: 'Accounts',
    description: 'Dedicated virtual account setup, collection routing, and reconciliation readiness.'
  },
  {
    id: 'subscriptions',
    label: 'Subscriptions',
    shortLabel: 'Subs',
    description: 'Recurring charge setup, subscription lifecycle, and billing cadence readiness.'
  },
  {
    id: 'transfers',
    label: 'Transfers',
    shortLabel: 'Transfers',
    description: 'Transfer initiation, beneficiary readiness, transfer rates, and payout operations.'
  },
  {
    id: 'settlements',
    label: 'Settlements',
    shortLabel: 'Settle',
    description: 'Settlement balances, expected arrivals, funding posture, and reconciliation status.'
  },
  {
    id: 'refunds',
    label: 'Refunds',
    shortLabel: 'Refunds',
    description: 'Refund review, reversal readiness, charge lookup, and customer remediation.'
  },
  {
    id: 'confirmations',
    label: 'Confirmations',
    shortLabel: 'Confirm',
    description: 'Network confirmation, webhook state, settlement review, and release readiness.'
  },
  {
    id: 'security',
    label: 'Security',
    shortLabel: 'Security',
    description: 'Wallet safety, release controls, confirmation thresholds, and operational safeguards.'
  },
  {
    id: 'developer',
    label: 'Developer',
    shortLabel: 'Dev',
    description: 'Webhook setup, traceability, idempotency guidance, and operator tools for provider integrations.'
  }
];

const laneById = new Map(providerWorkspaceLaneDefinitions.map((lane) => [lane.id, lane]));

const launcherLaneToWorkspaceLane = {
  'custom-details': 'custom-details',
  invoices: 'invoices',
  payouts: 'payouts',
  'wallet-balance': 'wallet',
  'provider-activity': 'activity'
};

export const workspaceLaneToLauncherLane = {
  'custom-details': 'custom-details',
  invoices: 'invoices',
  payouts: 'payouts',
  wallet: 'wallet-balance',
  activity: 'provider-activity'
};

// New provider-native lanes can reuse existing launcher/AdminPaymentsTab
// workflows until each provider has a dedicated backend implementation.
export const providerLaneToLauncherLane = {
  stripe: {
    payments: 'invoices',
    billing: 'invoices',
    connect: 'payouts',
    activity: 'provider-activity',
    developer: 'provider-activity'
  },
  wise: {
    send: 'payouts',
    balances: 'wallet-balance',
    activity: 'provider-activity'
  },
  paystack: {
    collections: 'invoices',
    customers: 'custom-details',
    'virtual-accounts': 'wallet-balance',
    activity: 'provider-activity',
    developer: 'provider-activity'
  },
  flutterwave: {
    collections: 'invoices',
    transfers: 'payouts',
    settlements: 'wallet-balance',
    refunds: 'provider-activity',
    activity: 'provider-activity',
    developer: 'provider-activity'
  },
  crypto: {
    receive: 'invoices',
    confirmations: 'provider-activity',
    activity: 'provider-activity',
    security: 'provider-activity'
  }
};

const providerManifestSeeds = [
  {
    id: 'paypal',
    slug: 'paypal',
    displayName: 'PayPal',
    shortDescription: 'Hosted invoices, official payouts, verified webhooks, and provider activity managed from Transferly.',
    logoAsset: '/brand-logos/paypal.png',
    iconLabel: 'PP',
    brand: {
      treatment: 'approved-secondary-provider-branding',
      label: 'Approved PayPal resources',
      summary:
        'PayPal appears as a connected provider inside Transferly. Use approved assets and provider terminology while keeping Transferly as the primary product shell.',
      assetSourceLabel: 'PayPal media resources',
      assetSourceUrl: 'https://newsroom.paypal-corp.com/media-resources',
      guidelinesLabel: 'PayPal developer policies',
      guidelinesUrl: 'https://developer.paypal.com/reference/guidelines/policiesAndGuidelines/',
      buttonGuideLabel: 'Button design guide',
      buttonGuideUrl: 'https://developer.paypal.com/docs/log-in-with-paypal/customize/button-design-guide/',
      layoutPrinciples: [
        'Transferly shell stays primary',
        'Provider branding stays secondary',
        'Use approved logo assets only',
        'Do not imitate PayPal dashboards'
      ]
    },
    theme: {
      accentColor: '#0070e0',
      accentSoft: 'rgba(0,112,224,0.14)',
      accentBorder: 'rgba(0,112,224,0.28)'
    },
    docsUrl: 'https://developer.paypal.com/docs/api/overview/',
    supportUrl: 'https://developer.paypal.com/support/',
    environmentSupport: ['sandbox', 'production'],
    supportedLanes: ['overview', 'custom-details', 'invoices', 'payouts', 'wallet', 'activity', 'developer'],
    capabilities: ['Hosted invoices', 'Official payouts', 'Verified webhooks', 'Provider activity', 'Developer tools'],
    status: 'live',
    featureFlags: {
      providerWorkspaceFoundation: true,
      invoiceCollection: true,
      payoutSubmission: true,
      balanceLookup: false,
      webhookActivity: true,
      developerTools: true
    }
  },
  {
    id: 'stripe',
    slug: 'stripe',
    displayName: 'Stripe Connect',
    shortDescription: 'Hosted invoices, connected-account transfers, platform balance checks, and signed webhook activity.',
    logoAsset: '/brand-logos/stripe.svg',
    iconLabel: 'ST',
    theme: {
      accentColor: '#635bff',
      accentSoft: 'rgba(99,91,255,0.14)',
      accentBorder: 'rgba(99,91,255,0.28)'
    },
    docsUrl: 'https://docs.stripe.com/connect',
    supportUrl: 'https://support.stripe.com/',
    environmentSupport: ['test', 'live'],
    supportedLanes: ['overview', 'payments', 'billing', 'connect', 'activity', 'developer'],
    includeLauncherLanes: false,
    capabilities: ['Payments', 'Billing', 'Connect', 'Platform balance', 'Signed webhooks'],
    status: 'live',
    featureFlags: {
      providerWorkspaceFoundation: true,
      invoiceCollection: true,
      payoutSubmission: true,
      balanceLookup: true,
      webhookActivity: true,
      developerTools: true
    },
    laneSupport: {
      payments: 'live',
      billing: 'preview',
      connect: 'live',
      activity: 'live',
      developer: 'preview'
    },
    laneOverrides: {
      payments: {
        description: 'Stripe payment collection using the existing hosted invoice and payment workflow in Transferly.'
      },
      billing: {
        description: 'Hosted invoice billing is available now; subscription lifecycle tooling remains a setup lane.'
      },
      connect: {
        description: 'Connected account transfers and platform balance checks using Transferly payout operations.'
      },
      developer: {
        description: 'Signed webhook, idempotency, and request traceability guidance for the Stripe integration.'
      }
    }
  },
  {
    id: 'wise',
    slug: 'wise',
    displayName: 'Wise',
    shortDescription: 'Payout-first workspace for quotes, recipients, transfers, funding, balances, and receipts.',
    logoAsset: '/brand-logos/wise.png',
    iconLabel: 'WI',
    theme: {
      accentColor: '#14b8a6',
      accentSoft: 'rgba(20,184,166,0.14)',
      accentBorder: 'rgba(20,184,166,0.26)'
    },
    docsUrl: 'https://docs.wise.com/api-docs/',
    supportUrl: 'https://wise.com/help/',
    environmentSupport: ['sandbox', 'production'],
    supportedLanes: ['overview', 'receive', 'send', 'balances', 'activity', 'compliance'],
    includeLauncherLanes: false,
    capabilities: ['Receive', 'Send', 'Balances', 'Quotes', 'Compliance'],
    status: 'setup',
    featureFlags: {
      providerWorkspaceFoundation: true,
      invoiceCollection: false,
      payoutSubmission: false,
      balanceLookup: false,
      webhookActivity: false
    },
    laneSupport: {
      receive: 'setup',
      send: 'setup',
      balances: 'setup',
      activity: 'setup',
      compliance: 'setup'
    },
    laneOverrides: {
      receive: {
        description: 'Wise account details, receiving posture, and funding instructions are prepared as a setup lane.'
      },
      send: {
        description: 'Quote, recipient, transfer, and receipt flows are planned for the Wise send workspace.'
      },
      compliance: {
        description: 'Recipient, route, currency, and compliance checks will stay explicit before money movement.'
      }
    }
  },
  {
    id: 'paystack',
    slug: 'paystack',
    displayName: 'Paystack',
    shortDescription: 'Payment request, transfer, refund, dispute, balance, and webhook workspace foundation.',
    logoAsset: '/brand-logos/paystack.svg',
    iconLabel: 'PS',
    theme: {
      accentColor: '#0ba5ec',
      accentSoft: 'rgba(11,165,236,0.14)',
      accentBorder: 'rgba(11,165,236,0.26)'
    },
    docsUrl: 'https://paystack.com/docs/',
    supportUrl: 'https://paystack.com/support/',
    environmentSupport: ['test', 'live'],
    supportedLanes: ['overview', 'collections', 'customers', 'virtual-accounts', 'subscriptions', 'activity', 'developer'],
    includeLauncherLanes: false,
    capabilities: ['Collections', 'Customers', 'Virtual accounts', 'Subscriptions', 'Webhooks'],
    status: 'setup',
    featureFlags: {
      providerWorkspaceFoundation: true,
      invoiceCollection: false,
      payoutSubmission: false,
      balanceLookup: false,
      webhookActivity: false,
      developerTools: false
    },
    laneSupport: {
      collections: 'setup',
      customers: 'setup',
      'virtual-accounts': 'setup',
      subscriptions: 'setup',
      activity: 'setup',
      developer: 'setup'
    },
    laneOverrides: {
      collections: {
        description: 'Paystack charge, transaction, and payment page workflows will be connected here.'
      },
      'virtual-accounts': {
        description: 'Dedicated virtual account setup and reconciliation readiness for Paystack collections.'
      }
    }
  },
  {
    id: 'flutterwave',
    slug: 'flutterwave',
    displayName: 'Flutterwave',
    shortDescription: 'Hosted checkout, payment links, transfer rates, mobile money, transfer, and webhook workspace foundation.',
    logoAsset: '/brand-logos/flutterwave.svg',
    iconLabel: 'FW',
    theme: {
      accentColor: '#38bdf8',
      accentSoft: 'rgba(56,189,248,0.13)',
      accentBorder: 'rgba(56,189,248,0.24)'
    },
    docsUrl: 'https://developer.flutterwave.com/docs',
    supportUrl: 'https://flutterwave.com/us/support',
    environmentSupport: ['test', 'live'],
    supportedLanes: ['overview', 'collections', 'transfers', 'settlements', 'refunds', 'activity', 'developer'],
    includeLauncherLanes: false,
    capabilities: ['Collections', 'Transfers', 'Settlements', 'Refunds', 'Webhooks'],
    status: 'setup',
    featureFlags: {
      providerWorkspaceFoundation: true,
      invoiceCollection: false,
      payoutSubmission: false,
      balanceLookup: false,
      webhookActivity: false,
      developerTools: false
    },
    laneSupport: {
      collections: 'setup',
      transfers: 'setup',
      settlements: 'setup',
      refunds: 'setup',
      activity: 'setup',
      developer: 'setup'
    },
    laneOverrides: {
      collections: {
        description: 'Flutterwave checkout, payment links, and collection monitoring are prepared here.'
      },
      transfers: {
        description: 'Beneficiary, transfer rate, transfer initiation, and status tracking readiness lane.'
      }
    }
  },
  {
    id: 'crypto',
    slug: 'crypto',
    displayName: 'Crypto Commerce',
    shortDescription: 'Hosted crypto charge, settlement review, webhook confirmation, and guarded release workspace.',
    logoAsset: '/brand-logos/crypto.svg',
    iconLabel: 'CC',
    theme: {
      accentColor: '#60a5fa',
      accentSoft: 'rgba(96,165,250,0.14)',
      accentBorder: 'rgba(96,165,250,0.28)'
    },
    docsUrl: 'https://docs.cdp.coinbase.com/commerce/docs',
    supportUrl: 'https://help.coinbase.com/en/commerce',
    environmentSupport: ['sandbox', 'production'],
    supportedLanes: ['overview', 'receive', 'send', 'confirmations', 'activity', 'security'],
    includeLauncherLanes: false,
    capabilities: ['Receive', 'Hosted charges', 'Confirmations', 'Settlement review', 'Release controls'],
    status: 'live',
    featureFlags: {
      providerWorkspaceFoundation: true,
      invoiceCollection: true,
      payoutSubmission: false,
      balanceLookup: false,
      webhookActivity: true
    },
    laneSupport: {
      receive: 'live',
      send: 'setup',
      confirmations: 'live',
      activity: 'live',
      security: 'preview'
    },
    laneOverrides: {
      receive: {
        description: 'Hosted crypto charge intake and collection tracking through Transferly.'
      },
      send: {
        description: 'Outbound crypto sending is not enabled yet; release workflows stay guarded by Transferly controls.'
      },
      confirmations: {
        description: 'Webhook confirmation, network settlement posture, and release readiness for hosted charges.'
      },
      security: {
        description: 'Confirmation thresholds, guarded releases, wallet safety posture, and operator checks.'
      }
    }
  }
];

function readLauncherLanes(slug) {
  const launcher = getPaymentProviderLauncher(slug);
  if (!launcher?.lanes?.length) {
    return [];
  }

  return launcher.lanes
    .map((lane) => launcherLaneToWorkspaceLane[lane.id])
    .filter(Boolean);
}

function normalizeLaneIds(seed, explicitLanes = []) {
  const launcherLanes = seed.includeLauncherLanes === false ? [] : readLauncherLanes(seed.slug);

  return [...new Set(['overview', ...explicitLanes, ...launcherLanes])]
    .filter((laneId) => laneById.has(laneId));
}

function buildLane(seed, laneId) {
  const definition = laneById.get(laneId);
  const override = seed.laneOverrides?.[laneId] || {};

  return {
    ...definition,
    ...override,
    support: seed.laneSupport?.[laneId] || (laneId === 'overview' ? seed.status : undefined)
  };
}

function buildManifest(seed) {
  const launcher = getPaymentProviderLauncher(seed.slug);
  const supportedLanes = normalizeLaneIds(seed, seed.supportedLanes);

  return {
    ...seed,
    displayName: seed.displayName || launcher?.title || seed.slug,
    shortDescription: seed.shortDescription || launcher?.description || '',
    supportedLanes,
    lanes: supportedLanes.map((laneId) => buildLane(seed, laneId)),
    capabilities: seed.capabilities?.length ? seed.capabilities : launcher?.capabilities || [],
    launcherStatusLabel: launcher?.statusLabel || '',
    launcherEyebrow: launcher?.eyebrow || ''
  };
}

export const providerManifests = providerManifestSeeds.map(buildManifest);

export const providerManifestBySlug = providerManifests.reduce((accumulator, manifest) => {
  accumulator[manifest.slug] = manifest;
  return accumulator;
}, {});

export function normalizeProviderSlug(value) {
  return String(value || '').trim().toLowerCase();
}

export function getProviderManifest(slug) {
  return providerManifestBySlug[normalizeProviderSlug(slug)] || null;
}

export function isProviderManifestSlug(slug) {
  return Boolean(getProviderManifest(slug));
}

export function getProviderLaneDefinition(laneId) {
  return laneById.get(laneId || 'overview') || laneById.get('overview');
}

export function getProviderManifestLanes(slug) {
  return getProviderManifest(slug)?.lanes || [];
}

export function isProviderLaneSupported(slug, laneId) {
  const manifest = getProviderManifest(slug);
  return Boolean(manifest?.supportedLanes?.includes(laneId || 'overview'));
}

export function getWorkspaceLauncherLaneId(manifestOrSlug, laneId) {
  const slug = normalizeProviderSlug(typeof manifestOrSlug === 'string' ? manifestOrSlug : manifestOrSlug?.slug);
  const lane = laneId || 'overview';
  return providerLaneToLauncherLane[slug]?.[lane] || workspaceLaneToLauncherLane[lane] || null;
}

export function getProviderWorkspaceRoute(slug, laneId = 'overview') {
  const providerSlug = normalizeProviderSlug(slug);
  const lane = laneId || 'overview';
  return lane === 'overview'
    ? `/miniapp/services/${providerSlug}/overview`
    : `/miniapp/services/${providerSlug}/${lane}`;
}
