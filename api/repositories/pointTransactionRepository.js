const { randomUUID } = require('node:crypto');
const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function mapTransaction(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    user_id: row.user_id,
    type: row.type,
    amount: row.amount,
    description: row.description,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
    created_at: row.created_at
  };
}

async function create(data, client = db) {
  const id = data.id || randomUUID();
  const createdAt = data.createdAt || new Date().toISOString();
  await client.run(
    `
      INSERT INTO points_transactions (id, user_id, type, amount, description, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      data.userId,
      data.type,
      data.amount,
      data.description,
      serializeJson(data.metadata || {}),
      createdAt
    ]
  );

  const row = await client.get('SELECT * FROM points_transactions WHERE id = ?', [id]);
  return mapTransaction(row);
}

async function findByUserId(userId, client = db) {
  const rows = await client.all(
    'SELECT * FROM points_transactions WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows.map(mapTransaction);
}

module.exports = {
  pointTransactionRepository: {
    create,
    findByUserId
  }
};
