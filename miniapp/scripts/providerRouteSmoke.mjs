import assert from 'node:assert/strict';
import {
  PROVIDER_CONTRACT_VERSION,
  PROVIDER_OPERATION_KEYS,
  isProviderOperationImplemented
} from '../src/lib/providerWorkspaceContract.js';
import {
  getProviderWorkspaceRoute,
  isProviderLaneSupported,
  providerManifests
} from '../src/lib/providerManifests.js';

assert.ok(providerManifests.length > 0, 'No Mini App provider manifests are registered.');
assert.deepEqual(PROVIDER_OPERATION_KEYS, ['invoices', 'payouts', 'balance', 'activity']);
assert.equal(isProviderOperationImplemented('live'), true);
assert.equal(isProviderOperationImplemented('preview'), true);
assert.equal(isProviderOperationImplemented('setup'), false);

for (const manifest of providerManifests) {
  assert.ok(manifest.slug, 'Provider manifest is missing a slug.');
  assert.ok(manifest.lanes.length > 0, `${manifest.slug} has no Mini App lanes.`);
  for (const lane of manifest.lanes) {
    const route = getProviderWorkspaceRoute(manifest.slug, lane.id);
    assert.ok(route.startsWith(`/miniapp/services/${manifest.slug}/`), `${manifest.slug}:${lane.id} has a bad route.`);
    assert.equal(isProviderLaneSupported(manifest.slug, lane.id), true);
  }
}

console.log(JSON.stringify({
  ok: true,
  contract_version: PROVIDER_CONTRACT_VERSION,
  providers: providerManifests.length
}));
