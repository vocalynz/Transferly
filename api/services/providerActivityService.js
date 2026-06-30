const { presentInvoice, presentPayout } = require('../presenters/paymentPresenter');
const { invoiceRepository } = require('../repositories/invoiceRepository');
const { payoutRepository } = require('../repositories/payoutRepository');

function readProviderFromMetadata(record, fallback) {
  return String(record?.metadata?.provider || fallback || 'paypal').toLowerCase();
}

function readActivityTimestamp(entry) {
  const value = entry.updated_at || entry.created_at || '';
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function readActivityId(entry) {
  return String(entry.id || entry.resource_id || entry.provider_id || '');
}

function compareActivity(left, right) {
  const leftTimestamp = readActivityTimestamp(left);
  const rightTimestamp = readActivityTimestamp(right);
  if (leftTimestamp !== rightTimestamp) {
    return rightTimestamp - leftTimestamp;
  }

  const typeCompare = String(left.type || '').localeCompare(String(right.type || ''));
  if (typeCompare !== 0) {
    return typeCompare;
  }

  return readActivityId(left).localeCompare(readActivityId(right));
}

function encodeActivityCursor(entry) {
  if (!entry) {
    return null;
  }

  const payload = {
    ts: readActivityTimestamp(entry),
    type: String(entry.type || ''),
    id: readActivityId(entry)
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeActivityCursor(cursor) {
  if (cursor === undefined || cursor === null || cursor === '') {
    return null;
  }

  if (typeof cursor === 'number') {
    return { legacyOffset: cursor };
  }

  const text = String(cursor);
  if (/^\d+$/.test(text)) {
    return { legacyOffset: Number(text) };
  }

  try {
    const parsed = JSON.parse(Buffer.from(text, 'base64url').toString('utf8'));
    if (Number.isFinite(parsed.ts)) {
      return {
        ts: parsed.ts,
        type: String(parsed.type || ''),
        id: String(parsed.id || '')
      };
    }
  } catch (_error) {
    return null;
  }

  return null;
}

function isAfterCursor(entry, cursor) {
  if (!cursor || !Number.isFinite(cursor.ts)) {
    return true;
  }

  const timestamp = readActivityTimestamp(entry);
  if (timestamp < cursor.ts) return true;
  if (timestamp > cursor.ts) return false;

  const type = String(entry.type || '');
  if (type > cursor.type) return true;
  if (type < cursor.type) return false;

  return readActivityId(entry) > cursor.id;
}

function presentInvoiceActivity(invoice, provider) {
  const presented = presentInvoice(invoice);
  return {
    type: 'invoice',
    resource_type: 'invoice',
    provider: readProviderFromMetadata(invoice, provider),
    id: presented.internal_invoice_id,
    resource_id: presented.internal_invoice_id,
    provider_id: presented.invoice_id,
    status: presented.status,
    amount: presented.summary.amount,
    currency: presented.summary.currency,
    label: presented.summary.description || presented.summary.recipient_email || 'Invoice',
    created_at: presented.summary.created_at,
    updated_at: presented.summary.updated_at,
    data: presented
  };
}

function presentPayoutActivity(payout, provider) {
  const presented = presentPayout(payout);
  return {
    type: 'payout',
    resource_type: 'payout',
    provider: readProviderFromMetadata(payout, provider),
    id: presented.payout_id,
    resource_id: presented.payout_id,
    provider_id: presented.tracking.payout_batch_id || presented.tracking.payout_item_id,
    status: presented.status,
    amount: presented.summary.amount,
    currency: presented.summary.currency,
    label: presented.summary.receiver || 'Payout',
    created_at: presented.summary.created_at,
    updated_at: presented.summary.updated_at,
    data: presented
  };
}

async function listProviderActivity(input = {}) {
  const provider = String(input.provider || '').toLowerCase();
  const type = input.type || 'all';
  const limit = input.limit || 25;
  const cursor = decodeActivityCursor(input.cursor);
  const legacyOffset = cursor?.legacyOffset || 0;
  const queryWindow = Math.min(Math.max(limit * 3, limit + 25), 200);
  const baseFilters = {
    provider,
    status: input.status,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    pageSize: queryWindow + 1,
    offset: legacyOffset,
    sortBy: 'createdAt',
    sortDirection: 'desc',
    userId: input.userId
  };

  const [invoices, payouts] = await Promise.all([
    type === 'payout' ? [] : invoiceRepository.findMany(baseFilters),
    type === 'invoice' ? [] : payoutRepository.findMany(baseFilters)
  ]);

  const items = [
    ...invoices.map((invoice) => presentInvoiceActivity(invoice, provider)),
    ...payouts.map((payout) => presentPayoutActivity(payout, provider))
  ]
    .sort(compareActivity)
    .filter((entry) => isAfterCursor(entry, cursor))
    .slice(0, limit);
  const sourceHasMore = invoices.length > queryWindow || payouts.length > queryWindow;
  const nextCursor = items.length === limit && (sourceHasMore || items.length < invoices.length + payouts.length)
    ? encodeActivityCursor(items[items.length - 1])
    : null;

  return {
    items,
    pagination: {
      cursor: input.cursor || null,
      cursor_type: 'activity-v1',
      page_size: limit,
      next_cursor: nextCursor,
      has_next_page: Boolean(nextCursor)
    }
  };
}

module.exports = {
  providerActivityService: {
    listProviderActivity
  }
};
