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

console.log(JSON.stringify({
  ok: true,
  contract_version: PROVIDER_CONTRACT_VERSION,
  providers: workspaces.length
}));
