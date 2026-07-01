const fs = require('node:fs');
const path = require('node:path');

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();

const sqliteDatabasePath = path.resolve(process.env.SQLITE_DATABASE_PATH || './data/transferly.sqlite');
fs.mkdirSync(path.dirname(sqliteDatabasePath), { recursive: true });

const database = new sqlite3.Database(sqliteDatabasePath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    database.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({
        lastID: this.lastID,
        changes: this.changes
      });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    database.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row || null);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    database.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    database.exec(sql, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function initializeDatabase() {
  await exec('PRAGMA journal_mode = WAL;');
  await exec('PRAGMA foreign_keys = ON;');
  await exec('PRAGMA busy_timeout = 5000;');
}

function createClient() {
  return {
    run,
    get,
    all,
    exec
  };
}

async function transaction(callback) {
  await run('BEGIN IMMEDIATE');
  try {
    const result = await callback(createClient());
    await run('COMMIT');
    return result;
  } catch (error) {
    await run('ROLLBACK');
    throw error;
  }
}

function close() {
  return new Promise((resolve, reject) => {
    database.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function loadSchemaSql() {
  return fs.readFileSync(require.resolve('./schema.sql'), 'utf8');
}

module.exports = {
  db: createClient(),
  initializeDatabase,
  transaction,
  close,
  loadSchemaSql,
  sqliteDatabasePath
};
