const config = require('../config');
const { AppError } = require('../utils/errors');

function requireAdminActor(request, _response, next) {
  if (config.ADMIN_AUTH_ENABLED) {
    if (!request.auth || request.auth.role !== 'ADMIN') {
      next(new AppError(401, 'ADMIN_AUTH_REQUIRED', 'A valid admin bearer token is required.'));
      return;
    }
  }

  const headerActorId = request.headers['x-admin-actor-id'];
  const adminActorId =
    (typeof headerActorId === 'string' && headerActorId) ||
    (request.auth && request.auth.role === 'ADMIN' ? request.auth.actorId : null) ||
    config.DEFAULT_ADMIN_ACTOR_ID;

  if (!adminActorId) {
    next(new AppError(400, 'ADMIN_ACTOR_ID_REQUIRED', 'x-admin-actor-id header is required.'));
    return;
  }

  request.adminActorId = adminActorId;
  next();
}

module.exports = {
  requireAdminActor
};
