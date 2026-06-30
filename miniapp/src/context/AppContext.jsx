import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  acknowledgePaymentOpsIssue as acknowledgePaymentOpsIssueRequest,
  addAdminInvoiceNote as addAdminInvoiceNoteRequest,
  addAdminPayoutNote as addAdminPayoutNoteRequest,
  adjustUserPoints as adjustUserPointsRequest,
  approveAdminPayout as approveAdminPayoutRequest,
  cancelUnclaimedPayout as cancelUnclaimedPayoutRequest,
  cancelInvoiceAutoReminders as cancelInvoiceAutoRemindersRequest,
  cancelInvoice as cancelInvoiceRequest,
  createInvoice as createInvoiceRequest,
  createPayout as createPayoutRequest,
  createAdminInvoiceTemplate as createAdminInvoiceTemplateRequest,
  createFaq as createFaqRequest,
  createTestimonial as createTestimonialRequest,
  createTopUpOrder as createTopUpOrderRequest,
  clearStoredToken,
  getStoredAdminToken,
  getStoredToken,
  deleteFaq as deleteFaqRequest,
  deleteAccount as deleteAccountRequest,
  deleteAdminInvoiceTemplate as deleteAdminInvoiceTemplateRequest,
  deleteTestimonial as deleteTestimonialRequest,
  generateReceipt as generateReceiptRequest,
  generateInvoiceQr as generateInvoiceQrRequest,
  getAdminUsers,
  getBootstrap,
  getMiniAppCommandCenter,
  getInvoiceTimeline as getInvoiceTimelineRequest,
  getAdminWebhookEvent as getAdminWebhookEventRequest,
  getPaymentProviderBalance as getPaymentProviderBalanceRequest,
  getMe,
  listDeadLetterJobs as listDeadLetterJobsRequest,
  listInvoiceReminderConfigurations as listInvoiceReminderConfigurationsRequest,
  listAdminWebhookEvents as listAdminWebhookEventsRequest,
  listAdminInvoices as listAdminInvoicesRequest,
  listAdminInvoiceTemplates as listAdminInvoiceTemplatesRequest,
  listAdminPayouts as listAdminPayoutsRequest,
  listAdminTopUpOrders as listAdminTopUpOrdersRequest,
  listPaymentOpsIssues as listPaymentOpsIssuesRequest,
  listPaymentProviderHealth as listPaymentProviderHealthRequest,
  listPaymentProviders as listPaymentProvidersRequest,
  markAdminInvoiceReviewRequired as markAdminInvoiceReviewRequiredRequest,
  ignoreAdminWebhookEvent as ignoreAdminWebhookEventRequest,
  recoverDeadLetterJob as recoverDeadLetterJobRequest,
  reopenPaymentOpsIssue as reopenPaymentOpsIssueRequest,
  replayAdminWebhookEvent as replayAdminWebhookEventRequest,
  resolvePaymentOpsIssue as resolvePaymentOpsIssueRequest,
  getPayoutTimeline as getPayoutTimelineRequest,
  getReferralStats,
  listInvoices as listInvoicesRequest,
  listTopUpOrders as listTopUpOrdersRequest,
  loginWithTelegramMiniApp as loginWithTelegramMiniAppRequest,
  listPayouts as listPayoutsRequest,
  previewInvoice as previewInvoiceRequest,
  previewPayout as previewPayoutRequest,
  refreshInvoice as refreshInvoiceRequest,
  refreshPayout as refreshPayoutRequest,
  runPaymentReconciliation as runPaymentReconciliationRequest,
  rejectAdminPayout as rejectAdminPayoutRequest,
  releaseAdminInvoiceFunds as releaseAdminInvoiceFundsRequest,
  sendInvoiceReminder as sendInvoiceReminderRequest,
  setStoredToken,
  suspendInvoiceReminderConfiguration as suspendInvoiceReminderConfigurationRequest,
  updateFaq as updateFaqRequest,
  updateAdminInvoiceTemplate as updateAdminInvoiceTemplateRequest,
  updateInvoiceReminderConfiguration as updateInvoiceReminderConfigurationRequest,
  updatePlatformConfig,
  updateProfile as updateProfileRequest,
  completeAdminTopUpOrder as completeAdminTopUpOrderRequest,
  cancelAdminTopUpOrder as cancelAdminTopUpOrderRequest,
  updateTopUpOrderStatus as updateTopUpOrderStatusRequest,
  resumeInvoiceReminderConfiguration as resumeInvoiceReminderConfigurationRequest,
  updateTestimonial as updateTestimonialRequest
} from '../lib/api';
import { getRawTelegramInitData, getTelegramStartParam } from '../lib/telegramMiniApp';

export const AppContext = createContext();

const defaultConfig = {
  platform_name: 'Transferly',
  tagline: 'Generate Professional Receipts Instantly',
  support_email: 'support@transferly.app',
  admin_email: 'admin@transferly.app',
  brand_color: '#f8812d',
  bank_slip_cost: 10,
  email_receipt_cost: 5,
  referral_bonus: 20,
  signup_bonus: 50,
  total_users: 1240,
  total_receipts: 45800,
  uptime: '99.9%',
  privacy_policy:
    'We take your privacy seriously. Transferly collects minimal data necessary to provide our services.',
  terms_of_service:
    'By using Transferly, you agree to use the platform for lawful purposes only.',
  about_us: 'Transferly is a professional receipt generation platform.'
};

function getTopUpOrdersStorageKey(userId) {
  return `transferly_topup_orders_${userId || 'guest'}`;
}

function getLegacyTopUpOrdersStorageKey(userId) {
  return `slipcraft_topup_orders_${userId || 'guest'}`;
}

