const assert = require("node:assert/strict");
const test = require("node:test");

process.env.ADMIN_TELEGRAM_ID ||= "1001";
process.env.ADMIN_TELEGRAM_USERNAME ||= "admin";
process.env.API_URL ||= "http://localhost:3000";
process.env.BOT_TOKEN ||= "123456:test-token";
process.env.ADMIN_API_TOKEN ||= "admin-token";
process.env.MINI_APP_URL ||= "https://mini.transferly.test/miniapp";

const {
  SCREEN_TYPES,
  TELEGRAM_COMMANDS,
  buildMiniAppUrl,
  buildScreenKeyboard,
  buildStartKeyboard,
  buildMainMenuKeyboard,
  buildCommandHubKeyboard,
  buildCommandSectionKeyboard,
  formatCommandSectionBody,
  buildProvidersKeyboard,
  buildInvoiceCenterKeyboard,
  buildPayoutCenterKeyboard,
  buildOpsCommandCenterKeyboard,
  buildBackKeyboard,
  buildUsersKeyboard,
  buildUsersListKeyboard,
  buildUserDetailKeyboard,
  buildUsersAuditKeyboard,
  buildPaymentAuditKeyboard,
  buildBotAnalyticsKeyboard,
  buildSubscriptionAlertsKeyboard,
  buildSubscriptionDurationKeyboard,
  buildUserConfirmKeyboard,
  buildServiceGroupsKeyboard,
  buildServiceDetailKeyboard,
  buildServiceLaneKeyboard,
  buildServiceSearchResultsKeyboard,
  buildProviderWorkspaceKeyboard,
  buildPayPalWorkspaceKeyboard,
  buildPayPalListKeyboard,
  buildInvoiceDetailKeyboard,
  buildInvoiceResultKeyboard,
  buildPayoutDetailKeyboard,
  buildPayoutResultKeyboard,
  buildCallbackRecoveryKeyboard,
  invoiceReleaseGuard,
  payoutActionGuard,
  rememberScreen,
  prepareNavigationAction,
  popBackAction,
  resetNavigation,
} = require("../bot");
const { handlePublicCallback } = require("../callbacks/public");
const { handleServiceCallback } = require("../callbacks/services");
const { handlePaymentCallback } = require("../callbacks/payments");
const { handleUserCallback } = require("../callbacks/users");
const { searchServices, getServiceLane } = require("../utils/serviceCatalog");
const { ROLES, STATUS, CAPABILITIES, hasCapability, getActionCapability, getCommandCapability } = require("../utils/capabilities");
const { initialSessionState } = require("../utils/sessionState");

function ctx() {
  return {
    session: initialSessionState(),
  };
}

function labels(keyboard) {
  return (keyboard.inline_keyboard || []).flat().map((button) => button.text);
}

function callbackActions(keyboard) {
  return (keyboard.inline_keyboard || [])
    .flat()
    .map((button) => button.callback_data)
    .filter(Boolean)
    .map((data) => {
      const value = String(data);
      return value.startsWith("cb|") ? value.split("|")[1] : value;
    });
}

test("visible Telegram command menu stays intentionally small", () => {
  assert.deepEqual(
    TELEGRAM_COMMANDS.map((command) => command.command),
    ["start", "menu", "miniapp", "providers", "services", "account", "status", "help", "whoami", "cancel"],
  );
});

test("start launcher only exposes visible command entry points", () => {
  const startLabels = labels(buildStartKeyboard(ctx(), { role: ROLES.OWNER, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true, isOwner: true }));
  assert.deepEqual(startLabels, [
    "📋 Menu",
    "💳 Providers",
    "🧰 Services",
    "📚 Help",
    "🪪 Whoami",
    "✖️ Cancel Prompt",
    "🚀 Open Dashboard",
    "🧾 Open Studio",
    "💰 Open Wallet",
  ]);
  assert.equal(startLabels.includes("🏦 Wallet Records"), false);
  assert.equal(startLabels.includes("📄 Invoices"), false);
  assert.equal(startLabels.includes("👥 Users"), false);
});

