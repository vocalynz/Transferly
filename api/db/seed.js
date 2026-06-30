const { close, initializeDatabase, db, loadSchemaSql } = require('./index');
const { bootstrapService } = require('../services/bootstrapService');

async function seed() {
  await initializeDatabase();
  await db.exec(loadSchemaSql());

  const result = await bootstrapService.ensureDemoAccount();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  await close();
}

seed().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  close().catch(() => {});
  process.exit(1);
});
