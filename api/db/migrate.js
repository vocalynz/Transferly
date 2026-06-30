const { initializeDatabase, db, loadSchemaSql, close } = require('./index');

async function ensureColumn(tableName, columnName, columnDefinition) {
  const columns = await db.all(`PRAGMA table_info(${tableName})`);
  const exists = columns.some((column) => column.name === columnName);
  if (!exists) {
    await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}

async function ensureInvoiceColumns() {
  await ensureColumn('invoices', 'paypal_qr_details_json', 'TEXT');
  await ensureColumn('invoices', 'paypal_synced_at', 'TEXT');
  await ensureColumn('invoices', 'template_id', 'TEXT');
  await ensureColumn('invoices', 'issue_date', 'TEXT');
  await ensureColumn('invoices', 'auto_reminders_cancelled_at', 'TEXT');
}

async function ensurePlatformConfigColumns() {
  await ensureColumn('platform_config', 'payout_minimum_cents', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn('platform_config', 'payout_fee_fixed_cents', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn('platform_config', 'payout_fee_percentage_bps', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn('platform_config', 'payout_manual_review_cents', 'INTEGER NOT NULL DEFAULT 0');
}

async function migrate() {
  await initializeDatabase();
  await db.exec(loadSchemaSql());
  await ensureInvoiceColumns();
  await ensurePlatformConfigColumns();
}

migrate()
  .then(async () => {
    await close();
    process.stdout.write('SQLite schema is up to date.\n');
  })
  .catch(async (error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    try {
      await close();
    } catch (_closeError) {
      // Ignore close failures during migration shutdown.
    }
    process.exit(1);
  });
