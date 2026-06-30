const { randomUUID } = require('node:crypto');

const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function mapInvoiceTemplate(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    currency_code: row.currency_code,
    default_due_days: row.default_due_days,
    line_items: parseJson(row.line_items_json, []),
    metadata: parseJson(row.metadata_json, {}),
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function findAll(filters = {}, client = db) {
  const clauses = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(filters, 'isActive')) {
    clauses.push('is_active = ?');
    params.push(filters.isActive ? 1 : 0);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await client.all(
    `SELECT * FROM invoice_templates ${whereClause} ORDER BY is_active DESC, updated_at DESC, created_at DESC`,
    params
  );

  return rows.map(mapInvoiceTemplate);
}

async function findById(id, client = db) {
  const row = await client.get('SELECT * FROM invoice_templates WHERE id = ?', [id]);
  return mapInvoiceTemplate(row);
}

async function create(input, client = db) {
  const now = new Date().toISOString();
  const id = input.id || randomUUID();

  await client.run(
    `
      INSERT INTO invoice_templates (
        id, name, description, currency_code, default_due_days, line_items_json, metadata_json, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      input.name,
      input.description || null,
      input.currency_code,
      input.default_due_days ?? null,
      serializeJson(input.line_items || []),
      serializeJson(input.metadata || {}),
      input.is_active === false ? 0 : 1,
      now,
      now
    ]
  );

  return findById(id, client);
}

async function update(id, updates, client = db) {
  const existing = await findById(id, client);
  if (!existing) {
    return null;
  }

  await client.run(
    `
      UPDATE invoice_templates
      SET name = ?, description = ?, currency_code = ?, default_due_days = ?, line_items_json = ?, metadata_json = ?, is_active = ?, updated_at = ?
      WHERE id = ?
    `,
    [
      updates.name ?? existing.name,
      Object.prototype.hasOwnProperty.call(updates, 'description')
        ? updates.description || null
        : existing.description,
      updates.currency_code ?? existing.currency_code,
      Object.prototype.hasOwnProperty.call(updates, 'default_due_days')
        ? updates.default_due_days ?? null
        : existing.default_due_days,
      serializeJson(
        Object.prototype.hasOwnProperty.call(updates, 'line_items') ? updates.line_items : existing.line_items
      ),
      serializeJson(Object.prototype.hasOwnProperty.call(updates, 'metadata') ? updates.metadata : existing.metadata),
      Object.prototype.hasOwnProperty.call(updates, 'is_active')
        ? (updates.is_active ? 1 : 0)
        : (existing.is_active ? 1 : 0),
      new Date().toISOString(),
      id
    ]
  );

  return findById(id, client);
}

async function remove(id, client = db) {
  await client.run('DELETE FROM invoice_templates WHERE id = ?', [id]);
}

module.exports = {
  invoiceTemplateRepository: {
    findAll,
    findById,
    create,
    update,
    remove
  }
};