test("mini app launch URLs target section routes and start params", () => {
  assert.equal(buildMiniAppUrl("home"), "https://mini.transferly.test/miniapp?startapp=home");
  assert.equal(buildMiniAppUrl("dashboard"), "https://mini.transferly.test/miniapp?startapp=dashboard");
  assert.equal(buildMiniAppUrl("invoices"), "https://mini.transferly.test/miniapp/invoices?startapp=invoices");
  assert.equal(buildMiniAppUrl("generate"), "https://mini.transferly.test/miniapp/studio?startapp=generate");
  assert.equal(buildMiniAppUrl("history"), "https://mini.transferly.test/miniapp/vault?startapp=history");
  assert.equal(buildMiniAppUrl("wallet"), "https://mini.transferly.test/miniapp/wallet?startapp=wallet");
  assert.equal(
    buildMiniAppUrl("services/paypal/invoices"),
    "https://mini.transferly.test/miniapp/services/paypal/invoices?startapp=services_paypal_invoices",
  );
});

test("main menu is role-aware", () => {
  const guestLabels = labels(buildMainMenuKeyboard(ctx(), { role: ROLES.GUEST, isAuthorized: false }));
  assert.deepEqual(guestLabels.slice(0, 2), ["🪪 Whoami", "📚 Help"]);
  assert.equal(guestLabels.includes("🏦 Wallet Records"), false);

  const userLabels = labels(buildMainMenuKeyboard(ctx(), { role: ROLES.USER, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: false }));
  assert.ok(userLabels.includes("💳 Providers"));
  assert.ok(userLabels.includes("🧰 Services"));
  assert.equal(userLabels.includes("📊 Activity"), false);
  assert.ok(userLabels.includes("🏦 Wallet Records"));
  assert.ok(userLabels.includes("🧾 Receipts"));
  assert.equal(userLabels.includes("📄 Invoices"), false);
  assert.equal(userLabels.includes("💸 Payouts"), false);
  assert.equal(userLabels.includes("👥 Users"), false);

  const adminLabels = labels(buildMainMenuKeyboard(ctx(), { role: ROLES.ADMIN, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true }));
  assert.ok(adminLabels.includes("📄 Invoices"));
  assert.ok(adminLabels.includes("💸 Payouts"));
  assert.ok(adminLabels.includes("📊 Activity"));
  assert.ok(adminLabels.includes("🛡️ Risk"));
  assert.ok(adminLabels.includes("🔐 Security"));
  assert.ok(adminLabels.includes("🤖 Bot Ops"));
  assert.equal(adminLabels.includes("👥 Users"), false);

  const ownerLabels = labels(buildMainMenuKeyboard(ctx(), { role: ROLES.OWNER, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true, isOwner: true }));
  assert.ok(ownerLabels.includes("📄 Invoices"));
  assert.ok(ownerLabels.includes("💸 Payouts"));
  assert.ok(ownerLabels.includes("👥 Users"));
});

test("command hub exposes role-aware submenus and provider continuity", () => {
  const guestLabels = labels(buildCommandHubKeyboard(ctx(), { role: ROLES.GUEST, isAuthorized: false }));
  assert.deepEqual(guestLabels.slice(0, 2), ["🪪 Whoami", "📚 Help"]);

  const userCtx = ctx();
  userCtx.session.lastProvider = "stripe";
  const userLabels = labels(buildCommandHubKeyboard(userCtx, { role: ROLES.USER, status: STATUS.ACTIVE, isAuthorized: true }));
  assert.ok(userLabels.includes("↩️ Continue Stripe"));
  assert.ok(userLabels.includes("🧾 Collect"));
  assert.ok(userLabels.includes("💸 Send"));
  assert.ok(userLabels.includes("🏦 Account"));
  assert.ok(userLabels.includes("🛟 Support"));
  assert.equal(userLabels.includes("🧩 Operations"), false);

  const adminLabels = labels(buildCommandHubKeyboard(ctx(), { role: ROLES.ADMIN, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true }));
  assert.ok(adminLabels.includes("🧩 Operations"));
  assert.ok(adminLabels.includes("📊 Activity"));
  assert.ok(adminLabels.includes("📈 Analytics"));
  assert.ok(adminLabels.includes("🔐 Security"));
});

