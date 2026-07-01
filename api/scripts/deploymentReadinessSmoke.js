'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../..');

const requiredFiles = [
  'api/package.json',
  'bot/package.json',
  'miniapp/package.json',
  'bot/utils/providerWorkspaces.js',
  'bot/utils/apiContract.js',
  'miniapp/src/lib/providerManifests.js',
  'miniapp/src/lib/providerWorkspaceContract.js',
  'miniapp/tests/smoke.spec.js',
];

const requiredScripts = {
  api: ['start', 'test', 'smoke:providers'],
  bot: ['test', 'smoke:providers'],
  miniapp: ['build', 'test:e2e'],
};

const liveSmokeEnvironment = ['BOT_TOKEN', 'MINI_APP_URL', 'API_BASE_URL'];

function resolveRepoPath(relativePath) {
  return path.join(repoRoot, relativePath);
}

function readPackageJson(packageName) {
  return JSON.parse(fs.readFileSync(resolveRepoPath(`${packageName}/package.json`), 'utf8'));
}

const errors = [];
const warnings = [];

for (const file of requiredFiles) {
  if (!fs.existsSync(resolveRepoPath(file))) {
    errors.push(`${file} is missing.`);
  }
}

for (const [packageName, scripts] of Object.entries(requiredScripts)) {
  let packageJson;

  try {
    packageJson = readPackageJson(packageName);
  } catch (_error) {
    errors.push(`${packageName}/package.json could not be read.`);
    continue;
  }

  for (const script of scripts) {
    if (!packageJson.scripts?.[script]) {
      errors.push(`${packageName} package is missing npm script "${script}".`);
    }
  }
}

for (const variable of liveSmokeEnvironment) {
  if (!process.env[variable]) {
    warnings.push(`${variable} is not set for live deployment smoke.`);
  }
}

const result = {
  ok: errors.length === 0,
  checked_at: new Date().toISOString(),
  checked_packages: Object.keys(requiredScripts),
  errors,
  warnings,
};

console.log(JSON.stringify(result, null, 2));

if (errors.length > 0) {
  process.exitCode = 1;
}
