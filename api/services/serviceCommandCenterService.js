const { randomUUID } = require('node:crypto');

const { AppError } = require('../utils/errors');
const { AUDIT_ACTOR_TYPE } = require('../utils/constants');
const { auditLogService } = require('./auditLogService');
const { profileRepository } = require('../repositories/profileRepository');
const { receiptRepository } = require('../repositories/receiptRepository');
const { walletRepository } = require('../repositories/walletRepository');

const PAYMENT_PROVIDER_SLUGS = new Set(['paypal', 'stripe', 'wise', 'paystack', 'flutterwave', 'crypto']);

const SERVICES = [
  { slug: 'opay', title: 'Opay', category: 'Verified Wallets', badge: 'Popular', status: 'available', receiptType: 'bank' },
  { slug: 'kuda', title: 'Kuda', category: 'Verified Wallets', badge: 'Popular', status: 'available', receiptType: 'bank' },
  { slug: 'palmpay', title: 'Palmpay', category: 'Verified Wallets', badge: 'Soon', status: 'comingSoon', receiptType: 'bank' },
  { slug: 'paypal', title: 'PayPal', category: 'Payment Providers', badge: 'Live', status: 'available', receiptType: 'email' },
  { slug: 'stripe', title: 'Stripe Connect', category: 'Payment Providers', badge: 'Adapter', status: 'available', receiptType: 'email' },
  { slug: 'wise', title: 'Wise', category: 'Payment Providers', badge: 'Live', status: 'available', receiptType: 'email' },
  { slug: 'paystack', title: 'Paystack', category: 'Payment Providers', badge: 'Adapter', status: 'available', receiptType: 'email' },
  { slug: 'flutterwave', title: 'Flutterwave', category: 'Payment Providers', badge: 'Adapter', status: 'available', receiptType: 'email' },
  { slug: 'crypto', title: 'Crypto Commerce', category: 'Payment Providers', badge: 'Adapter', status: 'available', receiptType: 'email' },
  { slug: 'binance', title: 'Binance', category: 'Verified Notifications', badge: 'Live', status: 'available', receiptType: 'email' },
  { slug: 'bybit', title: 'Bybit', category: 'Verified Notifications', badge: 'Live', status: 'available', receiptType: 'email' },
  { slug: 'coinbase', title: 'Coinbase', category: 'Verified Notifications', badge: 'Live', status: 'available', receiptType: 'email' },
  { slug: 'crypto-com', title: 'Crypto.com', category: 'Verified Notifications', badge: 'Live', status: 'available', receiptType: 'email' },
  { slug: 'cash-app', title: 'Cash App', category: 'Verified Notifications', badge: 'New', status: 'available', receiptType: 'email' },
  { slug: 'zelle', title: 'Zelle', category: 'Verified Notifications', badge: 'New', status: 'available', receiptType: 'email' },
  { slug: 'venmo', title: 'Venmo', category: 'Verified Notifications', badge: 'New', status: 'available', receiptType: 'email' },
  { slug: 'trust-wallet', title: 'Trust Wallet', category: 'Verified Notifications', badge: 'New', status: 'available', receiptType: 'email' },
  { slug: 'gcash', title: 'GCash', category: 'Verified Notifications', badge: 'New', status: 'available', receiptType: 'email' },
  { slug: 'crypto-receipts', title: 'Receipt Vault', category: 'Receipt Vault', badge: 'Live', status: 'available', receiptType: 'email' },
  { slug: 'ai-reply', title: 'Support AI Reply', category: 'Featured', badge: 'New', status: 'available' },
  { slug: 'articles', title: 'Ops Playbooks', category: 'Knowledge Library', badge: 'Utility', status: 'available' },
  { slug: 'faker-data', title: 'Sandbox Test Data', category: 'Sandbox Tools', badge: 'Utility', status: 'available' },
  { slug: 'support-sites', title: 'Support Desk', category: 'Support Desk', badge: 'Suite', status: 'available' },
  { slug: 'pass-clone', title: 'Security Center', category: 'Security Center', badge: 'Suite', status: 'available' },
  { slug: 'wallet-tracker', title: 'Provider Balance Tracker', category: 'Provider Balance Tracker', badge: 'New', status: 'available' },
  { slug: 'qr-code', title: 'Payment QR', category: 'Payment QR', badge: 'New', status: 'available' },
  { slug: 'link-shortener', title: 'Payment Link Shortener', category: 'Payment Links', badge: 'New', status: 'available' },
  { slug: 'investinnova', title: 'Workflow Templates', category: 'Template Marketplace', badge: 'Premium', status: 'available' }
];

