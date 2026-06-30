const { randomUUID } = require('node:crypto');

const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function mapPayoutBatch(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    senderBatchId: row.sender_batch_id,
    paypalPayoutBatchId: row.paypal_payout_batch_id,
    status: row.status,
    batchCurrencyCode: row.batch_currency_code,
    rawResponse: parseJson(row.raw_response_json, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function upsertBySenderBatchId(data, client = db) {
  const existing = await client.get('SELECT * FROM payout_batches WHERE sender_batch_id = ?', [data.senderBatchId]);
  const now = new Date().toISOString();

  if (existing) {
    await client.run(
      `
        UPDATE payout_batches
        SET paypal_payout_batch_id = ?, status = ?, batch_currency_code = ?, raw_response_json = ?, updated_at = ?
        WHERE sender_batch_id = ?
      `,
      [
        data.paypalPayoutBatchId || null,
        data.status,
        data.batchCurrencyCode,
        serializeJson(data.rawResponse),
        now,
        data.senderBatchId
      ]
    );
  } else {
    await client.run(
      `
        INSERT INTO payout_batches (
          id, sender_batch_id, paypal_payout_batch_id, status, batch_currency_code, raw_response_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        randomUUID(),
        data.senderBatchId,
        data.paypalPayoutBatchId || null,
        data.status,
        data.batchCurrencyCode,
        serializeJson(data.rawResponse),
        now,
        now
      ]
    );
  }

  const row = await client.get('SELECT * FROM payout_batches WHERE sender_batch_id = ?', [data.senderBatchId]);
  return mapPayoutBatch(row);
}

module.exports = {
  payoutBatchRepository: {
    upsertBySenderBatchId
  }
};
