const { randomUUID } = require('node:crypto');

const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function mapRiskFlag(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    invoiceId: row.invoice_id,
    payoutId: row.payout_id,
    ruleCode: row.rule_code,
    severity: row.severity,
    status: row.status,
    reason: row.reason,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
    resolvedAt: row.resolved_at
  };
}

async function createMany(flags, client = db) {
  if (!flags.length) {
    return;
  }

  const now = new Date().toISOString();
  for (const flag of flags) {
    await client.run(
      `
        INSERT INTO risk_flags (
          id, user_id, invoice_id, payout_id, rule_code, severity, status, reason, metadata_json, created_at, resolved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        randomUUID(),
        flag.userId || null,
        flag.invoiceId || null,
        flag.payoutId || null,
        flag.ruleCode,
        flag.severity,
        flag.status || 'OPEN',
        flag.reason,
        serializeJson(flag.metadata || {}),
        now,
        flag.resolvedAt || null
      ]
    );
  }
}

async function findMany(filters = {}, client = db) {
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
  if (filters.severity) {
    clauses.push('severity = ?');
    params.push(filters.severity);
  }

  let sql = 'SELECT * FROM risk_flags';
  if (clauses.length) {
    sql += ` WHERE ${clauses.join(' AND ')}`;
  }
  sql += ' ORDER BY created_at DESC';

  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  const rows = await client.all(sql, params);
  return rows.map(mapRiskFlag);
}

module.exports = {
  riskFlagRepository: {
    createMany,
    findMany
  }
};
