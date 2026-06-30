const { randomUUID } = require('node:crypto');

const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function mapAuditLog(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    actorType: row.actor_type,
    actorId: row.actor_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at
  };
}

async function create(data, client = db) {
  const now = new Date().toISOString();
  await client.run(
    `
      INSERT INTO audit_logs (id, actor_type, actor_id, action, entity_type, entity_id, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      randomUUID(),
      data.actorType,
      data.actorId || null,
      data.action,
      data.entityType,
      data.entityId,
      serializeJson(data.metadata || {}),
      now
    ]
  );
}

async function findManyForEntity(entityType, entityId, options = {}, client = db) {
  const params = [entityType, entityId];
  let sql = `
    SELECT id, actor_type, actor_id, action, entity_type, entity_id, metadata_json, created_at
    FROM audit_logs
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY created_at DESC
  `;

  if (options.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  const rows = await client.all(sql, params);
  return rows.map(mapAuditLog);
}

module.exports = {
  auditLogRepository: {
    create,
    findManyForEntity
  }
};
