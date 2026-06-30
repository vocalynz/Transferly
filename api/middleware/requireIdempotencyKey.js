const { AppError } = require('../utils/errors');

function requireIdempotencyKey(request, _response, next) {
  const idempotencyKey = request.headers['idempotency-key'];
  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    next(new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required.'));
    return;
  }

  request.idempotencyKey = idempotencyKey;
  next();
}

module.exports = {
  requireIdempotencyKey
};
