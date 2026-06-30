const { randomUUID } = require('node:crypto');
const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function mapEvent(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    referrerUserId: row.referrer_user_id,
    referrer_user_id: row.referrer_user_id,
    referredUserId: row.referred_user_id,
    referred_user_id: row.referred_user_id,
    referralCode: row.referral_code,
    referral_code: row.referral_code,
    bonusPoints: row.bonus_points,
    bonus_points: row.bonus_points,
    status: row.status,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
    created_at: row.created_at
  };
}

async function create(data, client = db) {
  const id = data.id || randomUUID();
  const createdAt = new Date().toISOString();
  await client.run(
    `
      INSERT INTO referral_events (
        id, referrer_user_id, referred_user_id, referral_code, bonus_points, status, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      data.referrerUserId,
      data.referredUserId,
      data.referralCode,
      data.bonusPoints,
      data.status,
      serializeJson(data.metadata || {}),
      createdAt
    ]
  );

  const row = await client.get('SELECT * FROM referral_events WHERE id = ?', [id]);
  return mapEvent(row);
}

async function findByReferredUserId(userId, client = db) {
  const row = await client.get('SELECT * FROM referral_events WHERE referred_user_id = ?', [userId]);
  return mapEvent(row);
}

async function findByReferrerUserId(userId, client = db) {
  const rows = await client.all(
    'SELECT * FROM referral_events WHERE referrer_user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows.map(mapEvent);
}

module.exports = {
  referralEventRepository: {
    create,
    findByReferredUserId,
    findByReferrerUserId
  }
};
