const {
  initializeDatabase,
  db,
  loadSchemaSql,
  close,
  sqliteDatabasePath
} = require('./index');

const REQUIRED_TABLES = Object.freeze([
  'users',
  'wallets',
  'ledger_entries',
  'invoices',
  'invoice_templates',
  'payout_batches',
  'payouts',
  'audit_logs',
  'risk_flags',
  'webhook_events',
  'auth_credentials',
  'profiles',
  'platform_config',
  'faqs',
  'testimonials',
  'payment_ops_issues',
  'receipts',
  'points_transactions',
  'top_up_orders',
  'email_dispatches',
  'referral_events',
  'telegram_accounts',
  'telegram_command_logs'
]);

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

async function verifyRequiredTables() {
  const placeholders = REQUIRED_TABLES.map(() => '?').join(', ');
  const rows = await db.all(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${placeholders})`,
    REQUIRED_TABLES
  );
  const existingTables = new Set(rows.map((row) => row.name));
  const missingTables = REQUIRED_TABLES.filter((tableName) => !existingTables.has(tableName));

  if (missingTables.length > 0) {
    throw new Error(
      `SQLite schema migration incomplete for ${sqliteDatabasePath}. Missing tables: ${missingTables.join(', ')}`
    );
  }
}

async function migrate() {
  await initializeDatabase();
  await db.exec(loadSchemaSql());
  await ensureInvoiceColumns();
  await ensurePlatformConfigColumns();
  await verifyRequiredTables();
}

if (require.main === module) {
  migrate()
    .then(async () => {
      await close();
      process.stdout.write(`SQLite schema is up to date at ${sqliteDatabasePath}.\n`);
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
}

module.exports = {
  REQUIRED_TABLES,
  migrate,
  verifyRequiredTables
};