test("command section keyboards route to provider-first and account submenus", () => {
  const admin = { role: ROLES.ADMIN, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true };
  const collectKeyboard = buildCommandSectionKeyboard(ctx(), "MENU_COLLECT", admin);
  const sendKeyboard = buildCommandSectionKeyboard(ctx(), "MENU_SEND", admin);
  const accountKeyboard = buildCommandSectionKeyboard(ctx(), "MENU_ACCOUNT", admin);
  const supportKeyboard = buildCommandSectionKeyboard(ctx(), "MENU_SUPPORT", admin);

  assert.ok(callbackActions(collectKeyboard).includes("PP:INV"));
  assert.ok(labels(collectKeyboard).includes("📄 Open Collection Center"));
  assert.ok(callbackActions(sendKeyboard).includes("PP:PO"));
  assert.ok(labels(sendKeyboard).includes("💸 Open Sending Center"));
  assert.ok(callbackActions(accountKeyboard).includes("PROFILE"));
  assert.ok(labels(accountKeyboard).includes("👤 Open Profile"));
  assert.ok(callbackActions(supportKeyboard).includes("HELP"));
  assert.ok(callbackActions(supportKeyboard).includes("ACTIVITY"));
  assert.ok(labels(supportKeyboard).includes("🛟 Open Support"));
  assert.ok(callbackActions(buildCommandSectionKeyboard(ctx(), "MENU_ADMIN", admin)).includes("PAYMENT_AUDIT"));
});

test("command section bodies describe guided bot and mini app workflows", () => {
  const collectBody = formatCommandSectionBody("MENU_COLLECT");
  assert.match(collectBody, /Collection Workflows/);
  assert.match(collectBody, /Mini App mirror/);
  assert.match(collectBody, /provider workspaces/);
  assert.match(collectBody, /Release and void actions/);

  const sendBody = formatCommandSectionBody("MENU_SEND");
  assert.match(sendBody, /Sending Workflows/);
  assert.match(sendBody, /Payouts/);
  assert.match(sendBody, /Approving, rejecting, retrying/);

  const accountBody = formatCommandSectionBody("MENU_ACCOUNT");
  assert.match(accountBody, /Profile, Wallet, Vault/);
  assert.match(accountBody, /Self-service status checks/);

  const adminBody = formatCommandSectionBody("MENU_ADMIN");
  assert.match(adminBody, /Activity, clients, risk, security/);
  assert.match(adminBody, /Production monitoring/);

  const supportBody = formatCommandSectionBody("MENU_SUPPORT");
  assert.match(supportBody, /Help and Whoami/);
  assert.match(supportBody, /Support, Profile, Dashboard/);
});

test("screen router prevents detail screens from rendering the main grid", () => {
  const detailLabels = labels(buildScreenKeyboard(ctx(), SCREEN_TYPES.DETAIL));
  assert.deepEqual(detailLabels, ["⬅️ Back", "🏠 Main Menu"]);

  const mainLabels = labels(buildScreenKeyboard(ctx(), SCREEN_TYPES.MAIN, { access: { role: ROLES.ADMIN, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true } }));
  assert.ok(mainLabels.includes("📄 Invoices"));
  assert.ok(mainLabels.includes("💸 Payouts"));
});

test("service catalog exposes search from services screen", () => {
  const serviceLabels = labels(buildServiceGroupsKeyboard(ctx()));
  assert.ok(serviceLabels.includes("🔎 Search Service"));

  const matches = searchServices("paypal");
  assert.equal(matches[0].slug, "paypal");

  const resultLabels = labels(buildServiceSearchResultsKeyboard(ctx(), matches.slice(0, 1)));
  assert.ok(resultLabels.includes("PayPal"));
  assert.ok(resultLabels.includes("🔎 Search Again"));
});

test("service command centers expose Telegram lanes and mini app actions", () => {
  const service = searchServices("opay")[0];
  const lane = getServiceLane(service, "wallet-record");
  assert.equal(lane.label, "Wallet Record");

  const detailKeyboard = buildServiceDetailKeyboard(ctx(), service);
  const detailLabels = labels(detailKeyboard);
  assert.ok(detailLabels.includes("✅ Wallet Record"));
  assert.ok(detailLabels.includes("✅ Support Context"));
  assert.ok(detailLabels.includes("🚀 Open Service Workspace"));
  assert.ok(callbackActions(detailKeyboard).includes("SERVICE_LANE:opay:wallet-record"));

  const laneKeyboard = buildServiceLaneKeyboard(ctx(), service, lane);
  assert.ok(labels(laneKeyboard).includes("🚀 Start Lane"));
  assert.ok(labels(laneKeyboard).includes("✍️ Custom Details"));
  assert.ok(labels(laneKeyboard).includes("🚀 Open Wallet Record"));
  assert.ok(callbackActions(laneKeyboard).includes("SERVICE_ACTION:opay:wallet-record"));
  assert.ok(callbackActions(laneKeyboard).includes("SERVICE:opay"));
});

