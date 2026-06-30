const { db } = require('../db');

function mapCredential(row) {
  if (!row) {
    return null;
  }

  return {
    userId: row.user_id,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function findByUserId(userId, client = db) {
  const row = await client.get('SELECT * FROM auth_credentials WHERE user_id = ?', [userId]);
  return mapCredential(row);
}

async function upsert(data, client = db) {
  const now = new Date().toISOString();
  const existing = await findByUserId(data.userId, client);

  await client.run(
    `
      INSERT INTO auth_credentials (
        user_id, password_hash, password_salt, last_login_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        password_hash = excluded.password_hash,
        password_salt = excluded.password_salt,
        last_login_at = excluded.last_login_at,
        updated_at = excluded.updated_at
    `,
    [
      data.userId,
      data.passwordHash,
      data.passwordSalt,
      data.lastLoginAt || existing?.lastLoginAt || null,
      existing?.createdAt || now,
      now
    ]
  );

  return findByUserId(data.userId, client);
}

async function touchLastLogin(userId, client = db) {
  const existing = await findByUserId(userId, client);
  if (!existing) {
    return null;
  }

  return upsert(
    {
      userId,
      passwordHash: existing.passwordHash,
      passwordSalt: existing.passwordSalt,
      lastLoginAt: new Date().toISOString()
    },
    client
  );
}

module.exports = {
  authCredentialRepository: {
    findByUserId,
    upsert,
    touchLastLogin
  }
};
