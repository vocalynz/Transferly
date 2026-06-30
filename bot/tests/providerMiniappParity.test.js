const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const {
  PROVIDER_CONTRACT_VERSION,
  buildProviderMiniAppSection,
  listProviderWorkspaces,
} = require("../utils/providerWorkspaces");

async function loadMiniAppProviderManifest() {
  const manifestPath = path.resolve(__dirname, "../../miniapp/src/lib/providerManifests.js");
  return import(pathToFileURL(manifestPath).href);
}

async function loadMiniAppProviderContract() {
  const contractPath = path.resolve(__dirname, "../../miniapp/src/lib/providerWorkspaceContract.js");
  return import(pathToFileURL(contractPath).href);
}

function laneFromMiniAppSection(section) {
  const parts = String(section || "").split("/");
  assert.equal(parts[0], "services");
  assert.ok(parts[1], `missing provider slug in mini app section ${section}`);
  assert.ok(parts[2], `missing lane id in mini app section ${section}`);
  return {
    slug: parts[1],
    lane: parts[2],
  };
}

test("bot provider workspaces link to supported mini app provider lanes", async () => {
  const {
    getProviderManifest,
    getProviderWorkspaceRoute,
    isProviderLaneSupported,
  } = await loadMiniAppProviderManifest();

  for (const workspace of listProviderWorkspaces()) {
    const manifest = getProviderManifest(workspace.slug);
    assert.ok(manifest, `${workspace.slug} is missing from mini app provider manifests`);
    assert.ok(manifest.docsUrl, `${workspace.slug} should expose an official docs link`);
    assert.ok(manifest.supportUrl, `${workspace.slug} should expose a help/support link`);

    for (const lane of workspace.lanes) {
      const section = buildProviderMiniAppSection(workspace.slug, lane.id);
      const route = `/miniapp/${section}`;
      const routed = laneFromMiniAppSection(section);

      assert.equal(routed.slug, workspace.slug, `${workspace.slug}:${lane.id} routes to the wrong provider`);
      assert.equal(
        getProviderWorkspaceRoute(workspace.slug, routed.lane),
        route,
        `${workspace.slug}:${lane.id} mini app route drifted`,
      );
      assert.equal(
        isProviderLaneSupported(workspace.slug, routed.lane),
        true,
        `${workspace.slug}:${lane.id} points at unsupported mini app lane ${routed.lane}`,
      );
      assert.ok(lane.summary, `${workspace.slug}:${lane.id} needs user-facing summary copy`);
      assert.match(lane.status, /^(live|preview|setup|planned|unavailable)$/);
    }
  }
});

test("bot and mini app provider contracts stay package-local and version aligned", async () => {
  const miniAppContract = await loadMiniAppProviderContract();

  assert.equal(miniAppContract.PROVIDER_CONTRACT_VERSION, PROVIDER_CONTRACT_VERSION);
  assert.deepEqual(
    miniAppContract.PROVIDER_OPERATION_KEYS,
    ["invoices", "payouts", "balance", "activity"],
  );
});
