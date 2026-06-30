const { randomUUID } = require('node:crypto');

const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

const payoutSelect = `
  SELECT
    p.*,
    pb.id AS payout_batch_join_id,
    pb.sender_batch_id AS payout_batch_sender_batch_id,
    pb.paypal_payout_batch_id AS payout_batch_paypal_payout_batch_id,
    pb.status AS payout_batch_status,
    pb.batch_currency_code AS payout_batch_currency_code,
    pb.raw_response_json AS payout_batch_raw_response_json,
    pb.created_at AS payout_batch_created_at,
    pb.updated_at AS payout_batch_updated_at
  FROM payouts p
  LEFT JOIN payout_batches pb ON pb.id = p.payout_batch_id
`;

function mapPayout(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    payoutBatchId: row.payout_batch_id,
    idempotencyKey: row.idempotency_key,
    senderBatchId: row.sender_batch_id,
    paypalPayoutItemId: row.paypal_payout_item_id,
    status: row.status,
    riskDecision: row.risk_decision,
    recipientType: row.recipient_type,
    receiver: row.receiver,
    receiverCountryCode: row.receiver_country_code,
    amountCents: row.amount_cents,
    currencyCode: row.currency_code,
    note: row.note,
    failureReason: row.failure_reason,
    metadata: parseJson(row.metadata_json, {}),
    approvedByActorId: row.approved_by_actor_id,
    approvedAt: row.approved_at,
    rejectedAt: row.rejected_at,
    processedAt: row.processed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    payoutBatch: row.payout_batch_join_id
      ? {
          id: row.payout_batch_join_id,
          senderBatchId: row.payout_batch_sender_batch_id,
          paypalPayoutBatchId: row.payout_batch_paypal_payout_batch_id,
          status: row.payout_batch_status,
          batchCurrencyCode: row.payout_batch_currency_code,
          rawResponse: parseJson(row.payout_batch_raw_response_json, null),
          createdAt: row.payout_batch_created_at,
          updatedAt: row.payout_batch_updated_at
        }
      : null
  };
}

