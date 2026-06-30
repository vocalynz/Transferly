const { randomUUID } = require('node:crypto');

function assignRequestId(request, response, next) {
  request.id = request.headers['x-request-id'] || randomUUID();
  response.setHeader('x-request-id', request.id);
  next();
}

module.exports = {
  assignRequestId
};
