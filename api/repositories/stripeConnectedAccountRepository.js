const { randomUUID } = require('node:crypto');

const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function mapStripeConnectedAccount(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    stripeAccountId: row.stripe_account_id,
    email: row.email,
    countryCode: row.country_code,
    businessType: row.business_type,
    status: row.status,
    chargesEnabled: Boolean(row.charges_enabled),
    payoutsEnabled: Boolean(row.payouts_enabled),
    detailsSubmitted: Boolean(row.details_submitted),
    requirements: parseJson(row.requirements_json, {}),
    capabilities: parseJson(row.capabilities_json, {}),
    disabledReason: row.disabled_reason,
    metadata: parseJson(row.metadata_json, {}),
    createdByActorId: row.created_by_actor_id,
    lastOnboardingLinkCreatedAt: row.last_onboarding_link_created_at,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function findMany(filters = {}, client = db) {
  const clauses = [];
  const params = [];

  if (filters.userId) {
    clauses.push('user_id = ?');
    params.push(filters.userId);
  }
  if (filters.status) {
    clauses.push('status = ?');
    params.push(filters.status);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await client.all(
    `SELECT * FROM stripe_connected_accounts ${whereClause} ORDER BY updated_at DESC, created_at DESC`,
    params
  );
  return rows.map(mapStripeConnectedAccount);
}

async function findById(id, client = db) {
  const row = await client.get('SELECT * FROM stripe_connected_accounts WHERE id = ?', [id]);
  return mapStripeConnectedAccount(row);
}

async function findByStripeAccountId(stripeAccountId, client = db) {
  const row = await client.get('SELECT * FROM stripe_connected_accounts WHERE stripe_account_id = ?', [
    stripeAccountId
  ]);
  return mapStripeConnectedAccount(row);
}

async function upsert(data, client = db) {
  const now = new Date().toISOString();
  const existing = await findByStripeAccountId(data.stripeAccountId, client);

  if (existing) {
    await client.run(
      `
        UPDATE stripe_connected_accounts
        SET user_id = ?, email = ?, country_code = ?, business_type = ?, status = ?, charges_enabled = ?,
            payouts_enabled = ?, details_submitted = ?, requirements_json = ?, capabilities_json = ?,
            disabled_reason = ?, metadata_json = ?, created_by_actor_id = COALESCE(created_by_actor_id, ?),
            last_onboarding_link_created_at = ?, last_synced_at = ?, updated_at = ?
        WHERE stripe_account_id = ?
      `,
      [
        data.userId || existing.userId || null,
        data.email || null,
        data.countryCode || null,
        data.businessType || null,
        data.status,
        data.chargesEnabled ? 1 : 0,
        data.payoutsEnabled ? 1 : 0,
        data.detailsSubmitted ? 1 : 0,
        serializeJson(data.requirements || {}),
        serializeJson(data.capabilities || {}),
        data.disabledReason || null,
        serializeJson(data.metadata || {}),
        data.createdByActorId || null,
        data.lastOnboardingLinkCreatedAt || existing.lastOnboardingLinkCreatedAt || null,
        data.lastSyncedAt || now,
        now,
        data.stripeAccountId
      ]
    );
    return findByStripeAccountId(data.stripeAccountId, client);
  }

  const id = data.id || randomUUID();
  await client.run(
    `
      INSERT INTO stripe_connected_accounts (
        id, user_id, stripe_account_id, email, country_code, business_type, status, charges_enabled,
        payouts_enabled, details_submitted, requirements_json, capabilities_json, disabled_reason,
        metadata_json, created_by_actor_id, last_onboarding_link_created_at, last_synced_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      data.userId || null,
      data.stripeAccountId,
      data.email || null,
      data.countryCode || null,
      data.businessType || null,
      data.status,
      data.chargesEnabled ? 1 : 0,
      data.payoutsEnabled ? 1 : 0,
      data.detailsSubmitted ? 1 : 0,
      serializeJson(data.requirements || {}),
      serializeJson(data.capabilities || {}),
      data.disabledReason || null,
      serializeJson(data.metadata || {}),
      data.createdByActorId || null,
      data.lastOnboardingLinkCreatedAt || null,
      data.lastSyncedAt || now,
      now,
      now
    ]
  );

  return findById(id, client);
}

async function markOnboardingLinkCreated(id, client = db) {
  const now = new Date().toISOString();
  await client.run('UPDATE stripe_connected_accounts SET last_onboarding_link_created_at = ?, updated_at = ? WHERE id = ?', [
    now,
    now,
    id
  ]);
  return findById(id, client);
}

module.exports = {
  stripeConnectedAccountRepository: {
    findMany,
    findById,
    findByStripeAccountId,
    upsert,
    markOnboardingLinkCreated
  }
};
