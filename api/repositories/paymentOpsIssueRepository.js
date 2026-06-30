const { randomUUID } = require('node:crypto');

const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function mapPaymentOpsIssue(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    issueType: row.issue_type,
    severity: row.severity,
    status: row.status,
    summary: row.summary,
    metadata: parseJson(row.metadata_json, {}),
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function findById(id, client = db) {
  const row = await client.get('SELECT * FROM payment_ops_issues WHERE id = ?', [id]);
  return mapPaymentOpsIssue(row);
}

async function findMany(filters = {}, client = db) {
  const clauses = [];
  const params = [];

  if (filters.status) {
    clauses.push('status = ?');
    params.push(filters.status);
  }
  if (filters.entityType) {
    clauses.push('entity_type = ?');
    params.push(filters.entityType);
  }
  if (filters.severity) {
    clauses.push('severity = ?');
    params.push(filters.severity);
  }
  if (filters.provider) {
    const provider = String(filters.provider).toLowerCase();
    if (provider === 'paypal') {
      clauses.push("(metadata_json IS NULL OR metadata_json = '{}' OR lower(metadata_json) NOT LIKE '%\"provider\":%' OR lower(metadata_json) LIKE ?)");
      params.push('%"provider":"paypal"%');
    } else {
      clauses.push('lower(metadata_json) LIKE ?');
      params.push(`%"provider":"${provider}"%`);
    }
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  let sql = `SELECT * FROM payment_ops_issues ${whereClause} ORDER BY status ASC, severity DESC, last_seen_at DESC`;
  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  const rows = await client.all(sql, params);
  return rows.map(mapPaymentOpsIssue);
}

async function findByUniqueKey(entityType, entityId, issueType, client = db) {
  const row = await client.get(
    `
      SELECT * FROM payment_ops_issues
      WHERE entity_type = ? AND entity_id = ? AND issue_type = ?
    `,
    [entityType, entityId, issueType]
  );

  return mapPaymentOpsIssue(row);
}

async function upsert(input, client = db) {
  const existing = await findByUniqueKey(input.entityType, input.entityId, input.issueType, client);
  const now = new Date().toISOString();

  if (!existing) {
    const id = input.id || randomUUID();
    await client.run(
      `
        INSERT INTO payment_ops_issues (
          id, entity_type, entity_id, issue_type, severity, status, summary, metadata_json,
          first_seen_at, last_seen_at, resolved_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        input.entityType,
        input.entityId,
        input.issueType,
        input.severity,
        input.status || 'OPEN',
        input.summary,
        serializeJson(input.metadata || {}),
        input.firstSeenAt || now,
        input.lastSeenAt || now,
        input.resolvedAt || null,
        now,
        now
      ]
    );

    return findByUniqueKey(input.entityType, input.entityId, input.issueType, client);
  }

  const nextStatus =
    existing.status === 'ACKNOWLEDGED' && input.status === 'OPEN'
      ? 'ACKNOWLEDGED'
      : input.status || existing.status;
  const nextMetadata = {
    ...(existing.metadata || {}),
    ...(input.metadata || {})
  };
  const nextResolvedAt =
    nextStatus === 'RESOLVED'
      ? (Object.prototype.hasOwnProperty.call(input, 'resolvedAt') ? input.resolvedAt : existing.resolvedAt || now)
      : null;

  await client.run(
    `
      UPDATE payment_ops_issues
      SET severity = ?, status = ?, summary = ?, metadata_json = ?, last_seen_at = ?, resolved_at = ?, updated_at = ?
      WHERE id = ?
    `,
    [
      input.severity ?? existing.severity,
      nextStatus,
      input.summary ?? existing.summary,
      serializeJson(nextMetadata),
      input.lastSeenAt || now,
      nextResolvedAt,
      now,
      existing.id
    ]
  );

  return findByUniqueKey(input.entityType, input.entityId, input.issueType, client);
}

async function resolveIssuesForEntity(entityType, entityId, preservedIssueTypes = [], client = db) {
  const rows = await client.all(
    "SELECT * FROM payment_ops_issues WHERE entity_type = ? AND entity_id = ? AND status IN ('OPEN', 'ACKNOWLEDGED')",
    [entityType, entityId]
  );

  const preserve = new Set(preservedIssueTypes);
  const now = new Date().toISOString();

  for (const row of rows) {
    if (preserve.has(row.issue_type)) {
      continue;
    }

    await client.run(
      `
        UPDATE payment_ops_issues
        SET status = 'RESOLVED', resolved_at = ?, updated_at = ?
        WHERE id = ?
      `,
      [now, now, row.id]
    );
  }
}

async function updateById(id, updates, client = db) {
  const existing = await findById(id, client);
  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  await client.run(
    `
      UPDATE payment_ops_issues
      SET status = ?, summary = ?, metadata_json = ?, last_seen_at = ?, resolved_at = ?, updated_at = ?
      WHERE id = ?
    `,
    [
      updates.status ?? existing.status,
      updates.summary ?? existing.summary,
      serializeJson(updates.metadata ?? existing.metadata),
      updates.lastSeenAt ?? existing.lastSeenAt,
      Object.prototype.hasOwnProperty.call(updates, 'resolvedAt') ? updates.resolvedAt : existing.resolvedAt,
      now,
      id
    ]
  );

  return findById(id, client);
}

module.exports = {
  paymentOpsIssueRepository: {
    findById,
    findMany,
    findByUniqueKey,
    upsert,
    resolveIssuesForEntity,
    updateById
  }
};
