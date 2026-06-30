const { randomUUID } = require('node:crypto');

const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

const providerPrefixes = ['paypal', 'stripe', 'crypto', 'paystack', 'flutterwave', 'wise'];

function mapWebhookEvent(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    eventId: row.event_id,
    eventType: row.event_type,
    resourceType: row.resource_type,
    transmissionId: row.transmission_id,
    status: row.status,
    payload: parseJson(row.payload_json, {}),
    verificationPayload: parseJson(row.verification_payload_json, null),
    processingAttempts: row.processing_attempts,
    lastError: row.last_error,
    processedAt: row.processed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function findByEventId(eventId, client = db) {
  const row = await client.get('SELECT * FROM webhook_events WHERE event_id = ?', [eventId]);
  return mapWebhookEvent(row);
}

async function findById(id, client = db) {
  const row = await client.get('SELECT * FROM webhook_events WHERE id = ?', [id]);
  return mapWebhookEvent(row);
}

async function findByIdentifier(identifier, client = db) {
  const row = await client.get('SELECT * FROM webhook_events WHERE id = ? OR event_id = ?', [identifier, identifier]);
  return mapWebhookEvent(row);
}

async function findMany(filters = {}, client = db) {
  const clauses = [];
  const params = [];

  if (filters.status) {
    clauses.push('status = ?');
    params.push(filters.status);
  }
  if (filters.eventType) {
    clauses.push('event_type = ?');
    params.push(filters.eventType);
  }
  if (filters.provider) {
    const provider = String(filters.provider).toLowerCase();
    if (provider === 'paypal') {
      clauses.push(`(
        lower(event_id) LIKE 'paypal:%'
        OR lower(payload_json) LIKE ?
        OR (${providerPrefixes.map(() => 'lower(event_id) NOT LIKE ?').join(' AND ')}
          AND lower(payload_json) NOT LIKE '%"provider":%')
      )`);
      params.push('%"provider":"paypal"%');
      providerPrefixes.forEach((prefix) => params.push(`${prefix}:%`));
    } else {
      clauses.push('(lower(event_id) LIKE ? OR lower(payload_json) LIKE ?)');
      params.push(`${provider}:%`, `%"provider":"${provider}"%`);
    }
  }

  let sql = 'SELECT * FROM webhook_events';
  if (clauses.length) {
    sql += ` WHERE ${clauses.join(' AND ')}`;
  }
  sql += ' ORDER BY created_at DESC';

  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  const rows = await client.all(sql, params);
  return rows.map(mapWebhookEvent);
}

async function create(data, client = db) {
  const now = new Date().toISOString();
  const id = data.id || randomUUID();

  await client.run(
    `
      INSERT INTO webhook_events (
        id, event_id, event_type, resource_type, transmission_id, status, payload_json,
        verification_payload_json, processing_attempts, last_error, processed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      data.eventId,
      data.eventType,
      data.resourceType || null,
      data.transmissionId || null,
      data.status,
      serializeJson(data.payload),
      serializeJson(data.verificationPayload),
      data.processingAttempts || 0,
      data.lastError || null,
      data.processedAt || null,
      now,
      now
    ]
  );

  return findById(id, client);
}

async function update(id, updates, client = db) {
  const fields = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(updates, 'status')) {
    fields.push('status = ?');
    params.push(updates.status);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'verificationPayload')) {
    fields.push('verification_payload_json = ?');
    params.push(serializeJson(updates.verificationPayload));
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'processingAttempts')) {
    fields.push('processing_attempts = ?');
    params.push(updates.processingAttempts);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'lastError')) {
    fields.push('last_error = ?');
    params.push(updates.lastError);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'processedAt')) {
    fields.push('processed_at = ?');
    params.push(updates.processedAt);
  }

  fields.push('updated_at = ?');
  params.push(new Date().toISOString(), id);

  await client.run(`UPDATE webhook_events SET ${fields.join(', ')} WHERE id = ?`, params);
  return findById(id, client);
}

module.exports = {
  webhookEventRepository: {
    create,
    findByEventId,
    findById,
    findByIdentifier,
    findMany,
    update
  }
};