test("PayPal workspace exposes invoice and payout search", () => {
  const userLabels = labels(buildPayPalWorkspaceKeyboard(ctx(), { role: ROLES.USER, status: STATUS.ACTIVE, isAuthorized: true }));
  assert.ok(userLabels.includes("✉️ Notification"));
  assert.equal(userLabels.includes("🔎 Search Invoice"), false);
  assert.equal(userLabels.includes("🔎 Search Payout"), false);

  const paypalLabels = labels(buildPayPalWorkspaceKeyboard(ctx(), { role: ROLES.ADMIN, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true }));
  assert.ok(paypalLabels.includes("🔎 Search Invoice"));
  assert.ok(paypalLabels.includes("🔎 Search Payout"));
});

test("provider cockpit exposes provider lanes and admin operations", () => {
  const userLabels = labels(buildProvidersKeyboard(ctx(), { role: ROLES.USER, status: STATUS.ACTIVE, isAuthorized: true }));
  assert.ok(userLabels.includes("PayPal"));
  assert.ok(userLabels.includes("Stripe"));
  assert.ok(userLabels.includes("🧰 Service Catalog"));
  assert.equal(userLabels.includes("📄 Invoices"), false);

  const adminLabels = labels(buildProvidersKeyboard(ctx(), { role: ROLES.ADMIN, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true }));
  assert.ok(adminLabels.includes("📄 Invoices"));
  assert.ok(adminLabels.includes("💸 Payouts"));
  assert.ok(adminLabels.includes("📊 Activity"));
  assert.ok(adminLabels.includes("🔐 Security"));

  const stripe = searchServices("stripe")[0];
  const stripeWorkspaceLabels = labels(buildProviderWorkspaceKeyboard(ctx(), stripe, { role: ROLES.ADMIN, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true }));
  assert.ok(stripeWorkspaceLabels.includes("📄 Open Invoices"));
  assert.ok(stripeWorkspaceLabels.includes("💸 Open Payouts"));
  assert.ok(stripeWorkspaceLabels.includes("💰 Provider Balance"));
  assert.ok(stripeWorkspaceLabels.includes("🛰 Webhooks"));
  assert.ok(stripeWorkspaceLabels.includes("⚠️ Issues"));
});

test("invoice and payout command centers mirror provider workspace actions", () => {
  const admin = { role: ROLES.ADMIN, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true };
  const invoiceKeyboard = buildInvoiceCenterKeyboard(ctx(), admin);
  const invoiceLabels = labels(invoiceKeyboard);
  assert.ok(invoiceLabels.includes("✅ PayPal Invoices"));
  assert.ok(invoiceLabels.includes("✅ Stripe Payments"));
  assert.ok(invoiceLabels.includes("✅ Crypto Receive"));
  assert.ok(invoiceLabels.includes("📄 Open Collection Center"));
  assert.ok(invoiceLabels.includes("All Providers"));
  assert.ok(callbackActions(invoiceKeyboard).includes("PP:INV"));
  assert.ok(callbackActions(invoiceKeyboard).includes("PROVIDER_INV:stripe"));
  assert.ok(callbackActions(invoiceKeyboard).includes("PROVIDER_INV:crypto"));
  assert.ok(callbackActions(invoiceKeyboard).includes("PROVIDERS"));

  const payoutKeyboard = buildPayoutCenterKeyboard(ctx(), admin);
  const payoutLabels = labels(payoutKeyboard);
  assert.ok(payoutLabels.includes("✅ PayPal Payouts"));
  assert.ok(payoutLabels.includes("✅ Stripe Payouts"));
  assert.ok(payoutLabels.includes("🛠 Wise Send"));
  assert.ok(payoutLabels.includes("🛠 Flutterwave Transfers"));
  assert.ok(payoutLabels.includes("🛠 Crypto Send"));
  assert.ok(payoutLabels.includes("💸 Open Sending Center"));
  assert.ok(payoutLabels.includes("All Providers"));
  assert.ok(callbackActions(payoutKeyboard).includes("PP:PO"));
  assert.ok(callbackActions(payoutKeyboard).includes("PROVIDER_PO:stripe"));
  assert.ok(callbackActions(payoutKeyboard).includes("PROVIDER_LANE:wise:send"));
  assert.ok(callbackActions(payoutKeyboard).includes("PROVIDERS"));
});