const CATEGORY_COMMAND_CENTERS = {
  'Verified Wallets': {
    lanes: ['wallet-record', 'support-context', 'wallet-activity', 'balance-readiness']
  },
  'Verified Notifications': {
    lanes: ['custom-notification', 'deposit-notification', 'template-library', 'receipt-vault']
  }
};

const SERVICE_COMMAND_CENTER_OVERRIDES = {
  'crypto-receipts': ['vault-search', 'duplicate-receipt', 'support-handoff', 'activity-trail'],
  'ai-reply': ['draft-reply', 'support-context', 'saved-replies', 'activity-review'],
  articles: ['provider-runbooks', 'support-playbooks', 'activity-lessons', 'security-notes'],
  'faker-data': ['sandbox-payload', 'studio-preview', 'vault-review', 'operator-training'],
  'support-sites': ['support-desk', 'escalation-states', 'receipt-context', 'security-context'],
  'pass-clone': ['security-center', 'provider-readiness', 'support-safety', 'activity-audit'],
  'wallet-tracker': ['balance-overview', 'provider-ops', 'payout-activity', 'support-handoff'],
  'qr-code': ['qr-studio', 'invoice-handoff', 'vault-reference', 'qr-activity'],
  'link-shortener': ['payment-links', 'studio-link', 'provider-links', 'link-support'],
  investinnova: ['template-marketplace', 'provider-onboarding', 'support-triage', 'payout-operations']
};

const SERVICE_BY_SLUG = new Map(SERVICES.map((service) => [service.slug, service]));

function findService(slug) {
  return SERVICE_BY_SLUG.get(String(slug || '').trim().toLowerCase()) || null;
}

function normalizeSearchValue(value) {
  return String(value || '').trim().toLowerCase();
}

function collectReceiptSearchText(receipt) {
  const details = receipt?.data?.details || receipt?.data || {};
  const summary = receipt?.summary || {};
  return [
    receipt?.title,
    summary.text,
    summary.provider,
    summary.service,
    details.service,
    details.serviceSlug,
    details.service_slug,
    details.provider,
    details.wallet,
    details.brand,
    details.senderBank,
    details.receiverBank
  ].map(normalizeSearchValue).filter(Boolean).join(' ');
}

function receiptMatchesService(receipt, service) {
  const searchText = collectReceiptSearchText(receipt);
  if (!searchText) {
    return false;
  }

  return searchText.includes(service.slug) || searchText.includes(service.title.toLowerCase());
}

function formatMoney(cents = 0, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  }).format(Number(cents || 0) / 100);
}

function formatTimestamp(value) {
  if (!value) {
    return 'No activity yet';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No activity yet';
  }

  return date.toISOString();
}

