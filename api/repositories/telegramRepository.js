const { randomUUID } = require('node:crypto');
const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function mapAccount(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    user_id: row.user_id,
    telegramUserId: row.telegram_user_id,
    telegram_user_id: row.telegram_user_id,
    chatId: row.chat_id,
    chat_id: row.chat_id,
    username: row.username,
    firstName: row.first_name,
    first_name: row.first_name,
    lastName: row.last_name,
    last_name: row.last_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function mapCommandLog(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    telegramUserId: row.telegram_user_id,
    telegram_user_id: row.telegram_user_id,
    chatId: row.chat_id,
    chat_id: row.chat_id,
    command: row.command,
    arguments: parseJson(row.arguments_json, {}),
    response: parseJson(row.response_json, {}),
    status: row.status,
    createdAt: row.created_at,
    created_at: row.created_at
  };
}

async function findAccountByTelegramUserId(telegramUserId, client = db) {
  const row = await client.get('SELECT * FROM telegram_accounts WHERE telegram_user_id = ?', [String(telegramUserId)]);
  return mapAccount(row);
}

async function findAccountByUserId(userId, client = db) {
  const row = await client.get('SELECT * FROM telegram_accounts WHERE user_id = ?', [userId]);
  return mapAccount(row);
}

async function upsertAccount(data, client = db) {
  const existing = await findAccountByTelegramUserId(data.telegramUserId, client);
  const now = new Date().toISOString();
  await client.run(
    `
      INSERT INTO telegram_accounts (
        id, user_id, telegram_user_id, chat_id, username, first_name, last_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(telegram_user_id) DO UPDATE SET
        user_id = excluded.user_id,
        chat_id = excluded.chat_id,
        username = excluded.username,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        updated_at = excluded.updated_at
    `,
    [
      existing?.id || randomUUID(),
      data.userId || null,
      String(data.telegramUserId),
      String(data.chatId),
      data.username || null,
      data.firstName || null,
      data.lastName || null,
      existing?.createdAt || now,
      now
    ]
  );

  return findAccountByTelegramUserId(data.telegramUserId, client);
}

async function createCommandLog(data, client = db) {
  const id = data.id || randomUUID();
  const createdAt = new Date().toISOString();
  await client.run(
    `
      INSERT INTO telegram_command_logs (
        id, telegram_user_id, chat_id, command, arguments_json, response_json, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      String(data.telegramUserId),
      String(data.chatId),
      data.command,
      serializeJson(data.arguments || {}),
      serializeJson(data.response || {}),
      data.status,
      createdAt
    ]
  );

  const row = await client.get('SELECT * FROM telegram_command_logs WHERE id = ?', [id]);
  return mapCommandLog(row);
}

module.exports = {
  telegramRepository: {
    findAccountByTelegramUserId,
    findAccountByUserId,
    upsertAccount,
    createCommandLog
  }
};
