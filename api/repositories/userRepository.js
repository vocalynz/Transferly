const { db } = require('../db');
const { profileRepository } = require('./profileRepository');
const { walletRepository } = require('./walletRepository');

function mapUser(row, wallet) {
  if (!row) {
    return null;
  }

  const profile = row.profile || null;

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    countryCode: row.country_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    name: profile?.name || row.display_name || null,
    points: profile?.points ?? 0,
    referral_count: profile?.referral_count ?? profile?.referralCount ?? 0,
    referral_code: profile?.referral_code ?? profile?.referralCode ?? null,
    is_admin: profile?.is_admin ?? profile?.isAdmin ?? false,
    receipt_count: row.receipt_count ?? 0,
    profile,
    wallet
  };
}

async function findById(userId, client = db) {
  const row = await client.get('SELECT * FROM users WHERE id = ?', [userId]);
  if (!row) {
    return null;
  }

  const wallet = await walletRepository.findByUserId(userId, client);
  const profile = await profileRepository.findByUserId(userId, client);
  return mapUser({ ...row, profile }, wallet);
}

async function findByEmail(email, client = db) {
  const row = await client.get('SELECT * FROM users WHERE lower(email) = lower(?)', [email]);
  if (!row) {
    return null;
  }

  const wallet = await walletRepository.findByUserId(row.id, client);
  const profile = await profileRepository.findByUserId(row.id, client);
  return mapUser({ ...row, profile }, wallet);
}

async function upsert(data, client = db) {
  const now = new Date().toISOString();

  await client.run(
    `
      INSERT INTO users (id, email, display_name, country_code, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        display_name = excluded.display_name,
        country_code = excluded.country_code,
        updated_at = excluded.updated_at
    `,
    [data.id, data.email.toLowerCase(), data.displayName || null, data.countryCode || null, now, now]
  );

  return findById(data.id, client);
}

async function deleteById(userId, client = db) {
  await client.run('DELETE FROM users WHERE id = ?', [userId]);
}

async function findAll(client = db) {
  const rows = await client.all(
    `
      SELECT
        u.*,
        p.name AS profile_name,
        p.is_admin AS profile_is_admin,
        p.points AS profile_points,
        p.referral_code AS profile_referral_code,
        p.referred_by_user_id AS profile_referred_by_user_id,
        p.referral_count AS profile_referral_count,
        p.telegram_chat_id AS profile_telegram_chat_id,
        p.telegram_username AS profile_telegram_username,
        p.created_at AS profile_created_at,
        p.updated_at AS profile_updated_at,
        COUNT(r.id) AS receipt_count
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      LEFT JOIN receipts r ON r.user_id = u.id
      GROUP BY
        u.id,
        u.email,
        u.display_name,
        u.country_code,
        u.created_at,
        u.updated_at,
        p.name,
        p.is_admin,
        p.points,
        p.referral_code,
        p.referred_by_user_id,
        p.referral_count,
        p.telegram_chat_id,
        p.telegram_username,
        p.created_at,
        p.updated_at
      ORDER BY u.created_at DESC
    `
  );

  return Promise.all(
    rows.map(async (row) => {
      const wallet = await walletRepository.findByUserId(row.id, client);
      return mapUser(
        {
          ...row,
          profile: row.profile_name
            ? {
                userId: row.id,
                name: row.profile_name,
                isAdmin: Boolean(row.profile_is_admin),
                is_admin: Boolean(row.profile_is_admin),
                points: row.profile_points,
                referralCode: row.profile_referral_code,
                referral_code: row.profile_referral_code,
                referredByUserId: row.profile_referred_by_user_id,
                referred_by_user_id: row.profile_referred_by_user_id,
                referralCount: row.profile_referral_count,
                referral_count: row.profile_referral_count,
                telegramChatId: row.profile_telegram_chat_id,
                telegram_chat_id: row.profile_telegram_chat_id,
                telegramUsername: row.profile_telegram_username,
                telegram_username: row.profile_telegram_username,
                createdAt: row.profile_created_at,
                updatedAt: row.profile_updated_at,
                created_at: row.profile_created_at,
                updated_at: row.profile_updated_at
              }
            : null
        },
        wallet
      );
    })
  );
}

module.exports = {
  userRepository: {
    findById,
    findByEmail,
    upsert,
    deleteById,
    findAll
  }
};
