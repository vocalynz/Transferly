const path = require('node:path');
const { mkdirSync } = require('node:fs');
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_BASE_URL: z.string().url().default('http://localhost:3001'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  SQLITE_DATABASE_PATH: z.string().min(1).default('./data/transferly.sqlite'),
  REDIS_URL: z.string().min(1),
  INLINE_QUEUE_MODE: z.coerce.boolean().default(false),
  JWT_SECRET: z.string().min(16).default('transferly-development-secret'),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(604800),
  AUTH_COOKIE_NAME: z.string().min(1).default('transferly_token'),
  PAYPAL_CLIENT_ID: z.string().min(1),
  PAYPAL_CLIENT_SECRET: z.string().min(1),
  PAYPAL_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  PAYPAL_WEBHOOK_ID: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  STRIPE_CONNECT_CLIENT_ID: z.string().default(''),
  STRIPE_CONNECTED_ACCOUNT_ID: z.string().default(''),
  STRIPE_PAYOUTS_ENABLED: z.coerce.boolean().default(false),
  STRIPE_PAYOUT_MODE: z.enum(['transfer_to_connected_account']).default('transfer_to_connected_account'),
  STRIPE_API_VERSION: z.string().default('2026-02-25.clover'),
  STRIPE_API_BASE_URL: z.string().url().default('https://api.stripe.com'),
  WISE_API_TOKEN: z.string().default(''),
  WISE_PROFILE_ID: z.string().default(''),
  WISE_WEBHOOK_PUBLIC_KEY: z.string().default(''),
  PAYSTACK_SECRET_KEY: z.string().default(''),
  PAYSTACK_WEBHOOK_SECRET: z.string().default(''),
  FLUTTERWAVE_SECRET_KEY: z.string().default(''),
  FLUTTERWAVE_WEBHOOK_SECRET: z.string().default(''),
  CRYPTO_COMMERCE_API_KEY: z.string().default(''),
  CRYPTO_COMMERCE_WEBHOOK_SECRET: z.string().default(''),
  CRYPTO_COMMERCE_API_BASE_URL: z.string().url().default('https://api.commerce.coinbase.com'),
  EMAIL_DELIVERY_WEBHOOK_URL: z.string().url().optional(),
  TELEGRAM_BOT_TOKEN: z.string().default(''),
  TELEGRAM_WEBHOOK_SECRET: z.string().default(''),
  TELEGRAM_API_BASE: z.string().url().default('https://api.telegram.org'),
  TELEGRAM_MINI_APP_URL: z.string().url().optional(),
  TELEGRAM_MINI_APP_AUTH_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(3600),
  MAX_SINGLE_PAYOUT: z.coerce.number().positive().default(1000),
  DAILY_PAYOUT_LIMIT: z.coerce.number().positive().default(5000),
  MAX_PAYOUTS_PER_HOUR: z.coerce.number().int().positive().default(5),
  HIGH_RISK_COUNTRIES: z.string().default(''),
  HIGH_RISK_CURRENCIES: z.string().default(''),
  SUSPICIOUS_INVOICE_KEYWORDS: z.string().default('crypto,investment,loan,casino,gift card'),
  API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  CORS_ALLOWED_ORIGINS: z.string().default(''),
  JOB_WAIT_MS: z.coerce.number().int().positive().optional(),
  WEBHOOK_QUEUE_WAIT_MS: z.coerce.number().int().positive().optional(),
  ADMIN_API_TOKEN: z.string().default(''),
  ADMIN_API_ACTOR_ID: z.string().default(''),
  USER_API_TOKENS: z.string().default(''),
  SEED_USER_ID: z.string().min(1).optional(),
  SEED_USER_EMAIL: z.string().email().optional(),
  SEED_USER_NAME: z.string().min(1).optional(),
  SEED_USER_COUNTRY: z.string().length(2).optional(),
  SEED_WALLET_CURRENCY: z.string().length(3).optional(),
  SEED_PENDING_BALANCE: z.coerce.number().int().min(0).optional(),
  SEED_AVAILABLE_BALANCE: z.coerce.number().int().min(0).optional(),
  SEED_FROZEN_BALANCE: z.coerce.number().int().min(0).optional(),
  SEED_PAID_OUT_BALANCE: z.coerce.number().int().min(0).optional(),
  SEED_ADMIN_ACTOR_ID: z.string().min(1).optional()
});