async function create(data, client = db) {
  const now = new Date().toISOString();
  const id = data.id || randomUUID();

  await client.run(
    `
      INSERT INTO payouts (
        id, user_id, payout_batch_id, idempotency_key, sender_batch_id, paypal_payout_item_id,
        status, risk_decision, recipient_type, receiver, receiver_country_code, amount_cents,
        currency_code, note, failure_reason, metadata_json, approved_by_actor_id, approved_at,
        rejected_at, processed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      data.userId,
      data.payoutBatchId || null,
      data.idempotencyKey,
      data.senderBatchId,
      data.paypalPayoutItemId || null,
      data.status,
      data.riskDecision,
      data.recipientType,
      data.receiver,
      data.receiverCountryCode || null,
      data.amountCents,
      data.currencyCode,
      data.note || null,
      data.failureReason || null,
      serializeJson(data.metadata || {}),
      data.approvedByActorId || null,
      data.approvedAt || null,
      data.rejectedAt || null,
      data.processedAt || null,
      now,
      now
    ]
  );

  return findById(id, client);
}

async function findById(id, client = db) {
  const row = await client.get(`${payoutSelect} WHERE p.id = ?`, [id]);
  return mapPayout(row);
}

async function findByIdentifier(identifier, client = db) {
  const row = await client.get(
    `
      ${payoutSelect}
      WHERE p.id = ? OR p.sender_batch_id = ? OR p.paypal_payout_item_id = ? OR pb.paypal_payout_batch_id = ?
      ORDER BY p.created_at DESC
      LIMIT 1
    `,
    [identifier, identifier, identifier, identifier]
  );

  return mapPayout(row);
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

function resolvePayoutSort(filters) {
  const sortColumns = {
    createdAt: 'p.created_at',
    updatedAt: 'p.updated_at',
    amount: 'p.amount_cents',
    receiver: 'p.receiver',
    status: 'p.status'
  };
  const sortBy = sortColumns[filters.sortBy] || sortColumns.createdAt;
  const sortDirection = String(filters.sortDirection || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return `${sortBy} ${sortDirection}`;
}

function buildFindManyWhere(filters) {
  const clauses = [];
  const params = [];

  if (filters.userId) {
    clauses.push('p.user_id = ?');
    params.push(filters.userId);
  }
  if (filters.status) {
    clauses.push('p.status = ?');
    params.push(filters.status);
  }
  if (filters.riskDecision) {
    clauses.push('p.risk_decision = ?');
    params.push(filters.riskDecision);
  }
  if (filters.provider) {
    const provider = String(filters.provider).toLowerCase();
    if (provider === 'paypal') {
      clauses.push("(p.metadata_json IS NULL OR p.metadata_json = '{}' OR lower(p.metadata_json) NOT LIKE '%\"provider\":%' OR lower(p.metadata_json) LIKE ?)");
      params.push('%"provider":"paypal"%');
    } else {
      clauses.push('lower(p.metadata_json) LIKE ?');
      params.push(`%"provider":"${provider}"%`);
    }
  }
  if (filters.providerState) {
    clauses.push('(lower(p.metadata_json) LIKE ? OR lower(pb.status) = ?)');
    params.push(`%"provider_item_status":"${String(filters.providerState).toLowerCase()}"%`);
    params.push(String(filters.providerState).toLowerCase());
  }
  if (filters.recipient) {
    clauses.push(
      '(lower(p.receiver) LIKE ? OR lower(p.id) LIKE ? OR lower(p.sender_batch_id) LIKE ? OR lower(COALESCE(pb.paypal_payout_batch_id, \'\')) LIKE ?)'
    );
    const search = `%${String(filters.recipient).toLowerCase()}%`;
    params.push(search, search, search, search);
  }
  if (filters.dateFrom) {
    clauses.push('p.created_at >= ?');
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    clauses.push('p.created_at <= ?');
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
  let sql = `${payoutSelect} ${whereClause} ORDER BY ${resolvePayoutSort(filters)}`;
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
  return rows.map(mapPayout);
}

async function countMany(filtersOrClient, maybeClient) {
  const { filters, client } = resolveFindManyArgs(filtersOrClient, maybeClient);
  const { whereClause, params } = buildFindManyWhere(filters);
  const row = await client.get(
    `
      SELECT COUNT(*) AS count
      FROM payouts p
      LEFT JOIN payout_batches pb ON pb.id = p.payout_batch_id
      ${whereClause}
    `,
    params
  );
  return row ? Number(row.count || 0) : 0;
}

async function findByIdempotencyKey(idempotencyKey, client = db) {
  const row = await client.get(`${payoutSelect} WHERE p.idempotency_key = ?`, [idempotencyKey]);
  return mapPayout(row);
}

async function update(id, updates, client = db) {
  const fields = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(updates, 'payoutBatchId')) {
    fields.push('payout_batch_id = ?');
    params.push(updates.payoutBatchId);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'paypalPayoutItemId')) {
    fields.push('paypal_payout_item_id = ?');
    params.push(updates.paypalPayoutItemId);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'status')) {
    fields.push('status = ?');
    params.push(updates.status);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'approvedByActorId')) {
    fields.push('approved_by_actor_id = ?');
    params.push(updates.approvedByActorId);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'approvedAt')) {
    fields.push('approved_at = ?');
    params.push(updates.approvedAt);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'rejectedAt')) {
    fields.push('rejected_at = ?');
    params.push(updates.rejectedAt);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'processedAt')) {
    fields.push('processed_at = ?');
    params.push(updates.processedAt);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'failureReason')) {
    fields.push('failure_reason = ?');
    params.push(updates.failureReason);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'metadata')) {
    fields.push('metadata_json = ?');
    params.push(serializeJson(updates.metadata));
  }

  fields.push('updated_at = ?');
  params.push(new Date().toISOString(), id);

  await client.run(`UPDATE payouts SET ${fields.join(', ')} WHERE id = ?`, params);
  return findById(id, client);
}

async function findSuccessfulRecipientPayout(userId, receiver, client = db) {
  const row = await client.get(
    `
      SELECT * FROM payouts
      WHERE user_id = ? AND receiver = ? AND status = 'SUCCESS'
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [userId, receiver]
  );

  return mapPayout(row);
}

async function findRecentSimilarPayout(userId, receiver, amountCents, currencyCode, sinceIso, client = db) {
  const row = await client.get(
    `
      SELECT * FROM payouts
      WHERE user_id = ? AND receiver = ? AND amount_cents = ? AND currency_code = ?
        AND created_at >= ?
        AND status IN ('PENDING_APPROVAL', 'QUEUED', 'PROCESSING', 'SUCCESS', 'PENDING')
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [userId, receiver, amountCents, currencyCode, sinceIso]
  );

  return mapPayout(row);
}

async function countUserPayoutsSince(userId, sinceIso, client = db) {
  const row = await client.get('SELECT COUNT(*) AS count FROM payouts WHERE user_id = ? AND created_at >= ?', [
    userId,
    sinceIso
  ]);
  return row ? row.count : 0;
}

async function sumUserPayoutsSince(userId, sinceIso, client = db) {
  const row = await client.get(
    `
      SELECT COALESCE(SUM(amount_cents), 0) AS total
      FROM payouts
      WHERE user_id = ? AND created_at >= ? AND status IN ('QUEUED', 'PROCESSING', 'SUCCESS', 'PENDING', 'PENDING_APPROVAL')
    `,
    [userId, sinceIso]
  );
  return row ? row.total : 0;
}

module.exports = {
  payoutRepository: {
    create,
    countMany,
    findById,
    findByIdentifier,
    findMany,
    findByIdempotencyKey,
    update,
    findSuccessfulRecipientPayout,
    findRecentSimilarPayout,
    countUserPayoutsSince,
    sumUserPayoutsSince
  }
};
