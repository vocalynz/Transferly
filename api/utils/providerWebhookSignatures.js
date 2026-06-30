const crypto = require('node:crypto');

const { AppError } = require('./errors');

const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;

function parseSignatureHeader(headerValue) {
  return String(headerValue || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((parts, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex <= 0) {
        return parts;
      }

      const key = part.slice(0, separatorIndex);
      const value = part.slice(separatorIndex + 1);
      parts[key] = parts[key] || [];
      parts[key].push(value);
      return parts;
    }, {});
}

function assertFreshTimestamp(timestamp, toleranceSeconds = DEFAULT_WEBHOOK_TOLERANCE_SECONDS) {
  const webhookTimestamp = Number(timestamp);
  if (!Number.isFinite(webhookTimestamp)) {
    throw new AppError(400, 'INVALID_WEBHOOK_SIGNATURE', 'Webhook signature timestamp is invalid.');
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - webhookTimestamp);
  if (ageSeconds > toleranceSeconds) {
    throw new AppError(400, 'WEBHOOK_SIGNATURE_EXPIRED', 'Webhook signature timestamp is outside the allowed tolerance.');
  }
}

function safeCompareHex(expected, candidates) {
  const expectedBuffer = Buffer.from(expected, 'hex');
  return candidates.some((candidate) => {
    const candidateBuffer = Buffer.from(candidate, 'hex');
    return candidateBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
  });
}

function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!secret) {
    throw new AppError(503, 'STRIPE_WEBHOOK_NOT_CONFIGURED', 'Stripe webhook secret is not configured.');
  }

  const parts = parseSignatureHeader(signatureHeader);
  const timestamp = parts.t && parts.t[0];
  const signatures = parts.v1 || [];
  if (!timestamp || signatures.length === 0) {
    throw new AppError(400, 'INVALID_WEBHOOK_SIGNATURE', 'Stripe signature header is incomplete.');
  }

  assertFreshTimestamp(timestamp);
  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');

  if (!safeCompareHex(expected, signatures)) {
    throw new AppError(400, 'INVALID_WEBHOOK_SIGNATURE', 'Stripe webhook signature verification failed.');
  }
}

function normalizeHeaderLookup(headers = {}) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value || '')]));
}

function verifyCoinbaseWebhookSignature(rawBody, signatureHeader, secret, headers = {}) {
  if (!secret) {
    throw new AppError(503, 'CRYPTO_WEBHOOK_NOT_CONFIGURED', 'Crypto Commerce webhook secret is not configured.');
  }

  const parts = parseSignatureHeader(signatureHeader);
  const timestamp = parts.t && parts.t[0];
  const headerNames = parts.h && parts.h[0];
  const signatures = parts.v1 || [];
  if (!timestamp || !headerNames || signatures.length === 0) {
    throw new AppError(400, 'INVALID_WEBHOOK_SIGNATURE', 'Coinbase webhook signature header is incomplete.');
  }

  assertFreshTimestamp(timestamp);
  const normalizedHeaders = normalizeHeaderLookup(headers);
  const headerValues = headerNames
    .split(' ')
    .map((name) => normalizedHeaders[name.toLowerCase()] || '')
    .join('.');
  const signedPayload = `${timestamp}.${headerNames}.${headerValues}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');

  if (!safeCompareHex(expected, signatures)) {
    throw new AppError(400, 'INVALID_WEBHOOK_SIGNATURE', 'Coinbase webhook signature verification failed.');
  }
}

module.exports = {
  verifyStripeSignature,
  verifyCoinbaseWebhookSignature
};
