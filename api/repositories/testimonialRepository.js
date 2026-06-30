const { randomUUID } = require('node:crypto');
const { db } = require('../db');

function mapTestimonial(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    role: row.role,
    avatar: row.avatar,
    content: row.content,
    rating: row.rating,
    order_index: row.order_index,
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
    clientName: row.name,
    clientCountry: row.role,
    starRating: row.rating
  };
}

async function findAll(options = {}, client = db) {
  const params = [];
  let sql = 'SELECT * FROM testimonials';

  if (options.onlyActive) {
    sql += ' WHERE is_active = 1';
  }

  sql += ' ORDER BY order_index ASC, created_at ASC';
  const rows = await client.all(sql, params);
  return rows.map(mapTestimonial);
}

async function findById(id, client = db) {
  const row = await client.get('SELECT * FROM testimonials WHERE id = ?', [id]);
  return mapTestimonial(row);
}

async function create(data, client = db) {
  const now = new Date().toISOString();
  const id = data.id || randomUUID();
  await client.run(
    `
      INSERT INTO testimonials (id, name, role, avatar, content, rating, order_index, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      data.name,
      data.role,
      data.avatar || null,
      data.content,
      data.rating ?? 5,
      data.order_index ?? 0,
      data.is_active === false ? 0 : 1,
      now,
      now
    ]
  );

  const row = await client.get('SELECT * FROM testimonials WHERE id = ?', [id]);
  return mapTestimonial(row);
}

async function update(id, updates, client = db) {
  const existing = await client.get('SELECT * FROM testimonials WHERE id = ?', [id]);
  if (!existing) {
    return null;
  }

  await client.run(
    `
      UPDATE testimonials
      SET
        name = ?,
        role = ?,
        avatar = ?,
        content = ?,
        rating = ?,
        order_index = ?,
        is_active = ?,
        updated_at = ?
      WHERE id = ?
    `,
    [
      updates.name ?? existing.name,
      updates.role ?? existing.role,
      updates.avatar ?? existing.avatar,
      updates.content ?? existing.content,
      updates.rating ?? existing.rating,
      updates.order_index ?? existing.order_index,
      updates.is_active === undefined ? existing.is_active : updates.is_active ? 1 : 0,
      new Date().toISOString(),
      id
    ]
  );

  const row = await client.get('SELECT * FROM testimonials WHERE id = ?', [id]);
  return mapTestimonial(row);
}

async function remove(id, client = db) {
  await client.run('DELETE FROM testimonials WHERE id = ?', [id]);
}

module.exports = {
  testimonialRepository: {
    findAll,
    findById,
    create,
    update,
    remove
  }
};
