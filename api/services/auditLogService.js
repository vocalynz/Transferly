const { auditLogRepository } = require('../repositories/auditLogRepository');

async function log(entry, client) {
  await auditLogRepository.create(entry, client);
}

module.exports = {
  auditLogService: {
    log
  }
};
