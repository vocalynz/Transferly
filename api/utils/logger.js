const pino = require('pino');

const config = require('../config');

const logger = pino({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug'
});

module.exports = {
  logger
};
