import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  Plus,
  QrCode,
  RotateCcw,
  Send,
  Trash2,
  Wallet
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { listStripeConnectedAccounts } from '../../lib/api';
import InvoiceComposerSection from './InvoiceComposer';
import { InvoiceFilters, PayoutFilters } from './PaymentFilters';
import { FundingOrdersPanel, PaymentIssuesPanel, WorkspaceControls } from './PaymentOpsPanels';
import PayPalSandboxPayoutChrome from './PayPalSandbox';
import {
  BUILT_IN_INVOICE_SAVED_VIEWS,
  BUILT_IN_PAYOUT_SAVED_VIEWS,
  PAYPAL_BRAND,
  buildReminderDrafts,
  calculateLineItemsTotalCents,
  createEmptyInvoiceComposer,
  createEmptyLineItem,
  createEmptyPayoutComposer,
  createEmptyTemplateForm,
  formatCents,
  formatDateTime,
  getInitialPageParam,
  getInitialSearchParam,
  getPayoutPricingPreview,
  getWalletAvailableCents,
  getWalletBucketCents,
  parseMoneyToCents,
  readSavedViewsForType,
  setSearchParamIfChanged,
  writeSavedViewsForType
} from './paymentsUtils';
import {
  InvoiceRecordsTable,
  PaymentRecordDrawer,
  PayoutComposerSection,
  PayoutRecordsTable,
  StatusPill
} from './PaymentsParts';

