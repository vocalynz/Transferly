export const PAYPAL_BRAND = {
  logoUrl: 'https://www.paypalobjects.com/webstatic/mktg/Logo/pp-logo-200px.png',
  blue: '#003087',
  actionBlue: '#0070e0',
  cyan: '#009cde',
  ink: '#001435',
  muted: '#545d68',
  mist: '#f4f8ff',
  border: '#d5e3ff',
  shell: '#f5f7fa',
  sand: '#fff7ec',
  gold: '#ffc439',
  success: '#00a86b'
};

const SAVED_VIEWS_STORAGE_KEY = 'transferly_paypal_ops_saved_views';

export const BUILT_IN_INVOICE_SAVED_VIEWS = [
  {
    id: 'paid',
    label: 'Paid invoices',
    filters: {
      recipient: '',
      provider: '',
      status: 'PAID',
      template: 'ALL',
      dateFrom: '',
      dateTo: '',
      pageSize: '50',
      sortBy: 'updatedAt',
      sortDirection: 'desc'
    }
  },
  {
    id: 'payable',
    label: 'Payable links',
    filters: {
      recipient: '',
      provider: '',
      status: 'SENT',
      template: 'ALL',
      dateFrom: '',
      dateTo: '',
      pageSize: '50',
      sortBy: 'createdAt',
      sortDirection: 'desc'
    }
  },
  {
    id: 'updated',
    label: 'Updated invoices',
    filters: {
      recipient: '',
      provider: '',
      status: 'UPDATED',
      template: 'ALL',
      dateFrom: '',
      dateTo: '',
      pageSize: '50',
      sortBy: 'updatedAt',
      sortDirection: 'desc'
    }
  },
  {
    id: 'cancelled',
    label: 'Cancelled',
    filters: {
      recipient: '',
      provider: '',
      status: 'CANCELLED',
      template: 'ALL',
      dateFrom: '',
      dateTo: '',
      pageSize: '50',
      sortBy: 'updatedAt',
      sortDirection: 'desc'
    }
  }
];

export const BUILT_IN_PAYOUT_SAVED_VIEWS = [
  {
    id: 'needs_review',
    label: 'Needs review',
    filters: {
      search: '',
      status: 'PENDING_APPROVAL',
      provider: 'ALL',
      dateFrom: '',
      dateTo: '',
      pageSize: '50',
      sortBy: 'createdAt',
      sortDirection: 'desc'
    }
  },
  {
    id: 'provider_held',
    label: 'Provider held',
    filters: {
      search: '',
      status: 'PENDING',
      provider: 'ONHOLD',
      dateFrom: '',
      dateTo: '',
      pageSize: '50',
      sortBy: 'updatedAt',
      sortDirection: 'desc'
    }
  },
  {
    id: 'unclaimed',
    label: 'Unclaimed',
    filters: {
      search: '',
      status: 'PENDING',
      provider: 'UNCLAIMED',
      dateFrom: '',
      dateTo: '',
      pageSize: '50',
      sortBy: 'updatedAt',
      sortDirection: 'desc'
    }
  },
  {
    id: 'failed',
    label: 'Failed',
    filters: {
      search: '',
      status: 'FAILED',
      provider: 'ALL',
      dateFrom: '',
      dateTo: '',
      pageSize: '50',
      sortBy: 'updatedAt',
      sortDirection: 'desc'
    }
  }
];

function readSavedViewsFromStorage() {
  if (typeof window === 'undefined') {
    return { invoice: [], payout: [] };
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(SAVED_VIEWS_STORAGE_KEY) || '{}');
    return {
      invoice: Array.isArray(parsed.invoice) ? parsed.invoice : [],
      payout: Array.isArray(parsed.payout) ? parsed.payout : []
    };
  } catch (_error) {
    return { invoice: [], payout: [] };
  }
}

export function readSavedViewsForType(type) {
  return readSavedViewsFromStorage()[type] || [];
}

export function writeSavedViewsForType(type, views) {
  if (typeof window === 'undefined') {
    return;
  }

  const stored = readSavedViewsFromStorage();
  window.localStorage.setItem(
    SAVED_VIEWS_STORAGE_KEY,
    JSON.stringify({
      ...stored,
      [type]: views
    })
  );
}

export function createEmptyLineItem() {
  return {
    name: '',
    description: '',
    quantity: 1,
    unitAmount: ''
  };
}

export function createEmptyTemplateForm() {
  return {
    name: '',
    description: '',
    currency_code: 'USD',
    default_due_days: '',
    is_active: true,
    line_items: [createEmptyLineItem()]
  };
}