test("operations command center mirrors Mini App and admin recovery actions", () => {
  const keyboard = buildOpsCommandCenterKeyboard(ctx());
  const opsLabels = labels(keyboard);
  assert.ok(opsLabels.includes("📊 Activity"));
  assert.ok(opsLabels.includes("👥 Clients"));
  assert.ok(opsLabels.includes("⚠️ Issues"));
  assert.ok(opsLabels.includes("🛡️ Risk"));
  assert.ok(opsLabels.includes("🔐 Security"));
  assert.ok(opsLabels.includes("🧺 Orders"));
  assert.ok(opsLabels.includes("🔄 Reconcile"));
  assert.ok(opsLabels.includes("🧾 Payment Audit"));
  assert.ok(opsLabels.includes("📊 Bot Analytics"));
  assert.ok(opsLabels.includes("🤖 Bot Ops"));
  assert.ok(opsLabels.includes("🔍 Status"));
  assert.ok(opsLabels.includes("💳 Provider Dashboard"));
  assert.ok(opsLabels.includes("🚀 Open Dashboard"));
  assert.ok(opsLabels.includes("🧾 Open Studio"));
  assert.ok(callbackActions(keyboard).includes("ACTIVITY"));
  assert.ok(callbackActions(keyboard).includes("PAYMENT_AUDIT"));
  assert.ok(callbackActions(keyboard).includes("PROVIDERS"));
});

test("provider record keyboards return to their originating provider workspace", () => {
  const fakeCtx = ctx();
  const stripeInvoice = {
    provider: "stripe",
    metadata: {
      provider: "stripe",
    },
  };
  const cryptoPayout = {
    metadata: {
      provider: "crypto",
    },
  };

  assert.ok(callbackActions(buildInvoiceDetailKeyboard(fakeCtx, stripeInvoice, "inv_1")).includes("PROVIDER_INV:stripe"));
  assert.ok(callbackActions(buildInvoiceResultKeyboard(fakeCtx, "inv_1", stripeInvoice)).includes("PROVIDER:stripe"));
  assert.ok(callbackActions(buildPayoutDetailKeyboard(fakeCtx, cryptoPayout, "po_1")).includes("PROVIDER_PO:crypto"));
  assert.ok(callbackActions(buildPayoutResultKeyboard(fakeCtx, "po_1", cryptoPayout)).includes("PROVIDER:crypto"));
});

