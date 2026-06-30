const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Store DB in project root as data.db
const dbPath = path.resolve(__dirname, '../db/data.db');
const db = new sqlite3.Database(dbPath);
db.configure?.('busyTimeout', 5000);

const { ownerId, userId, username } = require('../config').admin;

function subscriptionExpiryFromDays(days, base = Date.now()) {
  const parsed = Number.parseInt(days, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null;
  }
  const baseTimestamp = Number.isFinite(Number(base)) ? Number(base) : Date.now();
  return new Date(baseTimestamp + parsed * 24 * 60 * 60 * 1000).toISOString();
}

function initializeUsersTable() {
  db.get(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'`, [], (error, row) => {
    const currentSql = row?.sql || '';
    const needsRebuild = Boolean(
      !error &&
        currentSql &&
        (!currentSql.includes("'OWNER'") || !currentSql.includes("subscription_expires_at"))
    );
    if (!needsRebuild) {
      db.run(`CREATE TABLE IF NOT EXISTS users (
        telegram_id INTEGER PRIMARY KEY,
        username TEXT,
        role TEXT CHECK(role IN ('OWNER','ADMIN','USER')) NOT NULL DEFAULT 'USER',
        status TEXT CHECK(status IN ('ACTIVE','SUSPENDED','REVOKED')) NOT NULL DEFAULT 'ACTIVE',
        subscription_expires_at DATETIME,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen_at DATETIME,
        created_by TEXT
      )`);
      db.run(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'ACTIVE'`, () => {});
      db.run(`ALTER TABLE users ADD COLUMN subscription_expires_at DATETIME`, () => {});
      db.run(`ALTER TABLE users ADD COLUMN updated_at DATETIME`, () => {});
      db.run(`ALTER TABLE users ADD COLUMN last_seen_at DATETIME`, () => {});
      db.run(`ALTER TABLE users ADD COLUMN created_by TEXT`, () => {});
      db.run(`INSERT OR IGNORE INTO users (telegram_id, username, role, status, subscription_expires_at, created_by) VALUES (?, ?, 'OWNER', 'ACTIVE', NULL, 'env')`, [ownerId || userId, username]);
      db.run(`UPDATE users SET role = 'OWNER', status = 'ACTIVE', subscription_expires_at = NULL WHERE telegram_id = ?`, [ownerId || userId]);
      return;
    }

    db.serialize(() => {
      const legacyStatusExpr = currentSql.includes('status') ? "COALESCE(status, 'ACTIVE')" : "'ACTIVE'";
      const legacySubscriptionExpr = currentSql.includes('subscription_expires_at') ? "subscription_expires_at" : "NULL";
      db.run(`ALTER TABLE users RENAME TO users_legacy`);
      db.run(`CREATE TABLE users (
        telegram_id INTEGER PRIMARY KEY,
        username TEXT,
        role TEXT CHECK(role IN ('OWNER','ADMIN','USER')) NOT NULL DEFAULT 'USER',
        status TEXT CHECK(status IN ('ACTIVE','SUSPENDED','REVOKED')) NOT NULL DEFAULT 'ACTIVE',
        subscription_expires_at DATETIME,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen_at DATETIME,
        created_by TEXT
      )`);
      db.run(`INSERT OR IGNORE INTO users (telegram_id, username, role, status, subscription_expires_at, timestamp, created_by)
        SELECT
          telegram_id,
          username,
          CASE WHEN role = 'OWNER' THEN 'OWNER' WHEN role = 'ADMIN' THEN 'ADMIN' ELSE 'USER' END,
          ${legacyStatusExpr},
          CASE WHEN role = 'OWNER' THEN NULL ELSE ${legacySubscriptionExpr} END,
          timestamp,
          'migration'
        FROM users_legacy`);
      db.run(`DROP TABLE users_legacy`);
      db.run(`INSERT OR IGNORE INTO users (telegram_id, username, role, status, subscription_expires_at, created_by) VALUES (?, ?, 'OWNER', 'ACTIVE', NULL, 'env')`, [ownerId || userId, username]);
      db.run(`UPDATE users SET role = 'OWNER', status = 'ACTIVE', subscription_expires_at = NULL WHERE telegram_id = ?`, [ownerId || userId]);
    });
  });
}

db.serialize(() => {
  db.run(`PRAGMA journal_mode = WAL`);
  db.run(`PRAGMA foreign_keys = ON`);
  initializeUsersTable();

  db.run(`CREATE TABLE IF NOT EXISTS script_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_id TEXT NOT NULL,
    script_type TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    payload TEXT NOT NULL,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_script_versions_lookup ON script_versions(script_id, script_type, version_number)`);

  db.run(`CREATE TABLE IF NOT EXISTS bot_sessions (
    session_key TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS bot_user_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_telegram_id INTEGER,
    action TEXT NOT NULL,
    target_telegram_id INTEGER,
    target_role TEXT,
    subscription_days INTEGER,
    subscription_expires_at DATETIME,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS bot_access_denials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER,
    username TEXT,
    role TEXT,
    status TEXT,
    capability TEXT,
    action_label TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS bot_payment_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_telegram_id INTEGER,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    provider_state TEXT,
    transferly_state TEXT,
    amount TEXT,
    currency TEXT,
    recipient TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS bot_analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER,
    username TEXT,
    action TEXT NOT NULL,
    category TEXT,
    status TEXT,
    duration_ms INTEGER,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS bot_subscription_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER NOT NULL,
    threshold TEXT NOT NULL,
    subscription_expires_at DATETIME,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(telegram_id, threshold, subscription_expires_at)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS bot_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_bot_sessions_updated_at ON bot_sessions(updated_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_bot_user_audit_created_at ON bot_user_audit_logs(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_bot_access_denials_created_at ON bot_access_denials(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_bot_payment_audit_created_at ON bot_payment_audit_logs(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_bot_analytics_created_at ON bot_analytics_events(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_bot_analytics_action_created_at ON bot_analytics_events(action, created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_bot_subscription_alerts_user_threshold ON bot_subscription_alerts(telegram_id, threshold, sent_at)`);
});

function getUser(id, cb) {
  db.get(`SELECT * FROM users WHERE telegram_id = ?`, [id], (e, r) => {
    if (e) return cb(null);
    cb(r);
  });
}
function addUser(id, username, role = 'USER', subscriptionDays = null, cb = () => {}) {
  const safeRole = role === 'OWNER' ? 'OWNER' : role === 'ADMIN' ? 'ADMIN' : 'USER';
  const expiresAt = safeRole === 'OWNER' ? null : subscriptionExpiryFromDays(subscriptionDays);
  db.run(
    `INSERT INTO users (telegram_id, username, role, status, subscription_expires_at, updated_at)
     VALUES (?, ?, ?, 'ACTIVE', ?, CURRENT_TIMESTAMP)
     ON CONFLICT(telegram_id) DO UPDATE SET username = excluded.username, role = excluded.role, status = 'ACTIVE', subscription_expires_at = excluded.subscription_expires_at, updated_at = CURRENT_TIMESTAMP`,
    [id, username, safeRole, expiresAt],
    cb
  );
}
function getUserList(cb) {
  db.all(`SELECT * FROM users ORDER BY role ASC, status ASC, timestamp DESC`, [], (e, r) => {
    if (e) {
      console.error('Database error in getUserList:', e);
      return cb(e, null);
    }
    cb(null, r || []);
  });
}
function promoteUser(id, subscriptionDays = null, cb = () => {}) {
  const expiresAt = subscriptionExpiryFromDays(subscriptionDays);
  db.run(`UPDATE users SET role = 'ADMIN', status = 'ACTIVE', subscription_expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?`, [expiresAt, id], cb);
}
function removeUser(id, cb = () => {}) {
  db.run(`UPDATE users SET status = 'REVOKED', updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?`, [id], cb);
}
function setUserRole(id, role = 'USER', subscriptionDays = null, cb = () => {}) {
  const safeRole = role === 'OWNER' ? 'OWNER' : role === 'ADMIN' ? 'ADMIN' : 'USER';
  const expiresAt = safeRole === 'OWNER' ? null : subscriptionExpiryFromDays(subscriptionDays);
  db.run(`UPDATE users SET role = ?, status = 'ACTIVE', subscription_expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?`, [safeRole, expiresAt, id], cb);
}
function setUserStatus(id, status = 'ACTIVE', subscriptionDays = null, cb = () => {}) {
  const expiresAt = status === 'ACTIVE' ? subscriptionExpiryFromDays(subscriptionDays) : null;
  const sql = status === 'ACTIVE'
    ? `UPDATE users SET status = ?, subscription_expires_at = COALESCE(?, subscription_expires_at), updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?`
    : `UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?`;
  const params = status === 'ACTIVE' ? [status, expiresAt, id] : [status, id];
  db.run(sql, params, cb);
}
function extendUserSubscription(id, days, cb = () => {}) {
  const parsed = Number.parseInt(days, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    cb(new Error('Invalid subscription days'));
    return;
  }
  db.get(`SELECT role, subscription_expires_at FROM users WHERE telegram_id = ?`, [id], (error, user) => {
    if (error) {
      cb(error);
      return;
    }
    if (!user) {
      cb(new Error('User not found'));
      return;
    }
    if (user.role === 'OWNER') {
      cb(new Error('Owner subscriptions do not expire'));
      return;
    }
    const current = user.subscription_expires_at ? Date.parse(user.subscription_expires_at) : null;
    const base = Number.isFinite(current) && current > Date.now() ? current : Date.now();
    const expiresAt = subscriptionExpiryFromDays(parsed, base);
    db.run(
      `UPDATE users SET status = 'ACTIVE', subscription_expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?`,
      [expiresAt, id],
      cb
    );
  });
}
function touchUser(id, cb = () => {}) {
  db.run(`UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE telegram_id = ?`, [id], cb);
}
function isAdmin(id, cb) {
  db.get(`SELECT role, status FROM users WHERE telegram_id = ?`, [id], (e, r) => {
    if (e) return cb(false);
    cb((r?.role === 'ADMIN' || r?.role === 'OWNER') && (r.status || 'ACTIVE') === 'ACTIVE');
  });
}
function expireInactiveUsers(days = 30) {
  db.run(`DELETE FROM users WHERE timestamp <= datetime('now', ? || ' days')`, [`-${days}`]);
}

function readBotSession(key) {
  return new Promise((resolve) => {
    db.get(`SELECT payload FROM bot_sessions WHERE session_key = ?`, [String(key)], (error, row) => {
      if (error || !row?.payload) {
        resolve(undefined);
        return;
      }

      try {
        resolve(JSON.parse(row.payload));
      } catch (_) {
        resolve(undefined);
      }
    });
  });
}

function writeBotSession(key, value) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO bot_sessions (session_key, payload, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(session_key) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP`,
      [String(key), JSON.stringify(value || {})],
      (error) => {
        if (error) reject(error);
        else resolve();
      },
    );
  });
}

function deleteBotSession(key) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM bot_sessions WHERE session_key = ?`, [String(key)], (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function cleanupExpiredBotSessions(maxAgeHours = 336, cb = () => {}) {
  const safeHours = Math.min(Math.max(Number.parseInt(maxAgeHours, 10) || 336, 1), 8760);
  db.run(
    `DELETE FROM bot_sessions WHERE updated_at <= datetime('now', ?)`,
    [`-${safeHours} hours`],
    cb,
  );
}

function recordBotUserAudit(entry = {}, cb = () => {}) {
  db.run(
    `INSERT INTO bot_user_audit_logs (
      actor_telegram_id,
      action,
      target_telegram_id,
      target_role,
      subscription_days,
      subscription_expires_at,
      details
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.actorTelegramId || null,
      String(entry.action || 'unknown'),
      entry.targetTelegramId || null,
      entry.targetRole || null,
      entry.subscriptionDays || null,
      entry.subscriptionExpiresAt || null,
      entry.details ? JSON.stringify(entry.details) : null
    ],
    cb
  );
}

function recordBotAccessDenied(entry = {}, cb = () => {}) {
  db.run(
    `INSERT INTO bot_access_denials (
      telegram_id,
      username,
      role,
      status,
      capability,
      action_label
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      entry.telegramId || null,
      entry.username || null,
      entry.role || null,
      entry.status || null,
      entry.capability || null,
      entry.actionLabel || null
    ],
    cb
  );
}

function getBotOpsStats(cb = () => {}) {
  const stats = {
    generated_at: new Date().toISOString(),
    users: {
      total: 0,
      owners: 0,
      admins: 0,
      active_users: 0,
      expired: 0,
      suspended: 0,
      revoked: 0
    },
    access_denials_24h: 0,
    recent_denials: [],
    recent_user_audit: []
  };

  db.serialize(() => {
    db.all(
      `SELECT role, status, subscription_expires_at FROM users`,
      [],
      (userError, users = []) => {
        if (userError) {
          cb(userError);
          return;
        }
        users.forEach((user) => {
          const role = user.role || 'USER';
          const status = user.status || 'ACTIVE';
          const expiresAt = user.subscription_expires_at ? Date.parse(user.subscription_expires_at) : null;
          const expired = role !== 'OWNER' && status === 'ACTIVE' && Number.isFinite(expiresAt) && expiresAt <= Date.now();
          stats.users.total += 1;
          if (role === 'OWNER') stats.users.owners += 1;
          if (role === 'ADMIN') stats.users.admins += 1;
          if (role === 'USER' && status === 'ACTIVE' && !expired) stats.users.active_users += 1;
          if (expired) stats.users.expired += 1;
          if (status === 'SUSPENDED') stats.users.suspended += 1;
          if (status === 'REVOKED') stats.users.revoked += 1;
        });

        db.get(
          `SELECT COUNT(*) AS count FROM bot_access_denials WHERE created_at >= datetime('now', '-24 hours')`,
          [],
          (denialCountError, denialCountRow) => {
            if (denialCountError) {
              cb(denialCountError);
              return;
            }
            stats.access_denials_24h = denialCountRow?.count || 0;

            db.all(
              `SELECT telegram_id, username, role, status, capability, action_label, created_at
               FROM bot_access_denials
               ORDER BY created_at DESC
               LIMIT 5`,
              [],
              (denialsError, denials = []) => {
                if (denialsError) {
                  cb(denialsError);
                  return;
                }
                stats.recent_denials = denials || [];

                db.all(
                  `SELECT actor_telegram_id, action, target_telegram_id, target_role, subscription_days, subscription_expires_at, created_at
                   FROM bot_user_audit_logs
                   ORDER BY created_at DESC
                   LIMIT 5`,
                  [],
                  (auditError, auditRows = []) => {
                    if (auditError) {
                      cb(auditError);
                      return;
                    }
                    stats.recent_user_audit = auditRows || [];
                    cb(null, stats);
                  }
                );
              }
            );
          }
        );
      }
    );
  });
}

function getRecentUserAuditLogs(limit = 10, cb = () => {}) {
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), 50);
  db.all(
    `SELECT actor_telegram_id, action, target_telegram_id, target_role, subscription_days, subscription_expires_at, details, created_at
     FROM bot_user_audit_logs
     ORDER BY created_at DESC
     LIMIT ?`,
    [safeLimit],
    (error, rows) => cb(error, rows || [])
  );
}

function getUserAuditLogs(targetTelegramId, limit = 5, cb = () => {}) {
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 5, 1), 25);
  db.all(
    `SELECT actor_telegram_id, action, target_telegram_id, target_role, subscription_days, subscription_expires_at, details, created_at
     FROM bot_user_audit_logs
     WHERE target_telegram_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [targetTelegramId, safeLimit],
    (error, rows) => cb(error, rows || [])
  );
}

function getExpiringUsers(days = 7, limit = 10, cb = () => {}) {
  const safeDays = Math.min(Math.max(Number.parseInt(days, 10) || 7, 1), 90);
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), 50);
  db.all(
    `SELECT *
     FROM users
     WHERE role != 'OWNER'
       AND status = 'ACTIVE'
       AND subscription_expires_at IS NOT NULL
       AND subscription_expires_at <= datetime('now', '+' || ? || ' days')
     ORDER BY subscription_expires_at ASC
     LIMIT ?`,
    [safeDays, safeLimit],
    (error, rows) => cb(error, rows || [])
  );
}

function recordBotPaymentAudit(entry = {}, cb = () => {}) {
  db.run(
    `INSERT INTO bot_payment_audit_logs (
      actor_telegram_id,
      action,
      resource_type,
      resource_id,
      provider_state,
      transferly_state,
      amount,
      currency,
      recipient,
      details
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.actorTelegramId || null,
      String(entry.action || 'unknown'),
      String(entry.resourceType || 'payment'),
      entry.resourceId || null,
      entry.providerState || null,
      entry.transferlyState || null,
      entry.amount === undefined || entry.amount === null ? null : String(entry.amount),
      entry.currency || null,
      entry.recipient || null,
      entry.details ? JSON.stringify(entry.details) : null
    ],
    cb
  );
}

function getRecentPaymentAuditLogs(options = {}, cb = () => {}) {
  const config = typeof options === 'number' ? { limit: options } : options || {};
  const safeLimit = Math.min(Math.max(Number.parseInt(config.limit, 10) || 10, 1), 100);
  const clauses = [];
  const params = [];
  if (config.resourceType && config.resourceType !== 'ALL') {
    clauses.push(`resource_type = ?`);
    params.push(String(config.resourceType));
  }
  if (config.action && config.action !== 'ALL') {
    clauses.push(`action = ?`);
    params.push(String(config.action));
  }
  if (config.actorTelegramId) {
    clauses.push(`actor_telegram_id = ?`);
    params.push(config.actorTelegramId);
  }
  if (config.resourceId) {
    clauses.push(`resource_id LIKE ?`);
    params.push(`%${String(config.resourceId)}%`);
  }
  params.push(safeLimit);
  db.all(
    `SELECT actor_telegram_id, action, resource_type, resource_id, provider_state, transferly_state, amount, currency, recipient, details, created_at
     FROM bot_payment_audit_logs
     ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT ?`,
    params,
    (error, rows) => cb(error, rows || [])
  );
}

function recordBotAnalyticsEvent(entry = {}, cb = () => {}) {
  db.run(
    `INSERT INTO bot_analytics_events (
      telegram_id,
      username,
      action,
      category,
      status,
      duration_ms,
      details
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.telegramId || null,
      entry.username || null,
      String(entry.action || 'unknown'),
      entry.category || null,
      entry.status || 'ok',
      Number.isFinite(Number(entry.durationMs)) ? Number(entry.durationMs) : null,
      entry.details ? JSON.stringify(entry.details) : null
    ],
    cb
  );
}

function getBotAnalyticsStats(cb = () => {}) {
  const stats = {
    generated_at: new Date().toISOString(),
    action_totals_24h: [],
    category_totals_24h: [],
    failures_24h: 0,
    payment_actions_24h: 0,
    access_denials_24h: 0,
    active_sessions_24h: 0,
    callback_failures_24h: 0,
    callback_recoveries_24h: 0,
    unknown_actions_24h: 0,
    callback_status_totals_24h: [],
    slow_actions_24h: []
  };

  db.serialize(() => {
    db.all(
      `SELECT action, COUNT(*) AS count
       FROM bot_analytics_events
       WHERE created_at >= datetime('now', '-24 hours')
       GROUP BY action
       ORDER BY count DESC
       LIMIT 8`,
      [],
      (actionError, actionRows = []) => {
        if (actionError) return cb(actionError);
        stats.action_totals_24h = actionRows || [];

        db.all(
          `SELECT COALESCE(category, 'uncategorized') AS category, COUNT(*) AS count
           FROM bot_analytics_events
           WHERE created_at >= datetime('now', '-24 hours')
           GROUP BY COALESCE(category, 'uncategorized')
           ORDER BY count DESC
           LIMIT 8`,
          [],
          (categoryError, categoryRows = []) => {
            if (categoryError) return cb(categoryError);
            stats.category_totals_24h = categoryRows || [];

            db.get(
              `SELECT COUNT(*) AS count FROM bot_analytics_events WHERE created_at >= datetime('now', '-24 hours') AND status != 'ok'`,
              [],
              (failureError, failureRow) => {
                if (failureError) return cb(failureError);
                stats.failures_24h = failureRow?.count || 0;

                db.get(
                  `SELECT COUNT(*) AS count FROM bot_payment_audit_logs WHERE created_at >= datetime('now', '-24 hours')`,
                  [],
                  (paymentError, paymentRow) => {
                    if (paymentError) return cb(paymentError);
                    stats.payment_actions_24h = paymentRow?.count || 0;

                    db.get(
                      `SELECT COUNT(*) AS count FROM bot_access_denials WHERE created_at >= datetime('now', '-24 hours')`,
                      [],
                      (denialError, denialRow) => {
                        if (denialError) return cb(denialError);
                        stats.access_denials_24h = denialRow?.count || 0;

                        db.get(
                          `SELECT COUNT(*) AS count FROM bot_sessions WHERE updated_at >= datetime('now', '-24 hours')`,
                          [],
                          (sessionError, sessionRow) => {
                            if (sessionError) return cb(sessionError);
                            stats.active_sessions_24h = sessionRow?.count || 0;

                            db.get(
                              `SELECT COUNT(*) AS count
                               FROM bot_analytics_events
                               WHERE created_at >= datetime('now', '-24 hours')
                                 AND category = 'callback'
                                 AND status != 'ok'`,
                              [],
                              (callbackFailureError, callbackFailureRow) => {
                                if (callbackFailureError) return cb(callbackFailureError);
                                stats.callback_failures_24h = callbackFailureRow?.count || 0;

                                db.get(
                                  `SELECT COUNT(*) AS count
                                   FROM bot_analytics_events
                                   WHERE created_at >= datetime('now', '-24 hours')
                                     AND category = 'callback_recovery'`,
                                  [],
                                  (recoveryError, recoveryRow) => {
                                    if (recoveryError) return cb(recoveryError);
                                    stats.callback_recoveries_24h = recoveryRow?.count || 0;

                                    db.get(
                                      `SELECT COUNT(*) AS count
                                       FROM bot_analytics_events
                                       WHERE created_at >= datetime('now', '-24 hours')
                                         AND category = 'callback'
                                         AND status = 'unknown'`,
                                      [],
                                      (unknownError, unknownRow) => {
                                        if (unknownError) return cb(unknownError);
                                        stats.unknown_actions_24h = unknownRow?.count || 0;

                                        db.all(
                                          `SELECT status, COUNT(*) AS count
                                           FROM bot_analytics_events
                                           WHERE created_at >= datetime('now', '-24 hours')
                                             AND category = 'callback'
                                           GROUP BY status
                                           ORDER BY count DESC
                                           LIMIT 8`,
                                          [],
                                          (callbackStatusError, callbackStatusRows = []) => {
                                            if (callbackStatusError) return cb(callbackStatusError);
                                            stats.callback_status_totals_24h = callbackStatusRows || [];

                                            db.all(
                                              `SELECT
                                                 action,
                                                 COALESCE(category, 'uncategorized') AS category,
                                                 ROUND(AVG(duration_ms)) AS avg_duration_ms,
                                                 MAX(duration_ms) AS max_duration_ms,
                                                 COUNT(*) AS count,
                                                 MAX(created_at) AS last_seen_at
                                               FROM bot_analytics_events
                                               WHERE created_at >= datetime('now', '-24 hours')
                                                 AND duration_ms IS NOT NULL
                                               GROUP BY action, COALESCE(category, 'uncategorized')
                                               ORDER BY avg_duration_ms DESC, max_duration_ms DESC, last_seen_at DESC
                                               LIMIT 5`,
                                              [],
                                              (slowActionError, slowActionRows = []) => {
                                                if (slowActionError) return cb(slowActionError);
                                                stats.slow_actions_24h = slowActionRows || [];
                                                cb(null, stats);
                                              }
                                            );
                                          }
                                        );
                                      }
                                    );
                                  }
                                );
                              }
                            );
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  });
}

function searchUsers(query = '', limit = 10, cb = () => {}) {
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), 50);
  const raw = String(query || '').trim();
  if (!raw) {
    cb(null, []);
    return;
  }
  const upper = raw.toUpperCase();
  const like = `%${raw.replace(/^@/, '')}%`;
  const numeric = Number.parseInt(raw, 10);
  const params = [];
  const clauses = [];
  if (Number.isSafeInteger(numeric) && numeric > 0) {
    clauses.push(`telegram_id = ?`);
    params.push(numeric);
  }
  if (['OWNER', 'ADMIN', 'USER'].includes(upper)) {
    clauses.push(`role = ?`);
    params.push(upper);
  }
  if (['ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED'].includes(upper)) {
    if (upper === 'EXPIRED') {
      clauses.push(`role != 'OWNER' AND status = 'ACTIVE' AND subscription_expires_at IS NOT NULL AND subscription_expires_at <= CURRENT_TIMESTAMP`);
    } else {
      clauses.push(`status = ?`);
      params.push(upper);
    }
  }
  clauses.push(`username LIKE ?`);
  params.push(like);
  params.push(safeLimit);
  db.all(
    `SELECT * FROM users
     WHERE ${clauses.map((clause) => `(${clause})`).join(' OR ')}
     ORDER BY role ASC, status ASC, timestamp DESC
     LIMIT ?`,
    params,
    (error, rows) => cb(error, rows || [])
  );
}

function getDueSubscriptionAlerts(cb = () => {}) {
  db.all(
    `SELECT *
     FROM users
     WHERE role != 'OWNER'
       AND status = 'ACTIVE'
       AND subscription_expires_at IS NOT NULL
       AND subscription_expires_at <= datetime('now', '+7 days')
     ORDER BY subscription_expires_at ASC
     LIMIT 100`,
    [],
    (error, rows = []) => {
      if (error) return cb(error);
      const now = Date.now();
      const due = [];
      for (const user of rows || []) {
        const expiry = Date.parse(user.subscription_expires_at);
        if (!Number.isFinite(expiry)) continue;
        const msLeft = expiry - now;
        const threshold =
          msLeft <= 0 ? 'expired' :
          msLeft <= 24 * 60 * 60 * 1000 ? '24h' :
          msLeft <= 3 * 24 * 60 * 60 * 1000 ? '3d' :
          '7d';
        due.push({ ...user, alert_threshold: threshold });
      }
      cb(null, due);
    }
  );
}

function wasSubscriptionAlertSent(telegramId, threshold, expiresAt, cb = () => {}) {
  db.get(
    `SELECT id FROM bot_subscription_alerts WHERE telegram_id = ? AND threshold = ? AND subscription_expires_at = ? LIMIT 1`,
    [telegramId, threshold, expiresAt],
    (error, row) => cb(error, Boolean(row))
  );
}

function recordSubscriptionAlert(telegramId, threshold, expiresAt, cb = () => {}) {
  db.run(
    `INSERT OR IGNORE INTO bot_subscription_alerts (telegram_id, threshold, subscription_expires_at)
     VALUES (?, ?, ?)`,
    [telegramId, threshold, expiresAt],
    cb
  );
}

function getBotSetting(key, fallback = null, cb = () => {}) {
  db.get(`SELECT value FROM bot_settings WHERE key = ?`, [String(key)], (error, row) => {
    if (error) return cb(error, fallback);
    cb(null, row?.value ?? fallback);
  });
}

function setBotSetting(key, value, cb = () => {}) {
  db.run(
    `INSERT INTO bot_settings (key, value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    [String(key), String(value)],
    cb
  );
}

function getUserActivityStats(telegramId, cb = () => {}) {
  const stats = {
    telegram_id: telegramId,
    analytics_24h: 0,
    denied_24h: 0,
    payment_actions_30d: 0,
    recent_actions: []
  };
  db.serialize(() => {
    db.get(
      `SELECT COUNT(*) AS count FROM bot_analytics_events WHERE telegram_id = ? AND created_at >= datetime('now', '-24 hours')`,
      [telegramId],
      (analyticsError, analyticsRow) => {
        if (analyticsError) return cb(analyticsError);
        stats.analytics_24h = analyticsRow?.count || 0;
        db.get(
          `SELECT COUNT(*) AS count FROM bot_access_denials WHERE telegram_id = ? AND created_at >= datetime('now', '-24 hours')`,
          [telegramId],
          (denialError, denialRow) => {
            if (denialError) return cb(denialError);
            stats.denied_24h = denialRow?.count || 0;
            db.get(
              `SELECT COUNT(*) AS count FROM bot_payment_audit_logs WHERE actor_telegram_id = ? AND created_at >= datetime('now', '-30 days')`,
              [telegramId],
              (paymentError, paymentRow) => {
                if (paymentError) return cb(paymentError);
                stats.payment_actions_30d = paymentRow?.count || 0;
                db.all(
                  `SELECT action, category, status, created_at
                   FROM bot_analytics_events
                   WHERE telegram_id = ?
                   ORDER BY created_at DESC
                   LIMIT 5`,
                  [telegramId],
                  (recentError, recentRows = []) => {
                    if (recentError) return cb(recentError);
                    stats.recent_actions = recentRows || [];
                    cb(null, stats);
                  }
                );
              }
            );
          }
        );
      }
    );
  });
}

function getNextScriptVersion(scriptId, scriptType) {
  return new Promise((resolve, reject) => {
    const sql = `SELECT MAX(version_number) AS max_version FROM script_versions WHERE script_id = ? AND script_type = ?`;
    db.get(sql, [scriptId, scriptType], (err, row) => {
      if (err) return reject(err);
      const next = Number(row?.max_version || 0) + 1;
      resolve(next);
    });
  });
}

async function saveScriptVersion(scriptId, scriptType, payload, createdBy = null) {
  if (!scriptId || !scriptType || !payload) return null;
  const version = await getNextScriptVersion(scriptId, scriptType);
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO script_versions (script_id, script_type, version_number, payload, created_by)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run([
      String(scriptId),
      String(scriptType),
      version,
      JSON.stringify(payload),
      createdBy
    ], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, version });
      }
    });
    stmt.finalize();
  });
}

function listScriptVersions(scriptId, scriptType, limit = 10) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT id, script_id, script_type, version_number, created_by, created_at
      FROM script_versions
      WHERE script_id = ? AND script_type = ?
      ORDER BY version_number DESC
      LIMIT ?
    `;
    db.all(sql, [String(scriptId), String(scriptType), limit], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function getScriptVersion(scriptId, scriptType, versionNumber) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT id, script_id, script_type, version_number, payload, created_by, created_at
      FROM script_versions
      WHERE script_id = ? AND script_type = ? AND version_number = ?
      LIMIT 1
    `;
    db.get(sql, [String(scriptId), String(scriptType), Number(versionNumber)], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      let payload = null;
      try {
        payload = JSON.parse(row.payload);
      } catch (_) {}
      resolve({ ...row, payload });
    });
  });
}

function getLatestScriptVersion(scriptId, scriptType) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT id, script_id, script_type, version_number, payload, created_by, created_at
      FROM script_versions
      WHERE script_id = ? AND script_type = ?
      ORDER BY version_number DESC
      LIMIT 1
    `;
    db.get(sql, [String(scriptId), String(scriptType)], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      let payload = null;
      try {
        payload = JSON.parse(row.payload);
      } catch (_) {}
      resolve({ ...row, payload });
    });
  });
}

module.exports = {
  getUser, addUser, getUserList, promoteUser, removeUser,
  setUserRole,
  setUserStatus,
  extendUserSubscription,
  touchUser,
  isAdmin, expireInactiveUsers,
  readBotSession,
  writeBotSession,
  deleteBotSession,
  cleanupExpiredBotSessions,
  recordBotUserAudit,
  recordBotAccessDenied,
  getBotOpsStats,
  getRecentUserAuditLogs,
  getUserAuditLogs,
  getExpiringUsers,
  recordBotPaymentAudit,
  getRecentPaymentAuditLogs,
  recordBotAnalyticsEvent,
  getBotAnalyticsStats,
  searchUsers,
  getDueSubscriptionAlerts,
  wasSubscriptionAlertSent,
  recordSubscriptionAlert,
  getBotSetting,
  setBotSetting,
  getUserActivityStats,
  saveScriptVersion,
  listScriptVersions,
  getScriptVersion,
  getLatestScriptVersion
};
