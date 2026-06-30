#!/usr/bin/env node
'use strict';

require('dotenv').config();

const https = require('https');

const token = process.env.BOT_TOKEN;
const chatId = process.env.SMOKE_CHAT_ID || process.env.ADMIN_TELEGRAM_ID;
const miniAppUrl = process.env.MINI_APP_URL || process.env.WEB_APP_URL || process.env.FRONTEND_URL;

if (!token || !chatId) {
  console.error('Missing BOT_TOKEN or SMOKE_CHAT_ID/ADMIN_TELEGRAM_ID.');
  process.exit(1);
}

function apiRequest(method, payload = null) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : null;
    const request = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/${method}`,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(body ? { 'content-length': Buffer.byteLength(body) } : {}),
      },
    }, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          const parsed = JSON.parse(data || '{}');
          if (!parsed.ok) {
            reject(new Error(parsed.description || `Telegram ${method} failed`));
            return;
          }
          resolve(parsed.result);
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

function callback(action) {
  return action;
}

async function main() {
  const me = await apiRequest('getMe');
  const text = [
    '<b>Transferly Bot Live Smoke</b>',
    '',
    `Bot: @${me.username || me.first_name}`,
    '',
    'Manual tap path:',
    '1. Tap Users',
    '2. Tap Search Users',
    '3. Search a Telegram ID or username',
    '4. Open a user detail card',
    '5. Tap Back / Users / Main Menu',
    '',
    'Telegram does not let a bot click its own inline buttons, so this smoke script verifies token/chat delivery and sends signed buttons for live operator tap-through.',
  ].join('\n');
  const inlineKeyboard = [
    [
      { text: 'Users', callback_data: callback('USERS') },
      { text: 'Search Users', callback_data: callback('USERS_SEARCH') },
    ],
    [
      { text: 'Analytics', callback_data: callback('BOT_ANALYTICS') },
      { text: 'Payment Audit', callback_data: callback('PAYMENT_AUDIT') },
    ],
    [
      { text: 'Main Menu', callback_data: callback('MENU') },
    ],
  ];

  if (miniAppUrl) {
    inlineKeyboard.splice(2, 0, [
      { text: 'Open Mini App', web_app: { url: new URL(miniAppUrl).toString() } },
    ]);
  }

  const result = await apiRequest('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: inlineKeyboard,
    },
  });

  console.log(JSON.stringify({
    ok: true,
    bot: me.username || me.first_name,
    chat_id: chatId,
    message_id: result.message_id,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