test("capabilities allow authorized users to use services but block payment ops", () => {
  const user = { role: ROLES.USER, status: STATUS.ACTIVE };
  const admin = { role: ROLES.ADMIN, status: STATUS.ACTIVE };
  const guest = { role: ROLES.GUEST, status: STATUS.ACTIVE };

  assert.equal(hasCapability(user, CAPABILITIES.SERVICES_USE), true);
  assert.equal(hasCapability(user, CAPABILITIES.PAYMENTS_READ), false);
  assert.equal(hasCapability(admin, CAPABILITIES.PAYMENTS_READ), true);
  assert.equal(hasCapability(admin, CAPABILITIES.USERS_MANAGE), false);
  assert.equal(hasCapability({ role: ROLES.OWNER, status: STATUS.ACTIVE }, CAPABILITIES.USERS_MANAGE), true);
  assert.equal(hasCapability({ role: ROLES.OWNER, status: STATUS.ACTIVE, subscriptionExpired: true }, CAPABILITIES.USERS_MANAGE), true);
  assert.equal(hasCapability({ role: ROLES.ADMIN, status: STATUS.ACTIVE, subscriptionExpired: true }, CAPABILITIES.PAYMENTS_READ), false);
  assert.equal(hasCapability({ role: ROLES.USER, status: STATUS.ACTIVE, subscriptionExpired: true }, CAPABILITIES.SERVICES_USE), false);
  assert.equal(hasCapability(guest, CAPABILITIES.SERVICES_USE), false);
  assert.equal(getActionCapability("GROUP:BANK"), CAPABILITIES.SERVICES_USE);
  assert.equal(getActionCapability("SERVICE_ACTION:opay:wallet-record"), CAPABILITIES.SERVICES_USE);
  assert.equal(getActionCapability("SERVICE_LANE:opay:wallet-record"), CAPABILITIES.SERVICES_USE);
  assert.equal(getActionCapability("PROVIDERS"), CAPABILITIES.SERVICES_USE);
  assert.equal(getActionCapability("MENU_COLLECT"), CAPABILITIES.SERVICES_USE);
  assert.equal(getActionCapability("MENU_SEND"), CAPABILITIES.SERVICES_USE);
  assert.equal(getActionCapability("MENU_ACCOUNT"), CAPABILITIES.ACCOUNT_READ);
  assert.equal(getActionCapability("MENU_ADMIN"), CAPABILITIES.SYSTEM_STATUS);
  assert.equal(getActionCapability("MENU_SUPPORT"), CAPABILITIES.PUBLIC);
  assert.equal(getCommandCapability("stripe"), CAPABILITIES.SERVICES_USE);
  assert.equal(getCommandCapability("paypal"), CAPABILITIES.SERVICES_USE);
  assert.equal(getCommandCapability("invoices"), CAPABILITIES.PAYMENTS_READ);
  assert.equal(getActionCapability("ACTIVITY"), CAPABILITIES.PAYMENTS_READ);
  assert.equal(getActionCapability("SECURITY"), CAPABILITIES.SYSTEM_STATUS);
  assert.equal(getActionCapability("PP:INV"), CAPABILITIES.PAYMENTS_READ);
  assert.equal(getActionCapability("PROVIDER_INV:stripe"), CAPABILITIES.PAYMENTS_READ);
  assert.equal(getActionCapability("PROVIDER_PO:stripe"), CAPABILITIES.PAYMENTS_READ);
  assert.equal(getActionCapability("PROVIDER_BAL:stripe"), CAPABILITIES.PAYMENTS_READ);
  assert.equal(getActionCapability("PROVIDER_WEBHOOKS:stripe"), CAPABILITIES.PAYMENTS_READ);
  assert.equal(getActionCapability("PROVIDER_ISSUES:stripe"), CAPABILITIES.PAYMENTS_READ);
  assert.equal(getActionCapability("BOT_OPS"), CAPABILITIES.SYSTEM_STATUS);
  assert.equal(getActionCapability("USER_D:123"), CAPABILITIES.USERS_MANAGE);
});

test("owner user-management keyboards include duration presets and confirmation controls", () => {
  const usersLabels = labels(buildUsersKeyboard(ctx()));
  assert.ok(usersLabels.includes("📋 List Users"));
  assert.ok(usersLabels.includes("⏳ Expiring"));
  assert.ok(usersLabels.includes("🔎 Search Users"));
  assert.ok(usersLabels.includes("🔔 Alerts"));
  assert.ok(usersLabels.includes("➕ Add User"));
  assert.ok(usersLabels.includes("⬆️ Promote User"));
  assert.ok(usersLabels.includes("⬇️ Demote User"));
  assert.ok(usersLabels.includes("⏸ Suspend"));
  assert.ok(usersLabels.includes("▶️ Reactivate"));
  assert.ok(usersLabels.includes("❌ Revoke"));
  assert.ok(usersLabels.includes("🧾 Audit Logs"));
  assert.ok(usersLabels.includes("📊 Analytics"));

  const userListLabels = labels(buildUsersListKeyboard(ctx(), [{ telegram_id: 123, username: "alice", role: ROLES.USER }]));
  assert.ok(userListLabels.includes("USER · @alice"));

  const detailLabels = labels(buildUserDetailKeyboard(ctx(), { telegram_id: 123, username: "alice", role: ROLES.USER, status: STATUS.ACTIVE }));
  assert.ok(detailLabels.includes("➕ Extend"));
  assert.ok(detailLabels.includes("⬆️ Promote"));
  assert.ok(detailLabels.includes("⏸ Suspend"));

  const durationLabels = labels(buildSubscriptionDurationKeyboard(ctx()));
  assert.deepEqual(durationLabels, ["7 days", "30 days", "90 days", "365 days", "✍️ Type Custom Days", "Cancel", "Back"]);

  const confirmLabels = labels(buildUserConfirmKeyboard(ctx(), { action: "promote" }));
  assert.ok(confirmLabels.includes("✅ Confirm"));
  assert.ok(confirmLabels.includes("🕒 Change Days"));

  const suspendLabels = labels(buildUserConfirmKeyboard(ctx(), { action: "suspend" }));
  assert.ok(suspendLabels.includes("✅ Confirm"));
  assert.equal(suspendLabels.includes("🕒 Change Days"), false);
});

