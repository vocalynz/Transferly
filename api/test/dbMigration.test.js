const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-db-migration-'));
process.env.SQLITE_DATABASE_PATH = path.join(testDir, 'transferly.sqlite');

const { sqliteDatabasePath, db, close } = require('../db');
const { REQUIRED_TABLES, migrate, verifyRequiredTables } = require('../db/migrate');

after(async () => {
  await close();
  fs.rmSync(testDir, { force: true, recursive: true });
});

test('migration creates and verifies required operational tables', async () => {
  await migrate();
  await verifyRequiredTables();

  const rows = await db.all("SELECT name FROM sqlite_master WHERE type = 'table'");
  const tableNames = new Set(rows.map((row) => row.name));

  for (const tableName of REQUIRED_TABLES) {
    assert.equal(
      tableNames.has(tableName),
      true,
      `${tableName} should exist in migrated database ${sqliteDatabasePath}`
    );
  }
});
