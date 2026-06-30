const assert = require("node:assert/strict");
const test = require("node:test");

const {
  listProviderWorkspaces,
  getProviderWorkspace,
  getProviderLane,
  findProviderLanesByIntent,
  buildProviderMiniAppSection,
} = require("../utils/providerWorkspaces");

test("provider workspace manifest exposes all first-class providers", () => {
  assert.deepEqual(
    listProviderWorkspaces().map((provider) => provider.slug),
    ["paypal", "stripe", "wise", "paystack", "flutterwave", "crypto"],
  );
});

test("provider lanes include route and action metadata for command menus", () => {
  const paypal = getProviderWorkspace("paypal");
  const paypalInvoices = getProviderLane("paypal", "invoices");
  const stripeConnect = getProviderLane("stripe", "connect");
  const wiseReceive = getProviderLane("wise", "receive");

  assert.equal(paypal.displayName, "PayPal");
  assert.equal(paypalInvoices.miniAppSection, "services/paypal/invoices");
  assert.equal(paypalInvoices.botAction, "PP:INV");
  assert.equal(stripeConnect.botAction, "PROVIDER_PO:stripe");
  assert.equal(wiseReceive.status, "setup");
});

test("provider intent lookup powers collect and send command centers", () => {
  assert.deepEqual(
    findProviderLanesByIntent("collect").map(({ workspace, lane }) => `${workspace.slug}:${lane.id}`),
    [
      "paypal:invoices",
      "stripe:payments",
      "stripe:billing",
      "wise:receive",
      "paystack:collections",
      "paystack:virtual-accounts",
      "paystack:subscriptions",
      "flutterwave:collections",
      "crypto:receive",
    ],
  );

  assert.deepEqual(
    findProviderLanesByIntent("send").map(({ workspace, lane }) => `${workspace.slug}:${lane.id}`),
    [
      "paypal:payouts",
      "stripe:connect",
      "wise:send",
      "flutterwave:transfers",
      "crypto:send",
    ],
  );
});

test("mini app route sections are derived from provider lane routes", () => {
  assert.equal(buildProviderMiniAppSection("paypal", "invoices"), "services/paypal/invoices");
  assert.equal(buildProviderMiniAppSection("crypto", "security"), "services/crypto/security");
  assert.equal(buildProviderMiniAppSection("missing", "overview"), "services/missing/overview");
});