test("all generated inline callback actions have router coverage", async () => {
  const service = searchServices("paypal")[0];
  const stripeService = searchServices("stripe")[0];
  const walletService = searchServices("opay")[0];
  const walletLane = getServiceLane(walletService, "wallet-record");
  const invoiceList = buildPayPalListKeyboard(
    ctx(),
    "invoice",
    [{ key: "inv_1", label: "Invoice 1" }],
    { page: 2, has_next_page: true },
    { page: 2, status: "ALL" },
  );
  const payoutList = buildPayPalListKeyboard(
    ctx(),
    "payout",
    [{ key: "po_1", label: "Payout 1" }],
    { page: 2, has_next_page: true },
    { page: 2, status: "ALL", providerState: "ALL" },
  );
  const user = { telegram_id: 123, username: "alice", role: ROLES.USER, status: STATUS.ACTIVE };
  const ownerAccess = { role: ROLES.OWNER, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true, isOwner: true };
  const actionSet = new Set([
    ...callbackActions(buildStartKeyboard(ctx(), ownerAccess)),
    ...callbackActions(buildMainMenuKeyboard(ctx(), ownerAccess)),
    ...callbackActions(buildMainMenuKeyboard(ctx(), { role: ROLES.USER, status: STATUS.ACTIVE, isAuthorized: true })),
    ...callbackActions(buildCommandHubKeyboard(ctx(), ownerAccess)),
    ...callbackActions(buildCommandSectionKeyboard(ctx(), "MENU_COLLECT", ownerAccess)),
    ...callbackActions(buildCommandSectionKeyboard(ctx(), "MENU_SEND", ownerAccess)),
    ...callbackActions(buildCommandSectionKeyboard(ctx(), "MENU_ACCOUNT", ownerAccess)),
    ...callbackActions(buildCommandSectionKeyboard(ctx(), "MENU_ADMIN", ownerAccess)),
    ...callbackActions(buildCommandSectionKeyboard(ctx(), "MENU_SUPPORT", ownerAccess)),
    ...callbackActions(buildProvidersKeyboard(ctx(), ownerAccess)),
    ...callbackActions(buildInvoiceCenterKeyboard(ctx(), ownerAccess)),
    ...callbackActions(buildPayoutCenterKeyboard(ctx(), ownerAccess)),
    ...callbackActions(buildOpsCommandCenterKeyboard(ctx())),
    ...callbackActions(buildServiceGroupsKeyboard(ctx())),
    ...callbackActions(buildServiceSearchResultsKeyboard(ctx(), [service])),
    ...callbackActions(buildServiceDetailKeyboard(ctx(), walletService)),
    ...callbackActions(buildServiceLaneKeyboard(ctx(), walletService, walletLane)),
    ...callbackActions(buildPayPalWorkspaceKeyboard(ctx(), { role: ROLES.ADMIN, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true })),
    ...callbackActions(buildProviderWorkspaceKeyboard(ctx(), stripeService, ownerAccess)),
    ...callbackActions(invoiceList),
    ...callbackActions(payoutList),
    ...callbackActions(buildInvoiceResultKeyboard(ctx(), "inv_1")),
    ...callbackActions(buildPayoutResultKeyboard(ctx(), "po_1")),
    ...callbackActions(buildUsersKeyboard(ctx())),
    ...callbackActions(buildUsersListKeyboard(ctx(), [user])),
    ...callbackActions(buildUserDetailKeyboard(ctx(), user)),
    ...callbackActions(buildUsersAuditKeyboard(ctx())),
    ...callbackActions(buildPaymentAuditKeyboard(ctx())),
    ...callbackActions(buildBotAnalyticsKeyboard(ctx())),
    ...callbackActions(buildSubscriptionAlertsKeyboard(ctx())),
    ...callbackActions(buildSubscriptionDurationKeyboard(ctx())),
    ...callbackActions(buildUserConfirmKeyboard(ctx(), { action: "promote" })),
  ]);
  actionSet.delete("BACK");

  const calls = [];
  const handlers = new Proxy({
    getService: () => service,
  }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return async (...args) => {
        calls.push([String(prop), args]);
      };
    },
  });
  const deps = {
    requireAdmin: async () => true,
    handlers,
  };

  const uncovered = [];
  for (const action of actionSet) {
    const handled =
      await handleServiceCallback(ctx(), action, deps) ||
      await handlePaymentCallback(ctx(), action, deps) ||
      await handleUserCallback(ctx(), action, deps) ||
      await handlePublicCallback(ctx(), action, deps);
    if (!handled) uncovered.push(action);
  }

  assert.deepEqual(uncovered, []);
  assert.ok(calls.length > 0);
});

