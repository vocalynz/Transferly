const { randomUUID } = require('node:crypto');

const { db } = require('../db');

function mapWallet(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    currencyCode: row.currency_code,
    pendingBalanceCents: row.pending_balance_cents,
    availableBalanceCents: row.available_balance_cents,
    frozenBalanceCents: row.frozen_balance_cents,
    paidOutBalanceCents: row.paid_out_balance_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function findByUserId(userId, client = db) {
  const row = await client.get('SELECT * FROM wallets WHERE user_id = ?', [userId]);
  return mapWallet(row);
}

async function getOrCreate(client, userId, currencyCode) {
  const existing = await findByUserId(userId, client);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  await client.run(
    `
      INSERT INTO wallets (
        id, user_id, currency_code, pending_balance_cents, available_balance_cents,
        frozen_balance_cents, paid_out_balance_cents, created_at, updated_at
      ) VALUES (?, ?, ?, 0, 0, 0, 0, ?, ?)
    `,
    [randomUUID(), userId, currencyCode, now, now]
  );

  return findByUserId(userId, client);
}

async function updateBalances(client, walletId, balances) {
  const fields = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(balances, 'pendingBalanceCents')) {
    fields.push('pending_balance_cents = ?');
    params.push(balances.pendingBalanceCents);
  }
  if (Object.prototype.hasOwnProperty.call(balances, 'availableBalanceCents')) {
    fields.push('available_balance_cents = ?');
    params.push(balances.availableBalanceCents);
  }
  if (Object.prototype.hasOwnProperty.call(balances, 'frozenBalanceCents')) {
    fields.push('frozen_balance_cents = ?');
    params.push(balances.frozenBalanceCents);
  }
  if (Object.prototype.hasOwnProperty.call(balances, 'paidOutBalanceCents')) {
    fields.push('paid_out_balance_cents = ?');
    params.push(balances.paidOutBalanceCents);
  }

  fields.push('updated_at = ?');
  params.push(new Date().toISOString(), walletId);

  await client.run(`UPDATE wallets SET ${fields.join(', ')} WHERE id = ?`, params);
  const row = await client.get('SELECT * FROM wallets WHERE id = ?', [walletId]);
  return mapWallet(row);
}

async function seedBalances(client, userId, currencyCode, balances) {
  const wallet = await getOrCreate(client, userId, currencyCode);
  return updateBalances(client, wallet.id, {
    pendingBalanceCents: balances.pendingBalanceCents,
    availableBalanceCents: balances.availableBalanceCents,
    frozenBalanceCents: balances.frozenBalanceCents,
    paidOutBalanceCents: balances.paidOutBalanceCents
  });
}

module.exports = {
  walletRepository: {
    findByUserId,
    getOrCreate,
    updateBalances,
    seedBalances
  }
};
