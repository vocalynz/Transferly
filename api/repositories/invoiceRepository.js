const { randomUUID } = require('node:crypto');

const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function mapInvoice(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    templateId: row.template_id,
    paypalInvoiceId: row.paypal_invoice_id,
    invoiceNumber: row.invoice_number,
    status: row.status,
    amountCents: row.amount_cents,
    currencyCode: row.currency_code,
    recipientEmail: row.recipient_email,
    description: row.description,
    invoiceUrl: row.invoice_url,
    paypalDetails: parseJson(row.paypal_details_json, {}),
    paypalQrDetails: parseJson(row.paypal_qr_details_json, null),
    paypalSyncedAt: row.paypal_synced_at,
    metadata: parseJson(row.metadata_json, {}),
    issueDate: row.issue_date,
    dueDate: row.due_date,
    autoRemindersCancelledAt: row.auto_reminders_cancelled_at,
    paidAt: row.paid_at,
    cancelledAt: row.cancelled_at,
    refundedAt: row.refunded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function create(data, client = db) {
  const now = new Date().toISOString();
  const id = data.id || randomUUID();

  await client.run(
    `
      INSERT INTO invoices (
        id, user_id, template_id, paypal_invoice_id, invoice_number, status, amount_cents, currency_code,
        recipient_email, description, invoice_url, paypal_details_json, paypal_qr_details_json,
        paypal_synced_at, metadata_json, issue_date, due_date, auto_reminders_cancelled_at, paid_at,
        cancelled_at, refunded_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      data.userId,
      data.templateId || null,
      data.paypalInvoiceId,
      data.invoiceNumber,
      data.status,
      data.amountCents,
      data.currencyCode,
      data.recipientEmail,
      data.description || null,
      data.invoiceUrl,
      serializeJson(data.paypalDetails),
      serializeJson(data.paypalQrDetails),
      data.paypalSyncedAt || null,
      serializeJson(data.metadata || {}),
      data.issueDate || null,
      data.dueDate || null,
      data.autoRemindersCancelledAt || null,
      data.paidAt || null,
      data.cancelledAt || null,
      data.refundedAt || null,
      now,
      now
    ]
  );

  return findById(id, client);
}

async function findById(id, client = db) {
  const row = await client.get('SELECT * FROM invoices WHERE id = ?', [id]);
  return mapInvoice(row);
}

async function findByPaypalInvoiceId(paypalInvoiceId, client = db) {
  const row = await client.get('SELECT * FROM invoices WHERE paypal_invoice_id = ?', [paypalInvoiceId]);
  return mapInvoice(row);
}

async function findByIdentifier(identifier, client = db) {
  const row = await client.get(
    `
      SELECT * FROM invoices
      WHERE id = ? OR paypal_invoice_id = ? OR invoice_number = ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [identifier, identifier, identifier]
  );

  return mapInvoice(row);
}

function resolveFindManyArgs(filtersOrClient, maybeClient) {
  if (filtersOrClient && typeof filtersOrClient.all === 'function') {
    return {
      filters: {},
      client: filtersOrClient
    };
  }

  return {
    filters: filtersOrClient || {},
    client: maybeClient || db
  };
}

function resolveInvoiceSort(filters) {
  const sortColumns = {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    amount: 'amount_cents',
    recipient: 'recipient_email',
    status: 'status',
    dueDate: 'due_date'
  };
  const sortBy = sortColumns[filters.sortBy] || sortColumns.createdAt;
  const sortDirection = String(filters.sortDirection || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return `${sortBy} ${sortDirection}`;
}

function buildFindManyWhere(filters) {
  const clauses = [];
  const params = [];

  if (filters.userId) {
    clauses.push('user_id = ?');
    params.push(filters.userId);
  }

  if (filters.status) {
    clauses.push('status = ?');
    params.push(filters.status);
  }

  if (filters.recipient) {
    clauses.push('(lower(recipient_email) LIKE ? OR lower(invoice_number) LIKE ? OR lower(paypal_invoice_id) LIKE ?)');
    const search = `%${String(filters.recipient).toLowerCase()}%`;
    params.push(search, search, search);
  }

  if (filters.provider) {
    const provider = String(filters.provider).toLowerCase();
    if (provider === 'paypal') {
      clauses.push("(metadata_json IS NULL OR metadata_json = '{}' OR lower(metadata_json) LIKE ?)");
      params.push('%"provider":"paypal"%');
    } else {
      clauses.push('lower(metadata_json) LIKE ?');
      params.push(`%"provider":"${provider}"%`);
    }
  }

  if (filters.providerInvoiceId) {
    clauses.push('lower(paypal_invoice_id) LIKE ?');
    params.push(`%${String(filters.providerInvoiceId).toLowerCase()}%`);
  }

  if (filters.templateId) {
    clauses.push('template_id = ?');
    params.push(filters.templateId);
  }

  if (filters.dateFrom) {
    clauses.push('created_at >= ?');
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    clauses.push('created_at <= ?');
    params.push(filters.dateTo);
  }

  return {
    whereClause: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  };
}

async function findMany(filtersOrClient, maybeClient) {
  const { filters, client } = resolveFindManyArgs(filtersOrClient, maybeClient);
  const { whereClause, params } = buildFindManyWhere(filters);
  let sql = `SELECT * FROM invoices ${whereClause} ORDER BY ${resolveInvoiceSort(filters)}`;
  const limit = filters.pageSize || filters.limit;
  if (limit) {
    sql += ' LIMIT ?';
    params.push(limit);
  }
  if (filters.offset) {
    sql += ' OFFSET ?';
    params.push(filters.offset);
  }

  const rows = await client.all(sql, params);
  return rows.map(mapInvoice);
}

async function countMany(filtersOrClient, maybeClient) {
  const { filters, client } = resolveFindManyArgs(filtersOrClient, maybeClient);
  const { whereClause, params } = buildFindManyWhere(filters);
  const row = await client.get(`SELECT COUNT(*) AS count FROM invoices ${whereClause}`, params);
  return row ? Number(row.count || 0) : 0;
}

async function update(id, updates, client = db) {
  const fields = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(updates, 'status')) {
    fields.push('status = ?');
    params.push(updates.status);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'templateId')) {
    fields.push('template_id = ?');
    params.push(updates.templateId);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'paypalDetails')) {
    fields.push('paypal_details_json = ?');
    params.push(serializeJson(updates.paypalDetails));
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'paypalQrDetails')) {
    fields.push('paypal_qr_details_json = ?');
    params.push(serializeJson(updates.paypalQrDetails));
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'paypalSyncedAt')) {
    fields.push('paypal_synced_at = ?');
    params.push(updates.paypalSyncedAt);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'metadata')) {
    fields.push('metadata_json = ?');
    params.push(serializeJson(updates.metadata));
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'invoiceUrl')) {
    fields.push('invoice_url = ?');
    params.push(updates.invoiceUrl);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'paidAt')) {
    fields.push('paid_at = ?');
    params.push(updates.paidAt);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'cancelledAt')) {
    fields.push('cancelled_at = ?');
    params.push(updates.cancelledAt);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'refundedAt')) {
    fields.push('refunded_at = ?');
    params.push(updates.refundedAt);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'dueDate')) {
    fields.push('due_date = ?');
    params.push(updates.dueDate);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'issueDate')) {
    fields.push('issue_date = ?');
    params.push(updates.issueDate);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'autoRemindersCancelledAt')) {
    fields.push('auto_reminders_cancelled_at = ?');
    params.push(updates.autoRemindersCancelledAt);
  }

  fields.push('updated_at = ?');
  params.push(new Date().toISOString(), id);

  await client.run(`UPDATE invoices SET ${fields.join(', ')} WHERE id = ?`, params);
  return findById(id, client);
}

module.exports = {
  invoiceRepository: {
    create,
    findById,
    findByPaypalInvoiceId,
    findByIdentifier,
    findMany,
    countMany,
    update
  }
};