export function createEmptyInvoiceComposer() {
  return {
    recipientEmail: '',
    templateId: '',
    description: '',
    currency: 'USD',
    issueDate: '',
    dueDate: '',
    items: [createEmptyLineItem()]
  };
}

export function createEmptyPayoutComposer() {
  return {
    receiver: '',
    recipientType: 'EMAIL',
    receiverCountryCode: 'US',
    amount: '',
    currency: 'USD',
    note: ''
  };
}

export function getInitialSearchParam(searchParams, key, fallback = '') {
  return searchParams.get(key) || fallback;
}

export function getInitialPageParam(searchParams, key, fallback = 1) {
  const page = Number(searchParams.get(key));
  return Number.isInteger(page) && page > 0 ? page : fallback;
}

export function setSearchParamIfChanged(params, key, value, fallback = '') {
  const normalized = typeof value === 'number' ? String(value) : value || '';
  if (!normalized || normalized === fallback || normalized === 'ALL') {
    params.delete(key);
    return;
  }

  params.set(key, normalized);
}

export function buildReminderDrafts(configurations) {
  return Object.fromEntries(
    configurations.map((configuration) => [
      configuration.id,
      {
        type: configuration.type || 'BEFORE_DUE',
        unit: configuration.interval?.unit || 'DAY',
        value: String(configuration.interval?.value || 1),
        repetition: String(configuration.repetition || 1),
        send_to_invoicer: Boolean(configuration.notification?.send_to_invoicer)
      }
    ])
  );
}

export function formatDateTime(value) {
  if (!value) {
    return 'Not synced';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export function parseMoneyToCents(value) {
  if (value === '' || value === null || typeof value === 'undefined') {
    return 0;
  }

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  return Math.round(amount * 100);
}

export function formatCents(cents, currency = 'USD') {
  return `${(Number(cents || 0) / 100).toFixed(2)} ${currency}`;
}

export function formatCurrencyMajor(cents) {
  return (Number(cents || 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function calculateLineItemSubtotalCents(item) {
  const quantity = Number(item?.quantity || 0);
  const unitAmountCents = parseMoneyToCents(item?.unitAmount);
  if (!Number.isFinite(quantity) || quantity <= 0 || unitAmountCents <= 0) {
    return 0;
  }

  return Math.round(quantity * unitAmountCents);
}

export function calculateLineItemsTotalCents(items = []) {
  return items.reduce((sum, item) => sum + calculateLineItemSubtotalCents(item), 0);
}

export function getWalletAvailableCents(profile) {
  return Number(
    profile?.wallet?.availableBalanceCents ??
      profile?.wallet?.available_balance_cents ??
      profile?.wallet?.available_balance ??
      0
  );
}

export function getWalletBucketCents(profile, camelKey, snakeKey) {
  return Number(profile?.wallet?.[camelKey] ?? profile?.wallet?.[snakeKey] ?? 0);
}

export function getPayoutPricingPreview(composer, config, profile) {
  const amountCents = parseMoneyToCents(composer.amount);
  const currency = (composer.currency || 'USD').trim().toUpperCase();
  const fixedFeeCents = Number(config?.payout_fee_fixed_cents || 0);
  const percentageBps = Number(config?.payout_fee_percentage_bps || 0);
  const percentageFeeCents = Math.round(amountCents * (percentageBps / 10000));
  const feeCents = fixedFeeCents + percentageFeeCents;
  const totalDebitCents = amountCents + feeCents;
  const manualReviewCents = Number(config?.payout_manual_review_cents || 0);
  const minimumCents = Number(config?.payout_minimum_cents || 0);
  const availableCents = getWalletAvailableCents(profile);
  const likelyReviewPath =
    amountCents <= 0
      ? 'Enter amount'
      : minimumCents > 0 && amountCents < minimumCents
        ? 'Below minimum'
        : manualReviewCents > 0 && amountCents >= manualReviewCents
          ? 'Manual review likely'
          : 'Auto-processing likely';

  return {
    amountCents,
    currency,
    feeCents,
    totalDebitCents,
    availableCents,
    remainingAvailableCents: availableCents - totalDebitCents,
    likelyReviewPath
  };
}

export function getTopUpOrderTone(status) {
  if (status === 'completed') {
    return 'green';
  }
  if (status === 'cancelled') {
    return 'red';
  }
  if (status === 'awaiting_confirmation') {
    return 'amber';
  }
  return 'blue';
}