test("back navigation uses the saved previous screen", () => {
  const fakeCtx = ctx();
  resetNavigation(fakeCtx, "MENU");
  rememberScreen(fakeCtx, "WHOAMI");
  assert.equal(popBackAction(fakeCtx), "MENU");

  const backLabels = labels(buildBackKeyboard(fakeCtx));
  assert.deepEqual(backLabels, ["⬅️ Back", "🏠 Main Menu"]);
});

test("parent inline routes replace child screens in the navigation stack", () => {
  const serviceCtx = ctx();
  resetNavigation(serviceCtx, "MENU");
  rememberScreen(serviceCtx, "SERVICES");
  rememberScreen(serviceCtx, "GROUP:FLASH");
  rememberScreen(serviceCtx, "SERVICE:paypal");
  prepareNavigationAction(serviceCtx, "GROUP:FLASH");
  rememberScreen(serviceCtx, "GROUP:FLASH");
  assert.equal(popBackAction(serviceCtx), "SERVICES");

  const paypalCtx = ctx();
  resetNavigation(paypalCtx, "MENU");
  rememberScreen(paypalCtx, "SERVICE:paypal");
  rememberScreen(paypalCtx, "PP:HOME");
  rememberScreen(paypalCtx, "PP:INV");
  rememberScreen(paypalCtx, "PP:INV_D:inv_1");
  prepareNavigationAction(paypalCtx, "PP:INV");
  rememberScreen(paypalCtx, "PP:INV");
  assert.equal(popBackAction(paypalCtx), "PP:HOME");

  prepareNavigationAction(paypalCtx, "PP:HOME");
  rememberScreen(paypalCtx, "PP:HOME");
  assert.equal(popBackAction(paypalCtx), "SERVICE:paypal");
});

test("stale callback recovery opens the closest fresh workspace", () => {
  const owner = { role: ROLES.OWNER, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true, isOwner: true };
  assert.ok(labels(buildCallbackRecoveryKeyboard(ctx(), "USER_D:123", owner)).includes("📋 List Users"));
  assert.ok(labels(buildCallbackRecoveryKeyboard(ctx(), "PP:INV_D:inv_1", owner)).includes("📄 Official Invoices"));
  assert.ok(labels(buildCallbackRecoveryKeyboard(ctx(), "INVOICES", owner)).includes("✅ PayPal Invoices"));
  assert.ok(labels(buildCallbackRecoveryKeyboard(ctx(), "OPS", owner)).includes("🧾 Payment Audit"));
  assert.ok(labels(buildCallbackRecoveryKeyboard(ctx(), "PAYMENT_AUDIT", owner)).includes("💳 Provider Dashboard"));
  assert.ok(labels(buildCallbackRecoveryKeyboard(ctx(), "SERVICE:paypal", owner)).includes("Verified Wallets"));
});

test("payment duplicate guards block unsafe repeated actions", () => {
  assert.equal(invoiceReleaseGuard({ status: "RELEASED" }), "This invoice already appears to have released funds.");
  assert.equal(invoiceReleaseGuard({ status: "SENT" }), "Invoice status SENT is not releaseable from Telegram.");
  assert.equal(invoiceReleaseGuard({ status: "PAID" }), null);

  assert.equal(payoutActionGuard({ status: "APPROVED" }, "approve"), "This payout is already approved or processing.");
  assert.equal(payoutActionGuard({ status: "REJECTED" }, "reject"), "This payout has already been rejected.");
  assert.equal(
    payoutActionGuard({ status: "PENDING_APPROVAL", official_paypal: { provider_item_status: "SUCCESS" } }, "cancel"),
    "Provider state SUCCESS is not eligible for unclaimed cancellation.",
  );
  assert.equal(payoutActionGuard({ status: "PENDING_APPROVAL", official_paypal: { provider_item_status: "UNCLAIMED" } }, "cancel"), null);
});