export default function AdminPaymentsTab({ mode = 'all', embedded = false, providerFilter = '' }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = searchParams.get('section') || '';
  const {
    config,
    profile,
    invoices,
    invoiceTemplates,
    invoiceReminderConfigurations,
    paymentIssues,
    payouts,
    invoicePagination,
    payoutPagination,
    adminTopUpOrders,
    acknowledgePaymentIssue,
    fetchInvoices,
    fetchInvoiceReminderConfigurations,
    fetchInvoiceTemplates,
    fetchPaymentIssues,
    fetchPayouts,
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
    updateInvoiceReminderConfiguration,
    suspendInvoiceReminderConfiguration,
    resumeInvoiceReminderConfiguration,
    fetchInvoiceTimeline,
    refreshPayout,
    cancelUnclaimedPayout,
    fetchPayoutTimeline,
    runPaymentReconciliation,
    resolvePaymentIssue,
    reopenPaymentIssue,
    completeTopUpOrder,
    cancelTopUpOrder
  } = useAppContext();
  const brand = config?.brand_color || '#f8812d';
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [invoiceTimelineId, setInvoiceTimelineId] = useState('');
  const [payoutTimelineId, setPayoutTimelineId] = useState('');
  const [invoiceTimelineEntries, setInvoiceTimelineEntries] = useState([]);
  const [payoutTimelineEntries, setPayoutTimelineEntries] = useState([]);
  const [invoiceTimelineLoading, setInvoiceTimelineLoading] = useState(false);
  const [payoutTimelineLoading, setPayoutTimelineLoading] = useState(false);
  const [reminderDrafts, setReminderDrafts] = useState({});
  const [issueNotes, setIssueNotes] = useState({});
  const [editingTemplateId, setEditingTemplateId] = useState('');
  const [templateForm, setTemplateForm] = useState(createEmptyTemplateForm());
  const [invoiceComposer, setInvoiceComposer] = useState(createEmptyInvoiceComposer());
  const [lastCreatedInvoice, setLastCreatedInvoice] = useState(null);
  const [invoicePreview, setInvoicePreview] = useState(null);
  const [payoutComposer, setPayoutComposer] = useState(createEmptyPayoutComposer());
  const [lastCreatedPayout, setLastCreatedPayout] = useState(null);
  const [payoutServerPreview, setPayoutServerPreview] = useState(null);
  const [stripeConnectedAccountsState, setStripeConnectedAccountsState] = useState({
    accounts: [],
    loading: false,
    error: ''
  });
  const [selectedStripeConnectedAccountId, setSelectedStripeConnectedAccountId] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState(() => getInitialSearchParam(searchParams, 'invoiceRecipient'));
  const [invoiceProviderSearch, setInvoiceProviderSearch] = useState(() => getInitialSearchParam(searchParams, 'invoiceProvider'));
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState(() => getInitialSearchParam(searchParams, 'invoiceStatus', 'ALL'));
  const [invoiceTemplateFilter, setInvoiceTemplateFilter] = useState(() => getInitialSearchParam(searchParams, 'invoiceTemplate', 'ALL'));
  const [invoiceDateFrom, setInvoiceDateFrom] = useState(() => getInitialSearchParam(searchParams, 'invoiceFrom'));
  const [invoiceDateTo, setInvoiceDateTo] = useState(() => getInitialSearchParam(searchParams, 'invoiceTo'));
  const [invoicePage, setInvoicePage] = useState(() => getInitialPageParam(searchParams, 'invoicePage'));
  const [invoicePageSize, setInvoicePageSize] = useState(() => getInitialSearchParam(searchParams, 'invoicePageSize', '50'));
  const [invoiceSortBy, setInvoiceSortBy] = useState(() => getInitialSearchParam(searchParams, 'invoiceSortBy', 'createdAt'));
  const [invoiceSortDirection, setInvoiceSortDirection] = useState(() => getInitialSearchParam(searchParams, 'invoiceSortDirection', 'desc'));
  const [payoutSearch, setPayoutSearch] = useState(() => getInitialSearchParam(searchParams, 'payoutRecipient'));
  const [payoutStatusFilter, setPayoutStatusFilter] = useState(() => getInitialSearchParam(searchParams, 'payoutStatus', 'ALL'));
  const [payoutProviderFilter, setPayoutProviderFilter] = useState(() => getInitialSearchParam(searchParams, 'payoutProvider', 'ALL'));
  const [payoutDateFrom, setPayoutDateFrom] = useState(() => getInitialSearchParam(searchParams, 'payoutFrom'));
  const [payoutDateTo, setPayoutDateTo] = useState(() => getInitialSearchParam(searchParams, 'payoutTo'));
  const [payoutPage, setPayoutPage] = useState(() => getInitialPageParam(searchParams, 'payoutPage'));
  const [payoutPageSize, setPayoutPageSize] = useState(() => getInitialSearchParam(searchParams, 'payoutPageSize', '50'));
  const [payoutSortBy, setPayoutSortBy] = useState(() => getInitialSearchParam(searchParams, 'payoutSortBy', 'createdAt'));
  const [payoutSortDirection, setPayoutSortDirection] = useState(() => getInitialSearchParam(searchParams, 'payoutSortDirection', 'desc'));
  const [customInvoiceSavedViews, setCustomInvoiceSavedViews] = useState(() => readSavedViewsForType('invoice'));
  const [customPayoutSavedViews, setCustomPayoutSavedViews] = useState(() => readSavedViewsForType('payout'));
  const [invoiceSavedViewName, setInvoiceSavedViewName] = useState('');
  const [payoutSavedViewName, setPayoutSavedViewName] = useState('');
  const [detailDrawer, setDetailDrawer] = useState({ type: '', id: '' });
  const [payoutSandboxView, setPayoutSandboxView] = useState('home');
  const sectionRefs = useRef({});
  const invoiceFilterResetReadyRef = useRef(false);
  const payoutFilterResetReadyRef = useRef(false);
  const showFundingOrders = mode === 'all' || mode === 'payout';
  const showReminderCadence = mode === 'all' || mode === 'invoice';
  const showInvoiceTemplates = mode === 'all' || mode === 'invoice';
  const showInvoices = mode === 'all' || mode === 'invoice';
  const showPayouts = mode === 'all' || mode === 'payout';
  const showPaymentIssues = true;
  const isPayPalInvoiceWorkspace = embedded && mode === 'invoice' && (!providerFilter || providerFilter === 'paypal');
  const isPayPalPayoutWorkspace = embedded && mode === 'payout' && (!providerFilter || providerFilter === 'paypal');
  const isStripePayoutWorkspace = embedded && mode === 'payout' && providerFilter === 'stripe';
  const isPayPalEmbeddedWorkspace = isPayPalInvoiceWorkspace || isPayPalPayoutWorkspace;

  useEffect(() => {
    if (!isStripePayoutWorkspace) {
      setStripeConnectedAccountsState({ accounts: [], loading: false, error: '' });
      setSelectedStripeConnectedAccountId('');
      return undefined;
    }

    let cancelled = false;
    setStripeConnectedAccountsState((previous) => ({ ...previous, loading: true, error: '' }));

    listStripeConnectedAccounts()
      .then((payload) => {
        if (cancelled) return;
        setStripeConnectedAccountsState({
          accounts: Array.isArray(payload?.data) ? payload.data : [],
          loading: false,
          error: ''
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setStripeConnectedAccountsState({
          accounts: [],
          loading: false,
          error: error?.message || 'Stripe connected accounts could not be loaded.'
        });
      });

    return () => {
      cancelled = true;
    };
  }, [isStripePayoutWorkspace]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    if (!embedded) {
      nextParams.set('tab', 'payments');
    }
    setSearchParamIfChanged(nextParams, 'invoiceRecipient', invoiceSearch);
    setSearchParamIfChanged(nextParams, 'invoiceProvider', invoiceProviderSearch);
    setSearchParamIfChanged(nextParams, 'invoiceStatus', invoiceStatusFilter, 'ALL');
    setSearchParamIfChanged(nextParams, 'invoiceTemplate', invoiceTemplateFilter, 'ALL');
    setSearchParamIfChanged(nextParams, 'invoiceFrom', invoiceDateFrom);
    setSearchParamIfChanged(nextParams, 'invoiceTo', invoiceDateTo);
    setSearchParamIfChanged(nextParams, 'invoicePage', invoicePage, '1');
    setSearchParamIfChanged(nextParams, 'invoicePageSize', invoicePageSize, '50');
    setSearchParamIfChanged(nextParams, 'invoiceSortBy', invoiceSortBy, 'createdAt');
    setSearchParamIfChanged(nextParams, 'invoiceSortDirection', invoiceSortDirection, 'desc');
    setSearchParamIfChanged(nextParams, 'payoutRecipient', payoutSearch);
    setSearchParamIfChanged(nextParams, 'payoutStatus', payoutStatusFilter, 'ALL');
    setSearchParamIfChanged(nextParams, 'payoutProvider', payoutProviderFilter, 'ALL');
    setSearchParamIfChanged(nextParams, 'payoutFrom', payoutDateFrom);
    setSearchParamIfChanged(nextParams, 'payoutTo', payoutDateTo);
    setSearchParamIfChanged(nextParams, 'payoutPage', payoutPage, '1');
    setSearchParamIfChanged(nextParams, 'payoutPageSize', payoutPageSize, '50');
    setSearchParamIfChanged(nextParams, 'payoutSortBy', payoutSortBy, 'createdAt');
    setSearchParamIfChanged(nextParams, 'payoutSortDirection', payoutSortDirection, 'desc');

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [
    embedded,
    invoiceDateFrom,
    invoiceDateTo,
    invoicePage,
    invoicePageSize,
    invoiceProviderSearch,
    invoiceSearch,
    invoiceSortBy,
    invoiceSortDirection,
    invoiceStatusFilter,
    invoiceTemplateFilter,
    payoutDateFrom,
    payoutDateTo,
    payoutPage,
    payoutPageSize,
    payoutProviderFilter,
    payoutSearch,
    payoutSortBy,
    payoutSortDirection,
    payoutStatusFilter,
    searchParams,
    setSearchParams
  ]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      await Promise.all([
        fetchInvoices(),
        fetchPayouts(),
        fetchAdminTopUpOrders(),
        fetchInvoiceReminderConfigurations(),
        fetchInvoiceTemplates(),
        fetchPaymentIssues()
      ]);
      if (active) {
        setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [
    fetchInvoiceReminderConfigurations,
    fetchInvoiceTemplates,
    fetchInvoices,
    fetchPaymentIssues,
    fetchPayouts,
    fetchAdminTopUpOrders
  ]);

  useEffect(() => {
    setReminderDrafts(buildReminderDrafts(invoiceReminderConfigurations));
  }, [invoiceReminderConfigurations]);

  const sectionLinks = useMemo(
    () => [
      ...(showFundingOrders ? [{ id: 'funding-orders', label: 'Funding Orders', icon: CheckCircle2 }] : []),
      ...(showReminderCadence ? [{ id: 'reminder-cadence', label: 'Reminder Cadence', icon: Clock3 }] : []),
      ...(showPaymentIssues ? [{ id: 'payment-issues', label: 'Payment Issues', icon: AlertTriangle }] : []),
      ...(showInvoiceTemplates ? [{ id: 'invoice-templates', label: 'Invoice Templates', icon: FileText }] : []),
      ...(showInvoices ? [{ id: 'invoices', label: 'Official Invoices', icon: QrCode }] : []),
      ...(showPayouts ? [{ id: 'payouts', label: 'Official Payouts', icon: Send }] : [])
    ],
    [showFundingOrders, showReminderCadence, showPaymentIssues, showInvoiceTemplates, showInvoices, showPayouts]
  );

  useEffect(() => {
    if (!activeSection) {
      return;
    }

    const target = sectionRefs.current[activeSection];
    if (!target) {
      return;
    }

    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [activeSection]);

  const summary = useMemo(() => {
    const pendingPayouts = payouts.filter((entry) => ['PENDING', 'PROCESSING', 'QUEUED'].includes(entry.status));
    const payableInvoices = invoices.filter((entry) => ['SENT', 'SCHEDULED', 'UPDATED'].includes(entry.status));
    const openIssues = paymentIssues.filter((entry) => entry.status === 'OPEN');
    const awaitingFundingOrders = adminTopUpOrders.filter((entry) => entry.status === 'awaiting_confirmation');

    return [
      { icon: Wallet, label: 'Invoices', value: invoices.length, tone: brand },
      { icon: Activity, label: 'Payouts', value: payouts.length, tone: '#3b82f6' },
      { icon: CheckCircle2, label: 'Funding Review', value: awaitingFundingOrders.length, tone: '#f59e0b' },
      { icon: FileText, label: 'Templates', value: invoiceTemplates.length, tone: '#111827' },
      { icon: AlertTriangle, label: 'Open Issues', value: openIssues.length, tone: '#ef4444' },
      { icon: Send, label: 'Open Invoice Flows', value: payableInvoices.length, tone: '#10b981' },
      { icon: RotateCcw, label: 'Pending Payout Sync', value: pendingPayouts.length, tone: '#f59e0b' }
    ];
  }, [adminTopUpOrders, brand, invoiceTemplates.length, invoices, paymentIssues, payouts]);

  const visibleSummary = useMemo(() => {
    if (mode === 'invoice') {
      return summary.filter(({ label }) =>
        ['Invoices', 'Templates', 'Open Issues', 'Open Invoice Flows'].includes(label)
      );
    }

    if (mode === 'payout') {
      return summary.filter(({ label }) =>
        ['Payouts', 'Funding Review', 'Open Issues', 'Pending Payout Sync'].includes(label)
      );
    }

    return summary;
  }, [mode, summary]);

  const invoiceStatusOptions = useMemo(
    () => ['ALL', ...new Set(invoices.map((entry) => entry.status).filter(Boolean))],
    [invoices]
  );

  const payoutStatusOptions = useMemo(
    () =>
      Array.from(new Set([
        'ALL',
        'PENDING_APPROVAL',
        'QUEUED',
        'PROCESSING',
        'PENDING',
        'SUCCESS',
        'FAILED',
        'DENIED',
        'REJECTED',
        ...payouts.map((entry) => entry.status).filter(Boolean)
      ])),
    [payouts]
  );

  const payoutProviderOptions = useMemo(
    () =>
      Array.from(new Set([
        'ALL',
        'PENDING',
        'PROCESSING',
        'SUCCESS',
        'UNCLAIMED',
        'ONHOLD',
        'FAILED',
        'RETURNED',
        ...payouts
          .map((entry) => entry.official_paypal?.provider_item_status || entry.metadata?.provider_item_status)
          .filter(Boolean)
      ])),
    [payouts]
  );

  useEffect(() => {
    if (!invoiceFilterResetReadyRef.current) {
      invoiceFilterResetReadyRef.current = true;
      return;
    }

    setInvoicePage(1);
  }, [
    invoiceDateFrom,
    invoiceDateTo,
    invoicePageSize,
    invoiceProviderSearch,
    invoiceSearch,
    invoiceSortBy,
    invoiceSortDirection,
    invoiceStatusFilter,
    invoiceTemplateFilter
  ]);

  const invoiceQuery = useMemo(() => {
    const dateFrom = invoiceDateFrom ? new Date(`${invoiceDateFrom}T00:00:00.000Z`).toISOString() : undefined;
    const dateTo = invoiceDateTo ? new Date(`${invoiceDateTo}T23:59:59.999Z`).toISOString() : undefined;

    return {
      recipient: invoiceSearch.trim() || undefined,
      provider: providerFilter || undefined,
      providerInvoiceId: invoiceProviderSearch.trim() || undefined,
      status: invoiceStatusFilter === 'ALL' ? undefined : invoiceStatusFilter,
      templateId: invoiceTemplateFilter === 'ALL' ? undefined : invoiceTemplateFilter,
      dateFrom,
      dateTo,
      page: invoicePage,
      pageSize: Number(invoicePageSize) || 50,
      sortBy: invoiceSortBy,
      sortDirection: invoiceSortDirection
    };
  }, [
    invoiceDateFrom,
    invoiceDateTo,
    invoicePage,
    invoicePageSize,
    providerFilter,
    invoiceProviderSearch,
    invoiceSearch,
    invoiceSortBy,
    invoiceSortDirection,
    invoiceStatusFilter,
    invoiceTemplateFilter
  ]);

  useEffect(() => {
    if (!showInvoices) {
      return undefined;
    }

    let active = true;
    const timeoutId = window.setTimeout(async () => {
      const nextInvoices = await fetchInvoices(invoiceQuery);
      if (!active) {
        return;
      }
      if (
        detailDrawer.type === 'invoice' &&
        !nextInvoices.some((entry) => entry.internal_invoice_id === detailDrawer.id)
      ) {
        setDetailDrawer({ type: '', id: '' });
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [detailDrawer.id, detailDrawer.type, fetchInvoices, invoiceQuery, showInvoices]);

  useEffect(() => {
    if (!payoutFilterResetReadyRef.current) {
      payoutFilterResetReadyRef.current = true;
      return;
    }

    setPayoutPage(1);
  }, [
    payoutDateFrom,
    payoutDateTo,
    payoutPageSize,
    payoutProviderFilter,
    payoutSearch,
    payoutSortBy,
    payoutSortDirection,
    payoutStatusFilter
  ]);

  const payoutQuery = useMemo(() => {
    const dateFrom = payoutDateFrom ? new Date(`${payoutDateFrom}T00:00:00.000Z`).toISOString() : undefined;
    const dateTo = payoutDateTo ? new Date(`${payoutDateTo}T23:59:59.999Z`).toISOString() : undefined;

    return {
      recipient: payoutSearch.trim() || undefined,
      status: payoutStatusFilter === 'ALL' ? undefined : payoutStatusFilter,
      providerState: payoutProviderFilter === 'ALL' ? undefined : payoutProviderFilter,
      dateFrom,
      dateTo,
      page: payoutPage,
      pageSize: Number(payoutPageSize) || 50,
      sortBy: payoutSortBy,
      sortDirection: payoutSortDirection
    };
  }, [
    payoutDateFrom,
    payoutDateTo,
    payoutPage,
    payoutPageSize,
    payoutProviderFilter,
    payoutSearch,
    payoutSortBy,
    payoutSortDirection,
    payoutStatusFilter
  ]);

  useEffect(() => {
    if (!showPayouts) {
      return undefined;
    }

    let active = true;
    const timeoutId = window.setTimeout(async () => {
      const nextPayouts = await fetchPayouts(payoutQuery);
      if (!active) {
        return;
      }
      if (detailDrawer.type === 'payout' && !nextPayouts.some((entry) => entry.payout_id === detailDrawer.id)) {
        setDetailDrawer({ type: '', id: '' });
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [detailDrawer.id, detailDrawer.type, fetchPayouts, payoutQuery, showPayouts]);

  const filteredInvoices = useMemo(() => {
    const query = invoiceSearch.trim().toLowerCase();

    return invoices.filter((invoice) => {
      if (invoiceStatusFilter !== 'ALL' && invoice.status !== invoiceStatusFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        invoice.summary?.invoice_number,
        invoice.invoice_id,
        invoice.summary?.recipient_email,
        invoice.summary?.description
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [invoiceSearch, invoiceStatusFilter, invoices]);

  const filteredPayouts = useMemo(() => {
    const query = payoutSearch.trim().toLowerCase();

    return payouts.filter((payout) => {
      const providerStatus = payout.official_paypal?.provider_item_status || payout.metadata?.provider_item_status || '';

      if (payoutStatusFilter !== 'ALL' && payout.status !== payoutStatusFilter) {
        return false;
      }

      if (payoutProviderFilter !== 'ALL' && providerStatus !== payoutProviderFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        payout.payout_id,
        payout.summary?.receiver,
        payout.tracking?.sender_batch_id,
        providerStatus
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [payoutProviderFilter, payoutSearch, payoutStatusFilter, payouts]);

  const workspaceTitle =
    mode === 'invoice'
      ? `Official ${providerFilter === 'stripe' ? 'Stripe' : providerFilter === 'crypto' ? 'Crypto' : 'PayPal'} Invoicing Workspace`
      : mode === 'payout'
        ? `Official ${providerFilter === 'stripe' ? 'Stripe' : 'PayPal'} Payout Workspace`
        : 'PayPal Operations';

  const workspaceDescription =
    mode === 'invoice'
      ? `Run the full hosted-invoice workflow here without leaving the ${providerFilter === 'stripe' ? 'Stripe' : providerFilter === 'crypto' ? 'Crypto' : 'PayPal'} service experience.`
      : mode === 'payout'
        ? `Run the full payout tracking and remediation workflow here without leaving the ${providerFilter === 'stripe' ? 'Stripe' : 'PayPal'} service experience.`
      : 'Work only with official PayPal invoice links, QR payloads, sync actions, and payout tracking.';
  const selectedInvoiceTemplate = invoiceTemplates.find((template) => template.id === invoiceComposer.templateId) || null;
  const invoiceDraftItems = selectedInvoiceTemplate ? selectedInvoiceTemplate.line_items || [] : invoiceComposer.items;
  const invoiceDraftCurrency = selectedInvoiceTemplate
    ? selectedInvoiceTemplate.currency_code
    : (invoiceComposer.currency || 'USD').trim().toUpperCase();
  const invoiceDraftTotalCents = calculateLineItemsTotalCents(invoiceDraftItems);
  const payoutPreview = useMemo(
    () => getPayoutPricingPreview(payoutComposer, config, profile),
    [config, payoutComposer, profile]
  );
  const payoutImpactPreview = payoutServerPreview
    ? {
        ...payoutPreview,
        feeCents: Number(payoutServerPreview.fee_cents || payoutPreview.feeCents),
        totalDebitCents: Number(payoutServerPreview.total_debit_cents || payoutPreview.totalDebitCents),
        availableCents: Number(payoutServerPreview.balance?.available_cents ?? payoutPreview.availableCents),
        remainingAvailableCents: Number(
          payoutServerPreview.balance?.remaining_available_cents ?? payoutPreview.remainingAvailableCents
        ),
        likelyReviewPath:
          payoutServerPreview.next_action === 'MANUAL_REVIEW'
            ? 'Manual review likely'
            : payoutServerPreview.next_action === 'BLOCK'
              ? 'Blocked by policy'
              : payoutServerPreview.next_action === 'READY_AFTER_SETUP'
                ? 'Ready after setup'
              : 'Auto-processing likely'
      }
    : payoutPreview;
  const walletCurrency =
    profile?.wallet?.currencyCode || profile?.wallet?.currency_code || payoutImpactPreview.currency || 'USD';
  const payoutSandboxWallet = {
    availableCents: getWalletAvailableCents(profile),
    pendingCents: getWalletBucketCents(profile, 'pendingBalanceCents', 'pending_balance_cents'),
    frozenCents: getWalletBucketCents(profile, 'frozenBalanceCents', 'frozen_balance_cents'),
    paidOutCents: getWalletBucketCents(profile, 'paidOutBalanceCents', 'paid_out_balance_cents')
  };
  const payoutSandboxStatus = {
    processing: payouts.filter((entry) => ['PENDING', 'PROCESSING', 'QUEUED'].includes(entry.status)).length,
    review: payouts.filter((entry) => entry.status === 'PENDING_APPROVAL').length,
    issues: payouts.filter((entry) =>
      ['ONHOLD', 'RETURNED', 'FAILED', 'DENIED'].includes(
        entry.official_paypal?.provider_item_status || entry.metadata?.provider_item_status || entry.status
      )
    ).length
  };
  const selectedInvoiceRecord = invoices.find((invoice) => invoice.internal_invoice_id === detailDrawer.id) || null;
  const selectedPayoutRecord = payouts.find((payout) => payout.payout_id === detailDrawer.id) || null;
  const showInvoiceComposer = mode === 'invoice';
  const showPayoutComposer = mode === 'payout';
  const renderPayPalPayoutChrome = isPayPalPayoutWorkspace;
  const renderSummaryCards = !renderPayPalPayoutChrome;
  const renderWorkspaceControls = !renderPayPalPayoutChrome;
  const renderPayoutComposer = showPayoutComposer && !renderPayPalPayoutChrome;
  const renderPayoutActivity = showPayouts && !renderPayPalPayoutChrome;
  const renderFundingOrders = showFundingOrders && !renderPayPalPayoutChrome;
  const renderPaymentIssues = showPaymentIssues && !renderPayPalPayoutChrome;
  const handleRefreshAll = async () => {
    setBusyAction('reconciliation');
    const result = await runPaymentReconciliation({ invoiceLimit: 50, payoutLimit: 50 });
    if (result.success) {
      await Promise.all([
        fetchInvoices(),
        fetchPayouts(payoutQuery),
        fetchAdminTopUpOrders(),
        fetchInvoiceReminderConfigurations(),
        fetchPaymentIssues()
      ]);
      toast.success(
        `Reconciled ${result.result.summary.invoice_count} invoices and ${result.result.summary.payout_count} payouts`
      );
    } else {
      toast.error(result.message || 'Failed to run reconciliation');
    }
    setBusyAction('');
  };

  const registerSectionRef = (sectionId) => (element) => {
    if (element) {
      sectionRefs.current[sectionId] = element;
    }
  };

  const handleSectionJump = (sectionId) => {
    const nextParams = new URLSearchParams(searchParams);
    if (embedded) {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', 'payments');
    }
    nextParams.set('section', sectionId);
    setSearchParams(nextParams);
  };

  const handlePayoutSandboxNavigation = (view) => {
    setPayoutSandboxView(view);

    if (isPayPalPayoutWorkspace) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('tab');
      nextParams.delete('section');
      setSearchParams(nextParams, { replace: true });
    }
  };

  const applyPayoutFilters = (next) => {
    if (!next) {
      return;
    }

    setPayoutSearch(next.search || '');
    setPayoutStatusFilter(next.status || 'ALL');
    setPayoutProviderFilter(next.provider || 'ALL');
    setPayoutSortBy(next.sortBy || 'createdAt');
    setPayoutSortDirection(next.sortDirection || 'desc');
    setPayoutDateFrom(next.dateFrom || '');
    setPayoutDateTo(next.dateTo || '');
    setPayoutPageSize(String(next.pageSize || '50'));
  };

  const applyPayoutSavedView = (view) => {
    const savedView = [...BUILT_IN_PAYOUT_SAVED_VIEWS, ...customPayoutSavedViews].find((entry) => entry.id === view);
    applyPayoutFilters(savedView?.filters);
  };

  const applyInvoiceFilters = (next) => {
    if (!next) {
      return;
    }

    setInvoiceSearch(next.recipient || '');
    setInvoiceProviderSearch(next.provider || '');
    setInvoiceStatusFilter(next.status || 'ALL');
    setInvoiceTemplateFilter(next.template || 'ALL');
    setInvoiceSortBy(next.sortBy || 'createdAt');
    setInvoiceSortDirection(next.sortDirection || 'desc');
    setInvoiceDateFrom(next.dateFrom || '');
    setInvoiceDateTo(next.dateTo || '');
    setInvoicePageSize(String(next.pageSize || '50'));
  };

  const applyInvoiceSavedView = (view) => {
    const savedView = [...BUILT_IN_INVOICE_SAVED_VIEWS, ...customInvoiceSavedViews].find((entry) => entry.id === view);
    applyInvoiceFilters(savedView?.filters);
  };

  const buildCurrentInvoiceSavedView = () => ({
    recipient: invoiceSearch,
    provider: invoiceProviderSearch,
    status: invoiceStatusFilter,
    template: invoiceTemplateFilter,
    dateFrom: invoiceDateFrom,
    dateTo: invoiceDateTo,
    pageSize: invoicePageSize,
    sortBy: invoiceSortBy,
    sortDirection: invoiceSortDirection
  });

  const buildCurrentPayoutSavedView = () => ({
    search: payoutSearch,
    status: payoutStatusFilter,
    provider: payoutProviderFilter,
    dateFrom: payoutDateFrom,
    dateTo: payoutDateTo,
    pageSize: payoutPageSize,
    sortBy: payoutSortBy,
    sortDirection: payoutSortDirection
  });

  const handleSaveInvoiceSavedView = () => {
    const label = invoiceSavedViewName.trim();
    if (!label) {
      toast.error('Name the invoice view first');
      return;
    }

    const nextViews = [
      ...customInvoiceSavedViews,
      {
        id: `invoice-${Date.now()}`,
        label,
        filters: buildCurrentInvoiceSavedView()
      }
    ];
    setCustomInvoiceSavedViews(nextViews);
    writeSavedViewsForType('invoice', nextViews);
    setInvoiceSavedViewName('');
    toast.success('Invoice view saved');
  };

  const handleDeleteInvoiceSavedView = (viewId) => {
    const nextViews = customInvoiceSavedViews.filter((entry) => entry.id !== viewId);
    setCustomInvoiceSavedViews(nextViews);
    writeSavedViewsForType('invoice', nextViews);
  };

  const handleSavePayoutSavedView = () => {
    const label = payoutSavedViewName.trim();
    if (!label) {
      toast.error('Name the payout view first');
      return;
    }

    const nextViews = [
      ...customPayoutSavedViews,
      {
        id: `payout-${Date.now()}`,
        label,
        filters: buildCurrentPayoutSavedView()
      }
    ];
    setCustomPayoutSavedViews(nextViews);
    writeSavedViewsForType('payout', nextViews);
    setPayoutSavedViewName('');
    toast.success('Payout view saved');
  };

  const handleDeletePayoutSavedView = (viewId) => {
    const nextViews = customPayoutSavedViews.filter((entry) => entry.id !== viewId);
    setCustomPayoutSavedViews(nextViews);
    writeSavedViewsForType('payout', nextViews);
  };

  const resetTemplateForm = () => {
    setEditingTemplateId('');
    setTemplateForm(createEmptyTemplateForm());
  };

  const resetInvoiceComposer = () => {
    setInvoiceComposer(createEmptyInvoiceComposer());
  };

  const handleInvoiceComposerFieldChange = (field, value) => {
    setInvoiceComposer((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  const handleInvoiceComposerLineItemChange = (index, field, value) => {
    setInvoiceComposer((previous) => ({
      ...previous,
      items: previous.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const addInvoiceComposerLineItem = () => {
    setInvoiceComposer((previous) => ({
      ...previous,
      items: [...previous.items, createEmptyLineItem()]
    }));
  };

  const removeInvoiceComposerLineItem = (index) => {
    setInvoiceComposer((previous) => ({
      ...previous,
      items:
        previous.items.length === 1
          ? previous.items
          : previous.items.filter((_item, itemIndex) => itemIndex !== index)
    }));
  };

  const buildInvoiceComposerPayload = () => {
    const payload = {
      recipientEmail: invoiceComposer.recipientEmail.trim(),
      description: invoiceComposer.description.trim() || undefined,
      issueDate: invoiceComposer.issueDate || undefined,
      dueDate: invoiceComposer.dueDate
        ? new Date(`${invoiceComposer.dueDate}T23:59:59.000Z`).toISOString()
        : undefined
    };

    if (invoiceComposer.templateId) {
      payload.templateId = invoiceComposer.templateId;
    } else {
      payload.currency = invoiceComposer.currency.trim().toUpperCase();
      payload.items = invoiceComposer.items.map((item) => ({
        name: item.name.trim(),
        description: item.description.trim() || undefined,
        quantity: Number(item.quantity),
        unitAmount: Number(item.unitAmount)
      }));
    }

    return payload;
  };

  const handleInvoiceComposerSubmit = async () => {
    const payload = buildInvoiceComposerPayload();

    const confirmed = window.confirm(
      `Create and send a hosted PayPal invoice for ${formatCents(invoiceDraftTotalCents, invoiceDraftCurrency)}? PayPal will create the customer payment link after submission.`
    );
    if (!confirmed) {
      return;
    }

    setBusyAction('create-invoice');
    const result = await createInvoice(payload);
    if (result.success) {
      await Promise.all([fetchInvoices(), fetchPaymentIssues()]);
      setLastCreatedInvoice(result.invoice);
      resetInvoiceComposer();
      handleSectionJump('invoices');
      toast.success('Official PayPal invoice created');
    } else {
      toast.error(result.message || 'Failed to create invoice');
    }
    setBusyAction('');
  };

  const resetPayoutComposer = () => {
    setPayoutComposer(createEmptyPayoutComposer());
  };

  const handlePayoutComposerFieldChange = (field, value) => {
    setPayoutComposer((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  const handleStripeConnectedAccountSelect = (accountId) => {
    setSelectedStripeConnectedAccountId(accountId);
    const account = stripeConnectedAccountsState.accounts.find((entry) => entry.id === accountId);
    if (!account) {
      return;
    }

    setPayoutComposer((previous) => ({
      ...previous,
      receiver: account.stripe_account_id,
      recipientType: 'STRIPE_ACCOUNT',
      receiverCountryCode: account.country_code || previous.receiverCountryCode || 'US'
    }));
  };

  const buildPayoutComposerPayload = () => ({
    provider: providerFilter || undefined,
    receiver: payoutComposer.receiver.trim(),
    recipientType: payoutComposer.recipientType,
    receiverCountryCode: payoutComposer.receiverCountryCode.trim().toUpperCase() || undefined,
    amount: Number(payoutComposer.amount),
    currency: payoutComposer.currency.trim().toUpperCase(),
    note: payoutComposer.note.trim() || undefined
  });

  useEffect(() => {
    if (!showInvoiceComposer || !invoiceComposer.recipientEmail || invoiceDraftTotalCents <= 0) {
      setInvoicePreview(null);
      return undefined;
    }

    let active = true;
    const timeoutId = window.setTimeout(async () => {
      const result = await previewInvoice(buildInvoiceComposerPayload());
      if (active) {
        setInvoicePreview(result.success ? result.preview : null);
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [invoiceComposer, invoiceDraftTotalCents, previewInvoice, showInvoiceComposer]);

  useEffect(() => {
    if (!showPayoutComposer || !payoutComposer.receiver || parseMoneyToCents(payoutComposer.amount) <= 0) {
      setPayoutServerPreview(null);
      return undefined;
    }

    let active = true;
    const timeoutId = window.setTimeout(async () => {
      const result = await previewPayout(buildPayoutComposerPayload());
      if (active) {
        setPayoutServerPreview(result.success ? result.preview : null);
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [payoutComposer, previewPayout, showPayoutComposer]);

  const handlePayoutComposerSubmit = async () => {
    setBusyAction('create-payout');
    const result = await createPayout(buildPayoutComposerPayload());

    if (result.success) {
      const refreshedPayouts = await fetchPayouts(payoutQuery);
      await fetchPaymentIssues();
      const matchedPayout =
        refreshedPayouts.find((entry) => entry.payout_id === result.payout?.payout_id) || result.payout;
      setLastCreatedPayout(matchedPayout);
      resetPayoutComposer();
      setSelectedStripeConnectedAccountId('');
      if (isPayPalPayoutWorkspace) {
        handlePayoutSandboxNavigation('activity');
      } else {
        handleSectionJump('payouts');
      }
      toast.success(isStripePayoutWorkspace ? 'Stripe payout requested' : 'Official PayPal payout requested');
    } else {
      toast.error(result.message || 'Failed to create payout');
    }
    setBusyAction('');
  };

  const handleReminderDraftChange = (configurationId, field, value) => {
    setReminderDrafts((previous) => ({
      ...previous,
      [configurationId]: {
        ...previous[configurationId],
        [field]: value
      }
    }));
  };

  const handleReminderConfigurationSave = async (configuration) => {
    const draft = reminderDrafts[configuration.id];
    if (!draft) {
      return;
    }

    setBusyAction(`reminder-save:${configuration.id}`);
    const result = await updateInvoiceReminderConfiguration(configuration.id, {
      type: draft.type,
      interval: {
        unit: draft.unit,
        value: Number(draft.value)
      },
      repetition: Number(draft.repetition),
      notification: {
        send_to_invoicer: Boolean(draft.send_to_invoicer)
      }
    });

    if (result.success) {
      toast.success('Reminder cadence updated');
    } else {
      toast.error(result.message || 'Failed to update reminder cadence');
    }
    setBusyAction('');
  };

  const handleReminderConfigurationToggle = async (configuration) => {
    const action = configuration.status === 'ACTIVE'
      ? suspendInvoiceReminderConfiguration
      : resumeInvoiceReminderConfiguration;
    const successMessage = configuration.status === 'ACTIVE' ? 'Reminder cadence suspended' : 'Reminder cadence resumed';

    setBusyAction(`reminder-toggle:${configuration.id}`);
    const result = await action(configuration.id);
    if (result.success) {
      toast.success(successMessage);
    } else {
      toast.error(result.message || 'Failed to update reminder cadence status');
    }
    setBusyAction('');
  };

  const handleTemplateFieldChange = (field, value) => {
    setTemplateForm((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  const handleTemplateLineItemChange = (index, field, value) => {
    setTemplateForm((previous) => ({
      ...previous,
      line_items: previous.line_items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const addTemplateLineItem = () => {
    setTemplateForm((previous) => ({
      ...previous,
      line_items: [...previous.line_items, createEmptyLineItem()]
    }));
  };

  const removeTemplateLineItem = (index) => {
    setTemplateForm((previous) => ({
      ...previous,
      line_items:
        previous.line_items.length === 1
          ? previous.line_items
          : previous.line_items.filter((_item, itemIndex) => itemIndex !== index)
    }));
  };

  const startTemplateEdit = (template) => {
    setEditingTemplateId(template.id);
    setTemplateForm({
      name: template.name || '',
      description: template.description || '',
      currency_code: template.currency_code || 'USD',
      default_due_days:
        template.default_due_days === null || typeof template.default_due_days === 'undefined'
          ? ''
          : String(template.default_due_days),
      is_active: Boolean(template.is_active),
      line_items: (template.line_items || []).length
        ? template.line_items.map((item) => ({
            name: item.name || '',
            description: item.description || '',
            quantity: item.quantity || 1,
            unitAmount: item.unitAmount || ''
          }))
        : [createEmptyLineItem()]
    });
  };

  const handleTemplateSubmit = async () => {
    const normalizedItems = templateForm.line_items.map((item) => ({
      name: item.name.trim(),
      description: item.description.trim() || undefined,
      quantity: Number(item.quantity),
      unitAmount: Number(item.unitAmount)
    }));

    const payload = {
      name: templateForm.name.trim(),
      description: templateForm.description.trim() || undefined,
      currency_code: templateForm.currency_code.trim().toUpperCase(),
      default_due_days: templateForm.default_due_days === '' ? undefined : Number(templateForm.default_due_days),
      is_active: Boolean(templateForm.is_active),
      line_items: normalizedItems
    };

    const result = editingTemplateId
      ? await updateInvoiceTemplate(editingTemplateId, payload)
      : await createInvoiceTemplate(payload);

    if (result.success) {
      toast.success(editingTemplateId ? 'Template updated' : 'Template created');
      resetTemplateForm();
    } else {
      toast.error(result.message || 'Failed to save template');
    }
  };

  const handleTemplateDelete = async (template) => {
    const confirmed = window.confirm(`Delete invoice template "${template.name}"?`);
    if (!confirmed) {
      return;
    }

    const result = await deleteInvoiceTemplate(template.id);
    if (result.success) {
      toast.success('Template deleted');
      if (editingTemplateId === template.id) {
        resetTemplateForm();
      }
    } else {
      toast.error(result.message || 'Failed to delete template');
    }
  };

  const handleTemplateToggleActive = async (template) => {
    const result = await updateInvoiceTemplate(template.id, {
      is_active: !template.is_active
    });

    if (result.success) {
      toast.success(template.is_active ? 'Template archived' : 'Template activated');
    } else {
      toast.error(result.message || 'Failed to update template status');
    }
  };

  const handleInvoiceAction = async (action, invoice, runner, successMessage) => {
    setBusyAction(`${action}:${invoice.internal_invoice_id}`);
    const result = await runner(invoice.internal_invoice_id);
    if (result.success) {
      await fetchPaymentIssues();
      toast.success(successMessage);
    } else {
      toast.error(result.message || 'Action failed');
    }
    setBusyAction('');
  };

  const handleInvoiceReminderCancellation = async (invoice) => {
    const confirmed = window.confirm(
      `Stop automatic PayPal reminders for invoice ${invoice.summary.invoice_number || invoice.invoice_id}?`
    );

    if (!confirmed) {
      return;
    }

    setBusyAction(`cancel-reminders:${invoice.internal_invoice_id}`);
    const result = await cancelInvoiceAutoReminders(invoice.internal_invoice_id);
    if (result.success) {
      toast.success('Invoice auto reminders cancelled in PayPal');
    } else {
      toast.error(result.message || 'Failed to cancel invoice auto reminders');
    }
    setBusyAction('');
  };

  const handlePayoutRefresh = async (payout) => {
    setBusyAction(`refresh:${payout.payout_id}`);
    const result = await refreshPayout(payout.payout_id);
    if (result.success) {
      await fetchPaymentIssues();
      toast.success('Payout refreshed');
    } else {
      toast.error(result.message || 'Failed to refresh payout');
    }
    setBusyAction('');
  };

  const handleCancelUnclaimedPayout = async (payout) => {
    const confirmed = window.confirm(
      `Cancel the unclaimed PayPal payout item for payout ${payout.payout_id}? Returned funds will move back to available balance once PayPal confirms the cancellation.`
    );

    if (!confirmed) {
      return;
    }

    setBusyAction(`cancel-unclaimed:${payout.payout_id}`);
    const result = await cancelUnclaimedPayout(payout.payout_id);
    if (result.success) {
      await fetchPaymentIssues();
      toast.success('Unclaimed payout cancellation submitted to PayPal');
    } else {
      toast.error(result.message || 'Failed to cancel unclaimed payout');
    }
    setBusyAction('');
  };

  const handleApprovePayout = async (payout) => {
    setBusyAction(`approve:${payout.payout_id}`);
    const result = await approvePayout(payout.payout_id);
    if (result.success) {
      await Promise.all([fetchPayouts(payoutQuery), fetchPaymentIssues()]);
      toast.success('Payout approved');
    } else {
      toast.error(result.message || 'Failed to approve payout');
    }
    setBusyAction('');
  };

  const handleRejectPayout = async (payout, reason) => {
    const confirmed = window.confirm(`Reject payout ${payout.payout_id}?`);
    if (!confirmed) {
      return;
    }

    setBusyAction(`reject:${payout.payout_id}`);
    const result = await rejectPayout(payout.payout_id, reason);
    if (result.success) {
      await Promise.all([fetchPayouts(payoutQuery), fetchPaymentIssues()]);
      toast.success('Payout rejected');
    } else {
      toast.error(result.message || 'Failed to reject payout');
    }
    setBusyAction('');
  };

  const handleReleaseInvoiceFunds = async (invoice, amount, reason) => {
    const confirmed = window.confirm(`Release funds for invoice ${invoice.summary?.invoice_number || invoice.invoice_id}?`);
    if (!confirmed) {
      return;
    }

    setBusyAction(`release:${invoice.internal_invoice_id}`);
    const result = await releaseInvoiceFunds(invoice.internal_invoice_id, {
      amount: amount ? Number(amount) : undefined,
      reason: reason || undefined
    });
    if (result.success) {
      await Promise.all([fetchInvoices(), fetchPaymentIssues()]);
      toast.success('Invoice funds released');
    } else {
      toast.error(result.message || 'Failed to release invoice funds');
    }
    setBusyAction('');
  };

  const handleMarkInvoiceReviewRequired = async (invoice) => {
    const confirmed = window.confirm(`Mark invoice ${invoice.summary?.invoice_number || invoice.invoice_id} for settlement review?`);
    if (!confirmed) {
      return;
    }

    setBusyAction(`review:${invoice.internal_invoice_id}`);
    const result = await markInvoiceReviewRequired(invoice.internal_invoice_id, {
      reason: 'Operator requested provider settlement review from admin workspace'
    });
    if (result.success) {
      await Promise.all([fetchInvoices(), fetchPaymentIssues()]);
      toast.success('Invoice marked for provider review');
    } else {
      toast.error(result.message || 'Failed to mark invoice for review');
    }
    setBusyAction('');
  };

  const handleAddRecordNote = async (record, type, note, onSaved) => {
    setBusyAction(`note:${type}:${type === 'invoice' ? record.internal_invoice_id : record.payout_id}`);
    const result =
      type === 'invoice'
        ? await addInvoiceNote(record.internal_invoice_id, note)
        : await addPayoutNote(record.payout_id, note);
    if (result.success) {
      onSaved();
      if (type === 'invoice') {
        setInvoiceTimelineId(record.internal_invoice_id);
        setInvoiceTimelineLoading(true);
        setInvoiceTimelineEntries(await fetchInvoiceTimeline(record.internal_invoice_id, 15));
        setInvoiceTimelineLoading(false);
      } else {
        setPayoutTimelineId(record.payout_id);
        setPayoutTimelineLoading(true);
        setPayoutTimelineEntries(await fetchPayoutTimeline(record.payout_id, 15));
        setPayoutTimelineLoading(false);
      }
      toast.success('Operator note saved');
    } else {
      toast.error(result.message || 'Failed to save note');
    }
    setBusyAction('');
  };

  const handleTopUpOrderComplete = async (order) => {
    const confirmed = window.confirm(
      `Approve funding order ${order.order_id} and credit ${Number(order.points || 0).toLocaleString()} points?`
    );

    if (!confirmed) {
      return;
    }

    setBusyAction(`topup-complete:${order.order_id}`);
    const result = await completeTopUpOrder(order.order_id);
    if (result.success) {
      toast.success('Funding order completed and points credited');
    } else {
      toast.error(result.message || 'Failed to complete funding order');
    }
    setBusyAction('');
  };

  const handleTopUpOrderCancel = async (order) => {
    const confirmed = window.confirm(`Cancel funding order ${order.order_id}?`);

    if (!confirmed) {
      return;
    }

    setBusyAction(`topup-cancel:${order.order_id}`);
    const result = await cancelTopUpOrder(order.order_id);
    if (result.success) {
      toast.success('Funding order cancelled');
    } else {
      toast.error(result.message || 'Failed to cancel funding order');
    }
    setBusyAction('');
  };

  const handleInvoiceCancel = async (invoice) => {
    const confirmed = window.confirm(
      `Cancel PayPal invoice ${invoice.summary.invoice_number || invoice.invoice_id}? This cannot be undone from this panel.`
    );

    if (!confirmed) {
      return;
    }

    setBusyAction(`cancel:${invoice.internal_invoice_id}`);
    const result = await cancelInvoice(invoice.internal_invoice_id);
    if (result.success) {
      await fetchPaymentIssues();
      toast.success('Invoice cancelled in PayPal');
    } else {
      toast.error(result.message || 'Failed to cancel invoice');
    }
    setBusyAction('');
  };

  const handleIssueAction = async (issue, action) => {
    const key = `issue:${action}:${issue.payment_issue_id}`;
    setBusyAction(key);
    const note = issueNotes[issue.payment_issue_id] || '';
    const runner =
      action === 'acknowledge'
        ? acknowledgePaymentIssue
        : action === 'resolve'
          ? resolvePaymentIssue
          : reopenPaymentIssue;
    const result = await runner(issue.payment_issue_id, note);
    if (result.success) {
      toast.success(
        action === 'acknowledge'
          ? 'Issue acknowledged.'
          : action === 'resolve'
            ? 'Issue resolved.'
            : 'Issue reopened.'
      );
      setIssueNotes((previous) => ({ ...previous, [issue.payment_issue_id]: '' }));
    } else {
      toast.error(result.message || 'Failed to update issue');
    }
    setBusyAction('');
  };

  const toggleInvoiceTimeline = async (invoice) => {
    if (invoiceTimelineId === invoice.internal_invoice_id) {
      setInvoiceTimelineId('');
      setInvoiceTimelineEntries([]);
      return;
    }

    setInvoiceTimelineId(invoice.internal_invoice_id);
    setInvoiceTimelineLoading(true);
    const entries = await fetchInvoiceTimeline(invoice.internal_invoice_id, 15);
    setInvoiceTimelineEntries(entries);
    setInvoiceTimelineLoading(false);
  };

  const togglePayoutTimeline = async (payout) => {
    if (payoutTimelineId === payout.payout_id) {
      setPayoutTimelineId('');
      setPayoutTimelineEntries([]);
      return;
    }

    setPayoutTimelineId(payout.payout_id);
    setPayoutTimelineLoading(true);
    const entries = await fetchPayoutTimeline(payout.payout_id, 15);
    setPayoutTimelineEntries(entries);
    setPayoutTimelineLoading(false);
  };

  const payoutSandboxChrome = (
    <PayPalSandboxPayoutChrome
      adminTopUpOrders={adminTopUpOrders}
      busyAction={busyAction}
      filteredPayouts={filteredPayouts}
      onNavigate={handlePayoutSandboxNavigation}
      onOpenPayoutDetail={(payout) => setDetailDrawer({ type: 'payout', id: payout.payout_id })}
      onPayoutComposerFieldChange={handlePayoutComposerFieldChange}
      onPayoutComposerSubmit={handlePayoutComposerSubmit}
      onRefreshAll={handleRefreshAll}
      onResetPayoutComposer={resetPayoutComposer}
      paymentIssues={paymentIssues}
      payoutComposer={payoutComposer}
      payoutImpactPreview={payoutImpactPreview}
      payoutSandboxStatus={payoutSandboxStatus}
      payoutSandboxView={payoutSandboxView}
      payoutSandboxWallet={payoutSandboxWallet}
      walletCurrency={walletCurrency}
    />
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {isPayPalEmbeddedWorkspace ? (
        <div
          className={
            isPayPalPayoutWorkspace
              ? 'overflow-hidden bg-white'
              : 'overflow-hidden rounded-[28px] border bg-white shadow-[0_24px_60px_rgba(0,48,135,0.08)]'
          }
          style={{
            borderColor: isPayPalPayoutWorkspace ? undefined : PAYPAL_BRAND.border,
            background: isPayPalPayoutWorkspace ? '#ffffff' : `linear-gradient(135deg, ${PAYPAL_BRAND.mist} 0%, #ffffff 58%, rgba(0,156,222,0.08) 100%)`
          }}
        >
          {isPayPalPayoutWorkspace ? (
            <>
            {payoutSandboxChrome}
            </>
          ) : (
            <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <img
                  src={PAYPAL_BRAND.logoUrl}
                  alt="PayPal"
                  className="h-10 w-auto"
                />
                <h2 className="mt-5 text-3xl font-black tracking-[-0.05em]" style={{ color: PAYPAL_BRAND.ink }}>
                  PayPal Invoicing
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Create, send, and manage official PayPal invoices with hosted links, reminder controls, QR generation, and template-backed workflows in one operational surface.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {['Hosted invoice links', 'Template backed', 'Reminder aware', 'QR ready'].map((chip) => (
                    <div
                      key={chip}
                      className="inline-flex rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em]"
                      style={{
                        borderColor: PAYPAL_BRAND.border,
                        backgroundColor: '#ffffff',
                        color: PAYPAL_BRAND.blue
                      }}
                    >
                      {chip}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:w-[320px] lg:grid-cols-1">
                <div className="rounded-[22px] border bg-white p-4 shadow-sm" style={{ borderColor: PAYPAL_BRAND.border }}>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                    Invoice Surface
                  </p>
                  <p className="mt-3 text-lg font-black tracking-[-0.03em]" style={{ color: PAYPAL_BRAND.ink }}>
                    Hosted links + records
                  </p>
                </div>
                <div className="rounded-[22px] border bg-white p-4 shadow-sm" style={{ borderColor: PAYPAL_BRAND.border }}>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                    Operational Model
                  </p>
                  <p className="mt-3 text-lg font-black tracking-[-0.03em]" style={{ color: PAYPAL_BRAND.ink }}>
                    Send, sync, remind, reconcile
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {renderSummaryCards ? (
      <div className={`grid grid-cols-1 gap-6 md:grid-cols-2 ${embedded ? 'xl:grid-cols-2' : 'xl:grid-cols-4'}`}>
        {visibleSummary.map(({ icon: Icon, label, value, tone }) => (
          <div
            key={label}
            className="rounded-2xl border bg-white p-6 shadow-sm"
            style={
              isPayPalEmbeddedWorkspace
                ? { borderColor: PAYPAL_BRAND.border, boxShadow: '0 16px 40px rgba(0,48,135,0.06)' }
                : undefined
            }
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{
                backgroundColor: isPayPalEmbeddedWorkspace ? `${PAYPAL_BRAND.blue}10` : `${tone}20`
              }}
            >
              <Icon size={22} style={{ color: isPayPalEmbeddedWorkspace ? PAYPAL_BRAND.blue : tone }} />
            </div>
            <p className="mt-4 text-sm font-medium text-gray-500">{label}</p>
            <p
              className="mt-1 text-3xl font-bold"
              style={{ color: isPayPalEmbeddedWorkspace ? PAYPAL_BRAND.ink : undefined }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>
      ) : null}

      {renderWorkspaceControls ? (
        <WorkspaceControls
          activeSection={activeSection}
          brand={brand}
          busyAction={busyAction}
          fetchAdminTopUpOrders={fetchAdminTopUpOrders}
          fetchInvoiceReminderConfigurations={fetchInvoiceReminderConfigurations}
          fetchInvoiceTemplates={fetchInvoiceTemplates}
          fetchInvoices={fetchInvoices}
          fetchPaymentIssues={fetchPaymentIssues}
          fetchPayouts={fetchPayouts}
          isPayPalEmbeddedWorkspace={isPayPalEmbeddedWorkspace}
          isPayPalInvoiceWorkspace={isPayPalInvoiceWorkspace}
          isPayPalPayoutWorkspace={isPayPalPayoutWorkspace}
          isStripePayoutWorkspace={isStripePayoutWorkspace}
          onRefreshAll={handleRefreshAll}
          onSectionJump={handleSectionJump}
          payoutQuery={payoutQuery}
          providerFilter={providerFilter}
          sectionLinks={sectionLinks}
          toast={toast}
          workspaceDescription={workspaceDescription}
          workspaceTitle={workspaceTitle}
        />
      ) : null}

      {showInvoiceComposer ? (
        <InvoiceComposerSection
          brand={brand}
          busyAction={busyAction}
          invoiceComposer={invoiceComposer}
          invoiceDraftCurrency={invoiceDraftCurrency}
          invoiceDraftItems={invoiceDraftItems}
          invoiceDraftTotalCents={invoiceDraftTotalCents}
          invoicePreview={invoicePreview}
          invoiceTemplates={invoiceTemplates}
          isPayPalInvoiceWorkspace={isPayPalInvoiceWorkspace}
          lastCreatedInvoice={lastCreatedInvoice}
          onAddLineItem={addInvoiceComposerLineItem}
          onFieldChange={handleInvoiceComposerFieldChange}
          onLineItemChange={handleInvoiceComposerLineItemChange}
          onRemoveLineItem={removeInvoiceComposerLineItem}
          onReset={resetInvoiceComposer}
          onSubmit={handleInvoiceComposerSubmit}
          onViewRecords={() => handleSectionJump('invoices')}
          sectionRef={registerSectionRef('payout-composer')}
          selectedInvoiceTemplate={selectedInvoiceTemplate}
        />
      ) : null}

      {renderPayoutComposer ? (
        <PayoutComposerSection
          busyAction={busyAction}
          isStripePayoutWorkspace={isStripePayoutWorkspace}
          lastCreatedPayout={lastCreatedPayout}
          onPayoutComposerFieldChange={handlePayoutComposerFieldChange}
          onPayoutComposerSubmit={handlePayoutComposerSubmit}
          onResetPayoutComposer={resetPayoutComposer}
          onStripeConnectedAccountSelect={handleStripeConnectedAccountSelect}
          payoutComposer={payoutComposer}
          payoutImpactPreview={payoutImpactPreview}
          payoutSandboxWallet={payoutSandboxWallet}
          selectedStripeConnectedAccountId={selectedStripeConnectedAccountId}
          stripeConnectedAccountsState={stripeConnectedAccountsState}
          walletCurrency={walletCurrency}
        />
      ) : null}

      {renderFundingOrders ? (
        <FundingOrdersPanel
          adminTopUpOrders={adminTopUpOrders}
          busyAction={busyAction}
          onCancel={handleTopUpOrderCancel}
          onComplete={handleTopUpOrderComplete}
          sectionRef={registerSectionRef('funding-orders')}
        />
      ) : null}

      {showReminderCadence ? (
        <div ref={registerSectionRef('reminder-cadence')} className="scroll-mt-28 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Reminder Cadence</h3>
          <p className="text-sm text-gray-500">
            {invoiceReminderConfigurations.length} official PayPal auto reminder configurations
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {invoiceReminderConfigurations.map((configuration) => {
            const draft = reminderDrafts[configuration.id] || {
              type: configuration.type,
              unit: configuration.interval?.unit || 'DAY',
              value: String(configuration.interval?.value || 1),
              repetition: String(configuration.repetition || 1),
              send_to_invoicer: Boolean(configuration.notification?.send_to_invoicer)
            };

            return (
              <div key={configuration.id} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-bold text-gray-900">{configuration.type.replace('_', ' ')}</h4>
                    <p className="mt-1 text-xs text-gray-500">{configuration.id}</p>
                  </div>
                  <StatusPill
                    value={configuration.status || 'UNKNOWN'}
                    tone={configuration.status === 'ACTIVE' ? 'green' : 'amber'}
                  />
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Interval Unit</label>
                    <select
                      value={draft.unit}
                      onChange={(event) => handleReminderDraftChange(configuration.id, 'unit', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                    >
                      <option value="DAY">DAY</option>
                      <option value="WEEK">WEEK</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Interval Value</label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={draft.value}
                      onChange={(event) => handleReminderDraftChange(configuration.id, 'value', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Repetition</label>
                    <input
                      type="number"
                      min="1"
                      max="7"
                      value={draft.repetition}
                      onChange={(event) =>
                        handleReminderDraftChange(configuration.id, 'repetition', event.target.value)
                      }
                      disabled={draft.type === 'BEFORE_DUE'}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none disabled:bg-gray-100"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700 md:pt-7">
                    <input
                      type="checkbox"
                      checked={draft.send_to_invoicer}
                      onChange={(event) =>
                        handleReminderDraftChange(configuration.id, 'send_to_invoicer', event.target.checked)
                      }
                    />
                    Send copy to invoicer
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
                  <span>Created: {formatDateTime(configuration.metadata?.created_time)}</span>
                  <span>Updated: {formatDateTime(configuration.metadata?.updated_time)}</span>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    onClick={() => handleReminderConfigurationSave(configuration)}
                    disabled={Boolean(busyAction)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Send size={14} />
                    Save Cadence
                  </button>
                  <button
                    onClick={() => handleReminderConfigurationToggle(configuration)}
                    disabled={Boolean(busyAction)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <RotateCcw
                      size={14}
                      className={busyAction === `reminder-toggle:${configuration.id}` ? 'animate-spin' : ''}
                    />
                    {configuration.status === 'ACTIVE' ? 'Suspend' : 'Resume'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {invoiceReminderConfigurations.length === 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white px-6 py-10 text-center text-sm text-gray-500 shadow-sm">
            No official PayPal reminder configurations available.
          </div>
        )}
        </div>
      ) : null}

      {renderPaymentIssues ? (
        <PaymentIssuesPanel
          busyAction={busyAction}
          isPayPalEmbeddedWorkspace={isPayPalEmbeddedWorkspace}
          issueNotes={issueNotes}
          onIssueAction={handleIssueAction}
          paymentIssues={paymentIssues}
          sectionRef={registerSectionRef('payment-issues')}
          setIssueNotes={setIssueNotes}
        />
      ) : null}

      {showInvoiceTemplates ? (
        <div ref={registerSectionRef('invoice-templates')} className="scroll-mt-28 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Invoice Templates</h3>
          <p className="text-sm text-gray-500">{invoiceTemplates.length} stored admin templates</p>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-gray-900">
                  {editingTemplateId ? 'Edit Template' : 'Create Template'}
                </h4>
                <p className="mt-1 text-sm text-gray-500">
                  Save reusable invoice structures for official PayPal invoice generation.
                </p>
              </div>
              {editingTemplateId && (
                <button
                  onClick={resetTemplateForm}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Template Name</label>
                <input
                  value={templateForm.name}
                  onChange={(event) => handleTemplateFieldChange('name', event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={templateForm.description}
                  onChange={(event) => handleTemplateFieldChange('description', event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Currency</label>
                  <input
                    value={templateForm.currency_code}
                    onChange={(event) => handleTemplateFieldChange('currency_code', event.target.value)}
                    maxLength={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase focus:border-orange-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Default Due Days</label>
                  <input
                    type="number"
                    min="0"
                    value={templateForm.default_due_days}
                    onChange={(event) => handleTemplateFieldChange('default_due_days', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={templateForm.is_active}
                  onChange={(event) => handleTemplateFieldChange('is_active', event.target.checked)}
                />
                Template is active
              </label>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">Line Items</label>
                  <button
                    onClick={addTemplateLineItem}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Plus size={14} />
                    Item
                  </button>
                </div>
                <div className="space-y-3">
                  {templateForm.line_items.map((item, index) => (
                    <div key={`template-line-item-${index}`} className="rounded-lg border border-gray-200 p-3">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <input
                          placeholder="Item name"
                          value={item.name}
                          onChange={(event) => handleTemplateLineItemChange(index, 'name', event.target.value)}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                        />
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="Unit amount"
                          value={item.unitAmount}
                          onChange={(event) => handleTemplateLineItemChange(index, 'unitAmount', event.target.value)}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                        />
                        <input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="Quantity"
                          value={item.quantity}
                          onChange={(event) => handleTemplateLineItemChange(index, 'quantity', event.target.value)}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                        />
                        <input
                          placeholder="Item description"
                          value={item.description}
                          onChange={(event) => handleTemplateLineItemChange(index, 'description', event.target.value)}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                        />
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => removeTemplateLineItem(index)}
                          disabled={templateForm.line_items.length === 1}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleTemplateSubmit}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
                style={{ backgroundColor: brand }}
              >
                {editingTemplateId ? 'Update Template' : 'Create Template'}
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    {['Template', 'Currency', 'Due Days', 'Items', 'Status', 'Actions'].map((heading) => (
                      <th key={heading} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoiceTemplates.map((template) => (
                    <tr key={template.id} className="border-b border-gray-100 align-top hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{template.name}</div>
                        <div className="mt-1 text-xs text-gray-500">{template.description || 'No description'}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{template.currency_code}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {template.default_due_days ?? 'Manual'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{template.line_items?.length || 0}</td>
                      <td className="px-6 py-4">
                        <StatusPill value={template.is_active ? 'ACTIVE' : 'INACTIVE'} tone={template.is_active ? 'green' : 'gray'} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => startTemplateEdit(template)}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleTemplateToggleActive(template)}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            {template.is_active ? 'Archive' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleTemplateDelete(template)}
                            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {invoiceTemplates.length === 0 && (
              <div className="px-6 py-10 text-center text-sm text-gray-500">No invoice templates yet.</div>
            )}
          </div>
        </div>
        </div>
      ) : null}

      {showInvoices ? (
        <div ref={registerSectionRef('invoices')} className="scroll-mt-28 space-y-4">
        <InvoiceFilters
          customInvoiceSavedViews={customInvoiceSavedViews}
          filteredInvoices={filteredInvoices}
          invoiceDateFrom={invoiceDateFrom}
          invoiceDateTo={invoiceDateTo}
          invoicePageSize={invoicePageSize}
          invoicePagination={invoicePagination}
          invoiceProviderSearch={invoiceProviderSearch}
          invoiceSavedViewName={invoiceSavedViewName}
          invoiceSearch={invoiceSearch}
          invoiceSortBy={invoiceSortBy}
          invoiceSortDirection={invoiceSortDirection}
          invoiceStatusFilter={invoiceStatusFilter}
          invoiceStatusOptions={invoiceStatusOptions}
          invoiceTemplateFilter={invoiceTemplateFilter}
          invoiceTemplates={invoiceTemplates}
          invoices={invoices}
          isPayPalInvoiceWorkspace={isPayPalInvoiceWorkspace}
          onApplySavedView={applyInvoiceSavedView}
          onDeleteSavedView={handleDeleteInvoiceSavedView}
          onSaveSavedView={handleSaveInvoiceSavedView}
          setInvoiceDateFrom={setInvoiceDateFrom}
          setInvoiceDateTo={setInvoiceDateTo}
          setInvoicePageSize={setInvoicePageSize}
          setInvoiceProviderSearch={setInvoiceProviderSearch}
          setInvoiceSavedViewName={setInvoiceSavedViewName}
          setInvoiceSearch={setInvoiceSearch}
          setInvoiceSortBy={setInvoiceSortBy}
          setInvoiceSortDirection={setInvoiceSortDirection}
          setInvoiceStatusFilter={setInvoiceStatusFilter}
          setInvoiceTemplateFilter={setInvoiceTemplateFilter}
        />

        <InvoiceRecordsTable
          busyAction={busyAction}
          filteredInvoices={filteredInvoices}
          generateInvoiceQr={generateInvoiceQr}
          handleInvoiceAction={handleInvoiceAction}
          handleInvoiceCancel={handleInvoiceCancel}
          handleInvoiceReminderCancellation={handleInvoiceReminderCancellation}
          handleMarkInvoiceReviewRequired={handleMarkInvoiceReviewRequired}
          invoicePagination={invoicePagination}
          invoiceTimelineEntries={invoiceTimelineEntries}
          invoiceTimelineId={invoiceTimelineId}
          invoiceTimelineLoading={invoiceTimelineLoading}
          isPayPalInvoiceWorkspace={isPayPalInvoiceWorkspace}
          onNextPage={() => setInvoicePage((page) => page + 1)}
          onOpenDetail={(invoice) => setDetailDrawer({ type: 'invoice', id: invoice.internal_invoice_id })}
          onPreviousPage={() => setInvoicePage((page) => Math.max(1, page - 1))}
          refreshInvoice={refreshInvoice}
          sendInvoiceReminder={sendInvoiceReminder}
          toggleInvoiceTimeline={toggleInvoiceTimeline}
        />
        </div>
      ) : null}

      {renderPayoutActivity ? (
        <div ref={registerSectionRef('payouts')} className="scroll-mt-28 space-y-4">
        <PayoutFilters
          customPayoutSavedViews={customPayoutSavedViews}
          filteredPayouts={filteredPayouts}
          isPayPalPayoutWorkspace={isPayPalPayoutWorkspace}
          payoutDateFrom={payoutDateFrom}
          payoutDateTo={payoutDateTo}
          payoutPageSize={payoutPageSize}
          payoutPagination={payoutPagination}
          payoutProviderFilter={payoutProviderFilter}
          payoutProviderOptions={payoutProviderOptions}
          payoutSavedViewName={payoutSavedViewName}
          payoutSearch={payoutSearch}
          payoutSortBy={payoutSortBy}
          payoutSortDirection={payoutSortDirection}
          payoutStatusFilter={payoutStatusFilter}
          payoutStatusOptions={payoutStatusOptions}
          payouts={payouts}
          onApplySavedView={applyPayoutSavedView}
          onDeleteSavedView={handleDeletePayoutSavedView}
          onSaveSavedView={handleSavePayoutSavedView}
          setPayoutDateFrom={setPayoutDateFrom}
          setPayoutDateTo={setPayoutDateTo}
          setPayoutPageSize={setPayoutPageSize}
          setPayoutProviderFilter={setPayoutProviderFilter}
          setPayoutSavedViewName={setPayoutSavedViewName}
          setPayoutSearch={setPayoutSearch}
          setPayoutSortBy={setPayoutSortBy}
          setPayoutSortDirection={setPayoutSortDirection}
          setPayoutStatusFilter={setPayoutStatusFilter}
        />

        <PayoutRecordsTable
          busyAction={busyAction}
          filteredPayouts={filteredPayouts}
          handleCancelUnclaimedPayout={handleCancelUnclaimedPayout}
          handlePayoutRefresh={handlePayoutRefresh}
          isPayPalPayoutWorkspace={isPayPalPayoutWorkspace}
          onNextPage={() => setPayoutPage((page) => page + 1)}
          onOpenDetail={(payout) => setDetailDrawer({ type: 'payout', id: payout.payout_id })}
          onPreviousPage={() => setPayoutPage((page) => Math.max(1, page - 1))}
          payoutPagination={payoutPagination}
          payoutTimelineEntries={payoutTimelineEntries}
          payoutTimelineId={payoutTimelineId}
          payoutTimelineLoading={payoutTimelineLoading}
          togglePayoutTimeline={togglePayoutTimeline}
        />
        </div>
      ) : null}

      <PaymentRecordDrawer
        record={detailDrawer.type === 'invoice' ? selectedInvoiceRecord : selectedPayoutRecord}
        type={detailDrawer.type}
        busyAction={busyAction}
        onClose={() => setDetailDrawer({ type: '', id: '' })}
        invoiceActions={{
          onRefresh: (item) => handleInvoiceAction('refresh', item, refreshInvoice, 'Invoice refreshed'),
          onReminder: (item) => handleInvoiceAction('remind', item, sendInvoiceReminder, 'Reminder sent'),
          onCancelReminders: handleInvoiceReminderCancellation,
          onQr: (item) => handleInvoiceAction('qr', item, generateInvoiceQr, 'Official PayPal QR generated'),
          onCancel: handleInvoiceCancel,
          onReviewRequired: handleMarkInvoiceReviewRequired,
          onTimelineToggle: toggleInvoiceTimeline
        }}
        payoutActions={{
          onRefresh: handlePayoutRefresh,
          onCancelUnclaimed: handleCancelUnclaimedPayout,
          onTimelineToggle: togglePayoutTimeline
        }}
        adminActions={{
          onApprovePayout: handleApprovePayout,
          onRejectPayout: handleRejectPayout,
          onReleaseInvoice: handleReleaseInvoiceFunds,
          onAddNote: handleAddRecordNote
        }}
        timeline={{
          open:
            detailDrawer.type === 'invoice'
              ? invoiceTimelineId === selectedInvoiceRecord?.internal_invoice_id
              : payoutTimelineId === selectedPayoutRecord?.payout_id,
          loading: detailDrawer.type === 'invoice' ? invoiceTimelineLoading : payoutTimelineLoading,
          entries: detailDrawer.type === 'invoice' ? invoiceTimelineEntries : payoutTimelineEntries
        }}
      />
    </div>
  );
}
