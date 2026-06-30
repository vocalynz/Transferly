const { createHmac } = require('node:crypto');

const { decodeBase64Url, encodeBase64Url } = require('./base64url');
const { AppError } = require('./errors');

function signJwt(payload, secret, expiresInSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds
  };

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedPayload = encodeBase64Url(JSON.stringify(fullPayload));
  const signature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyJwt(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid authentication token.');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const expectedSignature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  if (encodedSignature !== expectedSignature) {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid authentication token.');
  }

  const payload = JSON.parse(decodeBase64Url(encodedPayload));
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && Number(payload.exp) < now) {
    throw new AppError(401, 'TOKEN_EXPIRED', 'Authentication token has expired.');
  }

  return payload;
}

module.exports = {
  signJwt,
  verifyJwt
};
