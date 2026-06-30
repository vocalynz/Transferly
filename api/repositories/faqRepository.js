const { randomUUID } = require('node:crypto');
const { db } = require('../db');

function mapFaq(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    order_index: row.order_index,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function findAll(client = db) {
  const rows = await client.all('SELECT * FROM faqs ORDER BY order_index ASC, created_at ASC');
  return rows.map(mapFaq);
}

async function findById(id, client = db) {
  const row = await client.get('SELECT * FROM faqs WHERE id = ?', [id]);
  return mapFaq(row);
}

async function create(data, client = db) {
  const now = new Date().toISOString();
  const id = data.id || randomUUID();
  await client.run(
    `
      INSERT INTO faqs (id, question, answer, order_index, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [id, data.question, data.answer, data.order_index ?? 0, now, now]
  );

  const row = await client.get('SELECT * FROM faqs WHERE id = ?', [id]);
  return mapFaq(row);
}

async function update(id, updates, client = db) {
  const existing = await client.get('SELECT * FROM faqs WHERE id = ?', [id]);
  if (!existing) {
    return null;
  }

  await client.run(
    `
      UPDATE faqs
      SET question = ?, answer = ?, order_index = ?, updated_at = ?
      WHERE id = ?
    `,
    [
      updates.question ?? existing.question,
      updates.answer ?? existing.answer,
      updates.order_index ?? existing.order_index,
      new Date().toISOString(),
      id
    ]
  );

  const row = await client.get('SELECT * FROM faqs WHERE id = ?', [id]);
  return mapFaq(row);
}

async function remove(id, client = db) {
  await client.run('DELETE FROM faqs WHERE id = ?', [id]);
}

module.exports = {
  faqRepository: {
    findAll,
    findById,
    create,
    update,
    remove
  }
};
