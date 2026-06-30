#!/usr/bin/env node
'use strict';

require('dotenv').config();

const https = require('https');

const token = process.env.BOT_TOKEN;
const miniAppUrl = process.env.MINI_APP_URL || process.env.WEB_APP_URL || process.env.FRONTEND_URL;

if (!token || !miniAppUrl) {
  console.error('Missing BOT_TOKEN or MINI_APP_URL.');
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

async function main() {
  const normalizedUrl = new URL(miniAppUrl).toString();
  await apiRequest('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: 'Open Transferly',
      web_app: {
        url: normalizedUrl,
      },
    },
  });

  console.log(JSON.stringify({
    ok: true,
    menu_button: 'web_app',
    mini_app_url: normalizedUrl,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
