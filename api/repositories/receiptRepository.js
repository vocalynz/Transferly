const { randomUUID } = require('node:crypto');
const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function mapReceipt(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    user_id: row.user_id,
    type: row.type,
    status: row.status,
    title: row.title,
    summary: parseJson(row.summary_json, {}),
    data: parseJson(row.data_json, {}),
    pdfBase64: row.pdf_base64,
    pdf_base64: row.pdf_base64,
    imageDataUrl: row.image_data_url,
    image_data_url: row.image_data_url,
    emailTo: row.email_to,
    email_to: row.email_to,
    costPoints: row.cost_points,
    cost_points: row.cost_points,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function create(data, client = db) {
  const now = new Date().toISOString();
  const id = data.id || randomUUID();
  await client.run(
    `
      INSERT INTO receipts (
        id, user_id, type, status, title, summary_json, data_json, pdf_base64, image_data_url,
        email_to, cost_points, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      data.userId,
      data.type,
      data.status,
      data.title,
      serializeJson(data.summary || {}),
      serializeJson(data.data || {}),
      data.pdfBase64,
      data.imageDataUrl,
      data.emailTo || null,
      data.costPoints ?? 0,
      now,
      now
    ]
  );

  const row = await client.get('SELECT * FROM receipts WHERE id = ?', [id]);
  return mapReceipt(row);
}

async function findById(receiptId, client = db) {
  const row = await client.get('SELECT * FROM receipts WHERE id = ?', [receiptId]);
  return mapReceipt(row);
}

async function findByUserId(userId, client = db) {
  const rows = await client.all('SELECT * FROM receipts WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  return rows.map(mapReceipt);
}

async function update(receiptId, updates, client = db) {
  const existing = await findById(receiptId, client);
  if (!existing) {
    return null;
  }

  await client.run(
    `
      UPDATE receipts
      SET
        status = ?,
        title = ?,
        summary_json = ?,
        data_json = ?,
        pdf_base64 = ?,
        image_data_url = ?,
        email_to = ?,
        cost_points = ?,
        updated_at = ?
      WHERE id = ?
    `,
    [
      updates.status ?? existing.status,
      updates.title ?? existing.title,
      serializeJson(updates.summary ?? existing.summary),
      serializeJson(updates.data ?? existing.data),
      updates.pdfBase64 ?? existing.pdfBase64,
      updates.imageDataUrl ?? existing.imageDataUrl,
      updates.emailTo ?? existing.emailTo,
      updates.costPoints ?? existing.costPoints,
      new Date().toISOString(),
      receiptId
    ]
  );

  return findById(receiptId, client);
}

module.exports = {
  receiptRepository: {
    create,
    findById,
    findByUserId,
    update
  }
};
