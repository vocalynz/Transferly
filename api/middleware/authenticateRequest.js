const config = require('../config');
const { AppError } = require('../utils/errors');
const { verifyJwt } = require('../utils/jwt');

function parseBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') {
    return null;
  }

  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function parseCookieToken(cookieHeader) {
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return null;
  }

  const target = `${config.AUTH_COOKIE_NAME}=`;
  const parts = cookieHeader.split(';').map((entry) => entry.trim());
  const match = parts.find((entry) => entry.startsWith(target));

  if (!match) {
    return null;
  }

  return decodeURIComponent(match.slice(target.length));
}

function authenticateRequest(request, _response, next) {
  const token =
    parseBearerToken(request.headers.authorization) ||
    parseCookieToken(request.headers.cookie);
  request.auth = null;

  if (!token) {
    next();
    return;
  }

  if (config.ADMIN_AUTH_ENABLED && token === config.ADMIN_API_TOKEN) {
    const userId = config.USER_API_TOKEN_MAP[token] || null;
    request.auth = {
      role: 'ADMIN',
      actorId: config.DEFAULT_ADMIN_ACTOR_ID,
      userId
    };
    next();
    return;
  }

  const userId = config.USER_API_TOKEN_MAP[token];
  if (userId) {
    request.auth = {
      role: 'USER',
      actorId: userId,
      userId
    };
    next();
    return;
  }

  if (config.JWT_AUTH_ENABLED) {
    try {
      const payload = verifyJwt(token, config.JWT_SECRET);
      request.auth = {
        role: payload.role === 'ADMIN' || payload.isAdmin ? 'ADMIN' : 'USER',
        actorId: payload.sub,
        userId: payload.sub,
        email: payload.email || null,
        isAdmin: Boolean(payload.isAdmin || payload.role === 'ADMIN')
      };
      next();
      return;
    } catch (error) {
      next(error);
      return;
    }
  }

  next(new AppError(401, 'INVALID_API_TOKEN', 'Invalid API token.'));
}

function requireUserAuthIfConfigured(request, _response, next) {
  if (!config.USER_AUTH_ENABLED) {
    next();
    return;
  }

  if (!request.auth || (request.auth.role !== 'USER' && !(request.auth.role === 'ADMIN' && request.auth.userId))) {
    next(new AppError(401, 'USER_AUTH_REQUIRED', 'A valid user bearer token is required.'));
    return;
  }

  next();
}

function requireAuthenticatedUser(request, _response, next) {
  if (!request.auth || (request.auth.role !== 'USER' && !(request.auth.role === 'ADMIN' && request.auth.userId))) {
    next(new AppError(401, 'USER_AUTH_REQUIRED', 'A valid user bearer token is required.'));
    return;
  }

  next();
}

function resolveUserIdForRequest(request, requestedUserId) {
  if (request.auth && request.auth.role === 'USER') {
    if (requestedUserId && requestedUserId !== request.auth.userId) {
      throw new AppError(403, 'USER_SCOPE_VIOLATION', 'You cannot act on behalf of another user.');
    }

    return request.auth.userId;
  }

  return requestedUserId;
}

function assertCanAccessUserResource(request, resourceUserId) {
  if (request.auth && request.auth.role === 'USER' && resourceUserId !== request.auth.userId) {
    throw new AppError(403, 'USER_SCOPE_VIOLATION', 'You cannot access another user resource.');
  }
}

module.exports = {
  authenticateRequest,
  requireAuthenticatedUser,
  requireUserAuthIfConfigured,
  resolveUserIdForRequest,
  assertCanAccessUserResource
};
