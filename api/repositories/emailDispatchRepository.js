const { randomUUID } = require('node:crypto');
const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function mapDispatch(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    receiptId: row.receipt_id,
    toEmail: row.to_email,
    subject: row.subject,
    bodyText: row.body_text,
    status: row.status,
    providerReference: row.provider_reference,
    response: parseJson(row.response_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function create(data, client = db) {
  const now = new Date().toISOString();
  const id = data.id || randomUUID();
  await client.run(
    `
      INSERT INTO email_dispatches (
        id, user_id, receipt_id, to_email, subject, body_text, status,
        provider_reference, response_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      data.userId,
      data.receiptId,
      data.toEmail,
      data.subject,
      data.bodyText,
      data.status,
      data.providerReference || null,
      serializeJson(data.response || {}),
      now,
      now
    ]
  );

  const row = await client.get('SELECT * FROM email_dispatches WHERE id = ?', [id]);
  return mapDispatch(row);
}

async function update(dispatchId, updates, client = db) {
  const existing = await client.get('SELECT * FROM email_dispatches WHERE id = ?', [dispatchId]);
  if (!existing) {
    return null;
  }

  await client.run(
    `
      UPDATE email_dispatches
      SET
        status = ?,
        provider_reference = ?,
        response_json = ?,
        updated_at = ?
      WHERE id = ?
    `,
    [
      updates.status ?? existing.status,
      updates.providerReference ?? existing.provider_reference,
      serializeJson(updates.response ?? parseJson(existing.response_json, {})),
      new Date().toISOString(),
      dispatchId
    ]
  );

  const row = await client.get('SELECT * FROM email_dispatches WHERE id = ?', [dispatchId]);
  return mapDispatch(row);
}

module.exports = {
  emailDispatchRepository: {
    create,
    update
  }
};
