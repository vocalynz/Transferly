const config = require('../config');
const { transaction } = require('../db');
const { authCredentialRepository } = require('../repositories/authCredentialRepository');
const { faqRepository } = require('../repositories/faqRepository');
const { invoiceRepository } = require('../repositories/invoiceRepository');
const { payoutRepository } = require('../repositories/payoutRepository');
const { platformConfigRepository } = require('../repositories/platformConfigRepository');
const { profileRepository } = require('../repositories/profileRepository');
const { testimonialRepository } = require('../repositories/testimonialRepository');
const { topUpOrderRepository } = require('../repositories/topUpOrderRepository');
const { userRepository } = require('../repositories/userRepository');
const { walletRepository } = require('../repositories/walletRepository');
const { presentInvoice, presentPayout } = require('../presenters/paymentPresenter');
const { auditLogService } = require('./auditLogService');
const { AUDIT_ACTOR_TYPE } = require('../utils/constants');
const { hashPassword } = require('../utils/passwords');
const { referralService } = require('./referralService');
const { slipcraftReceiptService } = require('./slipcraftReceiptService');
const { slipcraftUserService } = require('./slipcraftUserService');

async function ensureDemoAccount(input = {}) {
  const seed = {
    userId: input.userId || config.SEED_USER_ID || 'demo-user',
    email: input.email || config.SEED_USER_EMAIL || 'demo@transferly.local',
    displayName: input.displayName || config.SEED_USER_NAME || 'Demo User',
    countryCode: (input.countryCode || config.SEED_USER_COUNTRY || 'US').toUpperCase(),
    currencyCode: (input.currencyCode || config.SEED_WALLET_CURRENCY || 'USD').toUpperCase(),
    pendingBalanceCents: input.pendingBalanceCents ?? config.SEED_PENDING_BALANCE ?? 0,
    availableBalanceCents: input.availableBalanceCents ?? config.SEED_AVAILABLE_BALANCE ?? 250000,
    frozenBalanceCents: input.frozenBalanceCents ?? config.SEED_FROZEN_BALANCE ?? 0,
    paidOutBalanceCents: input.paidOutBalanceCents ?? config.SEED_PAID_OUT_BALANCE ?? 0,
    adminActorId: input.adminActorId || config.SEED_ADMIN_ACTOR_ID || 'admin-demo',
    password: input.password || config.SEED_USER_PASSWORD || 'password123',
    signupBonus: input.signupBonus,
    referralCode: input.referralCode,
    referredByUserId: input.referredByUserId || null,
    isAdmin: Boolean(input.isAdmin ?? config.SEED_USER_IS_ADMIN ?? true)
  };

  return transaction(async (client) => {
    const user = await userRepository.upsert(
      {
        id: seed.userId,
        email: seed.email,
        displayName: seed.displayName,
        countryCode: seed.countryCode
      },
      client
    );

    const wallet = await walletRepository.seedBalances(client, user.id, seed.currencyCode, {
      pendingBalanceCents: seed.pendingBalanceCents,
      availableBalanceCents: seed.availableBalanceCents,
      frozenBalanceCents: seed.frozenBalanceCents,
      paidOutBalanceCents: seed.paidOutBalanceCents
    });

    const profile = await profileRepository.upsert(
      {
        userId: user.id,
        name: seed.displayName,
        isAdmin: seed.isAdmin,
        points: seed.signupBonus ?? config.SEED_SIGNUP_BONUS ?? 500,
        referralCode: seed.referralCode,
        referredByUserId: seed.referredByUserId
      },
      client
    );

    const password = hashPassword(seed.password);
    await authCredentialRepository.upsert(
      {
        userId: user.id,
        passwordHash: password.hash,
        passwordSalt: password.salt
      },
      client
    );

    const platformConfig = await platformConfigRepository.ensureDefault(client);

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.SYSTEM,
        actorId: seed.adminActorId,
        action: 'bootstrap.demo-account',
        entityType: 'user',
        entityId: user.id,
        metadata: {
          walletId: wallet.id,
          profileId: profile.id,
          currencyCode: wallet.currencyCode,
          balances: {
            pending: wallet.pendingBalanceCents,
            available: wallet.availableBalanceCents,
            frozen: wallet.frozenBalanceCents,
            paidOut: wallet.paidOutBalanceCents
          },
          platformConfigId: platformConfig.id
        }
      },
      client
    );

    return {
      user: {
        ...user,
        profile,
        wallet
      },
      adminActorId: seed.adminActorId
    };
  });
}