function humanizeLaneId(laneId) {
  return String(laneId || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getCommandCenterLaneIds(service) {
  if (!service || PAYMENT_PROVIDER_SLUGS.has(service.slug)) {
    return [];
  }

  return SERVICE_COMMAND_CENTER_OVERRIDES[service.slug] || CATEGORY_COMMAND_CENTERS[service.category]?.lanes || [];
}

function buildMetric(id, label, value, tone = 'muted', description = '') {
  return {
    id,
    label,
    value: String(value),
    tone,
    description
  };
}

function buildLaneMetrics(laneId, summary) {
  const shared = {
    receipts: buildMetric('service-receipts', 'Service receipts', summary.serviceReceiptCount, summary.serviceReceiptCount > 0 ? 'live' : 'muted'),
    compatible: buildMetric('compatible-history', 'Compatible history', summary.compatibleReceiptCount, summary.compatibleReceiptCount > 0 ? 'live' : 'muted'),
    lastActivity: buildMetric('last-activity', 'Last activity', formatTimestamp(summary.lastReceiptAt)),
    points: buildMetric('points', 'Points', `${summary.points} pts`, summary.points > 0 ? 'live' : 'warning'),
    wallet: buildMetric('wallet', 'Wallet', formatMoney(summary.wallet?.availableBalanceCents || 0, summary.wallet?.currencyCode || 'USD'), summary.wallet ? 'live' : 'warning')
  };

  if (laneId.includes('wallet') || laneId.includes('balance')) {
    return [shared.wallet, shared.points, shared.lastActivity];
  }
  if (laneId.includes('vault') || laneId.includes('activity') || laneId.includes('receipt')) {
    return [shared.receipts, shared.compatible, shared.lastActivity];
  }
  if (laneId.includes('support') || laneId.includes('security')) {
    return [shared.lastActivity, shared.receipts, shared.points];
  }

  return [shared.points, shared.receipts, shared.compatible];
}

function buildCommandCenter(service, summary) {
  const laneIds = getCommandCenterLaneIds(service);
  if (!laneIds.length) {
    return null;
  }

  return {
    title: `${service.title} Command Center`,
    summary: `${service.title} workspace readiness, receipt activity, wallet context, and lane-level operational signals.`,
    status: service.status,
    live_metrics: [
      buildMetric('service-receipts', 'Service receipts', summary.serviceReceiptCount, summary.serviceReceiptCount > 0 ? 'live' : 'muted'),
      buildMetric('compatible-history', 'Compatible history', summary.compatibleReceiptCount, summary.compatibleReceiptCount > 0 ? 'live' : 'muted'),
      buildMetric('points', 'Points', `${summary.points} pts`, summary.points > 0 ? 'live' : 'warning'),
      buildMetric('wallet', 'Wallet', formatMoney(summary.wallet?.availableBalanceCents || 0, summary.wallet?.currencyCode || 'USD'), summary.wallet ? 'live' : 'warning')
    ],
    lanes: laneIds.map((laneId) => ({
      id: laneId,
      status: service.status === 'available' ? 'live' : 'setup',
      live_metrics: buildLaneMetrics(laneId, summary)
    }))
  };
}

function summarizeReceipts(receipts, service) {
  const serviceReceipts = receipts.filter((receipt) => receiptMatchesService(receipt, service));
  const compatibleReceipts = service.receiptType
    ? receipts.filter((receipt) => receipt.type === service.receiptType)
    : receipts;
  const recentReceipts = (serviceReceipts.length ? serviceReceipts : compatibleReceipts).slice(0, 3);

  return {
    serviceReceipts,
    compatibleReceipts,
    recentReceipts,
    lastReceiptAt: recentReceipts[0]?.createdAt || recentReceipts[0]?.created_at || null
  };
}

function buildServicePayload(service) {
  return {
    slug: service.slug,
    title: service.title,
    category: service.category,
    badge: service.badge,
    status: service.status,
    receipt_type: service.receiptType || null,
    payment_provider: PAYMENT_PROVIDER_SLUGS.has(service.slug)
  };
}

function buildReceiptPreview(receipt) {
  const details = receipt?.data?.details || receipt?.data || {};
  const summary = receipt?.summary || {};

  return {
    id: receipt.id,
    type: receipt.type,
    status: receipt.status,
    title: receipt.title,
    created_at: receipt.createdAt || receipt.created_at,
    cost_points: receipt.costPoints ?? receipt.cost_points ?? 0,
    summary: {
      text: summary.text || '',
      provider: summary.provider || details.provider || details.service || '',
      service: summary.service || details.service || details.serviceSlug || details.service_slug || ''
    }
  };
}

function buildLanePrimaryAction(service, laneId) {
  const actionByLane = {
    'wallet-record': {
      label: `Open ${service.title} wallet builder`,
      kind: 'generate',
      route: `/dashboard/generate?type=bank&service=${encodeURIComponent(service.slug)}`
    },
    'custom-notification': {
      label: `Open ${service.title} notification builder`,
      kind: 'generate',
      route: `/dashboard/generate?type=email&service=${encodeURIComponent(service.slug)}&mailType=custom`
    },
    'deposit-notification': {
      label: `Open ${service.title} deposit flow`,
      kind: 'generate',
      route: `/dashboard/generate?type=email&service=${encodeURIComponent(service.slug)}&mailType=deposit`
    },
    'support-context': { label: 'Open support context', kind: 'support', route: '/miniapp/support' },
    'support-handoff': { label: 'Open support handoff', kind: 'support', route: '/miniapp/support' },
    'support-desk': { label: 'Open support desk', kind: 'support', route: '/miniapp/support' },
    'wallet-activity': { label: 'Open wallet activity', kind: 'activity', route: '/miniapp/activity' },
    'balance-readiness': { label: 'Open wallet readiness', kind: 'wallet', route: '/miniapp/wallet' },
    'receipt-vault': { label: 'Open receipt vault', kind: 'vault', route: '/miniapp/vault' },
    'vault-search': { label: 'Open vault search', kind: 'vault', route: '/miniapp/vault' },
    'vault-review': { label: 'Open vault review', kind: 'vault', route: '/miniapp/vault' },
    'receipt-context': { label: 'Open receipt context', kind: 'vault', route: '/miniapp/vault' },
    'activity-trail': { label: 'Open activity trail', kind: 'activity', route: '/miniapp/activity' },
    'activity-review': { label: 'Open activity review', kind: 'activity', route: '/miniapp/activity' },
    'activity-audit': { label: 'Open activity audit', kind: 'activity', route: '/miniapp/activity' },
    'provider-runbooks': { label: 'Open provider runbooks', kind: 'ops', route: '/miniapp/ops' },
    'support-playbooks': { label: 'Open support playbooks', kind: 'ops', route: '/miniapp/ops' },
    'template-library': { label: 'Open template library', kind: 'ops', route: '/miniapp/ops' },
    'template-marketplace': { label: 'Open templates', kind: 'ops', route: '/miniapp/ops' },
    'security-center': { label: 'Open security center', kind: 'security', route: '/miniapp/security' },
    'security-context': { label: 'Open security context', kind: 'security', route: '/miniapp/security' },
    'security-notes': { label: 'Open security notes', kind: 'security', route: '/miniapp/security' },
    'qr-studio': { label: 'Open QR studio', kind: 'studio', route: '/miniapp/studio' },
    'studio-preview': { label: 'Open studio preview', kind: 'studio', route: '/miniapp/studio' },
    'studio-link': { label: 'Open studio link', kind: 'studio', route: '/miniapp/studio' }
  };

  return actionByLane[laneId] || {
    label: `Open ${humanizeLaneId(laneId) || 'lane'}`,
    kind: 'workspace',
    route: '/miniapp/ops'
  };
}

function buildReadinessCheck(id, label, ready, description) {
  return {
    id,
    label,
    status: ready ? 'ready' : 'attention',
    description
  };
}

function buildLaneReadiness({ service, laneId, profile, wallet, receiptSummary }) {
  const points = Number(profile?.points || 0);
  const checks = [
    buildReadinessCheck(
      'service-availability',
      'Service availability',
      service.status === 'available',
      service.status === 'available'
        ? `${service.title} is available in this workspace.`
        : `${service.title} is visible but not enabled for live actions yet.`
    )
  ];

  if (laneId.includes('wallet') || laneId.includes('balance')) {
    checks.push(
      buildReadinessCheck(
        'wallet-record',
        'Wallet ledger',
        Boolean(wallet),
        wallet
          ? `${formatMoney(wallet.availableBalanceCents, wallet.currencyCode)} available with ${formatMoney(wallet.pendingBalanceCents, wallet.currencyCode)} pending.`
          : 'No wallet record is attached to this user yet.'
      )
    );
  }

  if (laneId.includes('record') || laneId.includes('notification') || laneId.includes('studio')) {
    checks.push(
      buildReadinessCheck(
        'points',
        'Point balance',
        points > 0,
        points > 0
          ? `${points} points available for generation flows.`
          : 'Top up points before running a generation flow.'
      )
    );
  }

  checks.push(
    buildReadinessCheck(
      'receipt-context',
      'Receipt context',
      receiptSummary.recentReceipts.length > 0,
      receiptSummary.recentReceipts.length > 0
        ? `${receiptSummary.recentReceipts.length} recent receipt record${receiptSummary.recentReceipts.length === 1 ? '' : 's'} ready for context.`
        : 'No recent receipts are available for this lane yet.'
    )
  );

  return checks;
}

function buildLanePrefill(service, laneId) {
  if (laneId === 'wallet-record' && service.receiptType === 'bank') {
    return {
      receipt_type: 'bank',
      service_slug: service.slug,
      service_title: service.title,
      suggested_fields: ['amount', 'sender_name', 'receiver_name', 'reference', 'status'],
      launch_path: `/dashboard/generate?type=bank&service=${encodeURIComponent(service.slug)}`
    };
  }

  if ((laneId === 'custom-notification' || laneId === 'deposit-notification') && service.receiptType === 'email') {
    return {
      receipt_type: 'email',
      service_slug: service.slug,
      service_title: service.title,
      suggested_fields: ['amount', 'sender_name', 'recipient_email', 'reference', 'memo'],
      launch_path: `/dashboard/generate?type=email&service=${encodeURIComponent(service.slug)}&mailType=${laneId === 'deposit-notification' ? 'deposit' : 'custom'}`
    };
  }

  return null;
}

function buildSupportContext({ service, laneId, profile, wallet, receiptSummary }) {
  return {
    service_title: service.title,
    lane_title: humanizeLaneId(laneId),
    user_id: profile?.userId || profile?.id || null,
    telegram_username: profile?.telegramUsername || profile?.telegram_username || null,
    points_available: Number(profile?.points || 0),
    wallet: wallet
      ? {
          currency_code: wallet.currencyCode,
          available_balance: formatMoney(wallet.availableBalanceCents, wallet.currencyCode),
          pending_balance: formatMoney(wallet.pendingBalanceCents, wallet.currencyCode)
        }
      : null,
    recent_receipt_count: receiptSummary.recentReceipts.length,
    last_receipt_at: receiptSummary.lastReceiptAt,
    suggested_handoff:
      receiptSummary.recentReceipts.length > 0
        ? `Use the latest ${service.title} receipt as customer context before responding.`
        : `Ask for the ${service.title} transaction reference before escalating.`
  };
}

function normalizeActionValue(value, fallback) {
  const normalized = String(value || fallback || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .slice(0, 80);

  return normalized || fallback;
}

function sanitizeActionMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  return Object.entries(metadata).slice(0, 12).reduce((result, [key, value]) => {
    const safeKey = String(key || '').trim().slice(0, 64);
    if (!safeKey) {
      return result;
    }

    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      result[safeKey] = typeof value === 'string' ? value.slice(0, 500) : value;
    }

    return result;
  }, {});
}

function countAttentionChecks(readiness = []) {
  return readiness.filter((check) => check.status !== 'ready').length;
}

async function loadServiceContext({ userId, slug }) {
  const service = findService(slug);
  if (!service) {
    throw new AppError(404, 'SERVICE_NOT_FOUND', 'Service not found.');
  }

  const [profile, wallet, receipts] = await Promise.all([
    profileRepository.findByUserId(userId),
    walletRepository.findByUserId(userId),
    receiptRepository.findByUserId(userId)
  ]);
  const receiptSummary = summarizeReceipts(receipts, service);

  return {
    service,
    profile,
    wallet,
    receiptSummary,
    summary: {
      points: Number(profile?.points || 0),
      wallet,
      serviceReceiptCount: receiptSummary.serviceReceipts.length,
      compatibleReceiptCount: receiptSummary.compatibleReceipts.length,
      lastReceiptAt: receiptSummary.lastReceiptAt
    }
  };
}

async function getServiceCommandCenterSummary({ userId, slug }) {
  const { service, profile, wallet, receiptSummary, summary } = await loadServiceContext({ userId, slug });

  return {
    service: buildServicePayload(service),
    command_center: buildCommandCenter(service, summary),
    activity: {
      service_receipt_count: receiptSummary.serviceReceipts.length,
      compatible_receipt_count: receiptSummary.compatibleReceipts.length,
      last_receipt_at: receiptSummary.lastReceiptAt,
      recent_receipts: receiptSummary.recentReceipts.map(buildReceiptPreview)
    },
    wallet: wallet
      ? {
          currency_code: wallet.currencyCode,
          available_balance_cents: wallet.availableBalanceCents,
          pending_balance_cents: wallet.pendingBalanceCents,
          frozen_balance_cents: wallet.frozenBalanceCents
        }
      : null,
    points: {
      available: Number(profile?.points || 0)
    }
  };
}

async function getServiceLaneDetail({ userId, slug, laneId }) {
  const context = await loadServiceContext({ userId, slug });
  const { service, profile, wallet, receiptSummary, summary } = context;
  const laneIds = getCommandCenterLaneIds(service);
  const normalizedLaneId = String(laneId || '').trim().toLowerCase();

  if (!laneIds.includes(normalizedLaneId)) {
    throw new AppError(404, 'SERVICE_LANE_NOT_FOUND', 'Service lane not found.');
  }

  return {
    service: buildServicePayload(service),
    lane: {
      id: normalizedLaneId,
      title: humanizeLaneId(normalizedLaneId),
      status: service.status === 'available' ? 'live' : 'setup',
      live_metrics: buildLaneMetrics(normalizedLaneId, summary)
    },
    action: buildLanePrimaryAction(service, normalizedLaneId),
    readiness: buildLaneReadiness({
      service,
      laneId: normalizedLaneId,
      profile,
      wallet,
      receiptSummary
    }),
    prefill: buildLanePrefill(service, normalizedLaneId),
    support_context: buildSupportContext({
      service,
      laneId: normalizedLaneId,
      profile,
      wallet,
      receiptSummary
    }),
    activity: {
      service_receipt_count: receiptSummary.serviceReceipts.length,
      compatible_receipt_count: receiptSummary.compatibleReceipts.length,
      last_receipt_at: receiptSummary.lastReceiptAt,
      recent_receipts: receiptSummary.recentReceipts.map(buildReceiptPreview)
    }
  };
}

async function createServiceLaneActionIntent({ userId, slug, laneId, intent, source, metadata }) {
  const laneDetail = await getServiceLaneDetail({ userId, slug, laneId });
  const actionIntentId = randomUUID();
  const normalizedIntent = normalizeActionValue(intent, laneDetail.action?.kind || 'launch');
  const normalizedSource = normalizeActionValue(source, 'api');
  const entityId = `${laneDetail.service.slug}:${laneDetail.lane.id}`;
  const createdAt = new Date().toISOString();
  const sanitizedMetadata = sanitizeActionMetadata(metadata);

  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.USER,
    actorId: userId,
    action: 'service_lane.action_intent_recorded',
    entityType: 'service_lane',
    entityId,
    metadata: {
      action_intent_id: actionIntentId,
      service_slug: laneDetail.service.slug,
      service_title: laneDetail.service.title,
      lane_id: laneDetail.lane.id,
      lane_title: laneDetail.lane.title,
      intent: normalizedIntent,
      source: normalizedSource,
      action_kind: laneDetail.action?.kind || null,
      action_route: laneDetail.action?.route || null,
      readiness_attention_count: countAttentionChecks(laneDetail.readiness),
      metadata: sanitizedMetadata
    }
  });

  return {
    action_intent: {
      id: actionIntentId,
      status: 'recorded',
      created_at: createdAt,
      service_slug: laneDetail.service.slug,
      lane_id: laneDetail.lane.id,
      intent: normalizedIntent,
      source: normalizedSource,
      action: laneDetail.action,
      prefill: laneDetail.prefill,
      readiness: laneDetail.readiness,
      audit: {
        entity_type: 'service_lane',
        entity_id: entityId,
        action: 'service_lane.action_intent_recorded'
      }
    }
  };
}

module.exports = {
  serviceCommandCenterService: {
    getServiceCommandCenterSummary,
    getServiceLaneDetail,
    createServiceLaneActionIntent
  },
  findService
};