const parsed = envSchema.parse(process.env);

function splitCsv(value, transform) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => (transform ? transform(entry) : entry));
}

function parseUserApiTokens(value) {
  const tokens = {};

  for (const entry of splitCsv(value)) {
    const separatorIndex = entry.indexOf(':');
    if (separatorIndex <= 0 || separatorIndex === entry.length - 1) {
      throw new Error(`Invalid USER_API_TOKENS entry "${entry}". Expected userId:token.`);
    }

    const userId = entry.slice(0, separatorIndex).trim();
    const token = entry.slice(separatorIndex + 1).trim();

    if (!userId || !token) {
      throw new Error(`Invalid USER_API_TOKENS entry "${entry}". Expected userId:token.`);
    }

    tokens[token] = userId;
  }

  return tokens;
}

const sqliteDatabasePath = path.resolve(parsed.SQLITE_DATABASE_PATH);
mkdirSync(path.dirname(sqliteDatabasePath), { recursive: true });
const userApiTokens = parseUserApiTokens(parsed.USER_API_TOKENS);
const defaultAdminActorId = parsed.ADMIN_API_ACTOR_ID || parsed.SEED_ADMIN_ACTOR_ID || 'system-admin';
const telegramMiniAppUrl = parsed.TELEGRAM_MINI_APP_URL || new URL('/miniapp', parsed.FRONTEND_URL).toString();

function toOrigin(value) {
  try {
    return new URL(value).origin;
  } catch (_error) {
    return null;
  }
}

function buildAllowedOrigins() {
  const origins = new Set(splitCsv(parsed.CORS_ALLOWED_ORIGINS));

  [parsed.APP_BASE_URL, parsed.FRONTEND_URL, telegramMiniAppUrl].forEach((url) => {
    const origin = toOrigin(url);
    if (origin) {
      origins.add(origin);
    }
  });

  return [...origins];
}

module.exports = {
  ...parsed,
  SQLITE_DATABASE_PATH: sqliteDatabasePath,
  JOB_WAIT_MS: parsed.JOB_WAIT_MS ?? parsed.WEBHOOK_QUEUE_WAIT_MS ?? 30000,
  WEBHOOK_QUEUE_WAIT_MS: parsed.JOB_WAIT_MS ?? parsed.WEBHOOK_QUEUE_WAIT_MS ?? 30000,
  TELEGRAM_MINI_APP_URL: telegramMiniAppUrl,
  CORS_ALLOWED_ORIGINS: buildAllowedOrigins(),
  ADMIN_AUTH_ENABLED: Boolean(parsed.ADMIN_API_TOKEN),
  USER_AUTH_ENABLED: Boolean(parsed.JWT_SECRET) || Object.keys(userApiTokens).length > 0,
  JWT_AUTH_ENABLED: Boolean(parsed.JWT_SECRET),
  DEFAULT_ADMIN_ACTOR_ID: defaultAdminActorId,
  USER_API_TOKEN_MAP: userApiTokens,
  HIGH_RISK_COUNTRIES: splitCsv(parsed.HIGH_RISK_COUNTRIES, (entry) => entry.toUpperCase()),
  HIGH_RISK_CURRENCIES: splitCsv(parsed.HIGH_RISK_CURRENCIES, (entry) => entry.toUpperCase()),
  SUSPICIOUS_INVOICE_KEYWORDS: splitCsv(parsed.SUSPICIOUS_INVOICE_KEYWORDS, (entry) => entry.toLowerCase())
};
