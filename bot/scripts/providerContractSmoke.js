const assert = require('node:assert/strict');
const {
  PROVIDER_CONTRACT_VERSION,
  contractShapes,
  providerRoutes,
  validateApiResponseContract
} = require('../utils/apiContract');
const { listProviderWorkspaces } = require('../utils/providerWorkspaces');

const workspaces = listProviderWorkspaces();
assert.ok(workspaces.length > 0, 'No bot provider workspaces are registered.');

for (const workspace of workspaces) {
  assert.ok(providerRoutes.provider(workspace.slug).includes(workspace.slug));
  assert.ok(providerRoutes.providerHealth(workspace.slug).endsWith('/health'));
  assert.ok(providerRoutes.providerStatus(workspace.slug).endsWith('/status'));
  assert.ok(providerRoutes.actionPreflight(workspace.slug, 'invoices').endsWith('/actions/invoices/preflight'));
  assert.ok(workspace.lanes.length > 0, `${workspace.slug} has no bot provider lanes.`);
}

validateApiResponseContract(
  {
    data: {
      provider: 'paypal',
      display_name: 'PayPal',
      provider_status: 'ready',
      score: 100,
      status: 'operational',
      failed_webhooks: 0,
      recent_webhooks: 1,
      unresolved_issues: 0,
      reasons: [],
      next_actions: []
    },
    provider: 'paypal',
    contract_version: PROVIDER_CONTRACT_VERSION,
    requestId: 'provider-smoke'
  },
  contractShapes.providerHealth,
  { method: 'GET', url: providerRoutes.providerHealth('paypal'), requestId: 'provider-smoke' }
);

validateApiResponseContract(
  {
    data: {
      provider: 'paypal',
      display_name: 'PayPal',
      status: 'ready',
      ready: true,
      provider_status: 'ready',
      health_status: 'operational',
      health_score: 100,
      operations: [],
      lanes: [],
      warnings: [],
      next_actions: []
    },
    provider: 'paypal',
    contract_version: PROVIDER_CONTRACT_VERSION,
    requestId: 'provider-status-smoke'
  },
  contractShapes.providerStatus,
  { method: 'GET', url: providerRoutes.providerStatus('paypal'), requestId: 'provider-status-smoke' }
);

validateApiResponseContract(
  {
    data: {
      allowed: true,
      provider: 'paypal',
      operation: 'invoices',
      label: 'Invoices',
      status: 'live',
      reason: null,
      code: null,
      supported_providers: [],
      warnings: [],
      next_actions: []
    },
    provider: 'paypal',
    contract_version: PROVIDER_CONTRACT_VERSION,
    requestId: 'provider-preflight-smoke'
  },
  contractShapes.providerActionPreflight,
  { method: 'GET', url: providerRoutes.actionPreflight('paypal', 'invoices'), requestId: 'provider-preflight-smoke' }
);

console.log(JSON.stringify({
  ok: true,
  contract_version: PROVIDER_CONTRACT_VERSION,
  providers: workspaces.length
}));