function loadTopUpOrders(userId) {
  if (typeof window === 'undefined' || !userId) {
    return [];
  }

  try {
    const raw =
      window.localStorage.getItem(getTopUpOrdersStorageKey(userId)) ||
      window.localStorage.getItem(getLegacyTopUpOrdersStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function saveTopUpOrders(userId, orders) {
  if (typeof window === 'undefined' || !userId) {
    return;
  }

  window.localStorage.setItem(getTopUpOrdersStorageKey(userId), JSON.stringify(orders));
  window.localStorage.removeItem(getLegacyTopUpOrdersStorageKey(userId));
}

function normalizeReceipt(receipt) {
  if (!receipt) {
    return receipt;
  }

  return {
    ...receipt,
    created_at: receipt.created_at || receipt.createdAt || null,
    pdf_base64: receipt.pdf_base64 || receipt.pdfBase64 || null,
    image_data_url: receipt.image_data_url || receipt.imageDataUrl || null
  };
}

function normalizeTopUpOrder(order) {
  if (!order) {
    return order;
  }

  return {
    ...order,
    order_id: order.order_id || order.orderId || order.id || '',
    id: order.id || order.order_id || order.orderId || '',
    amount_label: order.amount_label || order.amountLabel || `${Number(order.points || 0).toLocaleString()} pts`,
    method_id: order.method_id || order.methodId || '',
    method_title: order.method_title || order.methodTitle || '',
    service_intent: order.service_intent || order.serviceIntent || '',
    vendor_url: order.vendor_url || order.vendorUrl || '',
    admin_notes: order.admin_notes || order.adminNotes || '',
    submitted_at: order.submitted_at || order.submittedAt || null,
    completed_at: order.completed_at || order.completedAt || null,
    cancelled_at: order.cancelled_at || order.cancelledAt || null,
    created_at: order.created_at || order.createdAt || null,
    updated_at: order.updated_at || order.updatedAt || null
  };
}

function mapUser(snapshotUser, snapshotProfile) {
  if (!snapshotUser) {
    return null;
  }

  return {
    ...snapshotUser,
    name: snapshotProfile?.name || snapshotUser.displayName || snapshotUser.name || '',
    isAdmin: Boolean(
      snapshotProfile?.is_admin ??
        snapshotProfile?.isAdmin ??
        snapshotUser?.profile?.isAdmin ??
        snapshotUser?.isAdmin ??
        false
    )
  };
}

function mapProfile(profileData, pointsData, referralData, userData) {
  if (!profileData && !pointsData && !referralData && !userData) {
    return null;
  }

  return {
    id: profileData?.id || userData?.id || null,
    user_id: profileData?.userId || profileData?.user_id || userData?.id || null,
    email: userData?.email || '',
    name: profileData?.name || userData?.displayName || userData?.name || '',
    wallet: userData?.wallet || null,
    points: Number(pointsData?.points ?? profileData?.points ?? 0),
    referral_code: referralData?.referral_code || profileData?.referralCode || profileData?.referral_code || '',
    referral_count: Number(
      referralData?.referral_count ??
        profileData?.referralCount ??
        profileData?.referral_count ??
        0
    ),
    is_admin: Boolean(profileData?.isAdmin ?? profileData?.is_admin ?? false),
    created_at: profileData?.createdAt || profileData?.created_at || userData?.createdAt || null
  };
}

function sortByOrderIndex(items = []) {
  return [...items].sort((left, right) => {
    const orderDelta = Number(left?.order_index ?? 0) - Number(right?.order_index ?? 0);
    if (orderDelta !== 0) {
      return orderDelta;
    }
    return String(left?.created_at ?? '').localeCompare(String(right?.created_at ?? ''));
  });
}

function upsertByKey(items = [], nextItem, key) {
  if (!nextItem) {
    return items;
  }

  const index = items.findIndex((entry) => entry?.[key] === nextItem?.[key]);
  if (index === -1) {
    return [nextItem, ...items];
  }

  return items.map((entry, entryIndex) => (entryIndex === index ? nextItem : entry));
}

function readProviderKey(provider) {
  if (!provider) {
    return '';
  }

  if (typeof provider === 'string') {
    return provider.toLowerCase();
  }

  return String(provider.key || provider.slug || provider.id || provider.provider || provider.name || '').toLowerCase();
}

function buildReceiptPayload(receiptData) {
  if (receiptData.type === 'bank') {
    return {
      type: 'bank',
      title: `Bank Transfer Slip - ${receiptData.senderName || 'Transferly'}`,
      summary: receiptData.narration || 'Bank transfer receipt',
      details: {
        senderName: receiptData.senderName || '',
        senderAccount: receiptData.senderAccount || '',
        senderBank: receiptData.senderBank || '',
        receiverName: receiptData.receiverName || '',
        receiverAccount: receiptData.receiverAccount || '',
        receiverBank: receiptData.receiverBank || '',
        amount: receiptData.amount || '',
        transactionDate: receiptData.transactionDate || '',
        transactionTime: receiptData.transactionTime || '',
        transactionRef: receiptData.transactionRef || '',
        narration: receiptData.narration || '',
        sessionId: receiptData.sessionId || '',
        status: receiptData.status || ''
      }
    };
  }

  return {
    type: 'email',
    title: receiptData.subject || 'Email Receipt',
    summary: receiptData.body || 'Email receipt',
    emailTo: receiptData.toEmail || '',
    details: {
      fromName: receiptData.fromName || '',
      fromEmail: receiptData.fromEmail || '',
      toName: receiptData.toName || '',
      toEmail: receiptData.toEmail || '',
      subject: receiptData.subject || '',
      body: receiptData.body || '',
      date: receiptData.date || '',
      time: receiptData.time || '',
      provider: receiptData.provider || ''
    }
  };
}

export function AppContextProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [profile, setProfileState] = useState(null);
  const [config, setConfigState] = useState(defaultConfig);
  const [receipts, setReceiptsState] = useState([]);
  const [faqs, setFaqsState] = useState([]);
  const [testimonials, setTestimonialsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [telegramAuthState, setTelegramAuthState] = useState('idle');
  const [allUsers, setAllUsers] = useState([]);
  const [invoices, setInvoicesState] = useState([]);
  const [invoiceReminderConfigurations, setInvoiceReminderConfigurationsState] = useState([]);
  const [invoiceTemplates, setInvoiceTemplatesState] = useState([]);
  const [paymentIssues, setPaymentIssuesState] = useState([]);
  const [payouts, setPayoutsState] = useState([]);
  const [invoicePagination, setInvoicePaginationState] = useState(null);
  const [payoutPagination, setPayoutPaginationState] = useState(null);
  const [financeSummary, setFinanceSummaryState] = useState(null);
  const [commandCenter, setCommandCenterState] = useState(null);
  const [initializationError, setInitializationError] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [topUpOrders, setTopUpOrdersState] = useState([]);
  const [adminTopUpOrders, setAdminTopUpOrdersState] = useState([]);
  const [paymentProviders, setPaymentProvidersState] = useState([]);
  const [providerHealth, setProviderHealthState] = useState([]);
  const [providerBalances, setProviderBalancesState] = useState({});
  const [webhookEvents, setWebhookEventsState] = useState([]);
  const [deadLetterJobs, setDeadLetterJobsState] = useState([]);

  const applyBootstrap = useCallback((payload) => {
    if (!payload) {
      return;
    }

    if (payload.platform) {
      setConfigState((previous) => ({ ...previous, ...payload.platform }));
    }

    setFaqsState(sortByOrderIndex(payload.faqs || []));
    setTestimonialsState(sortByOrderIndex(payload.testimonials || []));
  }, []);

  const readCollectionSnapshot = useCallback((collection) => {
    if (Array.isArray(collection)) {
      return { data: collection, pagination: null };
    }

    if (Array.isArray(collection?.data)) {
      return {
        data: collection.data,
        pagination: collection.pagination || null
      };
    }

    return { data: [], pagination: null };
  }, []);

  const applySnapshot = useCallback((snapshot) => {
    if (!snapshot) {
      setUserState(null);
      setProfileState(null);
      setReceiptsState([]);
      setInvoicesState([]);
      setInvoiceReminderConfigurationsState([]);
      setInvoiceTemplatesState([]);
      setPaymentIssuesState([]);
      setPayoutsState([]);
      setInvoicePaginationState(null);
      setPayoutPaginationState(null);
      setFinanceSummaryState(null);
      setCommandCenterState(null);
      setInitializationError(null);
      setLastSyncedAt(null);
      setTopUpOrdersState([]);
      setAdminTopUpOrdersState([]);
      setPaymentProvidersState([]);
      setProviderHealthState([]);
      setProviderBalancesState({});
      setWebhookEventsState([]);
      setDeadLetterJobsState([]);
      return null;
    }

    const nextUser = mapUser(snapshot.user, snapshot.profile);
    const nextProfile = mapProfile(snapshot.profile, snapshot.points, snapshot.referrals, snapshot.user);
    const nextReceipts = (snapshot.receipts || []).map(normalizeReceipt);
    const nextTopUpOrders = Array.isArray(snapshot.topUpOrders)
      ? snapshot.topUpOrders.map(normalizeTopUpOrder)
      : loadTopUpOrders(nextUser?.id).map(normalizeTopUpOrder);
    const nextInvoices = readCollectionSnapshot(snapshot.invoices);
    const nextPayouts = readCollectionSnapshot(snapshot.payouts);

    setUserState(nextUser);
    setProfileState(nextProfile);
    setReceiptsState(nextReceipts);
    setInvoicesState(nextInvoices.data);
    setInvoicePaginationState(nextInvoices.pagination);
    setPayoutsState(nextPayouts.data);
    setPayoutPaginationState(nextPayouts.pagination);
    setFinanceSummaryState(snapshot.financeSummary || null);
    setCommandCenterState(snapshot.commandCenter || null);
    setInitializationError(null);
    setLastSyncedAt(new Date().toISOString());
    setTopUpOrdersState(nextTopUpOrders);

    return {
      user: nextUser,
      profile: nextProfile,
      receipts: nextReceipts,
      invoices: nextInvoices.data,
      payouts: nextPayouts.data,
      financeSummary: snapshot.financeSummary || null,
      commandCenter: snapshot.commandCenter || null,
      topUpOrders: nextTopUpOrders
    };
  }, [readCollectionSnapshot]);

  const fetchConfig = useCallback(async () => {
    const payload = await getBootstrap();
    applyBootstrap(payload);
    return payload.platform || null;
  }, [applyBootstrap]);

  const fetchFaqs = useCallback(async () => {
    const payload = await getBootstrap();
    applyBootstrap(payload);
    return payload.faqs || [];
  }, [applyBootstrap]);

  const fetchTestimonials = useCallback(async () => {
    const payload = await getBootstrap();
    applyBootstrap(payload);
    return payload.testimonials || [];
  }, [applyBootstrap]);

  const fetchProfile = useCallback(async () => {
    const snapshot = await getMe();
    const applied = applySnapshot(snapshot);
    return applied?.profile || null;
  }, [applySnapshot]);

  const fetchCommandCenter = useCallback(async () => {
    try {
      const payload = await getMiniAppCommandCenter();
      const nextCommandCenter = payload?.commandCenter || null;
      setCommandCenterState(nextCommandCenter);
      setLastSyncedAt(new Date().toISOString());
      return nextCommandCenter;
    } catch (error) {
      console.error('Failed to fetch mini app command center', error);
      return null;
    }
  }, []);

  const fetchReceipts = useCallback(async () => {
    const snapshot = await getMe();
    const applied = applySnapshot(snapshot);
    return applied?.receipts || [];
  }, [applySnapshot]);

  const fetchAllUsers = useCallback(async () => {
    try {
      const payload = await getAdminUsers();
      const users = Array.isArray(payload?.data) ? payload.data : [];
      setAllUsers(users);
      return users;
    } catch (error) {
      console.error('Failed to fetch admin users', error);
      setAllUsers([]);
      return [];
    }
  }, []);

  const fetchInvoices = useCallback(async (filters = {}) => {
    try {
      const payload = profile?.is_admin
        ? await listAdminInvoicesRequest(filters)
        : await listInvoicesRequest(filters);
      const nextInvoices = Array.isArray(payload?.data) ? payload.data : [];
      setInvoicesState(nextInvoices);
      setInvoicePaginationState(payload?.pagination || null);
      return nextInvoices;
    } catch (error) {
      console.error('Failed to fetch invoices', error);
      setInvoicesState([]);
      setInvoicePaginationState(null);
      return [];
    }
  }, [profile?.is_admin]);

  const fetchInvoiceTemplates = useCallback(async () => {
    try {
      const payload = await listAdminInvoiceTemplatesRequest();
      const templates = Array.isArray(payload?.data) ? payload.data : [];
      setInvoiceTemplatesState(templates);
      return templates;
    } catch (error) {
      console.error('Failed to fetch invoice templates', error);
      setInvoiceTemplatesState([]);
      return [];
    }
  }, []);

  const fetchInvoiceReminderConfigurations = useCallback(async (type) => {
    try {
      const payload = await listInvoiceReminderConfigurationsRequest(type);
      const configurations = Array.isArray(payload?.data) ? payload.data : [];
      setInvoiceReminderConfigurationsState(configurations);
      return configurations;
    } catch (error) {
      console.error('Failed to fetch invoice reminder configurations', error);
      setInvoiceReminderConfigurationsState([]);
      return [];
    }
  }, []);

  const fetchPaymentProviders = useCallback(async () => {
    try {
      const payload = await listPaymentProvidersRequest();
      const providers = Array.isArray(payload?.data) ? payload.data : [];
      setPaymentProvidersState(providers);
      return providers;
    } catch (error) {
      console.error('Failed to fetch payment providers', error);
      setPaymentProvidersState([]);
      return [];
    }
  }, []);

  const fetchProviderHealth = useCallback(async () => {
    try {
      const payload = await listPaymentProviderHealthRequest();
      const report = Array.isArray(payload?.data) ? payload.data : [];
      setProviderHealthState(report);
      return report;
    } catch (error) {
      console.error('Failed to fetch payment provider health', error);
      setProviderHealthState([]);
      return [];
    }
  }, []);

  const fetchProviderBalances = useCallback(async (providers = []) => {
    const providerKeys = [...new Set(providers.map(readProviderKey).filter(Boolean))];

    if (!providerKeys.length) {
      setProviderBalancesState({});
      return {};
    }

    const results = await Promise.allSettled(
      providerKeys.map(async (provider) => ({
        provider,
        payload: await getPaymentProviderBalanceRequest(provider)
      }))
    );

    const balances = {};
    results.forEach((result) => {
      if (result.status !== 'fulfilled') {
        return;
      }

      balances[result.value.provider] = result.value.payload?.balance || result.value.payload || null;
    });

    setProviderBalancesState(balances);
    return balances;
  }, []);

  const fetchWebhookEvents = useCallback(async (filters = {}) => {
    try {
      const payload = await listAdminWebhookEventsRequest(filters);
      const events = Array.isArray(payload?.data) ? payload.data : [];
      setWebhookEventsState(events);
      return events;
    } catch (error) {
      console.error('Failed to fetch webhook events', error);
      setWebhookEventsState([]);
      return [];
    }
  }, []);

  const fetchDeadLetterJobs = useCallback(async (filters = {}) => {
    try {
      const payload = await listDeadLetterJobsRequest(filters);
      const jobs = Array.isArray(payload?.data) ? payload.data : [];
      setDeadLetterJobsState(jobs);
      return jobs;
    } catch (error) {
      console.error('Failed to fetch dead-letter jobs', error);
      setDeadLetterJobsState([]);
      return [];
    }
  }, []);

  const recoverDeadLetterJob = useCallback(async (jobId, note) => {
    try {
      const payload = await recoverDeadLetterJobRequest(jobId, note);
      const recoveredJob = payload?.dead_letter || null;
      const recovery = payload?.recovery || recoveredJob?.recovery || null;

      setDeadLetterJobsState((previous) =>
        previous.map((job) => {
          const currentId = String(job?.job_id || job?.jobId || job?.id || '');
          if (currentId !== String(jobId)) {
            return job;
          }

          return {
            ...job,
            ...recoveredJob,
            recovery,
            recovered_at: recovery?.recovered_at || job.recovered_at
          };
        })
      );

      return { success: true, deadLetter: recoveredJob, recovery };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const fetchWebhookEvent = useCallback(async (webhookEventId) => {
    try {
      const payload = await getAdminWebhookEventRequest(webhookEventId);
      const event = payload?.event || null;
      setWebhookEventsState((previous) => upsertByKey(previous, event, 'webhook_event_id'));
      return { success: true, event };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const replayWebhookEvent = useCallback(async (webhookEventId, note) => {
    try {
      const payload = await replayAdminWebhookEventRequest(webhookEventId, note);
      const event = payload?.event || null;
      setWebhookEventsState((previous) => upsertByKey(previous, event, 'webhook_event_id'));
      return { success: true, event };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const ignoreWebhookEvent = useCallback(async (webhookEventId, note) => {
    try {
      const payload = await ignoreAdminWebhookEventRequest(webhookEventId, note);
      const event = payload?.event || null;
      setWebhookEventsState((previous) => upsertByKey(previous, event, 'webhook_event_id'));
      return { success: true, event };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const fetchPaymentIssues = useCallback(async (filters = {}) => {
    try {
      const payload = await listPaymentOpsIssuesRequest(filters);
      const issues = Array.isArray(payload?.data) ? payload.data : [];
      setPaymentIssuesState(issues);
      return issues;
    } catch (error) {
      console.error('Failed to fetch payment issues', error);
      setPaymentIssuesState([]);
      return [];
    }
  }, []);

  const acknowledgePaymentIssue = useCallback(async (issueId, note) => {
    try {
      const payload = await acknowledgePaymentOpsIssueRequest(issueId, note);
      const issue = payload?.issue || null;
      setPaymentIssuesState((previous) => upsertByKey(previous, issue, 'payment_issue_id'));
      return { success: true, issue };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const resolvePaymentIssue = useCallback(async (issueId, note) => {
    try {
      const payload = await resolvePaymentOpsIssueRequest(issueId, note);
      const issue = payload?.issue || null;
      setPaymentIssuesState((previous) => upsertByKey(previous, issue, 'payment_issue_id'));
      return { success: true, issue };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const reopenPaymentIssue = useCallback(async (issueId, note) => {
    try {
      const payload = await reopenPaymentOpsIssueRequest(issueId, note);
      const issue = payload?.issue || null;
      setPaymentIssuesState((previous) => upsertByKey(previous, issue, 'payment_issue_id'));
      return { success: true, issue };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const fetchPayouts = useCallback(async (filters = {}) => {
    try {
      const payload = profile?.is_admin
        ? await listAdminPayoutsRequest(filters)
        : await listPayoutsRequest(filters);
      const nextPayouts = Array.isArray(payload?.data) ? payload.data : [];
      setPayoutsState(nextPayouts);
      setPayoutPaginationState(payload?.pagination || null);
      return nextPayouts;
    } catch (error) {
      console.error('Failed to fetch payouts', error);
      setPayoutsState([]);
      setPayoutPaginationState(null);
      return [];
    }
  }, [profile?.is_admin]);

  const fetchTopUpOrders = useCallback(async () => {
    try {
      const payload = await listTopUpOrdersRequest();
      const orders = Array.isArray(payload?.data) ? payload.data.map(normalizeTopUpOrder) : [];
      setTopUpOrdersState(orders);
      if (user?.id) {
        saveTopUpOrders(user.id, orders);
      }
      return orders;
    } catch (error) {
      console.error('Failed to fetch top-up orders', error);
      return [];
    }
  }, [user?.id]);

  const fetchAdminTopUpOrders = useCallback(async (filters = {}) => {
    try {
      const payload = await listAdminTopUpOrdersRequest(filters);
      const orders = Array.isArray(payload?.data) ? payload.data.map(normalizeTopUpOrder) : [];
      setAdminTopUpOrdersState(orders);
      return orders;
    } catch (error) {
      console.error('Failed to fetch admin top-up orders', error);
      setAdminTopUpOrdersState([]);
      return [];
    }
  }, []);

  const authenticateTelegramMiniApp = useCallback(async () => {
    const initData = getRawTelegramInitData();
    if (!initData) {
      setTelegramAuthState('unavailable');
      return false;
    }

    setTelegramAuthState('authenticating');

    try {
      const result = await loginWithTelegramMiniAppRequest({
        initData,
        startParam: getTelegramStartParam()
      });
      setStoredToken(result.token);
      const snapshot = await getMe();
      applySnapshot(snapshot);
      setTelegramAuthState('authenticated');
      return true;
    } catch (error) {
      setTelegramAuthState('failed');
      throw error;
    }
  }, [applySnapshot]);

  const initializeApp = useCallback(async ({ isActive = () => true } = {}) => {
    setLoading(true);
    setInitializationError(null);

    try {
      const bootstrapPayload = await getBootstrap();
      if (!isActive()) {
        return;
      }

      applyBootstrap(bootstrapPayload);

      const token = getStoredToken() || getStoredAdminToken();
      if (!token) {
        await authenticateTelegramMiniApp();
        return;
      }

      try {
        const snapshot = await getMe();
        if (isActive()) {
          applySnapshot(snapshot);
        }
      } catch (error) {
        if (error.status === 401 || error.status === 403) {
          clearStoredToken();
          await authenticateTelegramMiniApp();
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Failed to initialize app context', error);
      if (isActive()) {
        setInitializationError({
          message: error.message || 'Unable to initialize Transferly.'
        });
      }
    } finally {
      if (isActive()) {
        setLoading(false);
      }
    }
  }, [applyBootstrap, applySnapshot, authenticateTelegramMiniApp]);

  useEffect(() => {
    let active = true;
    initializeApp({ isActive: () => active });

    return () => {
      active = false;
    };
  }, [initializeApp]);

  const retryInitialization = useCallback(() => initializeApp(), [initializeApp]);

  const logout = useCallback(async () => {
    clearStoredToken();
    setUserState(null);
    setProfileState(null);
    setReceiptsState([]);
    setAllUsers([]);
    setInvoicesState([]);
    setInvoiceReminderConfigurationsState([]);
    setInvoiceTemplatesState([]);
    setPaymentIssuesState([]);
    setPayoutsState([]);
    setInvoicePaginationState(null);
    setPayoutPaginationState(null);
    setFinanceSummaryState(null);
    setCommandCenterState(null);
    setInitializationError(null);
    setLastSyncedAt(null);
    setTopUpOrdersState([]);
    setAdminTopUpOrdersState([]);
    setPaymentProvidersState([]);
    setProviderHealthState([]);
    setProviderBalancesState({});
    setWebhookEventsState([]);
    setDeadLetterJobsState([]);
  }, []);

  const addReceipt = useCallback(async (receiptData) => {
    if (!user?.id || !profile) {
      return { error: 'Authentication required' };
    }

    try {
      const result = await generateReceiptRequest(buildReceiptPayload(receiptData));
      const nextReceipt = normalizeReceipt(result.receipt);

      setReceiptsState((previous) => (nextReceipt ? [nextReceipt, ...previous] : previous));

      if (typeof result.summary?.remaining_points !== 'undefined') {
        setProfileState((previous) =>
          previous
            ? {
                ...previous,
                points: Number(result.summary.remaining_points)
              }
            : previous
        );
      }

      fetchCommandCenter();
      return nextReceipt || result;
    } catch (error) {
      return { error: error.message };
    }
  }, [fetchCommandCenter, profile, user]);

  const updateProfile = useCallback(async (updates) => {
    try {
      const result = await updateProfileRequest({ name: updates?.name || '' });
      const userRecord = result?.user || null;
      const nextUser = mapUser(userRecord, userRecord?.profile);
      const nextProfile = mapProfile(
        userRecord?.profile,
        { points: userRecord?.points },
        {
          referral_count: userRecord?.referral_count,
          referral_code: userRecord?.referral_code
        },
        userRecord
      );

      setUserState(nextUser);
      setProfileState(nextProfile);

      return {
        success: true,
        user: nextUser,
        profile: nextProfile
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);
  const updateConfig = useCallback(async (updates) => {
    try {
      const payload = await updatePlatformConfig(updates);
      const nextConfig = payload?.config || {};
      setConfigState((previous) => ({ ...previous, ...nextConfig }));
      return { success: true, config: nextConfig };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const addFaq = useCallback(async (input) => {
    try {
      const payload = await createFaqRequest(input);
      const faq = payload?.faq || null;
      setFaqsState((previous) => sortByOrderIndex(faq ? [...previous, faq] : previous));
      return { success: true, faq };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const updateFaq = useCallback(async (faqId, updates) => {
    try {
      const payload = await updateFaqRequest(faqId, updates);
      const faq = payload?.faq || null;
      setFaqsState((previous) =>
        sortByOrderIndex(previous.map((entry) => (entry.id === faq?.id ? faq : entry)))
      );
      return { success: true, faq };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const deleteFaq = useCallback(async (faqId) => {
    try {
      await deleteFaqRequest(faqId);
      setFaqsState((previous) => previous.filter((entry) => entry.id !== faqId));
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const addTestimonial = useCallback(async (input) => {
    try {
      const payload = await createTestimonialRequest(input);
      const testimonial = payload?.testimonial || null;
      setTestimonialsState((previous) =>
        sortByOrderIndex(testimonial ? [...previous, testimonial] : previous)
      );
      return { success: true, testimonial };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const updateTestimonial = useCallback(async (testimonialId, updates) => {
    try {
      const payload = await updateTestimonialRequest(testimonialId, updates);
      const testimonial = payload?.testimonial || null;
      setTestimonialsState((previous) =>
        sortByOrderIndex(previous.map((entry) => (entry.id === testimonial?.id ? testimonial : entry)))
      );
      return { success: true, testimonial };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const deleteTestimonial = useCallback(async (testimonialId) => {
    try {
      await deleteTestimonialRequest(testimonialId);
      setTestimonialsState((previous) => previous.filter((entry) => entry.id !== testimonialId));
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);
  const adjustUserPoints = useCallback(async (userId, delta, reason) => {
    try {
      const payload = await adjustUserPointsRequest(userId, delta, reason);
      const updatedUser = payload?.user || null;

      setAllUsers((previous) =>
        previous.map((entry) =>
          entry.user_id === updatedUser?.user_id || entry.id === updatedUser?.user_id ? updatedUser : entry
        )
      );

      if (updatedUser && (user?.id === updatedUser.user_id || user?.id === updatedUser.id)) {
        const mappedUser = mapUser(updatedUser, updatedUser.profile);
        const mappedProfile = mapProfile(
          updatedUser.profile,
          { points: updatedUser.points },
          {
            referral_count: updatedUser.referral_count,
            referral_code: updatedUser.referral_code
          },
          updatedUser
        );

        setUserState(mappedUser);
        setProfileState(mappedProfile);
      }

      return { success: true, user: updatedUser };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, [user]);
  const deleteAccount = useCallback(async () => {
    try {
      await deleteAccountRequest();
      clearStoredToken();
      setUserState(null);
      setProfileState(null);
      setReceiptsState([]);
      setAllUsers([]);
      setInvoicesState([]);
      setInvoiceReminderConfigurationsState([]);
      setInvoiceTemplatesState([]);
      setPaymentIssuesState([]);
      setPayoutsState([]);
      setInvoicePaginationState(null);
      setPayoutPaginationState(null);
      setFinanceSummaryState(null);
      setCommandCenterState(null);
      setInitializationError(null);
      setLastSyncedAt(null);
      setTopUpOrdersState([]);
      setAdminTopUpOrdersState([]);
      setPaymentProvidersState([]);
      setProviderHealthState([]);
      setProviderBalancesState({});
      setWebhookEventsState([]);
      setDeadLetterJobsState([]);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const createTopUpOrder = useCallback(async (input) => {
    if (!user?.id) {
      return { success: false, message: 'Authentication required' };
    }

    try {
      const payload = await createTopUpOrderRequest({
        points: Number(input?.points || 0),
        amountLabel: input?.amountLabel,
        methodId: input?.methodId || '',
        methodTitle: input?.methodTitle || '',
        serviceIntent: input?.serviceIntent || '',
        instructions: input?.instructions || '',
        vendorUrl: input?.vendorUrl || '',
        notes: input?.notes || ''
      });
      const order = normalizeTopUpOrder(payload?.order);
      const nextOrders = order ? [order, ...topUpOrders.filter((entry) => entry.order_id !== order.order_id)] : topUpOrders;
      setTopUpOrdersState(nextOrders);
      saveTopUpOrders(user.id, nextOrders);
      fetchCommandCenter();
      return { success: true, order };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, [fetchCommandCenter, topUpOrders, user?.id]);

  const updateTopUpOrderStatus = useCallback(async (orderId, status) => {
    if (!user?.id) {
      return { success: false, message: 'Authentication required' };
    }

    try {
      const payload = await updateTopUpOrderStatusRequest(orderId, { status });
      const updatedOrder = normalizeTopUpOrder(payload?.order);
      const nextOrders = topUpOrders.map((order) =>
        order.order_id === orderId ? updatedOrder : order
      );
      setTopUpOrdersState(nextOrders);
      saveTopUpOrders(user.id, nextOrders);
      fetchCommandCenter();
      return { success: true, order: updatedOrder };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, [fetchCommandCenter, topUpOrders, user?.id]);

  const completeTopUpOrder = useCallback(async (orderId, notes) => {
    try {
      const payload = await completeAdminTopUpOrderRequest(orderId, notes);
      const order = normalizeTopUpOrder(payload?.order);
      setAdminTopUpOrdersState((previous) => upsertByKey(previous, order, 'order_id'));
      setTopUpOrdersState((previous) => upsertByKey(previous, order, 'order_id'));
      return { success: true, order };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const cancelTopUpOrder = useCallback(async (orderId, notes) => {
    try {
      const payload = await cancelAdminTopUpOrderRequest(orderId, notes);
      const order = normalizeTopUpOrder(payload?.order);
      setAdminTopUpOrdersState((previous) => upsertByKey(previous, order, 'order_id'));
      setTopUpOrdersState((previous) => upsertByKey(previous, order, 'order_id'));
      return { success: true, order };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const fetchReferrals = useCallback(async () => {
    try {
      const stats = await getReferralStats();
      setProfileState((previous) =>
        previous
          ? {
              ...previous,
              referral_code: stats.referral_code || previous.referral_code,
              referral_count: Number(stats.referral_count ?? previous.referral_count ?? 0)
            }
          : previous
      );
      return stats.referred_users || [];
    } catch (error) {
      console.error('Failed to fetch referrals', error);
      return [];
    }
  }, []);

  const createInvoiceTemplate = useCallback(async (input) => {
    try {
      const payload = await createAdminInvoiceTemplateRequest(input);
      const template = payload?.template || null;
      setInvoiceTemplatesState((previous) => upsertByKey(previous, template, 'id'));
      return { success: true, template };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const createInvoice = useCallback(async (input) => {
    if (!user?.id) {
      return { success: false, message: 'Authentication required' };
    }

    try {
      const invoice = await createInvoiceRequest({
        ...input,
        userId: input?.userId || user.id
      });
      setInvoicesState((previous) => upsertByKey(previous, invoice, 'internal_invoice_id'));
      return { success: true, invoice };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, [user?.id]);

  const previewInvoice = useCallback(async (input) => {
    if (!user?.id) {
      return { success: false, message: 'Authentication required' };
    }

    try {
      const preview = await previewInvoiceRequest({
        ...input,
        userId: input?.userId || user.id
      });
      return { success: true, preview };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, [user?.id]);

  const updateInvoiceTemplate = useCallback(async (templateId, updates) => {
    try {
      const payload = await updateAdminInvoiceTemplateRequest(templateId, updates);
      const template = payload?.template || null;
      setInvoiceTemplatesState((previous) => upsertByKey(previous, template, 'id'));
      return { success: true, template };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const deleteInvoiceTemplate = useCallback(async (templateId) => {
    try {
      await deleteAdminInvoiceTemplateRequest(templateId);
      setInvoiceTemplatesState((previous) => previous.filter((entry) => entry.id !== templateId));
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const refreshInvoice = useCallback(async (invoiceId) => {
    try {
      const invoice = await refreshInvoiceRequest(invoiceId);
      setInvoicesState((previous) => upsertByKey(previous, invoice, 'internal_invoice_id'));
      return { success: true, invoice };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const sendInvoiceReminder = useCallback(async (invoiceId) => {
    try {
      const invoice = await sendInvoiceReminderRequest(invoiceId);
      setInvoicesState((previous) => upsertByKey(previous, invoice, 'internal_invoice_id'));
      return { success: true, invoice };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const cancelInvoiceAutoReminders = useCallback(async (invoiceId) => {
    try {
      const invoice = await cancelInvoiceAutoRemindersRequest(invoiceId);
      setInvoicesState((previous) => upsertByKey(previous, invoice, 'internal_invoice_id'));
      return { success: true, invoice };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const generateInvoiceQr = useCallback(async (invoiceId) => {
    try {
      const invoice = await generateInvoiceQrRequest(invoiceId);
      setInvoicesState((previous) => upsertByKey(previous, invoice, 'internal_invoice_id'));
      return { success: true, invoice };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const cancelInvoice = useCallback(async (invoiceId) => {
    try {
      const invoice = await cancelInvoiceRequest(invoiceId);
      setInvoicesState((previous) => upsertByKey(previous, invoice, 'internal_invoice_id'));
      return { success: true, invoice };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const createPayout = useCallback(async (input) => {
    if (!user?.id) {
      return { success: false, message: 'Authentication required' };
    }

    try {
      const payout = await createPayoutRequest({
        ...input,
        userId: input?.userId || user.id
      });
      setPayoutsState((previous) => upsertByKey(previous, payout, 'payout_id'));
      return { success: true, payout };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, [user?.id]);

  const previewPayout = useCallback(async (input) => {
    if (!user?.id) {
      return { success: false, message: 'Authentication required' };
    }

    try {
      const preview = await previewPayoutRequest({
        ...input,
        userId: input?.userId || user.id
      });
      return { success: true, preview };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, [user?.id]);

  const approvePayout = useCallback(async (payoutId) => {
    try {
      const payout = await approveAdminPayoutRequest(payoutId);
      setPayoutsState((previous) => upsertByKey(previous, payout, 'payout_id'));
      return { success: true, payout };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const rejectPayout = useCallback(async (payoutId, reason) => {
    try {
      const payout = await rejectAdminPayoutRequest(payoutId, reason);
      setPayoutsState((previous) => upsertByKey(previous, payout, 'payout_id'));
      return { success: true, payout };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const releaseInvoiceFunds = useCallback(async (invoiceId, payload = {}) => {
    try {
      const release = await releaseAdminInvoiceFundsRequest(invoiceId, payload);
      return { success: true, release };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const markInvoiceReviewRequired = useCallback(async (invoiceId, payload = {}) => {
    try {
      const invoice = await markAdminInvoiceReviewRequiredRequest(invoiceId, payload);
      setInvoicesState((previous) => upsertByKey(previous, invoice, 'internal_invoice_id'));
      return { success: true, invoice };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const addInvoiceNote = useCallback(async (invoiceId, note) => {
    try {
      const result = await addAdminInvoiceNoteRequest(invoiceId, note);
      return { success: true, note: result?.note || note };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const addPayoutNote = useCallback(async (payoutId, note) => {
    try {
      const result = await addAdminPayoutNoteRequest(payoutId, note);
      return { success: true, note: result?.note || note };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const cancelUnclaimedPayout = useCallback(async (payoutId) => {
    try {
      const payout = await cancelUnclaimedPayoutRequest(payoutId);
      setPayoutsState((previous) => upsertByKey(previous, payout, 'payout_id'));
      return { success: true, payout };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const updateInvoiceReminderConfiguration = useCallback(async (configurationId, updates) => {
    try {
      const payload = await updateInvoiceReminderConfigurationRequest(configurationId, updates);
      const configuration = payload?.configuration || null;
      setInvoiceReminderConfigurationsState((previous) => upsertByKey(previous, configuration, 'id'));
      return { success: true, configuration };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const suspendInvoiceReminderConfiguration = useCallback(async (configurationId) => {
    try {
      const payload = await suspendInvoiceReminderConfigurationRequest(configurationId);
      const configuration = payload?.configuration || null;
      setInvoiceReminderConfigurationsState((previous) => upsertByKey(previous, configuration, 'id'));
      return { success: true, configuration };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const resumeInvoiceReminderConfiguration = useCallback(async (configurationId) => {
    try {
      const payload = await resumeInvoiceReminderConfigurationRequest(configurationId);
      const configuration = payload?.configuration || null;
      setInvoiceReminderConfigurationsState((previous) => upsertByKey(previous, configuration, 'id'));
      return { success: true, configuration };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const fetchInvoiceTimeline = useCallback(async (invoiceId, limit = 25) => {
    try {
      const payload = await getInvoiceTimelineRequest(invoiceId, limit);
      return payload?.data || [];
    } catch (error) {
      console.error('Failed to fetch invoice timeline', error);
      return [];
    }
  }, []);

  const refreshPayout = useCallback(async (payoutId) => {
    try {
      const payout = await refreshPayoutRequest(payoutId);
      setPayoutsState((previous) => upsertByKey(previous, payout, 'payout_id'));
      return { success: true, payout };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const fetchPayoutTimeline = useCallback(async (payoutId, limit = 25) => {
    try {
      const payload = await getPayoutTimelineRequest(payoutId, limit);
      return payload?.data || [];
    } catch (error) {
      console.error('Failed to fetch payout timeline', error);
      return [];
    }
  }, []);

  const runPaymentReconciliation = useCallback(async (payload = {}) => {
    try {
      const result = await runPaymentReconciliationRequest(payload);
      return { success: true, result };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, []);

  const value = {
    user,
    profile,
    loading,
    telegramAuthState,
    logout,
    deleteAccount,
    config,
    updateConfig,
    fetchConfig,
    receipts,
    addReceipt,
    fetchReceipts,
    fetchCommandCenter,
    retryInitialization,
    updateProfile,
    allUsers,
    fetchAllUsers,
    adjustUserPoints,
    invoices,
    invoiceReminderConfigurations,
    invoiceTemplates,
    paymentIssues,
    payouts,
    invoicePagination,
    payoutPagination,
    financeSummary,
    commandCenter,
    initializationError,
    lastSyncedAt,
    topUpOrders,
    adminTopUpOrders,
    paymentProviders,
    providerHealth,
    providerBalances,
    webhookEvents,
    deadLetterJobs,
    fetchInvoices,
    fetchInvoiceReminderConfigurations,
    fetchInvoiceTemplates,
    fetchPaymentProviders,
    fetchProviderHealth,
    fetchProviderBalances,
    fetchWebhookEvents,
    fetchDeadLetterJobs,
    fetchWebhookEvent,
    ignoreWebhookEvent,
    replayWebhookEvent,
    recoverDeadLetterJob,
    fetchPaymentIssues,
    acknowledgePaymentIssue,
    resolvePaymentIssue,
    reopenPaymentIssue,
    fetchPayouts,
    fetchTopUpOrders,
    fetchAdminTopUpOrders,
    createInvoice,
    previewInvoice,
    createPayout,
    previewPayout,
    approvePayout,
    rejectPayout,
    releaseInvoiceFunds,
    markInvoiceReviewRequired,
    addInvoiceNote,
    addPayoutNote,
    createInvoiceTemplate,
    updateInvoiceTemplate,
    deleteInvoiceTemplate,
    refreshInvoice,
    sendInvoiceReminder,
    cancelInvoiceAutoReminders,
    generateInvoiceQr,
    cancelInvoice,
    cancelUnclaimedPayout,
    updateInvoiceReminderConfiguration,
    suspendInvoiceReminderConfiguration,
    resumeInvoiceReminderConfiguration,
    fetchInvoiceTimeline,
    refreshPayout,
    fetchPayoutTimeline,
    runPaymentReconciliation,
    createTopUpOrder,
    updateTopUpOrderStatus,
    completeTopUpOrder,
    cancelTopUpOrder,
    faqs,
    addFaq,
    updateFaq,
    deleteFaq,
    fetchFaqs,
    testimonials,
    addTestimonial,
    updateTestimonial,
    deleteTestimonial,
    fetchTestimonials,
    fetchReferrals,
    setConfig: updateConfig,
    setUser: setProfileState
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppContextProvider');
  }
  return context;
}