async function getPublicBootstrap() {
  const [platform, faqs, testimonials] = await Promise.all([
    platformConfigRepository.get(),
    faqRepository.findAll(),
    testimonialRepository.findAll({ onlyActive: true })
  ]);

  return {
    platform,
    faqs,
    testimonials
  };
}

function buildSnapshotCollection(records, presenter) {
  const data = records.map(presenter);

  return {
    data,
    pagination: {
      page: 1,
      page_size: data.length,
      total: data.length
    }
  };
}

function sumCents(records, predicate) {
  return records.reduce((sum, record) => {
    if (predicate && !predicate(record)) {
      return sum;
    }

    return sum + Number(record.amountCents || 0);
  }, 0);
}

function buildFinanceSummary({ invoices, payouts, receipts, topUpOrders }) {
  const paidInvoices = invoices.filter((invoice) => String(invoice.status || '').toUpperCase() === 'PAID');
  const openInvoices = invoices.filter((invoice) =>
    ['DRAFT', 'SENT', 'SCHEDULED', 'PARTIALLY_PAID', 'PAYMENT_PENDING', 'PENDING'].includes(String(invoice.status || '').toUpperCase())
  );
  const pendingPayouts = payouts.filter((payout) =>
    ['PENDING', 'PENDING_APPROVAL', 'PROCESSING'].includes(String(payout.status || '').toUpperCase())
  );

  return {
    invoice_count: invoices.length,
    paid_invoice_count: paidInvoices.length,
    open_invoice_count: openInvoices.length,
    collected_cents: sumCents(paidInvoices),
    payout_count: payouts.length,
    requested_payout_cents: sumCents(payouts),
    pending_payout_cents: sumCents(pendingPayouts),
    receipt_count: receipts.length,
    top_up_order_count: topUpOrders.length,
    primary_currency: invoices[0]?.currencyCode || payouts[0]?.currencyCode || 'USD'
  };
}

function normalizeStatus(value) {
  return String(value || '').toUpperCase();
}

function normalizeTopUpStatus(value) {
  return String(value || '').toLowerCase();
}

function sortByNewest(records = []) {
  return [...records].sort((left, right) => {
    const leftTime = new Date(left.createdAt || left.created_at || 0).getTime();
    const rightTime = new Date(right.createdAt || right.created_at || 0).getTime();
    return rightTime - leftTime;
  });
}

