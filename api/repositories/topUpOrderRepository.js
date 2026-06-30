const { randomUUID } = require('node:crypto');
const { db } = require('../db');

function mapOrder(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    orderId: row.id,
    order_id: row.id,
    userId: row.user_id,
    user_id: row.user_id,
    status: row.status,
    points: row.points,
    amountLabel: row.amount_label,
    amount_label: row.amount_label,
    methodId: row.method_id,
    method_id: row.method_id,
    methodTitle: row.method_title,
    method_title: row.method_title,
    serviceIntent: row.service_intent,
    service_intent: row.service_intent,
    instructions: row.instructions,
    vendorUrl: row.vendor_url,
    vendor_url: row.vendor_url,
    notes: row.notes,
    adminNotes: row.admin_notes,
    admin_notes: row.admin_notes,
    submittedAt: row.submitted_at,
    submitted_at: row.submitted_at,
    completedAt: row.completed_at,
    completed_at: row.completed_at,
    cancelledAt: row.cancelled_at,
    cancelled_at: row.cancelled_at,
    createdAt: row.created_at,
    created_at: row.created_at,
    updatedAt: row.updated_at,
    updated_at: row.updated_at
  };
}

async function create(data, client = db) {
  const id = data.id || randomUUID();
  const now = data.createdAt || new Date().toISOString();

  await client.run(
    `
      INSERT INTO top_up_orders (
        id, user_id, status, points, amount_label, method_id, method_title,
        service_intent, instructions, vendor_url, notes, admin_notes,
        submitted_at, completed_at, cancelled_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      data.userId,
      data.status,
      data.points,
      data.amountLabel,
      data.methodId,
      data.methodTitle,
      data.serviceIntent || null,
      data.instructions || null,
      data.vendorUrl || null,
      data.notes || null,
      data.adminNotes || null,
      data.submittedAt || null,
      data.completedAt || null,
      data.cancelledAt || null,
      now,
      now
    ]
  );

  return findById(id, client);
}

async function findById(orderId, client = db) {
  const row = await client.get('SELECT * FROM top_up_orders WHERE id = ?', [orderId]);
  return mapOrder(row);
}

async function findByUserId(userId, client = db) {
  const rows = await client.all(
    'SELECT * FROM top_up_orders WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows.map(mapOrder);
}

async function findMany(filters = {}, client = db) {
  const where = [];
  const params = [];

  if (filters.status) {
    where.push('status = ?');
    params.push(filters.status);
  }

  if (filters.userId) {
    where.push('user_id = ?');
    params.push(filters.userId);
  }

  const limit = Math.min(Number(filters.limit || 100), 250);
  const sql = `
    SELECT * FROM top_up_orders
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY created_at DESC
    LIMIT ?
  `;

  const rows = await client.all(sql, [...params, limit]);
  return rows.map(mapOrder);
}

async function update(orderId, updates, client = db) {
  const existing = await findById(orderId, client);
  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  await client.run(
    `
      UPDATE top_up_orders
      SET
        status = ?,
        points = ?,
        amount_label = ?,
        method_id = ?,
        method_title = ?,
        service_intent = ?,
        instructions = ?,
        vendor_url = ?,
        notes = ?,
        admin_notes = ?,
        submitted_at = ?,
        completed_at = ?,
        cancelled_at = ?,
        updated_at = ?
      WHERE id = ?
    `,
    [
      updates.status ?? existing.status,
      updates.points ?? existing.points,
      updates.amountLabel ?? existing.amountLabel,
      updates.methodId ?? existing.methodId,
      updates.methodTitle ?? existing.methodTitle,
      updates.serviceIntent ?? existing.serviceIntent,
      updates.instructions ?? existing.instructions,
      updates.vendorUrl ?? existing.vendorUrl,
      updates.notes ?? existing.notes,
      updates.adminNotes ?? existing.adminNotes,
      updates.submittedAt ?? existing.submittedAt,
      updates.completedAt ?? existing.completedAt,
      updates.cancelledAt ?? existing.cancelledAt,
      now,
      orderId
    ]
  );

  return findById(orderId, client);
}

module.exports = {
  topUpOrderRepository: {
    create,
    findById,
    findByUserId,
    findMany,
    update
  }
};