function buildMiniAppCommandCenter({
  profile,
  points,
  referrals,
  receipts,
  topUpOrders,
  invoices,
  payouts,
  financeSummary
}) {
  const balancePoints = Number(points?.points ?? profile?.points ?? 0);
  const pendingOrders = topUpOrders.filter((order) => normalizeTopUpStatus(order.status) === 'pending');
  const awaitingOrders = topUpOrders.filter((order) => normalizeTopUpStatus(order.status) === 'awaiting_confirmation');
  const completedOrders = topUpOrders.filter((order) => normalizeTopUpStatus(order.status) === 'completed');
  const openInvoices = invoices.filter((invoice) =>
    ['DRAFT', 'SENT', 'SCHEDULED', 'PARTIALLY_PAID', 'PAYMENT_PENDING', 'PENDING'].includes(normalizeStatus(invoice.status))
  );
  const paidInvoices = invoices.filter((invoice) => normalizeStatus(invoice.status) === 'PAID');
  const pendingPayouts = payouts.filter((payout) =>
    ['PENDING', 'PENDING_APPROVAL', 'PROCESSING'].includes(normalizeStatus(payout.status))
  );
  const latestOrder = sortByNewest(topUpOrders)[0] || null;
  const latestReceipt = sortByNewest(receipts)[0] || null;
  const referralCount = Number(referrals?.referral_count ?? referrals?.referralCount ?? profile?.referralCount ?? profile?.referral_count ?? 0);
  const readiness = [
    {
      key: 'telegram-session',
      label: 'Telegram session',
      status: 'ready',
      detail: 'Authenticated session is active.'
    },
    {
      key: 'wallet-balance',
      label: 'Wallet balance',
      status: balancePoints > 0 ? 'ready' : 'needs_action',
      detail: balancePoints > 0 ? `${balancePoints} points available.` : 'Add points before creating receipts.'
    },
    {
      key: 'fulfillment',
      label: 'Order fulfillment',
      status: awaitingOrders.length > 0 ? 'pending' : 'ready',
      detail: awaitingOrders.length > 0
        ? `${awaitingOrders.length} point order${awaitingOrders.length === 1 ? '' : 's'} awaiting review.`
        : 'No point orders waiting on review.'
    }
  ];
  const recommendedActions = [];

  if (balancePoints <= 0) {
    recommendedActions.push({
      key: 'buy-points',
      label: 'Buy points',
      target: '/miniapp/wallet',
      priority: 1
    });
  }

  if (receipts.length === 0 && balancePoints > 0) {
    recommendedActions.push({
      key: 'create-receipt',
      label: 'Create first receipt',
      target: '/miniapp/studio',
      priority: 2
    });
  }

  if (openInvoices.length > 0) {
    recommendedActions.push({
      key: 'review-invoices',
      label: 'Review open invoices',
      target: '/miniapp/invoices',
      priority: 3
    });
  }

  return {
    generated_at: new Date().toISOString(),
    wallet: {
      balance_points: balancePoints,
      referral_count: referralCount,
      status: balancePoints > 0 ? 'ready' : 'needs_funding'
    },
    orders: {
      total: topUpOrders.length,
      pending: pendingOrders.length,
      awaiting_confirmation: awaitingOrders.length,
      completed: completedOrders.length,
      latest_status: latestOrder?.status || null,
      latest_order_id: latestOrder?.order_id || latestOrder?.id || null
    },
    receipts: {
      total: receipts.length,
      latest_title: latestReceipt?.serviceName || latestReceipt?.service_name || latestReceipt?.businessName || null,
      latest_created_at: latestReceipt?.createdAt || latestReceipt?.created_at || null
    },
    invoices: {
      total: invoices.length,
      open: openInvoices.length,
      paid: paidInvoices.length,
      collected_cents: Number(financeSummary?.collected_cents || 0)
    },
    payouts: {
      total: payouts.length,
      pending: pendingPayouts.length,
      pending_cents: Number(financeSummary?.pending_payout_cents || 0)
    },
    readiness,
    signals: [
      {
        key: 'latest-order',
        label: 'Latest order',
        value: latestOrder?.status || 'No orders yet'
      },
      {
        key: 'latest-receipt',
        label: 'Latest receipt',
        value: latestReceipt?.serviceName || latestReceipt?.businessName || 'No receipts yet'
      }
    ],
    recommended_actions: recommendedActions.sort((left, right) => left.priority - right.priority)
  };
}

async function getCurrentUserSnapshot(userId) {
  const [user, profile, points, receipts, referrals, topUpOrders, invoices, payouts] = await Promise.all([
    userRepository.findById(userId),
    profileRepository.findByUserId(userId),
    slipcraftUserService.getPointsSummary(userId),
    slipcraftReceiptService.getReceiptHistory(userId, 10),
    referralService.getStats(userId),
    topUpOrderRepository.findByUserId(userId),
    invoiceRepository.findMany({ userId, limit: 12 }),
    payoutRepository.findMany({ userId, limit: 12 })
  ]);
  const financeSummary = buildFinanceSummary({ invoices, payouts, receipts, topUpOrders });
  const commandCenter = buildMiniAppCommandCenter({
    profile,
    points,
    referrals,
    receipts,
    topUpOrders,
    invoices,
    payouts,
    financeSummary
  });

  return {
    user,
    profile,
    points,
    receipts,
    referrals,
    topUpOrders,
    invoices: buildSnapshotCollection(invoices, presentInvoice),
    payouts: buildSnapshotCollection(payouts, presentPayout),
    financeSummary,
    commandCenter
  };
}

async function getCurrentUserCommandCenter(userId) {
  const snapshot = await getCurrentUserSnapshot(userId);
  return snapshot.commandCenter;
}

module.exports = {
  bootstrapService: {
    ensureDemoAccount,
    getPublicBootstrap,
    getCurrentUserSnapshot,
    getCurrentUserCommandCenter
  }
};
