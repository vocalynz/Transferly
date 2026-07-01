let grammyPkg;
try {
  grammyPkg = require("grammy");
} catch (error) {
  console.error(
    'Missing dependency "grammy". Run `npm ci --omit=dev` in /bot before starting PM2.',
  );
  throw error;
}

const { Bot, InlineKeyboard, InputFile, session, webhookCallback } = grammyPkg;
const axios = require("axios");
const http = require("http");
const net = require("net");
const { randomUUID } = require("crypto");
const httpClient = require("./utils/httpClient");
const logger = require("./utils/logger");
const { createRateLimiter } = require("./utils/rateLimit");
const {
  buildApiUrl,
  contractShapes,
  createMutationIdempotencyKey,
  PROVIDER_CONTRACT_VERSION,
  providerRoutes,
  validateApiResponseContract,
} = require("./utils/apiContract");
const config = require("./config");
const { registerCommands } = require("./commands");
const { registerCallbackRouter } = require("./callbacks");
const { attachHmacAuth } = require("./utils/apiAuth");
const { buildCallbackData, validateCallback } = require("./utils/actions");
const {
  ROLES,
  STATUS,
  CAPABILITIES,
  normalizeRole,
  normalizeStatus,
  hasCapability,
  getCommandCapability,
  getActionCapability,
} = require("./utils/capabilities");
const {
  initialSessionState,
  ensureSession,
  resetSession,
  rememberProviderContext,
  getSessionContinuity,
} = require("./utils/sessionState");
const {
  SERVICE_GROUPS,
  getService,
  getGroup,
  searchServices,
  canGenerateService,
  getServiceGroupId,
  serviceSummary,
  getServiceCommandCenter,
  getServiceLane,
} = require("./utils/serviceCatalog");
const {
  listProviderWorkspaces,
  getProviderWorkspace,
  getProviderLanes,
  getProviderLane,
  getProviderLaneStatus: getManifestProviderLaneStatus,
  findProviderLanesByIntent,
  buildProviderMiniAppSection,
} = require("./utils/providerWorkspaces");
const {
  addUser,
  getUser,
  getUserList,
  promoteUser,
  removeUser,
  setUserRole,
  setUserStatus,
  extendUserSubscription,
  touchUser,
  recordBotUserAudit,
  recordBotAccessDenied,
  getBotOpsStats,
  getRecentUserAuditLogs,
  getUserAuditLogs,
  getExpiringUsers,
  recordBotPaymentAudit,
  getRecentPaymentAuditLogs,
  recordBotAnalyticsEvent,
  getBotAnalyticsStats,
  searchUsers,
  getDueSubscriptionAlerts,
  wasSubscriptionAlertSent,
  recordSubscriptionAlert,
  getBotSetting,
  setBotSetting,
  getUserActivityStats,
  readBotSession,
  writeBotSession,
  deleteBotSession,
  cleanupExpiredBotSessions,
} = require("./db/db");

const apiOrigins = new Set();
try {
  apiOrigins.add(new URL(config.apiUrl).origin);
} catch (_) {}

attachHmacAuth(axios, {
  secret: config.apiAuth?.hmacSecret,
  allowedOrigins: apiOrigins,
  defaultBaseUrl: config.apiUrl,
});

const bot = new Bot(config.botToken);
const updateRateLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30 });

const TELEGRAM_COMMANDS = [
  { command: "start", description: "Open the Transferly bot" },
  { command: "menu", description: "Open the Transferly command center" },
  { command: "miniapp", description: "Open the Transferly Mini App" },
  { command: "providers", description: "Open payment provider cockpit" },
  { command: "services", description: "Browse Transferly service catalog" },
  { command: "account", description: "Open wallet, receipts, and referrals" },
  { command: "status", description: "Review platform status" },
  { command: "help", description: "How to use Transferly bot" },
  { command: "whoami", description: "Show your bot access" },
  { command: "cancel", description: "Cancel the current bot prompt" },
];

const MENU_TTL_MS = 15 * 60 * 1000;
const PAYPAL_PAGE_SIZE = 5;
const PAYPAL_INVOICE_STATUSES = ["ALL", "SENT", "PAID", "FAILED"];
const PAYPAL_PAYOUT_STATUSES = ["ALL", "PENDING_APPROVAL", "QUEUED", "SUCCESS", "FAILED"];
const PAYPAL_PROVIDER_STATES = ["ALL", "UNCLAIMED", "RETURNED", "DENIED"];
const SCREEN_TYPES = Object.freeze({
  MAIN: "main",
  DETAIL: "detail",
  LIST: "list",
  FORM: "form",
  CONFIRM: "confirm",
  RESULT: "result",
});
const PAYMENT_PROVIDER_SLUGS = new Set(listProviderWorkspaces().map((provider) => provider.slug));
const PROVIDER_COMMAND_SLUGS = Object.freeze(listProviderWorkspaces().map((provider) => provider.slug));
const PROVIDER_COMMAND_HINT = PROVIDER_COMMAND_SLUGS.map((slug) => `/${slug}`).join(", ");
const COMMAND_SECTION_ACTIONS = new Set(["MENU_COLLECT", "MENU_SEND", "MENU_ACCOUNT", "MENU_ADMIN", "MENU_SUPPORT"]);
const MINI_APP_SECTIONS = Object.freeze({
  home: "",
  dashboard: "",
  invoices: "invoices",
  payouts: "payouts",
  activity: "activity",
  analytics: "analytics",
  clients: "clients",
  risk: "risk",
  security: "security",
  wallet: "wallet",
  support: "support",
  profile: "profile",
  ops: "ops",
  generate: "studio",
  studio: "studio",
  vault: "vault",
  history: "vault",
});
const PROVIDER_LANE_DETAILS = {
  "custom-details": {
    label: "Custom Details",
    status: "live",
    summary: "Create provider-styled custom receipt or notification details from the shared Transferly builder.",
  },
  invoices: {
    label: "Invoices",
    statusByProvider: { paypal: "live", stripe: "live", crypto: "live" },
    summary: "Create, inspect, refresh, and release provider invoice records where the backend adapter is live.",
  },
  payouts: {
    label: "Payouts",
    statusByProvider: { paypal: "live", stripe: "live" },
    summary: "Review payout requests, approve or reject them, refresh provider state, and handle supported remediation actions.",
  },
  "wallet-balance": {
    label: "Wallet Balance",
    statusByProvider: { stripe: "live" },
    status: "setup",
    summary: "Show provider balance readiness beside the Transferly internal ledger before payout submission.",
  },
  "provider-activity": {
    label: "Provider Activity",
    statusByProvider: { paypal: "live", stripe: "live", crypto: "live" },
    summary: "Track webhook intake, provider state sync, payment issues, timelines, and audit history.",
  },
};

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function line(label, value) {
  const displayValue = value === null || typeof value === "undefined" || value === "" ? "—" : value;
  return `<b>${escapeHtml(label)}:</b> ${escapeHtml(displayValue)}`;
}

function getArgs(ctx) {
  const text = ctx.message?.text || "";
  return text.trim().split(/\s+/).slice(1);
}

function truncate(value, max = 80) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatMoney(value, currency) {
  if (value === null || typeof value === "undefined" || value === "") {
    return "—";
  }
  return `${value} ${currency || ""}`.trim();
}

function statusLabel(status) {
  if (status === "available") return "Available";
  if (status === "comingSoon") return "Coming soon";
  return status || "Unknown";
}

function getNavigation(ctx) {
  ensureSession(ctx);
  ctx.session.meta.navigation = ctx.session.meta.navigation || {
    current: null,
    stack: [],
    suppressPush: false,
  };
  const navigation = ctx.session.meta.navigation;
  navigation.stack = Array.isArray(navigation.stack) ? navigation.stack : [];
  return navigation;
}

function rememberScreen(ctx, action) {
  if (!action) return;
  const navigation = getNavigation(ctx);
  if (navigation.current === action) {
    navigation.suppressPush = false;
    return;
  }
  if (navigation.current && !navigation.suppressPush) {
    navigation.stack.push(navigation.current);
    navigation.stack = navigation.stack.slice(-10);
  }
  navigation.current = action;
  navigation.suppressPush = false;
}

function popBackAction(ctx) {
  const navigation = getNavigation(ctx);
  const target = navigation.stack.pop() || "MENU";
  navigation.suppressPush = true;
  return target;
}

function suppressNextNavigationPush(ctx) {
  const navigation = getNavigation(ctx);
  navigation.suppressPush = true;
}

function replaceCurrentWithParent(ctx, action) {
  const navigation = getNavigation(ctx);
  navigation.suppressPush = true;
  if (navigation.stack[navigation.stack.length - 1] === action) {
    navigation.stack.pop();
  }
}

function resetNavigation(ctx, current = "MENU") {
  const navigation = getNavigation(ctx);
  navigation.current = current;
  navigation.stack = [];
  navigation.suppressPush = false;
}

function prepareNavigationAction(ctx, action) {
  if (!action) return;
  const current = getNavigation(ctx).current;
  if (!current || current === action) return;

  const returningToServiceCatalog =
    action === "SERVICES" && current.startsWith("GROUP:");
  const returningToServiceGroup =
    action.startsWith("GROUP:") &&
    (current.startsWith("SERVICE:") || current.startsWith("INFO:") || current.startsWith("HISTORY:"));
  const returningToPayPalService =
    action === "SERVICE:paypal" && current === "PP:HOME";
  const returningToPayPalWorkspace =
    action === "PP:HOME" &&
    (current === "PP:INV" || current === "PP:PO" || current.startsWith("PP:INV_D:") || current.startsWith("PP:PO_D:"));
  const returningToInvoiceList =
    action === "PP:INV" && current.startsWith("PP:INV_D:");
  const returningToPayoutList =
    action === "PP:PO" && current.startsWith("PP:PO_D:");
  const returningToUsersList =
    action === "USERS_LIST" && current.startsWith("USER_D:");
  const returningToUsersHome =
    action === "USERS" && (current === "USERS_LIST" || current === "USERS_AUDIT" || current === "USERS_EXPIRING" || current.startsWith("USER_D:"));

  if (
    returningToServiceCatalog ||
    returningToServiceGroup ||
    returningToPayPalService ||
    returningToPayPalWorkspace ||
    returningToInvoiceList ||
    returningToPayoutList ||
    returningToUsersList ||
    returningToUsersHome
  ) {
    replaceCurrentWithParent(ctx, action);
  }
}

function clearPendingPrompts(ctx) {
  ensureSession(ctx);
  delete ctx.session.meta.pendingServiceRun;
  delete ctx.session.meta.pendingUserAction;
  delete ctx.session.meta.pendingPayPalAction;
  delete ctx.session.meta.pendingSearch;
  delete ctx.session.meta.serviceComposer;
}

function normalizeUsername(value = "") {
  return String(value || "").trim().replace(/^@/, "").toLowerCase();
}

function getConfiguredAdminId() {
  const value = Number.parseInt(config.admin?.userId, 10);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function getConfiguredOwnerId() {
  const value = Number.parseInt(config.admin?.ownerId || config.admin?.userId, 10);
  return Number.isSafeInteger(value) && value > 0 ? value : getConfiguredAdminId();
}

function isSubscriptionExpired(expiresAt) {
  if (!expiresAt) return false;
  const timestamp = Date.parse(expiresAt);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

function formatExpiry(expiresAt) {
  if (!expiresAt) return "never";
  const timestamp = Date.parse(expiresAt);
  if (!Number.isFinite(timestamp)) return "unknown";
  return new Date(timestamp).toLocaleString();
}

function getAdminStatus(ctx) {
  return new Promise((resolve) => {
    getUser(ctx.from?.id, (user) => {
      const configuredOwnerId = getConfiguredOwnerId();
      const configuredAdminId = getConfiguredAdminId();
      const configuredAdminUsername = normalizeUsername(config.admin?.username);
      const currentUsername = normalizeUsername(ctx.from?.username);
      const dbRole = normalizeRole(user?.role);
      const dbStatus = normalizeStatus(user?.status);
      const subscriptionExpired = dbRole !== ROLES.OWNER && isSubscriptionExpired(user?.subscription_expires_at);
      const isActiveDbUser = Boolean(user && dbStatus === STATUS.ACTIVE && !subscriptionExpired);
      const isDbOwner = isActiveDbUser && dbRole === ROLES.OWNER;
      const isDbAdmin = isActiveDbUser && dbRole === ROLES.ADMIN;
      const isDbUser = isActiveDbUser && dbRole === ROLES.USER;
      const isConfiguredOwner = Boolean(configuredOwnerId && String(ctx.from?.id) === String(configuredOwnerId));
      const isConfiguredIdAdmin = Boolean(configuredAdminId && String(ctx.from?.id) === String(configuredAdminId));
      const configuredAdminIsOwner = !config.admin?.ownerExplicit && isConfiguredIdAdmin;
      const isUsernameFallbackAdmin = Boolean(
        !configuredAdminId &&
        configuredAdminUsername &&
        currentUsername &&
        configuredAdminUsername === currentUsername
      );
      const adminSource = isDbOwner
        ? "local owner DB"
        : isDbAdmin
        ? "local user DB"
        : isConfiguredOwner
          ? "OWNER_TELEGRAM_ID"
          : configuredAdminIsOwner
          ? "ADMIN_TELEGRAM_ID owner bootstrap"
          : isConfiguredIdAdmin
          ? "ADMIN_TELEGRAM_ID"
          : isUsernameFallbackAdmin
            ? "ADMIN_TELEGRAM_USERNAME fallback"
            : "none";
      const role = isDbOwner || isConfiguredOwner || configuredAdminIsOwner
        ? ROLES.OWNER
        : isDbAdmin || isConfiguredIdAdmin || isUsernameFallbackAdmin
          ? ROLES.ADMIN
        : isDbUser
          ? ROLES.USER
          : ROLES.GUEST;
      const status = user && subscriptionExpired ? "EXPIRED" : user ? dbStatus : STATUS.ACTIVE;
      const isOwner = role === ROLES.OWNER && status === STATUS.ACTIVE;
      const isAdmin = (role === ROLES.ADMIN || role === ROLES.OWNER) && status === STATUS.ACTIVE;
      const isAuthorized = role !== ROLES.GUEST && status === STATUS.ACTIVE;

      if (ctx.from?.id && user?.telegram_id) {
        touchUser(ctx.from.id, () => {});
      }

      resolve({
        user,
        role,
        status,
        subscriptionExpiresAt: role === ROLES.OWNER ? null : user?.subscription_expires_at || null,
        subscriptionExpired,
        isOwner,
        isAdmin,
        isAuthorized,
        adminSource,
        configuredOwnerId,
        configuredAdminId,
        configuredAdminUsername,
        usernameFallbackActive: isUsernameFallbackAdmin,
      });
    });
  });
}

async function getAccessStatus(ctx) {
  return getAdminStatus(ctx);
}

async function requireCapability(ctx, capability, actionLabel = "this action") {
  const access = await getAccessStatus(ctx);
  if (hasCapability(access, capability)) {
    return true;
  }

  recordBotAccessDenied({
    telegramId: ctx.from?.id || null,
    username: ctx.from?.username || null,
    role: access.role || ROLES.GUEST,
    status: access.status || "UNKNOWN",
    capability,
    actionLabel,
  }, () => {});

  const expired = Boolean(access.subscriptionExpired && access.user);
  const lines = expired
    ? [
      "<b>⏳ Subscription Expired</b>",
      "",
      `Your Transferly bot access expired before ${escapeHtml(actionLabel)} could run.`,
      "",
      line("Previous Role", access.user?.role || access.role || ROLES.USER),
      line("Expired On", formatExpiry(access.user?.subscription_expires_at || access.subscriptionExpiresAt)),
      line("Telegram ID", ctx.from?.id || "unknown"),
      "",
      "Contact an owner/admin to extend your subscription.",
    ]
    : [
      "<b>🔒 Access Required</b>",
      "",
      `You are not authorized for ${escapeHtml(actionLabel)}.`,
      "",
      line("Your Role", access.role || ROLES.GUEST),
      line("Access", access.isAuthorized ? access.status : "NOT_AUTHORIZED"),
      line("Telegram ID", ctx.from?.id || "unknown"),
    ];

  await replyHtml(ctx, lines.join("\n"), buildGuestKeyboard(ctx, access));
  return false;
}

async function requireAuthorized(ctx, actionLabel = "this action") {
  return requireCapability(ctx, CAPABILITIES.SERVICES_USE, actionLabel);
}

async function requireAdmin(ctx, actionLabel = "this action") {
  return requireCapability(ctx, CAPABILITIES.PAYMENTS_READ, actionLabel);
}

function addButtonGrid(keyboard, buttons, columns = 2) {
  buttons.forEach((button, index) => {
    keyboard.text(button.label, button.action);
    const shouldBreak = index % columns === columns - 1 && index < buttons.length - 1;
    if (shouldBreak) {
      keyboard.row();
    }
  });
  return keyboard;
}

function buildMiniAppUrl(section = "home") {
  if (!config.miniAppUrl) {
    return "";
  }

  const sectionKey = String(section || "home").replace(/^\/+/, "");
  const mappedSection = MINI_APP_SECTIONS[sectionKey] ?? (/^[a-z0-9/_-]+$/i.test(sectionKey) ? sectionKey : MINI_APP_SECTIONS.home);
  const startParam = MINI_APP_SECTIONS[sectionKey] !== undefined
    ? sectionKey
    : String(mappedSection || "home").replace(/\//g, "_").slice(0, 64);
  const url = new URL(config.miniAppUrl);
  const basePath = url.pathname.replace(/\/+$/, "");
  url.pathname = mappedSection ? `${basePath}/${mappedSection}` : basePath || "/miniapp";
  url.searchParams.set("startapp", startParam || "home");
  return url.toString();
}

function addMiniAppButton(keyboard, label = "🚀 Open Mini App", section = "home") {
  const url = buildMiniAppUrl(section);
  if (!url) {
    return keyboard;
  }

  keyboard.inline_keyboard = keyboard.inline_keyboard || [];
  keyboard.inline_keyboard.push([
    {
      text: label,
      web_app: { url },
    },
  ]);
  return keyboard;
}

function buildGuestKeyboard(ctx, access = {}) {
  const keyboard = new InlineKeyboard()
    .text("🪪 Whoami", buildCallbackData(ctx, "WHOAMI"))
    .text("📚 Help", buildCallbackData(ctx, "HELP"));
  addMiniAppButton(keyboard);
  const adminUsername = (access.configuredAdminUsername || config.admin?.username || "").replace(/^@/, "");
  if (adminUsername) {
    keyboard.row().url("📱 Request Access", `https://t.me/${adminUsername}`);
  }
  return keyboard;
}

function buildStartKeyboard(ctx, access = {}) {
  const keyboard = new InlineKeyboard()
    .text("📋 Menu", buildCallbackData(ctx, "MENU"))
    .text("💳 Providers", buildCallbackData(ctx, "PROVIDERS"))
    .row()
    .text("🧰 Services", buildCallbackData(ctx, "SERVICES"))
    .text("📚 Help", buildCallbackData(ctx, "HELP"))
    .row()
    .text("🪪 Whoami", buildCallbackData(ctx, "WHOAMI"))
    .text("✖️ Cancel Prompt", buildCallbackData(ctx, "CANCEL"));
  addMiniAppButton(keyboard, "🚀 Open Dashboard", "dashboard");
  addMiniAppButton(keyboard, "🧾 Open Studio", "studio");
  addMiniAppButton(keyboard, "💰 Open Wallet", "wallet");
  const adminUsername = (access.configuredAdminUsername || config.admin?.username || "").replace(/^@/, "");
  if (!access.isAuthorized && adminUsername) {
    keyboard.row().url("📱 Request Access", `https://t.me/${adminUsername}`);
  }
  return keyboard;
}

function buildMainMenuKeyboard(ctx, access = {}) {
  if (!access.isAuthorized && !access.isAdmin) {
    return buildGuestKeyboard(ctx, access);
  }

  const keyboard = new InlineKeyboard()
    .text("💳 Providers", buildCallbackData(ctx, "PROVIDERS"))
    .text("🧰 Services", buildCallbackData(ctx, "SERVICES"))
    .row()
    .text("🏦 Wallet Records", buildCallbackData(ctx, "GROUP:BANK"))
    .text("✉️ Notifications", buildCallbackData(ctx, "GROUP:FLASH"))
    .row()
    .text("💳 Provider Catalog", buildCallbackData(ctx, "GROUP:PAYMENT_PROVIDERS"))
    .text("₿ Crypto", buildCallbackData(ctx, "GROUP:CRYPTO"))
    .row()
    .text("🧰 Utilities", buildCallbackData(ctx, "GROUP:UTILITIES"))
    .text("💰 Balance", buildCallbackData(ctx, "BALANCE"))
    .row()
    .text("🧾 Receipts", buildCallbackData(ctx, "RECEIPTS"))
    .text("👤 Profile", buildCallbackData(ctx, "PROFILE"))
    .row()
    .text("🎁 Referral", buildCallbackData(ctx, "REFERRAL"))
    .text("🪪 Whoami", buildCallbackData(ctx, "WHOAMI"))
    .row()
    .text("🏥 Health", buildCallbackData(ctx, "HEALTH"));

  if (access.isAdmin) {
    keyboard
      .row()
      .text("📄 Invoices", buildCallbackData(ctx, "INVOICES"))
      .text("💸 Payouts", buildCallbackData(ctx, "PAYOUTS"))
      .row()
      .text("📊 Activity", buildCallbackData(ctx, "ACTIVITY"))
      .text("👥 Clients", buildCallbackData(ctx, "CLIENTS"))
      .row()
      .text("🛡️ Risk", buildCallbackData(ctx, "RISK"))
      .text("🔐 Security", buildCallbackData(ctx, "SECURITY"))
      .row()
      .text("⚠️ Issues", buildCallbackData(ctx, "ISSUES"))
      .row()
      .text("🧺 Orders", buildCallbackData(ctx, "ORDERS"))
      .text("🔄 Reconcile", buildCallbackData(ctx, "RECONCILE"))
      .row()
      .text("🧩 Ops", buildCallbackData(ctx, "OPS"))
      .text("📊 Analytics", buildCallbackData(ctx, "BOT_ANALYTICS"))
      .row()
      .text("🔍 Status", buildCallbackData(ctx, "STATUS"))
      .text("🤖 Bot Ops", buildCallbackData(ctx, "BOT_OPS"));
    keyboard
      .row()
      .text("🧾 Payment Audit", buildCallbackData(ctx, "PAYMENT_AUDIT"));
  }

  if (access.isOwner) {
    keyboard
      .row()
      .text("👥 Users", buildCallbackData(ctx, "USERS"));
  }

  addMiniAppButton(keyboard, "🚀 Open Dashboard", "dashboard");
  addMiniAppButton(keyboard, "🧾 Open Studio", "studio");
  addMiniAppButton(keyboard, "🗂️ Open Vault", "vault");
  return keyboard;
}

function formatProviderName(slug) {
  return String(slug || "")
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ") || "Provider";
}

function buildCommandHubKeyboard(ctx, access = {}) {
  if (!access.isAuthorized && !access.isAdmin) {
    return buildGuestKeyboard(ctx, access);
  }

  const continuity = getSessionContinuity(ctx);
  const keyboard = new InlineKeyboard();
  if (continuity.provider) {
    keyboard
      .text(`↩️ Continue ${formatProviderName(continuity.provider)}`, buildCallbackData(ctx, `PROVIDER:${continuity.provider}`))
      .row();
  }

  keyboard
    .text("🧾 Collect", buildCallbackData(ctx, "MENU_COLLECT"))
    .text("💸 Send", buildCallbackData(ctx, "MENU_SEND"))
    .row()
    .text("💳 Providers", buildCallbackData(ctx, "PROVIDERS"))
    .text("🏦 Account", buildCallbackData(ctx, "MENU_ACCOUNT"))
    .row()
    .text("🧰 Services", buildCallbackData(ctx, "SERVICES"))
    .text("🛟 Support", buildCallbackData(ctx, "MENU_SUPPORT"));

  if (access.isAdmin) {
    keyboard
      .row()
      .text("🧩 Operations", buildCallbackData(ctx, "MENU_ADMIN"))
      .text("📊 Activity", buildCallbackData(ctx, "ACTIVITY"))
      .row()
      .text("📈 Analytics", buildCallbackData(ctx, "BOT_ANALYTICS"))
      .text("🔐 Security", buildCallbackData(ctx, "SECURITY"));
  }

  if (access.isOwner) {
    keyboard.row().text("👥 Users", buildCallbackData(ctx, "USERS"));
  }

  keyboard.row().text("📋 Main Menu", buildCallbackData(ctx, "MENU"));
  addMiniAppButton(keyboard, "🚀 Dashboard", "dashboard");
  addMiniAppButton(keyboard, "🧾 Studio", "studio");
  addMiniAppButton(keyboard, "💰 Wallet", "wallet");
  return keyboard;
}

function buildAccountCommandKeyboard(ctx) {
  const keyboard = new InlineKeyboard()
    .text("👤 Profile", buildCallbackData(ctx, "PROFILE"))
    .text("💰 Balance", buildCallbackData(ctx, "BALANCE"))
    .row()
    .text("🧾 Receipts", buildCallbackData(ctx, "RECEIPTS"))
    .text("🎁 Referral", buildCallbackData(ctx, "REFERRAL"))
    .row()
    .text("🛟 Support", buildCallbackData(ctx, "MENU_SUPPORT"))
    .text("🏠 Main Menu", buildCallbackData(ctx, "MENU"));
  addMiniAppButton(keyboard, "💰 Open Wallet", "wallet");
  addMiniAppButton(keyboard, "🗂️ Open Vault", "vault");
  addMiniAppButton(keyboard, "👤 Open Profile", "profile");
  return keyboard;
}

function buildSupportCommandKeyboard(ctx, access = {}) {
  const keyboard = new InlineKeyboard()
    .text("📚 Help Guide", buildCallbackData(ctx, "HELP"))
    .text("🪪 Whoami", buildCallbackData(ctx, "WHOAMI"))
    .row()
    .text("🏥 Health", buildCallbackData(ctx, "HEALTH"))
    .text("💳 Providers", buildCallbackData(ctx, "PROVIDERS"))
    .row();

  if (access.isAdmin) {
    keyboard
      .text("📊 Activity", buildCallbackData(ctx, "ACTIVITY"))
      .text("🔐 Security", buildCallbackData(ctx, "SECURITY"))
      .row();
  }

  keyboard.text("🏠 Main Menu", buildCallbackData(ctx, "MENU"));
  addMiniAppButton(keyboard, "🛟 Open Support", "support");
  return keyboard;
}

function buildCommandSectionKeyboard(ctx, section, access = {}) {
  switch (section) {
    case "MENU_COLLECT":
      return buildInvoiceCenterKeyboard(ctx, access);
    case "MENU_SEND":
      return buildPayoutCenterKeyboard(ctx, access);
    case "MENU_ACCOUNT":
      return buildAccountCommandKeyboard(ctx);
    case "MENU_ADMIN":
      return access.isAdmin ? buildOpsCommandCenterKeyboard(ctx) : buildCommandHubKeyboard(ctx, access);
    case "MENU_SUPPORT":
    default:
      return buildSupportCommandKeyboard(ctx, access);
  }
}

function buildProvidersKeyboard(ctx, access = {}) {
  const keyboard = new InlineKeyboard();
  addButtonGrid(
    keyboard,
    listProviderWorkspaces().map((provider) => ({
      label: provider.displayName,
      action: buildCallbackData(ctx, `PROVIDER:${provider.slug}`),
    })),
    2,
  );

  if (access.isAdmin) {
    keyboard
      .row()
      .text("📄 Invoices", buildCallbackData(ctx, "INVOICES"))
      .text("💸 Payouts", buildCallbackData(ctx, "PAYOUTS"))
      .row()
      .text("📊 Activity", buildCallbackData(ctx, "ACTIVITY"))
      .text("🔐 Security", buildCallbackData(ctx, "SECURITY"));
  }

  keyboard
    .row()
    .text("🧰 Service Catalog", buildCallbackData(ctx, "SERVICES"))
    .text("🏠 Main Menu", buildCallbackData(ctx, "MENU"));
  addMiniAppButton(keyboard, "🚀 Open Provider Center", "services");
  return keyboard;
}

function buildInvoiceCenterKeyboard(ctx, access = {}) {
  const keyboard = new InlineKeyboard();
  addButtonGrid(
    keyboard,
    findProviderLanesByIntent("collect").map(({ workspace, lane }) => ({
      label: providerLaneButtonLabel(workspace, lane, { commandLabel: true }),
      action: providerLaneAction(ctx, workspace, lane),
    })),
    2,
  );
  keyboard.row().text("All Providers", buildCallbackData(ctx, "PROVIDERS"));

  if (access.isAdmin) {
    keyboard
      .row()
      .text("📊 Activity", buildCallbackData(ctx, "ACTIVITY"))
      .text("⚠️ Issues", buildCallbackData(ctx, "ISSUES"));
  }

  keyboard
    .row()
    .text("🧰 Service Catalog", buildCallbackData(ctx, "SERVICES"))
    .text("🏠 Main Menu", buildCallbackData(ctx, "MENU"));
  addMiniAppButton(keyboard, "📄 Open Collection Center", "services");
  return keyboard;
}

function buildPayoutCenterKeyboard(ctx, access = {}) {
  const keyboard = new InlineKeyboard();
  addButtonGrid(
    keyboard,
    findProviderLanesByIntent("send").map(({ workspace, lane }) => ({
      label: providerLaneButtonLabel(workspace, lane, { commandLabel: true }),
      action: providerLaneAction(ctx, workspace, lane),
    })),
    2,
  );
  keyboard.row().text("All Providers", buildCallbackData(ctx, "PROVIDERS"));

  if (access.isAdmin) {
    keyboard
      .row()
      .text("📊 Activity", buildCallbackData(ctx, "ACTIVITY"))
      .text("⚠️ Issues", buildCallbackData(ctx, "ISSUES"));
  }

  keyboard
    .row()
    .text("🧰 Service Catalog", buildCallbackData(ctx, "SERVICES"))
    .text("🏠 Main Menu", buildCallbackData(ctx, "MENU"));
  addMiniAppButton(keyboard, "💸 Open Sending Center", "services");
  return keyboard;
}

function buildOpsCommandCenterKeyboard(ctx) {
  const keyboard = new InlineKeyboard()
    .text("📊 Activity", buildCallbackData(ctx, "ACTIVITY"))
    .text("👥 Clients", buildCallbackData(ctx, "CLIENTS"))
    .row()
    .text("⚠️ Issues", buildCallbackData(ctx, "ISSUES"))
    .text("🛡️ Risk", buildCallbackData(ctx, "RISK"))
    .row()
    .text("🔐 Security", buildCallbackData(ctx, "SECURITY"))
    .text("🔍 Status", buildCallbackData(ctx, "STATUS"))
    .row()
    .text("🧺 Orders", buildCallbackData(ctx, "ORDERS"))
    .text("🔄 Reconcile", buildCallbackData(ctx, "RECONCILE"))
    .row()
    .text("🧾 Payment Audit", buildCallbackData(ctx, "PAYMENT_AUDIT"))
    .text("📊 Bot Analytics", buildCallbackData(ctx, "BOT_ANALYTICS"))
    .row()
    .text("🤖 Bot Ops", buildCallbackData(ctx, "BOT_OPS"))
    .text("💳 Provider Dashboard", buildCallbackData(ctx, "PROVIDERS"))
    .row()
    .text("🏠 Main Menu", buildCallbackData(ctx, "MENU"));
  addMiniAppButton(keyboard, "🚀 Open Dashboard", "dashboard");
  addMiniAppButton(keyboard, "🧾 Open Studio", "studio");
  return keyboard;
}

function buildBackKeyboard(ctx) {
  return new InlineKeyboard()
    .text("⬅️ Back", buildCallbackData(ctx, "BACK"))
    .text("🏠 Main Menu", buildCallbackData(ctx, "MENU"));
}

function buildScreenKeyboard(ctx, type, options = {}) {
  if (options.keyboard) return options.keyboard;
  switch (type) {
    case SCREEN_TYPES.MAIN:
      return buildMainMenuKeyboard(ctx, options.access || {});
    case SCREEN_TYPES.FORM:
      return buildCancelKeyboard(ctx);
    case SCREEN_TYPES.DETAIL:
    case SCREEN_TYPES.LIST:
    case SCREEN_TYPES.CONFIRM:
    case SCREEN_TYPES.RESULT:
    default:
      return buildBackKeyboard(ctx);
  }
}

function buildServiceGroupsKeyboard(ctx) {
  const keyboard = new InlineKeyboard();
  addButtonGrid(
    keyboard,
    SERVICE_GROUPS.map((group) => ({
      label: group.title,
      action: buildCallbackData(ctx, `GROUP:${group.id}`),
    })),
  );
  keyboard
    .row()
    .text("🔎 Search Service", buildCallbackData(ctx, "SEARCH:SERVICE"))
    .row()
    .text("⬅️ Back", buildCallbackData(ctx, "BACK"));
  return keyboard;
}

function buildServiceGroupKeyboard(ctx, group) {
  const keyboard = new InlineKeyboard();
  const buttons = group.slugs
    .map((slug) => getService(slug))
    .filter(Boolean)
    .map((service) => ({
      label: service.status === "comingSoon" ? `${service.title} · Soon` : service.title,
      action: buildCallbackData(ctx, `SERVICE:${service.slug}`),
    }));
  addButtonGrid(keyboard, buttons);
  keyboard
    .row()
    .text("⬅️ Services", buildCallbackData(ctx, "SERVICES"))
    .text("🏠 Main Menu", buildCallbackData(ctx, "MENU"));
  return keyboard;
}

function buildServiceDetailKeyboard(ctx, service) {
  const groupId = getServiceGroupId(service);
  const keyboard = new InlineKeyboard();
  const commandCenter = getServiceCommandCenter(service);

  if (isPaymentProviderService(service)) {
    keyboard
      .text("🧭 Provider Workspace", buildCallbackData(ctx, `PROVIDER:${service.slug}`))
      .text("✍️ Custom Details", buildCallbackData(ctx, `PROVIDER_CUSTOM:${service.slug}`))
      .row()
      .text("🕒 Recent Receipts", buildCallbackData(ctx, `HISTORY:${service.slug}`))
      .text("💰 Balance", buildCallbackData(ctx, "BALANCE"));
  } else if (commandCenter) {
    commandCenter.lanes.forEach((lane, index) => {
      const marker = lane.status === "live" ? "✅" : "🛠";
      keyboard.text(`${marker} ${lane.label}`, buildCallbackData(ctx, `SERVICE_LANE:${service.slug}:${lane.id}`));
      if (index % 2 === 1 && index < commandCenter.lanes.length - 1) {
        keyboard.row();
      }
    });

    keyboard.row();
    if (canGenerateService(service)) {
      keyboard
        .text("✍️ Custom Details", buildCallbackData(ctx, `CUSTOM:${service.slug}`))
        .text("🕒 Recent Receipts", buildCallbackData(ctx, `HISTORY:${service.slug}`));
    } else {
      keyboard
        .text("ℹ️ Service Info", buildCallbackData(ctx, `INFO:${service.slug}`))
        .text("💰 Balance", buildCallbackData(ctx, "BALANCE"));
    }
    addMiniAppButton(keyboard, "🚀 Open Service Workspace", commandCenter.lanes[0]?.miniAppSection || "studio");
  } else if (canGenerateService(service)) {
    const customLabel = service.slug === "paypal" ? "🧭 PayPal Workspace" : "✍️ Custom Details";
    keyboard
      .text("⚡ Quick Generate", buildCallbackData(ctx, `RUN:${service.slug}`))
      .text(customLabel, buildCallbackData(ctx, `CUSTOM:${service.slug}`))
      .row()
      .text("🕒 Recent Receipts", buildCallbackData(ctx, `HISTORY:${service.slug}`))
      .text("💰 Balance", buildCallbackData(ctx, "BALANCE"));
  } else {
    keyboard
      .text("ℹ️ Service Info", buildCallbackData(ctx, `INFO:${service.slug}`))
      .text("💰 Balance", buildCallbackData(ctx, "BALANCE"));
  }

  keyboard
    .row()
    .text("⬅️ Back", buildCallbackData(ctx, `GROUP:${groupId}`))
    .text("🏠 Main Menu", buildCallbackData(ctx, "MENU"));
  return keyboard;
}

function buildServiceLaneKeyboard(ctx, service, lane) {
  const keyboard = new InlineKeyboard();

  if (lane.status === "live") {
    keyboard.text("🚀 Start Lane", buildCallbackData(ctx, `SERVICE_ACTION:${service.slug}:${lane.id}`)).row();
  }

  if (lane.action === "run" && canGenerateService(service)) {
    keyboard.text("⚡ Quick Generate", buildCallbackData(ctx, `RUN:${service.slug}`));
  } else if (lane.action === "custom" && canGenerateService(service)) {
    keyboard.text("✍️ Custom Details", buildCallbackData(ctx, `CUSTOM:${service.slug}`));
  } else if (lane.action === "history") {
    keyboard.text("🕒 Recent Receipts", buildCallbackData(ctx, `HISTORY:${service.slug}`));
  } else if (lane.action === "balance") {
    keyboard.text("💰 Balance", buildCallbackData(ctx, "BALANCE"));
  }

  if (lane.miniAppSection) {
    addMiniAppButton(keyboard, `🚀 Open ${lane.label}`, lane.miniAppSection);
  }

  keyboard
    .row()
    .text(`⬅️ ${service.title}`, buildCallbackData(ctx, `SERVICE:${service.slug}`))
    .text("🏠 Main Menu", buildCallbackData(ctx, "MENU"));
  return keyboard;
}

function isPaymentProviderService(service) {
  return PAYMENT_PROVIDER_SLUGS.has(service?.slug);
}

function getProviderLaneStatus(providerSlug, laneId) {
  const manifestStatus = getManifestProviderLaneStatus(providerSlug, laneId);
  if (manifestStatus !== "setup") return manifestStatus;
  const lane = PROVIDER_LANE_DETAILS[laneId];
  if (!lane) return "setup";
  return lane.statusByProvider?.[providerSlug] || lane.status || "setup";
}

function providerLaneStatusIcon(status) {
  if (status === "live") return "✅";
  if (status === "preview") return "🧪";
  if (status === "coming-soon") return "⏳";
  return "🛠";
}

function providerLaneStatusLabel(status) {
  if (status === "live") return "Live";
  if (status === "preview") return "Preview";
  if (status === "coming-soon") return "Coming soon";
  return "Setup required";
}

function providerLaneButtonLabel(workspace, lane, options = {}) {
  const label = options.commandLabel ? lane.commandLabel || lane.label : lane.shortLabel || lane.label;
  const prefix = options.includeProvider ? `${workspace.displayName} ` : "";
  return `${providerLaneStatusIcon(lane.status)} ${prefix}${label}`;
}

function providerLaneAction(ctx, workspace, lane) {
  return buildCallbackData(ctx, lane.botAction || `PROVIDER_LANE:${workspace.slug}:${lane.id}`);
}

function addProviderWorkspaceMiniAppButton(keyboard, providerSlug, laneId = "overview", label = "🚀 Open Provider Workspace") {
  return addMiniAppButton(keyboard, label, buildProviderMiniAppSection(providerSlug, laneId));
}

function copyInlineKeyboardRows(targetKeyboard, sourceKeyboard) {
  (sourceKeyboard.inline_keyboard || []).forEach((row, rowIndex) => {
    if (rowIndex > 0) targetKeyboard.row();
    row.forEach((button) => {
      if (button.callback_data) {
        targetKeyboard.text(button.text, button.callback_data);
      } else if (button.url) {
        targetKeyboard.url(button.text, button.url);
      }
    });
  });
  return targetKeyboard;
}

function buildServiceCommandCenterSummaryUrl(slug) {
  if (!slug || !config.apiUrl || !config.admin?.apiToken) return "";
  try {
    return new URL(`/api/services/${encodeURIComponent(slug)}/command-center`, config.apiUrl).toString();
  } catch (_) {
    return "";
  }
}

function buildServiceLaneDetailUrl(slug, laneId) {
  if (!slug || !laneId || !config.apiUrl || !config.admin?.apiToken) return "";
  try {
    return new URL(`/api/services/${encodeURIComponent(slug)}/lanes/${encodeURIComponent(laneId)}`, config.apiUrl).toString();
  } catch (_) {
    return "";
  }
}

function buildServiceLaneActionUrl(slug, laneId) {
  if (!slug || !laneId || !config.apiUrl || !config.admin?.apiToken) return "";
  try {
    return new URL(`/api/services/${encodeURIComponent(slug)}/lanes/${encodeURIComponent(laneId)}/actions`, config.apiUrl).toString();
  } catch (_) {
    return "";
  }
}

async function loadServiceCommandCenterSummary(ctx, service) {
  const url = buildServiceCommandCenterSummaryUrl(service?.slug);
  if (!url) return null;
  try {
    const response = await httpClient.get(ctx, url, {
      timeout: 5000,
      retry: { retries: 0 },
    });
    return response.data || null;
  } catch (_) {
    return null;
  }
}

async function loadServiceLaneDetail(ctx, service, laneId) {
  const url = buildServiceLaneDetailUrl(service?.slug, laneId);
  if (!url) return null;
  try {
    const response = await httpClient.get(ctx, url, {
      timeout: 5000,
      retry: { retries: 0 },
    });
    return response.data || null;
  } catch (_) {
    return null;
  }
}

async function recordServiceLaneActionIntent(ctx, service, lane) {
  const url = buildServiceLaneActionUrl(service?.slug, lane?.id);
  if (!url) return null;

  const response = await httpClient.post(
    ctx,
    url,
    {
      source: "telegram-bot",
      intent: lane?.action || "launch",
      metadata: {
        mini_app_section: lane?.miniAppSection || "",
      },
    },
    {
      timeout: 5000,
      retry: { retries: 0 },
    },
  );
  return response.data || null;
}

function formatServiceLaneMetricLines(metrics = []) {
  return metrics
    .slice(0, 3)
    .map((metric) => line(metric.label || "Metric", metric.value || "Pending"));
}

function formatServiceLaneReadinessLines(checks = []) {
  return checks
    .slice(0, 4)
    .map((check) => line(check.label || "Check", check.status === "ready" ? "Ready" : "Attention"));
}

function formatServiceLaneActivityLines(activity = {}) {
  const receipts = Array.isArray(activity.recent_receipts) ? activity.recent_receipts : [];
  const latest = receipts[0];
  return [
    line("Service receipts", activity.service_receipt_count || 0),
    line("Compatible history", activity.compatible_receipt_count || 0),
    line("Latest", latest?.title || "No matching receipt"),
  ];
}

function providerTitleFromKey(providerKey) {
  if (!providerKey) return "PayPal";
  return getService(providerKey)?.title || providerKey;
}

function normalizeProviderSlug(value) {
  const slug = String(value || "")
    .trim()
    .replace(/^@/, "")
    .replace(/^\//, "")
    .toLowerCase();
  return PAYMENT_PROVIDER_SLUGS.has(slug) ? slug : "";
}

function recordProviderKey(record, fallback = "paypal") {
  return String(
    record?.provider ||
    record?.payment_provider ||
    record?.metadata?.provider ||
    record?.summary?.provider ||
    fallback,
  ).toLowerCase();
}

function providerListAction(type, record) {
  const provider = recordProviderKey(record);
  if (!provider || provider === "paypal") return type === "invoice" ? "PP:INV" : "PP:PO";
  return `${type === "invoice" ? "PROVIDER_INV" : "PROVIDER_PO"}:${provider}`;
}

function providerHomeAction(record) {
  const provider = recordProviderKey(record);
  return !provider || provider === "paypal" ? "PP:HOME" : `PROVIDER:${provider}`;
}

function providerHomeLabel(record) {
  const provider = recordProviderKey(record);
  return `🏠 ${providerTitleFromKey(provider)}`;
}

function formatProviderFeatureSummary(features = {}) {
  if (!features || typeof features !== "object") return "—";
  const enabled = Object.entries(features)
    .filter(([, value]) => value === true)
    .map(([key]) => key.replace(/_/g, " "))
    .slice(0, 5);
  return enabled.length ? enabled.join(", ") : features.supported === false ? "not supported" : "configured";
}

function providerLanesWithIntent(service, intent) {
  return getProviderLanes(service.slug).filter((lane) => lane.intent === intent);
}

function hasLiveProviderIntent(service, intent) {
  return providerLanesWithIntent(service, intent).some((lane) => getProviderLaneStatus(service.slug, lane.id) === "live");
}

function findProviderLaneByIntent(service, intent) {
  return providerLanesWithIntent(service, intent)[0] || null;
}

function providerGuidedAction(service, lane) {
  if (!service || !lane) return null;
  if (lane.botAction) return lane.botAction;
  if (lane.intent === "collect") return `PROVIDER_INV:${service.slug}`;
  if (lane.intent === "send") return `PROVIDER_PO:${service.slug}`;
  if (lane.intent === "balance") return `PROVIDER_BAL:${service.slug}`;
  if (lane.intent === "activity") return `PROVIDER_WEBHOOKS:${service.slug}`;
  return null;
}

function buildProviderOpsKeyboard(ctx, service, options = {}) {
  const keyboard = new InlineKeyboard();
  const hasInvoices = hasLiveProviderIntent(service, "collect") || getProviderLaneStatus(service.slug, "invoices") === "live";
  const hasPayouts = hasLiveProviderIntent(service, "send") || getProviderLaneStatus(service.slug, "payouts") === "live";
  const hasBalance = hasLiveProviderIntent(service, "balance") || getProviderLaneStatus(service.slug, "wallet-balance") === "live";
  const hasActivity = hasLiveProviderIntent(service, "activity") || getProviderLaneStatus(service.slug, "provider-activity") === "live";

  if (hasInvoices) {
    keyboard.text("📄 Open Invoices", buildCallbackData(ctx, `PROVIDER_INV:${service.slug}`));
  }
  if (hasPayouts) {
    keyboard.text("💸 Open Payouts", buildCallbackData(ctx, `PROVIDER_PO:${service.slug}`));
  }
  if (hasInvoices || hasPayouts) keyboard.row();
  if (hasBalance) {
    keyboard.text("💰 Provider Balance", buildCallbackData(ctx, `PROVIDER_BAL:${service.slug}`));
  }
  if (hasActivity) {
    keyboard.text("🛰 Webhooks", buildCallbackData(ctx, `PROVIDER_WEBHOOKS:${service.slug}`));
  }
  if (hasBalance || hasActivity) keyboard.row();
  keyboard.text("⚠️ Issues", buildCallbackData(ctx, `PROVIDER_ISSUES:${service.slug}`));
  if (options.includeReconcile) {
    keyboard.text("🔁 Reconcile", buildCallbackData(ctx, "RECONCILE"));
  }
  return keyboard;
}

function buildProviderDetailKeyboard(ctx, service, refreshAction) {
  const keyboard = new InlineKeyboard();
  if (refreshAction) {
    keyboard.text("🔄 Refresh", buildCallbackData(ctx, refreshAction)).row();
  }
  keyboard
    .text(`⬅️ ${service.title}`, buildCallbackData(ctx, `PROVIDER:${service.slug}`))
    .text("🏠 Main Menu", buildCallbackData(ctx, "MENU"));
  return keyboard;
}

function buildProviderLaneKeyboard(ctx, service, workspace, lane) {
  const keyboard = new InlineKeyboard();
  const action = lane.status === "live" ? providerGuidedAction(service, lane) : null;
  if (action) {
    keyboard.text(`🚀 Open ${lane.label}`, buildCallbackData(ctx, action)).row();
  }
  if (workspace?.docsUrl) {
    keyboard.url("📚 Official Docs", workspace.docsUrl);
  }
  if (workspace?.supportUrl) {
    keyboard.url("🛟 Help", workspace.supportUrl);
  }
  addProviderWorkspaceMiniAppButton(keyboard, service.slug, lane.id, `🚀 Open ${lane.label} Mini App`);
  keyboard
    .row()
    .text(`⬅️ ${service.title}`, buildCallbackData(ctx, `PROVIDER:${service.slug}`))
    .text("🏠 Main Menu", buildCallbackData(ctx, "MENU"));
  return keyboard;
}

function providerLaneNextStep(service, lane, status) {
  const action = providerGuidedAction(service, lane);
  if (status === "live" && action) {
    return `Use Open ${lane.label} for the guided bot flow, or continue in the Mini App workspace.`;
  }
  if (status === "live") {
    return "Open the Mini App workspace for the full lane view, or refresh the provider workspace when available.";
  }
  if (status === "preview") {
    return "Review this lane in the Mini App while the remaining backend controls are completed.";
  }
  if (status === "setup") {
    return `Connect ${service.title} credentials, signed webhooks, idempotency, state mapping, and ledger rules before enabling this lane.`;
  }
  if (status === "planned") {
    return "Keep this lane visible for product planning, then enable it after backend support and tests are ready.";
  }
  return "Return to the provider workspace or open the official docs for setup guidance.";
}

function buildProviderWorkspaceKeyboard(ctx, service, access = {}) {
  if (service.slug === "paypal") {
    return buildPayPalWorkspaceKeyboard(ctx, access);
  }

  const keyboard = new InlineKeyboard();
  const workspace = getProviderWorkspace(service.slug);
  const lanes = (workspace?.lanes || []).filter((lane) => lane.id !== "overview");

  addButtonGrid(
    keyboard,
    lanes.map((lane) => ({
      label: providerLaneButtonLabel(workspace, lane),
      action: providerLaneAction(ctx, workspace, lane),
    })),
    2,
  );

  if (access.isAdmin) {
    const opsKeyboard = buildProviderOpsKeyboard(ctx, service, { includeReconcile: true });
    keyboard.row();
    copyInlineKeyboardRows(keyboard, opsKeyboard);
  }

  keyboard
    .row()
    .text(`⬅️ ${service.title}`, buildCallbackData(ctx, `SERVICE:${service.slug}`))
    .text("🏠 Main Menu", buildCallbackData(ctx, "MENU"));
  addProviderWorkspaceMiniAppButton(keyboard, service.slug, "overview", `🚀 Open ${service.title} Mini App`);
  return keyboard;
}

function buildServiceSearchResultsKeyboard(ctx, services) {
  const keyboard = new InlineKeyboard();
  addButtonGrid(
    keyboard,
    services.map((service) => ({
      label: service.title,
      action: buildCallbackData(ctx, `SERVICE:${service.slug}`),
    })),
    1,
  );
  keyboard
    .row()
    .text("🔎 Search Again", buildCallbackData(ctx, "SEARCH:SERVICE"))
    .row()
    .text("⬅️ Services", buildCallbackData(ctx, "SERVICES"))
    .text("🏠 Main Menu", buildCallbackData(ctx, "MENU"));
  return keyboard;
}

function buildUsersKeyboard(ctx) {
  return new InlineKeyboard()
    .text("📋 List Users", buildCallbackData(ctx, "USERS_LIST"))
    .text("⏳ Expiring", buildCallbackData(ctx, "USERS_EXPIRING"))
    .row()
    .text("🔎 Search Users", buildCallbackData(ctx, "USERS_SEARCH"))
    .text("🔔 Alerts", buildCallbackData(ctx, "SUBSCRIPTION_ALERTS"))
    .row()
    .text("➕ Add User", buildCallbackData(ctx, "USERS_ADD"))
    .text("⬆️ Promote User", buildCallbackData(ctx, "USERS_PROMOTE"))
    .row()
    .text("⬇️ Demote User", buildCallbackData(ctx, "USERS_DEMOTE"))
    .text("⏸ Suspend", buildCallbackData(ctx, "USERS_SUSPEND"))
    .row()
    .text("▶️ Reactivate", buildCallbackData(ctx, "USERS_REACTIVATE"))
    .text("❌ Revoke", buildCallbackData(ctx, "USERS_REMOVE"))
    .row()
    .text("🧾 Audit Logs", buildCallbackData(ctx, "USERS_AUDIT"))
    .text("📊 Analytics", buildCallbackData(ctx, "BOT_ANALYTICS"))
    .row()
    .text("⬅️ Back", buildCallbackData(ctx, "BACK"))
    .text("🏠 Main Menu", buildCallbackData(ctx, "MENU"));
}

function buildUsersListKeyboard(ctx, users = []) {
  const keyboard = new InlineKeyboard();
  addButtonGrid(
    keyboard,
    users.slice(0, 10).map((user) => ({
      label: `${user.role || "USER"} · ${user.username ? `@${user.username}` : user.telegram_id}`,
      action: buildCallbackData(ctx, `USER_D:${user.telegram_id}`),
    })),
    1,
  );
  keyboard
    .row()
    .text("⏳ Expiring", buildCallbackData(ctx, "USERS_EXPIRING"))
    .text("🧾 Audit", buildCallbackData(ctx, "USERS_AUDIT"))
    .row()
    .text("⬇️ Export Users", buildCallbackData(ctx, "EXPORT_USERS"))
    .row()
    .text("⬅️ Users", buildCallbackData(ctx, "USERS"))
    .text("🏠 Main Menu", buildCallbackData(ctx, "MENU"));
  return keyboard;
}

function buildUserDetailKeyboard(ctx, user = {}) {
  const id = user.telegram_id;
  const keyboard = new InlineKeyboard();

  if (user.role !== ROLES.OWNER) {
    keyboard
      .text("➕ Extend", buildCallbackData(ctx, `USER_EXTEND:${id}`))
      .text(user.role === ROLES.ADMIN ? "⬇️ Demote" : "⬆️ Promote", buildCallbackData(ctx, user.role === ROLES.ADMIN ? `USER_DEMOTE:${id}` : `USER_PROMOTE:${id}`))
      .row();

    if ((user.status || STATUS.ACTIVE) === STATUS.SUSPENDED) {
      keyboard.text("▶️ Reactivate", buildCallbackData(ctx, `USER_REACTIVATE:${id}`));
    } else {
      keyboard.text("⏸ Suspend", buildCallbackData(ctx, `USER_SUSPEND:${id}`));
    }
    keyboard.text("❌ Revoke", buildCallbackData(ctx, `USER_REVOKE:${id}`));
  }

  keyboard
    .row()
    .text("⬅️ Users", buildCallbackData(ctx, "USERS_LIST"))
    .text("🏠 Main Menu", buildCallbackData(ctx, "MENU"));
  return keyboard;
}

function buildUsersAuditKeyboard(ctx) {
  return new InlineKeyboard()
    .text("🔄 Refresh", buildCallbackData(ctx, "USERS_AUDIT"))
    .row()
    .text("⬅️ Users", buildCallbackData(ctx, "USERS"))
    .text("🏠 Main Menu", buildCallbackData(ctx, "MENU"));
}

function buildPaymentAuditKeyboard(ctx) {
  return new InlineKeyboard()
    .text("🔄 Refresh", buildCallbackData(ctx, "PAYMENT_AUDIT"))
    .row()
    .text("All", buildCallbackData(ctx, "PAY_AUDIT_F:ALL"))
    .text("Invoices", buildCallbackData(ctx, "PAY_AUDIT_F:invoice"))
    .text("Payouts", buildCallbackData(ctx, "PAY_AUDIT_F:payout"))
    .row()
    .text("⬇️ Export CSV", buildCallbackData(ctx, "EXPORT_PAYMENT_AUDIT"))
    .row()
    .text("📊 Analytics", buildCallbackData(ctx, "BOT_ANALYTICS"))
    .text("🏠 Main Menu", buildCallbackData(ctx, "MENU"));
}

function buildBotAnalyticsKeyboard(ctx) {
  return new InlineKeyboard()
    .text("🔄 Refresh", buildCallbackData(ctx, "BOT_ANALYTICS"))
    .row()
    .text("⬇️ Export Analytics", buildCallbackData(ctx, "EXPORT_ANALYTICS"))
    .row()
    .text("🧾 Payment Audit", buildCallbackData(ctx, "PAYMENT_AUDIT"))
    .text("👥 Users", buildCallbackData(ctx, "USERS"))
    .row()
    .text("🏠 Main Menu", buildCallbackData(ctx, "MENU"));
}

function buildSubscriptionAlertsKeyboard(ctx) {
  return new InlineKeyboard()
    .text("🔄 Refresh", buildCallbackData(ctx, "SUBSCRIPTION_ALERTS"))
    .row()
    .text("On/Off", buildCallbackData(ctx, "ALERT_TOGGLE"))
    .text("Standard", buildCallbackData(ctx, "ALERT_PRESET:standard"))
    .row()
    .text("Wide", buildCallbackData(ctx, "ALERT_PRESET:wide"))
    .text("Expired Only", buildCallbackData(ctx, "ALERT_PRESET:expired"))
    .row()
    .text("⬇️ Export Expiring", buildCallbackData(ctx, "EXPORT_EXPIRING"))
    .row()
    .text("⏳ Expiring", buildCallbackData(ctx, "USERS_EXPIRING"))
    .text("👥 Users", buildCallbackData(ctx, "USERS"))
    .row()
    .text("🏠 Main Menu", buildCallbackData(ctx, "MENU"));
}

function buildSubscriptionDurationKeyboard(ctx) {
  return new InlineKeyboard()
    .text("7 days", buildCallbackData(ctx, "USERS_DAYS:7"))
    .text("30 days", buildCallbackData(ctx, "USERS_DAYS:30"))
    .row()
    .text("90 days", buildCallbackData(ctx, "USERS_DAYS:90"))
    .text("365 days", buildCallbackData(ctx, "USERS_DAYS:365"))
    .row()
    .text("✍️ Type Custom Days", buildCallbackData(ctx, "USERS_CUSTOM_DAYS"))
    .row()
    .text("Cancel", buildCallbackData(ctx, "CANCEL"))
    .text("Back", buildCallbackData(ctx, "BACK"));
}

function buildUserConfirmKeyboard(ctx, pending = {}) {
  const keyboard = new InlineKeyboard()
    .text("✅ Confirm", buildCallbackData(ctx, "USERS_CONFIRM"));
  if (["add", "promote", "demote", "reactivate"].includes(pending.action)) {
    keyboard.text("🕒 Change Days", buildCallbackData(ctx, "USERS_CHANGE_DAYS"));
  }
  keyboard
    .row()
    .text("Cancel", buildCallbackData(ctx, "CANCEL"))
    .text("Back", buildCallbackData(ctx, "BACK"));
  return keyboard;
}

function buildCancelKeyboard(ctx) {
  return new InlineKeyboard()
    .text("Cancel", buildCallbackData(ctx, "CANCEL"))
    .text("Back", buildCallbackData(ctx, "BACK"))
    .row()
    .text("Main Menu", buildCallbackData(ctx, "MENU"));
}

function buildComposerPreviewKeyboard(ctx) {
  return new InlineKeyboard()
    .text("✅ Generate", buildCallbackData(ctx, "CMP:OK"))
    .text("✏️ Edit", buildCallbackData(ctx, "CMP:EDIT"))
    .row()
    .text("Cancel", buildCallbackData(ctx, "CMP:CANCEL"))
    .text("Main Menu", buildCallbackData(ctx, "MENU"));
}

function buildPayPalWorkspaceKeyboard(ctx, access = {}) {
  const keyboard = new InlineKeyboard()
    .text("✉️ Notification", buildCallbackData(ctx, "PP:EMAIL"))
    .row()
    .text("🕒 PayPal Receipts", buildCallbackData(ctx, "HISTORY:paypal"))
    .text("💰 Balance", buildCallbackData(ctx, "BALANCE"));

  if (access.isAdmin) {
    keyboard
      .row()
      .text("📄 Official Invoices", buildCallbackData(ctx, "PP:INV"))
      .text("💸 Official Payouts", buildCallbackData(ctx, "PP:PO"))
      .row()
      .text("🛰 Activity", buildCallbackData(ctx, "PROVIDER_WEBHOOKS:paypal"))
      .text("🧪 Developer", buildCallbackData(ctx, "PROVIDER_LANE:paypal:developer"))
      .row()
      .text("🔎 Search Invoice", buildCallbackData(ctx, "PP:INV_SEARCH"))
      .text("🔎 Search Payout", buildCallbackData(ctx, "PP:PO_SEARCH"));
  }

  keyboard
    .row()
    .text("⬅️ PayPal Service", buildCallbackData(ctx, "SERVICE:paypal"))
    .text("🏠 Main Menu", buildCallbackData(ctx, "MENU"));
  addProviderWorkspaceMiniAppButton(keyboard, "paypal", "overview", "🚀 Open PayPal Mini App");
  return keyboard;
}

function buildPayPalListKeyboard(ctx, type, items, pagination = {}, view = {}) {
  const keyboard = new InlineKeyboard();
  const prefix = type === "invoice" ? "PP:INV_D" : "PP:PO_D";
  const refreshAction = view.provider
    ? `${type === "invoice" ? "PROVIDER_INV" : "PROVIDER_PO"}:${view.provider}`
    : (type === "invoice" ? "PP:INV" : "PP:PO");
  const parentAction = view.provider ? `PROVIDER:${view.provider}` : "PP:HOME";
  const parentLabel = view.provider ? `⬅️ ${providerTitleFromKey(view.provider)}` : "⬅️ PayPal";
  addButtonGrid(
    keyboard,
    items.map((item) => ({
      label: item.label,
      action: buildCallbackData(ctx, `${prefix}:${item.key}`),
    })),
    1,
  );

  const pageAction = type === "invoice" ? "PP:INV_P" : "PP:PO_P";
  const statusAction = type === "invoice" ? "PP:INV_S" : "PP:PO_S";
  const statuses = type === "invoice" ? PAYPAL_INVOICE_STATUSES : PAYPAL_PAYOUT_STATUSES;
  keyboard.row();
  statuses.slice(0, 4).forEach((status, index) => {
    const active = (view.status || "ALL") === status;
    keyboard.text(`${active ? "• " : ""}${status === "PENDING_APPROVAL" ? "REVIEW" : status}`, buildCallbackData(ctx, `${statusAction}:${status}`));
    if (index === 1) keyboard.row();
  });

  if (type === "payout") {
    keyboard.row();
    PAYPAL_PROVIDER_STATES.slice(0, 3).forEach((state) => {
      const active = (view.providerState || "ALL") === state;
      keyboard.text(`${active ? "• " : ""}${state}`, buildCallbackData(ctx, `PP:PO_PR:${state}`));
    });
  }

  keyboard.row();
  if (Number(pagination.page || view.page || 1) > 1) {
    keyboard.text("⬅️ Prev", buildCallbackData(ctx, `${pageAction}:${Number(pagination.page || view.page) - 1}`));
  }
  keyboard.text(`Page ${pagination.page || view.page || 1}`, buildCallbackData(ctx, refreshAction));
  if (pagination.has_next_page) {
    keyboard.text("Next ➡️", buildCallbackData(ctx, `${pageAction}:${Number(pagination.page || view.page || 1) + 1}`));
  }

  keyboard
    .row()
    .text("🔄 Refresh List", buildCallbackData(ctx, refreshAction))
    .text(parentLabel, buildCallbackData(ctx, parentAction));
  return keyboard;
}

function buildInvoiceDetailKeyboard(ctx, invoice, key) {
  const provider = String(invoice.provider || invoice.metadata?.provider || "paypal").toLowerCase();
  const linkLabel = provider === "stripe" ? "🔗 Open Stripe Invoice" : provider === "crypto" ? "🔗 Open Crypto Charge" : "🔗 Open PayPal Link";
  const keyboard = new InlineKeyboard()
    .text("🔄 Refresh", buildCallbackData(ctx, `PP:INV_REFRESH:${key}`))
    .text("✅ Release Funds", buildCallbackData(ctx, `PP:INV_RELEASE:${key}`));

  if (provider === "stripe") {
    keyboard.row().text("🛑 Void Stripe Invoice", buildCallbackData(ctx, `PP:INV_VOID:${key}`));
  }

  if (provider === "crypto") {
    keyboard.row().text("⚠️ Mark Review", buildCallbackData(ctx, `PP:INV_REVIEW:${key}`));
  }

  if (invoice.invoice_link) {
    keyboard.row().url(linkLabel, invoice.invoice_link);
  }

  keyboard
    .row()
    .text("⬅️ Invoices", buildCallbackData(ctx, providerListAction("invoice", invoice)))
    .text(providerHomeLabel(invoice), buildCallbackData(ctx, providerHomeAction(invoice)));
  return keyboard;
}

function buildInvoiceConfirmKeyboard(ctx, key, invoice = null) {
  return new InlineKeyboard()
    .text("✅ Confirm Release", buildCallbackData(ctx, `PP:INV_DO_RELEASE:${key}`))
    .row()
    .text("⬅️ Invoice", buildCallbackData(ctx, `PP:INV_D:${key}`))
    .text(providerHomeLabel(invoice), buildCallbackData(ctx, providerHomeAction(invoice)));
}

function buildInvoiceResultKeyboard(ctx, key, invoice = null) {
  return new InlineKeyboard()
    .text("👁 View Invoice", buildCallbackData(ctx, `PP:INV_D:${key}`))
    .text("🔄 Refresh", buildCallbackData(ctx, `PP:INV_REFRESH:${key}`))
    .row()
    .text("⬅️ Invoices", buildCallbackData(ctx, providerListAction("invoice", invoice)))
    .text(providerHomeLabel(invoice), buildCallbackData(ctx, providerHomeAction(invoice)));
}

function buildPayoutDetailKeyboard(ctx, payout, key) {
  const remediation = payout.official_paypal?.remediation;
  const keyboard = new InlineKeyboard()
    .text("✅ Approve", buildCallbackData(ctx, `PP:PO_APPROVE:${key}`))
    .text("⛔ Reject", buildCallbackData(ctx, `PP:PO_REJECT:${key}`))
    .row()
    .text("🔄 Refresh", buildCallbackData(ctx, `PP:PO_REFRESH:${key}`));

  if (remediation?.action === "cancel_unclaimed" && remediation.allowed !== false) {
    keyboard.text("↩️ Cancel Unclaimed", buildCallbackData(ctx, `PP:PO_CANCEL:${key}`));
  }

  keyboard
    .row()
    .text("⬅️ Payouts", buildCallbackData(ctx, providerListAction("payout", payout)))
    .text(providerHomeLabel(payout), buildCallbackData(ctx, providerHomeAction(payout)));
  return keyboard;
}

function buildPayoutConfirmKeyboard(ctx, action, key, payout = null) {
  const confirmAction = action === "cancel" ? "PP:PO_DO_CANCEL" : "PP:PO_DO_APPROVE";
  const label = action === "cancel" ? "↩️ Confirm Cancel" : "✅ Confirm Approve";
  return new InlineKeyboard()
    .text(label, buildCallbackData(ctx, `${confirmAction}:${key}`))
    .row()
    .text("⬅️ Payout", buildCallbackData(ctx, `PP:PO_D:${key}`))
    .text(providerHomeLabel(payout), buildCallbackData(ctx, providerHomeAction(payout)));
}

function buildPayoutResultKeyboard(ctx, key, payout = null) {
  return new InlineKeyboard()
    .text("👁 View Payout", buildCallbackData(ctx, `PP:PO_D:${key}`))
    .text("🔄 Refresh", buildCallbackData(ctx, `PP:PO_REFRESH:${key}`))
    .row()
    .text("⬅️ Payouts", buildCallbackData(ctx, providerListAction("payout", payout)))
    .text(providerHomeLabel(payout), buildCallbackData(ctx, providerHomeAction(payout)));
}

function buildCallbackRecoveryKeyboard(ctx, action, access = {}) {
  const value = String(action || "");
  if (value.startsWith("USER_") || value.startsWith("USERS")) {
    return access.isOwner ? buildUsersKeyboard(ctx) : buildMainMenuKeyboard(ctx, access);
  }
  if (value === "PROVIDERS") {
    return buildProvidersKeyboard(ctx, access);
  }
  if (COMMAND_SECTION_ACTIONS.has(value)) {
    return buildCommandSectionKeyboard(ctx, value, access);
  }
  if (value === "INVOICES") {
    return buildInvoiceCenterKeyboard(ctx, access);
  }
  if (value === "PAYOUTS") {
    return buildPayoutCenterKeyboard(ctx, access);
  }
  if (value.startsWith("PP:")) {
    return buildPayPalWorkspaceKeyboard(ctx, access);
  }
  if (
    value === "OPS" ||
    value === "ACTIVITY" ||
    value === "CLIENTS" ||
    value === "RISK" ||
    value === "SECURITY" ||
    value === "ISSUES" ||
    value === "ORDERS" ||
    value === "RECONCILE" ||
    value === "STATUS" ||
    value === "BOT_OPS" ||
    value === "BOT_ANALYTICS" ||
    value === "PAYMENT_AUDIT"
  ) {
    return buildOpsCommandCenterKeyboard(ctx);
  }
  if (
    value.startsWith("GROUP:") ||
    value.startsWith("SERVICE:") ||
    value.startsWith("SERVICE_ACTION:") ||
    value.startsWith("SERVICE_LANE:") ||
    value.startsWith("PROVIDER:") ||
    value.startsWith("PROVIDER_CUSTOM:") ||
    value.startsWith("PROVIDER_LANE:") ||
    value.startsWith("PROVIDER_INV:") ||
    value.startsWith("PROVIDER_PO:") ||
    value.startsWith("PROVIDER_BAL:") ||
    value.startsWith("PROVIDER_WEBHOOKS:") ||
    value.startsWith("PROVIDER_ISSUES:") ||
    value.startsWith("RUN:") ||
    value.startsWith("CUSTOM:") ||
    value.startsWith("HISTORY:") ||
    value.startsWith("INFO:") ||
    value === "SERVICES"
  ) {
    return buildServiceGroupsKeyboard(ctx);
  }
  return buildMainMenuKeyboard(ctx, access);
}

function getTrackedMenuMessages(ctx) {
  ensureSession(ctx);
  ctx.session.menuMessages = Array.isArray(ctx.session.menuMessages) ? ctx.session.menuMessages : [];
  return ctx.session.menuMessages;
}

function setTrackedMenuMessages(ctx, entries) {
  ensureSession(ctx);
  ctx.session.menuMessages = Array.isArray(entries) ? entries : [];
}

function registerMenuMessage(ctx, message) {
  const messageId = message?.message_id;
  const chatId = message?.chat?.id || ctx.chat?.id;
  if (!messageId || !chatId) {
    return;
  }

  const entries = getTrackedMenuMessages(ctx).filter(
    (entry) => !(entry.chatId === chatId && entry.messageId === messageId),
  );
  entries.push({ chatId, messageId, createdAt: Date.now() });
  setTrackedMenuMessages(ctx, entries);
}

async function deleteOrDisableMessage(ctx, chatId, messageId) {
  if (!chatId || !messageId) {
    return;
  }

  try {
    await ctx.api.deleteMessage(chatId, messageId);
    return;
  } catch (_deleteError) {
    // Telegram may refuse deletion for old messages; removing buttons still prevents stale actions.
  }

  try {
    await ctx.api.editMessageReplyMarkup(chatId, messageId);
  } catch (_editError) {
    // Ignore cleanup failures so the operator flow keeps moving.
  }
}

async function clearMenuMessages(ctx, options = {}) {
  const { keepMessageId = null } = options;
  const entries = getTrackedMenuMessages(ctx);
  if (entries.length === 0) {
    return;
  }

  const nextEntries = [];
  const now = Date.now();

  for (const entry of entries) {
    if (!entry.chatId || !entry.messageId) {
      continue;
    }

    if (keepMessageId && entry.messageId === keepMessageId) {
      nextEntries.push(entry);
      continue;
    }

    if (entry.createdAt && now - entry.createdAt > MENU_TTL_MS) {
      await deleteOrDisableMessage(ctx, entry.chatId, entry.messageId);
      continue;
    }

    await deleteOrDisableMessage(ctx, entry.chatId, entry.messageId);
  }

  setTrackedMenuMessages(ctx, nextEntries);
}

async function clearTriggerMessage(ctx) {
  const chatId = ctx.message?.chat?.id;
  const messageId = ctx.message?.message_id;
  await deleteOrDisableMessage(ctx, chatId, messageId);
}

async function replyHtml(ctx, text, keyboard = null) {
  await clearMenuMessages(ctx);
  const message = await ctx.reply(text, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: keyboard } : {}),
  });
  registerMenuMessage(ctx, message);
  return message;
}

function buildTelegramUpdate(ctx, commandLine) {
  return {
    update_id: ctx.update?.update_id || Date.now(),
    message: {
      message_id: ctx.message?.message_id || Date.now(),
      date: Math.floor(Date.now() / 1000),
      text: commandLine,
      from: {
        id: ctx.from?.id,
        is_bot: false,
        first_name: ctx.from?.first_name || "",
        last_name: ctx.from?.last_name || "",
        username: ctx.from?.username || "",
      },
      chat: {
        id: ctx.chat?.id || ctx.from?.id,
        type: ctx.chat?.type || "private",
        first_name: ctx.chat?.first_name || ctx.from?.first_name || "",
        last_name: ctx.chat?.last_name || ctx.from?.last_name || "",
        username: ctx.chat?.username || ctx.from?.username || "",
      },
    },
  };
}

async function runLinkedTelegramCommand(ctx, commandLine) {
  const response = await httpClient.post(
    ctx,
    `${config.apiUrl}/api/telegram/webhook`,
    buildTelegramUpdate(ctx, commandLine),
    { timeout: 10000 },
  );

  return response.data?.response || response.data;
}

async function replyLinkedCommand(ctx, commandLine, title) {
  const result = await runLinkedTelegramCommand(ctx, commandLine);
  const lines = [`<b>${escapeHtml(title)}</b>`, "", escapeHtml(result?.message || "Done.")];
  await replyHtml(ctx, lines.join("\n"), buildScreenKeyboard(ctx, SCREEN_TYPES.RESULT));
}

function parseDetailsText(rawValue) {
  const text = String(rawValue || "").trim();
  if (!text || text.toLowerCase() === "skip") {
    return {};
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (_error) {
    // Plain text becomes a note field, which keeps the Telegram flow forgiving.
  }

  return { note: text };
}

function buildServiceDetails(service, details = {}) {
  return {
    service: service.slug,
    service_title: service.title,
    category: service.category,
    ...details,
  };
}

const FAMILY_COMPOSER_STEPS = {
  bank: [
    { key: "amount", label: "Amount", prompt: "Enter the transfer amount." },
    { key: "sender_name", label: "Sender", prompt: "Enter the sender name." },
    { key: "receiver_name", label: "Receiver", prompt: "Enter the receiver name." },
    { key: "transaction_id", label: "Transaction ID", prompt: "Enter the transaction/reference ID." },
    { key: "transfer_time", label: "Transfer Time", prompt: "Enter the transfer date/time, or send skip to leave blank.", optional: true },
    { key: "note", label: "Note", prompt: "Optional note. Send skip to leave blank.", optional: true },
  ],
  email: [
    { key: "recipient", label: "Recipient", prompt: "Enter the recipient email or name." },
    { key: "amount", label: "Amount", prompt: "Enter the amount." },
    { key: "currency", label: "Currency", prompt: "Enter currency code, or send skip for USD.", optional: true, defaultValue: "USD" },
    { key: "reference", label: "Reference", prompt: "Enter the reference, invoice, or order ID." },
    { key: "note", label: "Note", prompt: "Optional note. Send skip to leave blank.", optional: true },
  ],
};

const SERVICE_COMPOSER_PRESETS = {
  opay: [
    { key: "amount", label: "Amount", prompt: "Enter the Opay transfer amount." },
    { key: "sender_name", label: "Sender Name", prompt: "Enter the sender name shown on the Opay slip." },
    { key: "receiver_name", label: "Receiver Name", prompt: "Enter the Opay receiver name." },
    { key: "opay_transaction_id", label: "Opay Transaction ID", prompt: "Enter the Opay transaction/reference ID." },
    { key: "transfer_time", label: "Transfer Time", prompt: "Enter the transfer date/time, or send skip to leave blank.", optional: true },
    { key: "note", label: "Note", prompt: "Optional Opay note. Send skip to leave blank.", optional: true },
  ],
  kuda: [
    { key: "amount", label: "Amount", prompt: "Enter the Kuda transfer amount." },
    { key: "sender_name", label: "Sender Name", prompt: "Enter the sender name shown on the Kuda slip." },
    { key: "beneficiary_name", label: "Beneficiary", prompt: "Enter the beneficiary name." },
    { key: "kuda_reference", label: "Kuda Reference", prompt: "Enter the Kuda session/reference ID." },
    { key: "transfer_time", label: "Transfer Time", prompt: "Enter the transfer date/time, or send skip to leave blank.", optional: true },
    { key: "note", label: "Note", prompt: "Optional Kuda note. Send skip to leave blank.", optional: true },
  ],
  binance: [
    { key: "recipient_email", label: "Recipient Email", prompt: "Enter the Binance recipient email." },
    { key: "amount", label: "Amount", prompt: "Enter the Binance amount." },
    { key: "currency", label: "Currency", prompt: "Enter currency or asset code, or send skip for USDT.", optional: true, defaultValue: "USDT" },
    { key: "network", label: "Network", prompt: "Enter the network, asset lane, or send skip to leave blank.", optional: true },
    { key: "transaction_id", label: "Transaction ID", prompt: "Enter the Binance transaction/order ID." },
    { key: "note", label: "Note", prompt: "Optional Binance note. Send skip to leave blank.", optional: true },
  ],
  bybit: [
    { key: "recipient_email", label: "Recipient Email", prompt: "Enter the Bybit recipient email." },
    { key: "amount", label: "Amount", prompt: "Enter the Bybit amount." },
    { key: "currency", label: "Currency", prompt: "Enter currency or asset code, or send skip for USDT.", optional: true, defaultValue: "USDT" },
    { key: "order_id", label: "Order ID", prompt: "Enter the Bybit order ID." },
    { key: "transaction_id", label: "Transaction ID", prompt: "Enter the Bybit transaction ID, or send skip to leave blank.", optional: true },
    { key: "note", label: "Note", prompt: "Optional Bybit note. Send skip to leave blank.", optional: true },
  ],
  coinbase: [
    { key: "recipient_email", label: "Recipient Email", prompt: "Enter the Coinbase recipient email." },
    { key: "amount", label: "Amount", prompt: "Enter the Coinbase amount." },
    { key: "currency", label: "Currency", prompt: "Enter currency or asset code, or send skip for USD.", optional: true, defaultValue: "USD" },
    { key: "transaction_hash", label: "Transaction Hash", prompt: "Enter the Coinbase transaction hash or reference." },
    { key: "note", label: "Note", prompt: "Optional Coinbase note. Send skip to leave blank.", optional: true },
  ],
  paypal: [
    { key: "recipient_email", label: "Recipient Email", prompt: "Enter the PayPal recipient email." },
    { key: "amount", label: "Amount", prompt: "Enter the PayPal amount." },
    { key: "currency", label: "Currency", prompt: "Enter currency code, or send skip for USD.", optional: true, defaultValue: "USD" },
    { key: "invoice_or_transaction_id", label: "Invoice or Transaction ID", prompt: "Enter the PayPal invoice or transaction ID." },
    { key: "payment_status", label: "Payment Status", prompt: "Enter the PayPal status, or send skip for COMPLETED.", optional: true, defaultValue: "COMPLETED" },
    { key: "note", label: "Note", prompt: "Optional PayPal note. Send skip to leave blank.", optional: true },
  ],
  "crypto-com": [
    { key: "recipient_email", label: "Recipient Email", prompt: "Enter the Crypto.com recipient email." },
    { key: "amount", label: "Amount", prompt: "Enter the Crypto.com amount." },
    { key: "currency", label: "Currency", prompt: "Enter currency or asset code, or send skip for USD.", optional: true, defaultValue: "USD" },
    { key: "transaction_id", label: "Transaction ID", prompt: "Enter the Crypto.com transaction ID." },
    { key: "note", label: "Note", prompt: "Optional Crypto.com note. Send skip to leave blank.", optional: true },
  ],
  wise: [
    { key: "recipient_email", label: "Recipient Email", prompt: "Enter the Wise recipient email." },
    { key: "amount", label: "Amount", prompt: "Enter the Wise transfer amount." },
    { key: "currency", label: "Currency", prompt: "Enter currency code, or send skip for USD.", optional: true, defaultValue: "USD" },
    { key: "transfer_number", label: "Transfer Number", prompt: "Enter the Wise transfer number." },
    { key: "note", label: "Note", prompt: "Optional Wise note. Send skip to leave blank.", optional: true },
  ],
  "cash-app": [
    { key: "recipient", label: "Recipient", prompt: "Enter the Cash App recipient name, email, or cashtag." },
    { key: "amount", label: "Amount", prompt: "Enter the Cash App amount." },
    { key: "currency", label: "Currency", prompt: "Enter currency code, or send skip for USD.", optional: true, defaultValue: "USD" },
    { key: "cashtag_or_reference", label: "Cashtag or Reference", prompt: "Enter the cashtag or payment reference." },
    { key: "note", label: "Note", prompt: "Optional Cash App note. Send skip to leave blank.", optional: true },
  ],
  zelle: [
    { key: "recipient_email", label: "Recipient Email", prompt: "Enter the Zelle recipient email." },
    { key: "amount", label: "Amount", prompt: "Enter the Zelle amount." },
    { key: "currency", label: "Currency", prompt: "Enter currency code, or send skip for USD.", optional: true, defaultValue: "USD" },
    { key: "confirmation_id", label: "Confirmation ID", prompt: "Enter the Zelle confirmation ID." },
    { key: "note", label: "Note", prompt: "Optional Zelle note. Send skip to leave blank.", optional: true },
  ],
  venmo: [
    { key: "recipient", label: "Recipient", prompt: "Enter the Venmo recipient name, email, or handle." },
    { key: "amount", label: "Amount", prompt: "Enter the Venmo amount." },
    { key: "currency", label: "Currency", prompt: "Enter currency code, or send skip for USD.", optional: true, defaultValue: "USD" },
    { key: "transaction_id", label: "Transaction ID", prompt: "Enter the Venmo transaction ID." },
    { key: "note", label: "Note", prompt: "Optional Venmo note. Send skip to leave blank.", optional: true },
  ],
  "trust-wallet": [
    { key: "wallet_address", label: "Wallet Address", prompt: "Enter the Trust Wallet recipient address." },
    { key: "amount", label: "Amount", prompt: "Enter the crypto amount." },
    { key: "currency", label: "Asset", prompt: "Enter asset code, or send skip for USDT.", optional: true, defaultValue: "USDT" },
    { key: "network", label: "Network", prompt: "Enter the network, for example TRC20 or ERC20." },
    { key: "transaction_hash", label: "Transaction Hash", prompt: "Enter the transaction hash." },
    { key: "note", label: "Note", prompt: "Optional Trust Wallet note. Send skip to leave blank.", optional: true },
  ],
  gcash: [
    { key: "recipient", label: "Recipient", prompt: "Enter the GCash recipient name or mobile number." },
    { key: "amount", label: "Amount", prompt: "Enter the GCash amount." },
    { key: "currency", label: "Currency", prompt: "Enter currency code, or send skip for PHP.", optional: true, defaultValue: "PHP" },
    { key: "reference_number", label: "Reference Number", prompt: "Enter the GCash reference number." },
    { key: "note", label: "Note", prompt: "Optional GCash note. Send skip to leave blank.", optional: true },
  ],
  "crypto-receipts": [
    { key: "wallet_address", label: "Wallet Address", prompt: "Enter the recipient wallet address." },
    { key: "amount", label: "Amount", prompt: "Enter the crypto amount." },
    { key: "currency", label: "Asset", prompt: "Enter asset code, or send skip for USDT.", optional: true, defaultValue: "USDT" },
    { key: "network", label: "Network", prompt: "Enter the blockchain network." },
    { key: "transaction_hash", label: "Transaction Hash", prompt: "Enter the transaction hash." },
    { key: "note", label: "Note", prompt: "Optional crypto receipt note. Send skip to leave blank.", optional: true },
  ],
};

function cloneComposerSteps(steps) {
  return steps.map((step) => ({ ...step }));
}

function getComposerSteps(service) {
  const preset = SERVICE_COMPOSER_PRESETS[service?.slug];
  if (preset) {
    return cloneComposerSteps(preset);
  }

  if (service?.receiptType === "bank") {
    return cloneComposerSteps(FAMILY_COMPOSER_STEPS.bank);
  }

  return cloneComposerSteps(FAMILY_COMPOSER_STEPS.email);
}

function validateComposerValue(step, value) {
  const normalized = String(value || "").trim();
  if (step.optional && (!normalized || normalized.toLowerCase() === "skip")) {
    return { ok: true, value: step.defaultValue || "" };
  }
  if (!normalized) {
    return { ok: false, message: `${step.label} is required.` };
  }
  if (step.key === "amount" && !Number.isFinite(Number(normalized.replace(/,/g, "")))) {
    return { ok: false, message: "Amount must be a number, for example 49.99." };
  }
  if (step.key === "currency") {
    const currency = normalized.toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9]{2,12}$/.test(currency)) {
      return { ok: false, message: "Currency or asset code must use 2-12 letters/numbers, for example USD or USDT." };
    }
    return { ok: true, value: currency };
  }
  if (step.key.endsWith("_email") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, message: `${step.label} must be a valid email address.` };
  }
  if (step.key === "wallet_address" && normalized.length < 8) {
    return { ok: false, message: "Wallet address is too short." };
  }
  return { ok: true, value: normalized };
}

async function sendComposerPrompt(ctx) {
  const composer = ctx.session.meta.serviceComposer;
  const service = getService(composer?.slug);
  if (!composer || !service) {
    await replyHtml(ctx, "Composer expired. Use /services to start again.", buildServiceGroupsKeyboard(ctx));
    return;
  }

  const steps = getComposerSteps(service);
  const step = steps[composer.stepIndex];
  if (!step) {
    await sendComposerPreview(ctx);
    return;
  }

  const lines = [
    `<b>${escapeHtml(service.title)} Composer</b>`,
    "",
    line("Step", `${composer.stepIndex + 1}/${steps.length}`),
    line("Field", step.label),
    "",
    escapeHtml(step.prompt),
  ];
  await replyHtml(ctx, lines.join("\n"), buildCancelKeyboard(ctx));
}

async function sendComposerPreview(ctx) {
  const composer = ctx.session.meta.serviceComposer;
  const service = getService(composer?.slug);
  if (!composer || !service) {
    await replyHtml(ctx, "Composer expired. Use /services to start again.", buildServiceGroupsKeyboard(ctx));
    return;
  }

  composer.awaitingConfirm = true;
  const details = {
    ...(composer.baseDetails || {}),
    ...(composer.answers || {}),
  };
  const lines = [
    `<b>${escapeHtml(service.title)} Preview</b>`,
    "",
    ...Object.entries(details)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => line(key.replace(/_/g, " "), String(value))),
    "",
    "Review the details before generating.",
  ];
  await replyHtml(ctx, lines.join("\n"), buildComposerPreviewKeyboard(ctx));
}

async function startServiceComposer(ctx, service, baseDetails = {}) {
  ctx.session.meta.serviceComposer = {
    slug: service.slug,
    baseDetails,
    answers: {},
    stepIndex: 0,
    awaitingConfirm: false,
    createdAt: Date.now(),
  };
  await sendComposerPrompt(ctx);
}

function ensurePayPalCache(ctx) {
  ensureSession(ctx);
  ctx.session.meta.paypalCache = ctx.session.meta.paypalCache || {
    invoices: {},
    payouts: {},
  };
  ctx.session.meta.paypalCache.invoices = ctx.session.meta.paypalCache.invoices || {};
  ctx.session.meta.paypalCache.payouts = ctx.session.meta.paypalCache.payouts || {};
  return ctx.session.meta.paypalCache;
}

function defaultPayPalView(type) {
  return {
    type,
    page: 1,
    pageSize: PAYPAL_PAGE_SIZE,
    status: undefined,
    providerState: undefined,
    provider: undefined,
    recipient: undefined,
    sortBy: "updatedAt",
    sortDirection: "desc",
  };
}

function ensurePayPalView(ctx, type) {
  ensureSession(ctx);
  ctx.session.meta.paypalViews = ctx.session.meta.paypalViews || {};
  const current = ctx.session.meta.paypalViews[type] || {};
  const next = {
    ...defaultPayPalView(type),
    ...current,
    type,
  };
  ctx.session.meta.paypalViews[type] = next;
  return next;
}

function updatePayPalView(ctx, type, updates = {}) {
  const view = ensurePayPalView(ctx, type);
  const next = {
    ...view,
    ...updates,
    type,
  };
  if (next.status === "ALL") next.status = undefined;
  if (next.providerState === "ALL") next.providerState = undefined;
  next.page = Math.max(1, Number.parseInt(next.page, 10) || 1);
  next.pageSize = Math.max(1, Math.min(20, Number.parseInt(next.pageSize, 10) || PAYPAL_PAGE_SIZE));
  ctx.session.meta.paypalViews[type] = next;
  return next;
}

function getPayPalQueryFromView(view) {
  return {
    page: view.page,
    pageSize: view.pageSize,
    status: view.status,
    providerState: view.providerState,
    provider: view.provider,
    recipient: view.recipient,
    sortBy: view.sortBy,
    sortDirection: view.sortDirection,
  };
}

function formatFilterLabel(view, type) {
  const filters = [];
  if (view.provider) filters.push(`provider=${view.provider}`);
  if (view.status) filters.push(`status=${view.status}`);
  if (type === "payout" && view.providerState) filters.push(`providerState=${view.providerState}`);
  if (view.recipient) filters.push(`search=${view.recipient}`);
  return filters.length ? filters.join(", ") : "none";
}

function cachePayPalRecords(ctx, type, records) {
  const cache = ensurePayPalCache(ctx);
  const storeName = type === "invoice" ? "invoices" : "payouts";
  cache[storeName] = {};
  return records.map((record, index) => {
    const key = `${type === "invoice" ? "i" : "p"}${index + 1}`;
    cache[storeName][key] = record;
    return { key, record };
  });
}

function getCachedPayPalRecord(ctx, type, key) {
  const cache = ensurePayPalCache(ctx);
  const storeName = type === "invoice" ? "invoices" : "payouts";
  return cache[storeName][key] || null;
}

function getPayPalRecordId(record, type) {
  if (type === "invoice") {
    return record?.internal_invoice_id || record?.invoice_id || record?.id;
  }
  return record?.payout_id || record?.id;
}

async function runServiceReceipt(ctx, service, details = {}) {
  if (!(await requireCapability(ctx, CAPABILITIES.SERVICES_USE, "service receipt generation"))) return;
  if (!canGenerateService(service)) {
    await replyHtml(
      ctx,
      [
        `<b>${escapeHtml(service?.title || "Service")}</b>`,
        "",
        escapeHtml(serviceSummary(service)),
      ].join("\n"),
      service ? buildServiceDetailKeyboard(ctx, service) : buildBackKeyboard(ctx),
    );
    return;
  }

  const payload = buildServiceDetails(service, details);
  const commandLine = `/generate_receipt ${service.receiptType} ${JSON.stringify(payload)}`;
  const result = await runLinkedTelegramCommand(ctx, commandLine);
  const lines = [
    `<b>${escapeHtml(service.title)} Receipt</b>`,
    "",
    escapeHtml(result?.message || "Receipt generated."),
    "",
    line("Service", service.title),
    line("Type", service.receiptType),
  ];
  await replyHtml(ctx, lines.join("\n"), buildServiceDetailKeyboard(ctx, service));
}

async function handlePayPalWorkspace(ctx) {
  if (!(await requireCapability(ctx, CAPABILITIES.SERVICES_USE, "PayPal service workspace"))) return;
  const access = await getAccessStatus(ctx);
  const workspace = getProviderWorkspace("paypal");
  const lanes = (workspace?.lanes || [])
    .filter((lane) => lane.id !== "overview")
    .map((lane) => line(`${providerLaneStatusIcon(lane.status)} ${lane.label}`, `${providerLaneStatusLabel(lane.status)} · ${lane.summary}`));
  rememberScreen(ctx, "PP:HOME");
  rememberProviderContext(ctx, { provider: "paypal", action: "PP:HOME" });
  clearPendingPrompts(ctx);
  const lines = [
    "<b>PayPal Workspace</b>",
    "",
    escapeHtml(workspace?.shortDescription || "Choose the PayPal lane you want to operate."),
    "",
    "<b>Provider Lanes</b>",
    ...lanes,
    access.isAdmin ? "" : null,
    access.isAdmin ? "Admin lanes include official invoice, payout, activity, and developer operations." : null,
  ].filter(Boolean);
  await replyHtml(ctx, lines.join("\n"), buildPayPalWorkspaceKeyboard(ctx, access));
}

async function handleProviderWorkspace(ctx, slug) {
  const service = getService(slug);
  if (!service || !isPaymentProviderService(service)) {
    await handleServiceDetail(ctx, slug);
    return;
  }
  rememberProviderContext(ctx, { provider: service.slug, action: `PROVIDER:${service.slug}` });

  if (service.slug === "paypal") {
    await handlePayPalWorkspace(ctx);
    return;
  }

  if (!(await requireCapability(ctx, CAPABILITIES.SERVICES_USE, `${service.title} provider workspace`))) return;
  const access = await getAccessStatus(ctx);
  rememberScreen(ctx, `PROVIDER:${service.slug}`);
  clearPendingPrompts(ctx);
  const [readinessPayload, capabilityPayload, healthPayload, providerStatusPayload, adminStatusPayload, featuresPayload] = access.isAdmin
    ? await Promise.all([
      getProviderReadinessPayload(service.slug),
      getProviderCapabilityPayload(service.slug),
      getProviderHealthPayload(service.slug),
      getProviderStatusPayload(service.slug),
      adminGet(`/api/admin/payment-providers/${service.slug}`).catch(() => null),
      adminGet(`/api/admin/payment-providers/${service.slug}/invoice-features`).catch(() => null),
    ])
    : await Promise.all([
      getProviderReadinessPayload(service.slug),
      getProviderCapabilityPayload(service.slug),
      getProviderHealthPayload(service.slug),
      getProviderStatusPayload(service.slug),
      Promise.resolve(null),
      Promise.resolve(null),
    ]);
  const readiness = readinessPayload?.data || null;
  const capability = capabilityPayload?.data || null;
  const health = healthPayload?.data || null;
  const providerStatus = providerStatusPayload?.data || null;
  const adminProviderStatus = adminStatusPayload?.provider || {};
  const providerFeatures = featuresPayload?.provider || {};
  const workspace = getProviderWorkspace(service.slug);
  const laneLines = (workspace?.lanes || [])
    .filter((lane) => lane.id !== "overview")
    .map((lane) => line(`${providerLaneStatusIcon(lane.status)} ${lane.label}`, `${providerLaneStatusLabel(lane.status)} · ${lane.summary}`));
  const missingEnv = Array.isArray(adminProviderStatus.missing_env) ? adminProviderStatus.missing_env : [];
  const healthActions = Array.isArray(health?.next_actions) ? health.next_actions : [];
  const providerActions = Array.isArray(providerStatus?.next_actions) ? providerStatus.next_actions : [];
  const adminProviderActions = Array.isArray(adminProviderStatus.next_actions) ? adminProviderStatus.next_actions : [];
  const nextActions = [...providerActions, ...adminProviderActions, ...healthActions].slice(0, 3);
  const nextSteps = formatProviderNextSteps(readiness);
  const lines = [
    `<b>${escapeHtml(service.title)} Workspace</b>`,
    "",
    escapeHtml(workspace?.shortDescription || "Choose the provider lane you want to inspect or operate."),
    "",
    line(
      "Contract",
      readinessPayload?.contract_version ||
        capabilityPayload?.contract_version ||
        healthPayload?.contract_version ||
        providerStatusPayload?.contract_version ||
        PROVIDER_CONTRACT_VERSION,
    ),
    providerStatus
      ? line("API Status", `${providerStatus.status || "unknown"} · ${providerStatus.health_status || "unknown"} · ${providerStatus.health_score ?? 0}/100`)
      : null,
    ...(readiness ? formatProviderReadiness(readiness) : [line("Readiness", capability?.status || adminProviderStatus.status || "catalog")]),
    ...(health ? formatProviderHealth(health) : []),
    access.isAdmin ? line("Mode", adminProviderStatus.mode || capability?.registry_status?.mode || "—") : null,
    access.isAdmin ? line("Invoice Features", formatProviderFeatureSummary(providerFeatures.invoice_features || capability?.registry_status?.invoice_features)) : null,
    missingEnv.length ? line("Missing Env", missingEnv.join(", ")) : null,
    nextActions.length ? line("Next Actions", nextActions.join("; ")) : null,
    nextSteps.length ? "" : null,
    nextSteps.length ? "<b>Recommended Next Steps</b>" : null,
    ...nextSteps,
    "",
    "<b>Provider Lanes</b>",
    ...laneLines,
  ].filter(Boolean);
  await replyHtml(ctx, lines.join("\n"), buildProviderWorkspaceKeyboard(ctx, service, access));
}

function formatBalanceEntries(entries = [], emptyText) {
  return entries.length
    ? entries.map((entry) => `• ${escapeHtml(formatMoney(entry.amount, entry.currency))}`).join("\n")
    : emptyText;
}

function issueProviderLabel(issue = {}) {
  const metadata = issue.metadata || issue.metadata_json || {};
  return issue.provider || issue.payment_provider || metadata.provider || metadata.payment_provider || "provider";
}

function eventProviderLabel(event = {}) {
  return event.provider || event.source || event.payment_provider || event.provider_key || "provider";
}

function belongsToProvider(item, providerSlug, getLabel) {
  const label = String(getLabel(item) || "").toLowerCase();
  return label === providerSlug || label.includes(providerSlug);
}

async function handleProviderPayouts(ctx, slug) {
  const service = getService(slug);
  if (!service || !isPaymentProviderService(service)) {
    await replyHtml(ctx, "Unknown payment provider. Open the provider workspace again.", buildServiceGroupsKeyboard(ctx));
    return;
  }

  if (!(await requireAdmin(ctx, `${service.title} payouts`))) return;
  rememberProviderContext(ctx, { provider: service.slug, lane: "payouts", action: `PROVIDER_PO:${service.slug}` });
  await handlePayPalPayouts(ctx, {
    provider: service.slug,
    providerState: "ALL",
    status: "ALL",
    page: 1,
    notice: `${service.title} payout workspace`,
  });
}

async function handleProviderBalance(ctx, slug) {
  const service = getService(slug);
  if (!service || !isPaymentProviderService(service)) {
    await replyHtml(ctx, "Unknown payment provider. Open the provider workspace again.", buildServiceGroupsKeyboard(ctx));
    return;
  }

  if (!(await requireAdmin(ctx, `${service.title} balance`))) return;
  rememberScreen(ctx, `PROVIDER_BAL:${service.slug}`);
  const readinessPayload = await getProviderReadinessPayload(service.slug);
  const readiness = readinessPayload?.data || null;
  const status = providerOperationStatus(readiness, "balance");
  if (readiness && !providerOperationImplemented(readiness, "balance")) {
    await replyHtml(
      ctx,
      [
        `<b>${escapeHtml(service.title)} · Wallet Balance</b>`,
        "",
        line("Status", providerLaneStatusLabel(status)),
        "Provider balance support needs a signed balance client, account mapping, audit logging, and sandbox validation before it can be operated here.",
      ].join("\n"),
      buildProviderDetailKeyboard(ctx, service),
    );
    return;
  }

  const payload = await providerApiGet(
    providerRoutes.balance(service.slug),
    {},
    contractShapes.okObject,
  ).catch(() => null);
  if (!payload) {
    await replyHtml(
      ctx,
      [
        `<b>${escapeHtml(service.title)} · Wallet Balance</b>`,
        "",
        line("Status", "Unavailable"),
        "The provider balance endpoint did not return a compatible response. Check provider readiness and API deployment status.",
      ].join("\n"),
      buildProviderDetailKeyboard(ctx, service, `PROVIDER_BAL:${service.slug}`),
    );
    return;
  }

  const balance = payload.data || payload.balance || {};
  const available = Array.isArray(balance.available) ? balance.available : [];
  const pending = Array.isArray(balance.pending) ? balance.pending : [];
  const lines = [
    `<b>${escapeHtml(service.title)} · Wallet Balance</b>`,
    "",
    line("Mode", balance.mode === "connected_account" ? "Connected account" : "Platform"),
    line("Environment", balance.livemode ? "Live" : "Sandbox"),
    balance.connected_account_id ? line("Connected Account", balance.connected_account_id) : null,
    "",
    "<b>Available</b>",
    formatBalanceEntries(available, "No available balances returned."),
    "",
    "<b>Pending</b>",
    formatBalanceEntries(pending, "No pending balances returned."),
  ].filter(Boolean);
  await replyHtml(ctx, lines.join("\n"), buildProviderDetailKeyboard(ctx, service, `PROVIDER_BAL:${service.slug}`));
}

async function handleProviderWebhooks(ctx, slug) {
  const service = getService(slug);
  if (!service || !isPaymentProviderService(service)) {
    await replyHtml(ctx, "Unknown payment provider. Open the provider workspace again.", buildServiceGroupsKeyboard(ctx));
    return;
  }

  if (!(await requireAdmin(ctx, `${service.title} webhook activity`))) return;
  rememberScreen(ctx, `PROVIDER_WEBHOOKS:${service.slug}`);
  const activityPayload = await providerApiGet(
    providerRoutes.activity(service.slug),
    { limit: 12 },
    contractShapes.providerActivityList,
  ).catch(() => null);
  const adminPayload = activityPayload ? null : await adminGet("/api/admin/webhooks", { provider: service.slug, limit: 12 }).catch(() => ({ data: [] }));
  const events = activityPayload?.data || dataList(adminPayload, "events", "items");
  const providerEvents = activityPayload ? events : events.filter((event) => belongsToProvider(event, service.slug, eventProviderLabel));
  const visibleEvents = (providerEvents.length ? providerEvents : events).slice(0, 8);
  const lines = [
    `<b>${escapeHtml(service.title)} · Activity</b>`,
    "",
    line("Matched", providerEvents.length || "recent provider events"),
    activityPayload?.pagination ? line("Next Cursor", activityPayload.pagination.next_cursor || "none") : null,
    "",
    ...(visibleEvents.length ? visibleEvents.map(formatWebhookEvent) : ["No recent webhook events found."]),
  ].filter(Boolean);
  await replyHtml(ctx, lines.join("\n"), buildProviderDetailKeyboard(ctx, service, `PROVIDER_WEBHOOKS:${service.slug}`));
}

async function handleProviderIssues(ctx, slug) {
  const service = getService(slug);
  if (!service || !isPaymentProviderService(service)) {
    await replyHtml(ctx, "Unknown payment provider. Open the provider workspace again.", buildServiceGroupsKeyboard(ctx));
    return;
  }

  if (!(await requireAdmin(ctx, `${service.title} payment issues`))) return;
  rememberScreen(ctx, `PROVIDER_ISSUES:${service.slug}`);
  const payload = await adminGet("/api/admin/payment-issues", { provider: service.slug, status: "OPEN", limit: 12 }).catch(() => ({ data: [] }));
  const issues = dataList(payload, "issues", "items");
  const providerIssues = issues.filter((issue) => belongsToProvider(issue, service.slug, issueProviderLabel));
  const visibleIssues = (providerIssues.length ? providerIssues : issues).slice(0, 8);
  const lines = [
    `<b>${escapeHtml(service.title)} · Issues</b>`,
    "",
    line("Matched", providerIssues.length || "recent open issues"),
    "",
    ...(visibleIssues.length ? visibleIssues.map(formatIssue) : ["No open payment issues found."]),
  ];
  await replyHtml(ctx, lines.join("\n"), buildProviderDetailKeyboard(ctx, service, `PROVIDER_ISSUES:${service.slug}`));
}

async function handleProviderLane(ctx, slug, laneId) {
  const service = getService(slug);
  const workspace = getProviderWorkspace(slug);
  const manifestLane = getProviderLane(slug, laneId);
  const lane = manifestLane || PROVIDER_LANE_DETAILS[laneId];
  if (!service || !isPaymentProviderService(service) || !lane) {
    await replyHtml(ctx, "Unknown provider lane. Open the provider workspace again.", buildServiceGroupsKeyboard(ctx));
    return;
  }

  if (laneId === "custom-details" || lane.intent === "custom") {
    await startServiceComposer(ctx, service, { mode: "custom_details" });
    return;
  }

  const requiresAdmin = lane.requiresAdmin !== false;
  const allowed = requiresAdmin
    ? await requireAdmin(ctx, `${service.title} ${lane.label}`)
    : await requireCapability(ctx, CAPABILITIES.SERVICES_USE, `${service.title} ${lane.label}`);
  if (!allowed) return;

  rememberScreen(ctx, `PROVIDER_LANE:${service.slug}:${laneId}`);
  rememberProviderContext(ctx, { provider: service.slug, lane: laneId, action: `PROVIDER_LANE:${service.slug}:${laneId}` });
  const status = getProviderLaneStatus(service.slug, laneId);
  const intentBalanceLane = findProviderLaneByIntent(service, "balance");
  const intentActivityLane = findProviderLaneByIntent(service, "activity");

  if (status === "live" && (lane.botAction === "PP:INV" || lane.botAction === `PROVIDER_INV:${service.slug}` || laneId === "invoices")) {
    await handlePayPalInvoices(ctx, {
      provider: service.slug,
      page: 1,
      notice: `${service.title} invoice workspace`,
    });
    return;
  }

  if (status === "live" && (lane.botAction === "PP:PO" || lane.botAction === `PROVIDER_PO:${service.slug}` || laneId === "payouts")) {
    if (service.slug === "paypal") {
      await handlePayPalPayouts(ctx, {
        provider: service.slug,
        page: 1,
        notice: `${service.title} payout workspace`,
      });
      return;
    }
    await handleProviderPayouts(ctx, service.slug);
    return;
  }

  if (status === "live" && (lane.botAction === `PROVIDER_BAL:${service.slug}` || laneId === "wallet-balance" || lane.id === intentBalanceLane?.id)) {
    await handleProviderBalance(ctx, service.slug);
    return;
  }

  if (status === "live" && (lane.botAction === `PROVIDER_WEBHOOKS:${service.slug}` || laneId === "provider-activity" || lane.id === intentActivityLane?.id)) {
    await handleProviderWebhooks(ctx, service.slug);
    return;
  }

  const lines = [
    `<b>${escapeHtml(service.title)} · ${escapeHtml(lane.label)}</b>`,
    "",
    line("Status", providerLaneStatusLabel(status)),
    workspace ? line("Environment", (workspace.environments || []).join(" / ")) : null,
    line("Intent", lane.intent || "workspace"),
    "",
    escapeHtml(lane.summary),
    "",
    line("Next step", providerLaneNextStep(service, lane, status)),
    "",
    status === "live"
      ? "This lane has backend support where provider readiness and admin permissions are configured."
      : "This lane is visible for navigation consistency, but it stays in setup until signed API clients, webhook verification, idempotency, state mapping, ledger rules, and sandbox tests are completed.",
  ].filter(Boolean);

  await replyHtml(ctx, lines.join("\n"), buildProviderLaneKeyboard(ctx, service, workspace, lane));
}

function invoiceListLabel(invoice, index) {
  const summary = invoice.summary || {};
  return truncate(summary.invoice_number || invoice.invoice_id || invoice.internal_invoice_id || `Invoice ${index + 1}`, 28);
}

function payoutListLabel(payout, index) {
  const summary = payout.summary || {};
  return truncate(payout.payout_id || summary.receiver || `Payout ${index + 1}`, 28);
}

async function handlePayPalInvoices(ctx, updates = {}) {
  if (!(await requireAdmin(ctx, "PayPal invoices"))) return;
  const { notice, ...viewUpdates } = updates;
  const view = updatePayPalView(ctx, "invoice", viewUpdates);
  rememberScreen(ctx, view.provider ? `PROVIDER_INV:${view.provider}` : "PP:INV");
  rememberProviderContext(ctx, {
    provider: view.provider || "paypal",
    lane: "invoices",
    filters: getPayPalQueryFromView(view),
    action: view.provider ? `PROVIDER_INV:${view.provider}` : "PP:INV",
  });
  const payload = await adminGet("/api/admin/invoices", getPayPalQueryFromView(view));
  const items = Array.isArray(payload.data) ? payload.data : [];
  const keyed = cachePayPalRecords(ctx, "invoice", items);
  const providerTitle = providerTitleFromKey(view.provider);
  const lines = [
    `<b>Official ${escapeHtml(providerTitle)} Invoices</b>`,
    notice ? escapeHtml(notice) : null,
    line("Total", payload.pagination?.total ?? items.length),
    line("Page", payload.pagination?.page || view.page),
    line("Filters", formatFilterLabel(view, "invoice")),
    "",
    ...(items.length ? items.map(formatInvoice) : ["No invoices found."]),
  ].filter(Boolean);
  const keyboardItems = keyed.map(({ key, record }, index) => ({
    key,
    label: invoiceListLabel(record, index),
  }));
  await replyHtml(ctx, lines.join("\n"), buildPayPalListKeyboard(ctx, "invoice", keyboardItems, payload.pagination, view));
}

async function handlePayPalPayouts(ctx, updates = {}) {
  if (!(await requireAdmin(ctx, "PayPal payouts"))) return;
  const { notice, ...viewUpdates } = updates;
  const view = updatePayPalView(ctx, "payout", viewUpdates);
  rememberScreen(ctx, view.provider ? `PROVIDER_PO:${view.provider}` : "PP:PO");
  rememberProviderContext(ctx, {
    provider: view.provider || "paypal",
    lane: "payouts",
    filters: getPayPalQueryFromView(view),
    action: view.provider ? `PROVIDER_PO:${view.provider}` : "PP:PO",
  });
  const payload = await adminGet("/api/admin/payouts", getPayPalQueryFromView(view));
  const items = Array.isArray(payload.data) ? payload.data : [];
  const keyed = cachePayPalRecords(ctx, "payout", items);
  const providerTitle = providerTitleFromKey(view.provider);
  const lines = [
    `<b>Official ${escapeHtml(providerTitle)} Payouts</b>`,
    notice ? escapeHtml(notice) : null,
    line("Total", payload.pagination?.total ?? items.length),
    line("Page", payload.pagination?.page || view.page),
    line("Filters", formatFilterLabel(view, "payout")),
    "",
    ...(items.length ? items.map(formatPayout) : ["No payouts found."]),
  ].filter(Boolean);
  const keyboardItems = keyed.map(({ key, record }, index) => ({
    key,
    label: payoutListLabel(record, index),
  }));
  await replyHtml(ctx, lines.join("\n"), buildPayPalListKeyboard(ctx, "payout", keyboardItems, payload.pagination, view));
}

async function handlePayPalInvoiceDetail(ctx, key) {
  if (!(await requireAdmin(ctx, "PayPal invoice details"))) return;
  rememberScreen(ctx, `PP:INV_D:${key}`);
  const invoice = getCachedPayPalRecord(ctx, "invoice", key);
  if (!invoice) {
    await replyHtml(ctx, "That invoice selection expired. Refreshing the invoice list.", buildPayPalWorkspaceKeyboard(ctx));
    await handlePayPalInvoices(ctx);
    return;
  }

  const summary = invoice.summary || {};
  const lines = [
    `<b>Invoice ${escapeHtml(summary.invoice_number || invoice.invoice_id || key)}</b>`,
    "",
    line("Status", invoice.status || "UNKNOWN"),
    line("Provider", invoice.official_paypal?.provider_status || invoice.status || "UNKNOWN"),
    line("Recipient", summary.recipient_email || "unknown"),
    line("Amount", formatMoney(summary.amount, summary.currency)),
    summary.description ? line("Description", summary.description) : null,
    line("PayPal Link", invoice.invoice_link ? "available" : "not available"),
    line("Updated", summary.updated_at || "unknown"),
  ].filter(Boolean);
  await replyHtml(ctx, lines.join("\n"), buildInvoiceDetailKeyboard(ctx, invoice, key));
}

async function handlePayPalPayoutDetail(ctx, key) {
  if (!(await requireAdmin(ctx, "PayPal payout details"))) return;
  rememberScreen(ctx, `PP:PO_D:${key}`);
  const payout = getCachedPayPalRecord(ctx, "payout", key);
  if (!payout) {
    await replyHtml(ctx, "That payout selection expired. Refreshing the payout list.", buildPayPalWorkspaceKeyboard(ctx));
    await handlePayPalPayouts(ctx);
    return;
  }

  const summary = payout.summary || {};
  const providerState = payout.official_paypal?.provider_item_status || payout.metadata?.provider_item_status || "UNKNOWN";
  const lines = [
    `<b>Payout ${escapeHtml(payout.payout_id || key)}</b>`,
    "",
    line("Status", payout.status || "UNKNOWN"),
    line("Provider", providerState),
    line("Receiver", summary.receiver || "unknown"),
    line("Amount", formatMoney(summary.amount, summary.currency)),
    line("Fee", formatMoney(summary.fee_amount, summary.currency)),
    line("Total Debit", formatMoney(summary.total_debit, summary.currency)),
    line("Risk", payout.risk_decision || "UNKNOWN"),
    summary.failure_reason ? line("Failure", summary.failure_reason) : null,
    line("Updated", summary.updated_at || "unknown"),
  ].filter(Boolean);
  await replyHtml(ctx, lines.join("\n"), buildPayoutDetailKeyboard(ctx, payout, key));
}

async function handlePayPalInvoiceAction(ctx, action, key, options = {}) {
  if (!(await requireAdmin(ctx, "PayPal invoice action"))) return;
  const invoice = getCachedPayPalRecord(ctx, "invoice", key);
  const invoiceId = getPayPalRecordId(invoice, "invoice");
  if (!invoiceId) {
    await replyHtml(ctx, "Invoice selection expired. Open the invoice list again.", buildPayPalWorkspaceKeyboard(ctx));
    return;
  }

  if (action === "refresh") {
    const result = await adminPost(`/api/invoices/${encodeURIComponent(invoiceId)}/refresh`);
    const summary = invoice.summary || {};
    recordPaymentAudit(ctx, {
      action: "invoice.refresh",
      resourceType: "invoice",
      resourceId: result.invoice_id || invoiceId,
      providerState: result.official_paypal?.provider_status || invoice.official_paypal?.provider_status || null,
      transferlyState: result.status || invoice.status || null,
      amount: summary.amount,
      currency: summary.currency,
      recipient: summary.recipient_email,
    });
    await replyHtml(
      ctx,
      [
        "<b>🔄 Invoice Refreshed</b>",
        "",
        line("Invoice", result.invoice_id || invoiceId),
        line("Recipient", summary.recipient_email || "unknown"),
        line("Status", result.status || invoice.status || "UNKNOWN"),
        line("Provider", result.official_paypal?.provider_status || invoice.official_paypal?.provider_status || "UNKNOWN"),
        line("Updated By", ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.id || "unknown"),
        line("Time", new Date().toLocaleString()),
      ].join("\n"),
      buildInvoiceResultKeyboard(ctx, key, invoice),
    );
    return;
  }

  if (action === "void") {
    const result = await adminPost(`/api/admin/invoices/${encodeURIComponent(invoiceId)}/void`);
    await replyHtml(
      ctx,
      [
        "<b>🛑 Invoice Voided</b>",
        "",
        line("Invoice", result.invoice_id || invoiceId),
        line("Status", result.status || "CANCELLED"),
        line("Provider", result.provider || result.metadata?.provider || invoice.provider || "stripe"),
      ].join("\n"),
      buildInvoiceResultKeyboard(ctx, key, invoice),
    );
    return;
  }

  if (action === "review") {
    const result = await adminPost(`/api/admin/invoices/${encodeURIComponent(invoiceId)}/review-required`, {
      reason: "Marked for provider settlement review from Telegram workspace",
    });
    await replyHtml(
      ctx,
      [
        "<b>⚠️ Invoice Review Required</b>",
        "",
        line("Invoice", result.invoice_id || invoiceId),
        line("Provider", result.provider || result.metadata?.provider || invoice.provider || "crypto"),
        line("Review", result.metadata?.settlement_review_required ? "required" : "requested"),
      ].join("\n"),
      buildInvoiceResultKeyboard(ctx, key, invoice),
    );
    return;
  }

  if (action === "release") {
    const guard = invoiceReleaseGuard(invoice);
    if (guard) {
      await sendPaymentGuardCard(ctx, "Invoice Release Blocked", guard, buildInvoiceResultKeyboard(ctx, key, invoice));
      return;
    }
    if (!options.confirmed) {
      const summary = invoice.summary || {};
      await replyHtml(
        ctx,
        [
          "<b>Confirm Invoice Release</b>",
          "",
          "This will release paid invoice funds in Transferly.",
          "",
          line("Invoice", summary.invoice_number || invoiceId),
          line("Status", invoice.status || "UNKNOWN"),
          line("Recipient", summary.recipient_email || "unknown"),
          line("Amount", formatMoney(summary.amount, summary.currency)),
        ].join("\n"),
        buildInvoiceConfirmKeyboard(ctx, key, invoice),
      );
      return;
    }

    const result = await adminPost(`/api/admin/invoices/${encodeURIComponent(invoiceId)}/release`, {
      reason: "Released from Telegram PayPal workspace",
    }, {
      headers: {
        "Idempotency-Key": `telegram-release-${invoiceId}-${randomUUID()}`,
      },
    });
    const summary = invoice.summary || {};
    recordPaymentAudit(ctx, {
      action: "invoice.release",
      resourceType: "invoice",
      resourceId: result.invoice_id || invoiceId,
      providerState: invoice.official_paypal?.provider_status || null,
      transferlyState: result.status || invoice.status || "RELEASED",
      amount: summary.amount,
      currency: summary.currency,
      recipient: summary.recipient_email,
      details: { released_amount: result.released_amount || null },
    });
    await replyHtml(
      ctx,
      [
        "<b>✅ Invoice Funds Released</b>",
        "",
        line("Invoice", result.invoice_id || invoiceId),
        line("Recipient", summary.recipient_email || "unknown"),
        line("Amount", formatMoney(summary.amount, summary.currency)),
        line("Transferly State", result.status || invoice.status || "RELEASED"),
        line("Released By", ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.id || "unknown"),
        line("Time", new Date().toLocaleString()),
      ].join("\n"),
      buildInvoiceResultKeyboard(ctx, key, invoice),
    );
  }
}

async function handlePayPalPayoutAction(ctx, action, key, options = {}) {
  if (!(await requireAdmin(ctx, "PayPal payout action"))) return;
  const payout = getCachedPayPalRecord(ctx, "payout", key);
  const payoutId = getPayPalRecordId(payout, "payout");
  if (!payoutId) {
    await replyHtml(ctx, "Payout selection expired. Open the payout list again.", buildPayPalWorkspaceKeyboard(ctx));
    return;
  }

  if (action === "approve") {
    const guard = payoutActionGuard(payout, "approve");
    if (guard) {
      await sendPaymentGuardCard(ctx, "Payout Approval Blocked", guard, buildPayoutResultKeyboard(ctx, key, payout));
      return;
    }
    if (!options.confirmed) {
      const summary = payout.summary || {};
      await replyHtml(
        ctx,
        [
          "<b>Confirm Payout Approval</b>",
          "",
          "This will move the payout into the approved processing path.",
          "",
          line("Payout", payoutId),
          line("Status", payout.status || "UNKNOWN"),
          line("Receiver", summary.receiver || "unknown"),
          line("Amount", formatMoney(summary.amount, summary.currency)),
          line("Total Debit", formatMoney(summary.total_debit, summary.currency)),
          line("Risk", payout.risk_decision || "UNKNOWN"),
        ].join("\n"),
        buildPayoutConfirmKeyboard(ctx, "approve", key, payout),
      );
      return;
    }

    const result = await adminPost(`/api/admin/payouts/${encodeURIComponent(payoutId)}/approve`);
    const summary = payout.summary || {};
    recordPaymentAudit(ctx, {
      action: "payout.approve",
      resourceType: "payout",
      resourceId: result.payout_id || payoutId,
      providerState: payout.official_paypal?.provider_item_status || payout.metadata?.provider_item_status || null,
      transferlyState: result.status || payout.status || "APPROVED",
      amount: summary.amount,
      currency: summary.currency,
      recipient: summary.receiver,
    });
    await replyHtml(
      ctx,
      [
        "<b>✅ Payout Approved</b>",
        "",
        line("Payout", result.payout_id || payoutId),
        line("Receiver", summary.receiver || "unknown"),
        line("Amount", formatMoney(summary.amount, summary.currency)),
        line("Total Debit", formatMoney(summary.total_debit, summary.currency)),
        line("Transferly State", result.status || payout.status || "APPROVED"),
        line("Approved By", ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.id || "unknown"),
        line("Time", new Date().toLocaleString()),
      ].join("\n"),
      buildPayoutResultKeyboard(ctx, key, payout),
    );
    return;
  }

  if (action === "refresh") {
    const result = await adminPost(`/api/payouts/${encodeURIComponent(payoutId)}/refresh`);
    const summary = payout.summary || {};
    recordPaymentAudit(ctx, {
      action: "payout.refresh",
      resourceType: "payout",
      resourceId: result.payout_id || payoutId,
      providerState: result.official_paypal?.provider_item_status || payout.official_paypal?.provider_item_status || payout.metadata?.provider_item_status || null,
      transferlyState: result.status || payout.status || null,
      amount: summary.amount,
      currency: summary.currency,
      recipient: summary.receiver,
    });
    await replyHtml(
      ctx,
      [
        "<b>🔄 Payout Refreshed</b>",
        "",
        line("Payout", result.payout_id || payoutId),
        line("Receiver", summary.receiver || "unknown"),
        line("Transferly State", result.status || payout.status || "UNKNOWN"),
        line("Provider", result.official_paypal?.provider_item_status || payout.official_paypal?.provider_item_status || payout.metadata?.provider_item_status || "UNKNOWN"),
        line("Updated By", ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.id || "unknown"),
        line("Time", new Date().toLocaleString()),
      ].join("\n"),
      buildPayoutResultKeyboard(ctx, key, payout),
    );
    return;
  }

  if (action === "cancel") {
    const guard = payoutActionGuard(payout, "cancel");
    if (guard) {
      await sendPaymentGuardCard(ctx, "Payout Cancel Blocked", guard, buildPayoutResultKeyboard(ctx, key, payout));
      return;
    }
    if (!options.confirmed) {
      const summary = payout.summary || {};
      await replyHtml(
        ctx,
        [
          "<b>Confirm Unclaimed Payout Cancel</b>",
          "",
          "This will request cancellation for an unclaimed PayPal payout.",
          "",
          line("Payout", payoutId),
          line("Receiver", summary.receiver || "unknown"),
          line("Provider", payout.official_paypal?.provider_item_status || payout.metadata?.provider_item_status || "UNKNOWN"),
          line("Amount", formatMoney(summary.amount, summary.currency)),
        ].join("\n"),
        buildPayoutConfirmKeyboard(ctx, "cancel", key, payout),
      );
      return;
    }

    const result = await adminPost(`/api/admin/payouts/${encodeURIComponent(payoutId)}/cancel-unclaimed`);
    const summary = payout.summary || {};
    recordPaymentAudit(ctx, {
      action: "payout.cancel_unclaimed",
      resourceType: "payout",
      resourceId: result.payout_id || payoutId,
      providerState: payout.official_paypal?.provider_item_status || payout.metadata?.provider_item_status || null,
      transferlyState: result.status || payout.status || null,
      amount: summary.amount,
      currency: summary.currency,
      recipient: summary.receiver,
    });
    await replyHtml(
      ctx,
      [
        "<b>↩️ Payout Cancel Submitted</b>",
        "",
        line("Payout", result.payout_id || payoutId),
        line("Receiver", summary.receiver || "unknown"),
        line("Provider", payout.official_paypal?.provider_item_status || payout.metadata?.provider_item_status || "UNKNOWN"),
        line("Amount", formatMoney(summary.amount, summary.currency)),
        line("Submitted By", ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.id || "unknown"),
        line("Time", new Date().toLocaleString()),
      ].join("\n"),
      buildPayoutResultKeyboard(ctx, key, payout),
    );
    return;
  }

  if (action === "reject") {
    const guard = payoutActionGuard(payout, "reject");
    if (guard) {
      await sendPaymentGuardCard(ctx, "Payout Rejection Blocked", guard, buildPayoutResultKeyboard(ctx, key, payout));
      return;
    }
    ctx.session.meta.pendingPayPalAction = {
      action: "reject_payout",
      payoutId,
      key,
      createdAt: Date.now(),
    };
    await replyHtml(ctx, "Send the rejection reason for this payout, or send cancel.", buildCancelKeyboard(ctx));
  }
}

async function handlePendingPayPalText(ctx, text) {
  const pending = ctx.session.meta.pendingPayPalAction;
  if (!pending) return false;
  if (!(await requireCapability(ctx, CAPABILITIES.PAYMENTS_MUTATE, "PayPal action"))) {
    delete ctx.session.meta.pendingPayPalAction;
    return true;
  }

  const normalized = String(text || "").trim();
  if (!normalized || normalized.toLowerCase() === "cancel") {
    delete ctx.session.meta.pendingPayPalAction;
    await replyHtml(ctx, "PayPal action cancelled.", buildPayPalWorkspaceKeyboard(ctx));
    return true;
  }

  if (pending.action === "reject_payout") {
    const payout = pending.key ? getCachedPayPalRecord(ctx, "payout", pending.key) : null;
    const summary = payout?.summary || {};
    const result = await adminPost(`/api/admin/payouts/${encodeURIComponent(pending.payoutId)}/reject`, {
      reason: normalized,
    });
    recordPaymentAudit(ctx, {
      action: "payout.reject",
      resourceType: "payout",
      resourceId: result.payout_id || pending.payoutId,
      providerState: payout?.official_paypal?.provider_item_status || payout?.metadata?.provider_item_status || null,
      transferlyState: result.status || "REJECTED",
      amount: summary.amount,
      currency: summary.currency,
      recipient: summary.receiver,
      details: { reason: normalized },
    });
    delete ctx.session.meta.pendingPayPalAction;
    await replyHtml(
      ctx,
      [
        "<b>⛔ Payout Rejected</b>",
        "",
        line("Payout", result.payout_id || pending.payoutId),
        line("Reason", normalized),
        line("Transferly State", result.status || "REJECTED"),
        line("Rejected By", ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.id || "unknown"),
        line("Time", new Date().toLocaleString()),
      ].join("\n"),
      pending.key ? buildPayoutResultKeyboard(ctx, pending.key, payout) : buildPayPalWorkspaceKeyboard(ctx, await getAccessStatus(ctx)),
    );
    return true;
  }

  delete ctx.session.meta.pendingPayPalAction;
  return false;
}

async function handlePendingComposerText(ctx, text) {
  const composer = ctx.session.meta.serviceComposer;
  if (!composer) return false;
  if (!(await requireCapability(ctx, CAPABILITIES.SERVICES_USE, "service composer"))) {
    delete ctx.session.meta.serviceComposer;
    return true;
  }

  const service = getService(composer.slug);
  if (!service) {
    delete ctx.session.meta.serviceComposer;
    await replyHtml(ctx, "Composer expired. Use /services to start again.", buildServiceGroupsKeyboard(ctx));
    return true;
  }

  const normalized = String(text || "").trim();
  if (normalized.toLowerCase() === "cancel") {
    delete ctx.session.meta.serviceComposer;
    await replyHtml(ctx, "Service composer cancelled.", buildServiceDetailKeyboard(ctx, service));
    return true;
  }

  if (composer.awaitingConfirm) {
    await replyHtml(ctx, "Use the preview buttons to generate, edit, or cancel.", buildComposerPreviewKeyboard(ctx));
    return true;
  }

  const steps = getComposerSteps(service);
  const step = steps[composer.stepIndex];
  if (!step) {
    await sendComposerPreview(ctx);
    return true;
  }

  const validation = validateComposerValue(step, normalized);
  if (!validation.ok) {
    await replyHtml(ctx, validation.message, buildCancelKeyboard(ctx));
    return true;
  }

  composer.answers[step.key] = validation.value;
  composer.stepIndex += 1;

  if (composer.stepIndex >= steps.length) {
    await sendComposerPreview(ctx);
    return true;
  }

  await sendComposerPrompt(ctx);
  return true;
}

async function handleComposerAction(ctx, action) {
  const composer = ctx.session.meta.serviceComposer;
  const service = getService(composer?.slug);
  if (!composer || !service) {
    await replyHtml(ctx, "Composer expired. Use /services to start again.", buildServiceGroupsKeyboard(ctx));
    return;
  }

  if (action === "cancel") {
    delete ctx.session.meta.serviceComposer;
    await replyHtml(ctx, "Service composer cancelled.", buildServiceDetailKeyboard(ctx, service));
    return;
  }

  if (action === "edit") {
    ctx.session.meta.serviceComposer = {
      ...composer,
      answers: {},
      stepIndex: 0,
      awaitingConfirm: false,
    };
    await sendComposerPrompt(ctx);
    return;
  }

  if (action === "confirm") {
    const details = {
      ...(composer.baseDetails || {}),
      ...(composer.answers || {}),
    };
    delete ctx.session.meta.serviceComposer;
    await runServiceReceipt(ctx, service, details);
  }
}

async function adminGet(path, params = {}) {
  const response = await httpClient.get(null, buildApiUrl(config.apiUrl, path, params), {
    timeout: 12000,
  });
  return response.data;
}

async function providerApiGet(path, params = {}, contract = null) {
  const response = await httpClient.get(null, buildApiUrl(config.apiUrl, path, params), {
    timeout: 12000,
  });
  return validateApiResponseContract(response.data, contract, {
    method: "GET",
    url: path,
    requestId: response.data?.requestId,
  });
}

async function getProviderReadinessPayload(provider) {
  return providerApiGet(
    providerRoutes.providerReadiness(provider),
    {},
    contractShapes.providerReadiness,
  ).catch(() => null);
}

async function getProviderHealthPayload(provider) {
  return providerApiGet(
    providerRoutes.providerHealth(provider),
    {},
    contractShapes.providerHealth,
  ).catch(() => null);
}

async function getProviderStatusPayload(provider) {
  return providerApiGet(
    providerRoutes.providerStatus(provider),
    {},
    contractShapes.providerStatus,
  ).catch(() => null);
}

async function getProviderCapabilityPayload(provider) {
  return providerApiGet(
    providerRoutes.provider(provider),
    {},
    contractShapes.okObject,
  ).catch(() => null);
}

function providerOperationStatus(readiness, operation) {
  const item = readiness?.operations?.find((entry) => entry.operation === operation);
  return item?.status || "setup";
}

function providerOperationImplemented(readiness, operation) {
  const item = readiness?.operations?.find((entry) => entry.operation === operation);
  return Boolean(item?.implemented);
}

function formatProviderReadiness(readiness = {}) {
  const summary = readiness.summary || {};
  const missingEnv = Array.isArray(readiness.missing_env) ? readiness.missing_env : [];
  return [
    line("Readiness", readiness.ready ? "Ready" : readiness.status || "Needs setup"),
    line("Live Ops", summary.live_operations ?? 0),
    line("Setup Ops", summary.setup_operations ?? 0),
    missingEnv.length ? line("Missing Env", missingEnv.join(", ")) : null,
  ].filter(Boolean);
}

function formatProviderHealth(health = {}) {
  return [
    line("Health", `${health.status || "unknown"} · ${health.score ?? 0}/100`),
    line("Failed Webhooks", health.failed_webhooks ?? 0),
    line("Open Issues", health.unresolved_issues ?? 0),
  ];
}

function formatProviderNextSteps(readiness = {}) {
  const steps = Array.isArray(readiness.recommended_next_steps)
    ? readiness.recommended_next_steps.slice(0, 3)
    : [];
  return steps.map((step) => `• ${escapeHtml(step.label || step.code || "Review provider setup")}`);
}

function buildMutationIdempotencyKey(path, body = {}) {
  return createMutationIdempotencyKey(path, body);
}

async function adminPost(path, body = {}, options = {}) {
  const response = await httpClient.post(null, buildApiUrl(config.apiUrl, path), body, {
    timeout: 15000,
    idempotencyKey: options.idempotencyKey || buildMutationIdempotencyKey(path, body),
    ...options,
  });
  return response.data;
}

function getListArgs(ctx) {
  const args = getArgs(ctx);
  return {
    status: args[0] && args[0].toUpperCase() !== "ALL" ? args[0].toUpperCase() : undefined,
    recipient: args.slice(1).join(" ") || undefined,
  };
}

function formatInvoice(invoice) {
  const summary = invoice.summary || {};
  const id = summary.invoice_number || invoice.invoice_id || invoice.internal_invoice_id || invoice.id;
  const providerState = invoice.official_paypal?.provider_status || invoice.status;
  return [
    `• <b>${escapeHtml(id)}</b>`,
    escapeHtml(summary.recipient_email || invoice.recipient_email || "unknown recipient"),
    escapeHtml(formatMoney(summary.amount, summary.currency)),
    escapeHtml(providerState || "UNKNOWN"),
  ].join(" — ");
}

function formatPayout(payout) {
  const summary = payout.summary || {};
  const providerState =
    payout.official_paypal?.provider_item_status ||
    payout.metadata?.provider_item_status ||
    "UNKNOWN";
  return [
    `• <b>${escapeHtml(payout.payout_id || payout.id)}</b>`,
    escapeHtml(summary.receiver || "unknown receiver"),
    escapeHtml(formatMoney(summary.amount, summary.currency)),
    escapeHtml(`${payout.status || "UNKNOWN"} / ${providerState}`),
  ].join(" — ");
}

function formatIssue(issue) {
  return [
    `• <b>${escapeHtml(issue.payment_issue_id || issue.id)}</b>`,
    escapeHtml(issue.status || "OPEN"),
    escapeHtml(truncate(issue.title || issue.issue_type || "Payment issue", 90)),
  ].join(" — ");
}

function formatOrder(order) {
  return [
    `• <b>${escapeHtml(order.order_id || order.id)}</b>`,
    escapeHtml(order.status || "unknown"),
    escapeHtml(order.user_email || order.user_id || "unknown user"),
    escapeHtml(order.amount_label || order.method_title || "top-up"),
  ].join(" — ");
}

function dataList(payload, ...keys) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

function adminReadFallback(error) {
  return {
    data: [],
    error: error?.userMessage || error?.message || "API request failed",
  };
}

function unavailableSummary(sources) {
  const failed = sources
    .filter(([, payload]) => payload?.error)
    .map(([label]) => label);
  return failed.length ? `Some sections could not be loaded: ${failed.join(", ")}.` : null;
}

function formatProvider(provider = {}) {
  const id = provider.provider || provider.slug || provider.id || provider.name || "provider";
  const label = provider.display_name || provider.displayName || provider.name || id;
  const enabled = provider.enabled === false || provider.status === "disabled" ? "disabled" : (provider.status || "enabled");
  const mode = provider.mode || provider.environment || provider.provider_mode || "";
  return `• <b>${escapeHtml(label)}</b> — ${escapeHtml(enabled)}${mode ? ` — ${escapeHtml(mode)}` : ""}`;
}

function formatWebhookEvent(event = {}) {
  const type = event.event_type || event.type || event.provider_event_type || "webhook";
  const provider = event.provider || event.source || event.payment_provider || "provider";
  const status = event.status || event.processing_status || "received";
  return `• <b>${escapeHtml(type)}</b> — ${escapeHtml(provider)} — ${escapeHtml(status)}`;
}

function formatRiskFlag(flag = {}) {
  const subject = flag.user_email || flag.user_id || flag.resource_id || flag.id || "resource";
  const reason = flag.reason || flag.risk_reason || flag.flag_type || "risk flag";
  const level = flag.severity || flag.level || flag.status || "review";
  return `• <b>${escapeHtml(subject)}</b> — ${escapeHtml(level)} — ${escapeHtml(truncate(reason, 80))}`;
}

function formatClient(user = {}) {
  const name = user.email || user.username || user.name || user.id || user.user_id || "client";
  const status = user.status || user.account_status || "active";
  const balance = user.balance_label || (user.wallet_balance !== undefined ? formatMoney(user.wallet_balance, user.wallet_currency) : "");
  return `• <b>${escapeHtml(name)}</b> — ${escapeHtml(status)}${balance ? ` — ${escapeHtml(balance)}` : ""}`;
}

function formatQueueSummary(payload = {}) {
  const queues = Array.isArray(payload.queues) ? payload.queues : [];
  if (!queues.length) return payload.redis_status || null;
  const totals = queues.reduce((acc, queue) => {
    const counts = queue.counts || {};
    acc.waiting += Number(counts.waiting || 0);
    acc.active += Number(counts.active || 0);
    acc.failed += Number(counts.failed || 0);
    return acc;
  }, { waiting: 0, active: 0, failed: 0 });
  return `${queues.length} queues · ${totals.waiting} waiting · ${totals.active} active · ${totals.failed} failed`;
}

async function getAdminDashboardSnapshot() {
  const [health, invoices, payouts, issues, orders] = await Promise.all([
    httpClient.get(null, `${config.apiUrl}/health`, { timeout: 5000 })
      .then((response) => response.data)
      .catch(() => ({ status: "unreachable" })),
    adminGet("/api/admin/invoices", { pageSize: 1 }).catch(() => ({})),
    adminGet("/api/admin/payouts", { pageSize: 1 }).catch(() => ({})),
    adminGet("/api/admin/payment-issues", { status: "OPEN", limit: 5 }).catch(() => ({ data: [] })),
    adminGet("/api/admin/top-up-orders", { status: "awaiting_confirmation", limit: 5 }).catch(() => ({ data: [] })),
  ]);

  return {
    api: health.status || (health.ok ? "ok" : "unknown"),
    invoices: invoices.pagination?.total ?? "—",
    payouts: payouts.pagination?.total ?? "—",
    issues: Array.isArray(issues.data) ? issues.data.length : "—",
    fundingReview: Array.isArray(orders.data) ? orders.data.length : "—",
  };
}

async function handleMenu(ctx) {
  resetSession(ctx);
  resetNavigation(ctx, "MENU");
  const access = await getAdminStatus(ctx);
  const dashboard = access.isAdmin ? await getAdminDashboardSnapshot() : null;
  const title = access.isOwner ? "Transferly Owner Console" : access.isAdmin ? "Transferly Admin Bot" : access.isAuthorized ? "Transferly Bot" : "Transferly Access";
  const userLines = [
    line("Telegram ID", ctx.from?.id || "unknown"),
    line("Username", ctx.from?.username ? `@${ctx.from.username}` : "none"),
    line("Role", access.role || ROLES.GUEST),
    line("Access", access.isAuthorized ? access.status : "NOT_AUTHORIZED"),
    line("Subscription", access.subscriptionExpired ? "expired" : formatExpiry(access.subscriptionExpiresAt)),
    line("Admin Source", access.adminSource),
  ];
  const guestBody = [
    `<b>💼 ${escapeHtml(title)}</b>`,
    "",
    "🔒 Your Telegram account is not authorized to use Transferly services yet.",
    "",
    "<b>👤 Identity</b>",
    ...userLines,
    "",
    "Send your Telegram ID to an administrator to request access.",
  ];
  const body = !access.isAuthorized && !access.isAdmin ? guestBody : [
    `<b>💼 ${escapeHtml(title)}</b>`,
    "",
    access.isOwner
      ? "👑 Welcome, Owner. Manage access, subscriptions, payment operations, provider health, and Transferly services."
      : access.isAdmin
      ? "🛡️ Welcome, Administrator. Your finance command center is ready for invoices, payouts, providers, risk, and activity."
      : "👋 Welcome to Transferly. Use this bot for provider services, balances, receipts, referrals, and Mini App finance flows.",
    "",
    "<b>👤 User Information</b>",
    ...userLines,
    "",
    dashboard ? "<b>📊 Live Operations</b>" : null,
    dashboard ? line("API", dashboard.api) : null,
    dashboard ? line("Invoices", dashboard.invoices) : null,
    dashboard ? line("Payouts", dashboard.payouts) : null,
    dashboard ? line("Open Issues", dashboard.issues) : null,
    dashboard ? line("Funding Review", dashboard.fundingReview) : null,
    dashboard ? "" : null,
    "<b>⚡ Main Workspaces</b>",
    "💳 Providers  •  📊 Activity",
    "🏦 Wallet Records  •  ✉️ Notifications  •  🗂️ Vault",
    access.isAdmin ? "📄 Invoices  •  💸 Payouts  •  🛡️ Risk  •  🔐 Security" : "🧾 Service Receipts  •  💰 Balance  •  🚀 Mini App",
    "",
    access.isOwner
      ? "Use the buttons below for owner, admin, and service workflows."
      : access.isAdmin
        ? "Use the buttons below for the fastest admin workflow."
      : "Use the buttons below for Transferly services, balances, receipts, profile, and referrals.",
  ].filter((item) => item !== null);
  await replyHtml(ctx, body.join("\n"), buildMainMenuKeyboard(ctx, access));
}

async function handleStart(ctx) {
  resetSession(ctx);
  resetNavigation(ctx, "START");
  const access = await getAdminStatus(ctx);
  const title = access.isOwner
    ? "Transferly Owner"
    : access.isAdmin
      ? "Transferly Admin"
      : access.isAuthorized
        ? "Transferly User"
        : "Transferly Access";
  const welcome = access.isOwner
    ? "Owner console ready. Manage access, subscriptions, and payment operations from one clean workspace."
    : access.isAdmin
      ? "Admin workspace ready. Review invoices, payouts, issues, and system health with fewer taps."
      : access.isAuthorized
        ? "Welcome back. Your Transferly services, receipts, balance, and PayPal tools are ready."
        : "Welcome to Transferly. Verify your identity below and request access to unlock services.";
  const accessLabel = access.isAuthorized ? access.status : "NOT_AUTHORIZED";
  const subscriptionLabel = access.subscriptionExpired
    ? "expired"
    : access.role === ROLES.OWNER
      ? "owner access"
      : formatExpiry(access.subscriptionExpiresAt);
  const nextStep = access.isAuthorized
    ? "Open Menu for the full workspace, or jump straight into Services."
    : "Tap Whoami, copy your Telegram ID, and send it to an owner/admin for access.";
  const lines = [
    `<b>💼 ${escapeHtml(title)}</b>`,
    escapeHtml(welcome),
    "",
    "<b>👤 Your Access</b>",
    line("Telegram ID", ctx.from?.id || "unknown"),
    line("Username", ctx.from?.username ? `@${ctx.from.username}` : "none"),
    line("Role", access.role || ROLES.GUEST),
    line("Status", accessLabel),
    line("Subscription", subscriptionLabel),
    "",
    `<b>⚡ Next:</b> ${escapeHtml(nextStep)}`,
  ];
  await replyHtml(ctx, lines.join("\n"), buildStartKeyboard(ctx, access));
}

async function handleCancel(ctx) {
  resetSession(ctx);
  await replyHtml(ctx, "Current bot prompt cancelled.", buildStartKeyboard(ctx, await getAdminStatus(ctx)));
}

async function handleMiniApp(ctx) {
  resetSession(ctx);
  rememberScreen(ctx, "MINI_APP");
  const access = await getAdminStatus(ctx);
  const lines = [
    "<b>🚀 Transferly Mini App</b>",
    "",
    "Open the Telegram-native workspace for receipts, points, provider operations, activity, and guided support.",
    "",
    "No web login or register screen is needed here. Launch from the bot and Transferly keeps the miniapp flow tied to Telegram context.",
    "",
    config.miniAppUrl
      ? "Use the buttons below to launch the Mini App directly inside Telegram."
      : "Mini App URL is not configured. Set MINI_APP_URL in bot/.env.",
  ];

  const keyboard = new InlineKeyboard()
    .text("📋 Menu", buildCallbackData(ctx, "MENU"))
    .text("💳 Providers", buildCallbackData(ctx, "PROVIDERS"));
  addMiniAppButton(keyboard, "🚀 Dashboard", "dashboard");
  addMiniAppButton(keyboard, "🧾 Studio", "studio");
  addMiniAppButton(keyboard, "🗂️ Vault", "vault");
  addMiniAppButton(keyboard, "💳 Providers", "ops");
  addMiniAppButton(keyboard, "📄 Invoices", "invoices");
  addMiniAppButton(keyboard, "💸 Payouts", "payouts");
  addMiniAppButton(keyboard, "📊 Activity", "activity");
  addMiniAppButton(keyboard, "💰 Wallet", "wallet");
  if (access.isAdmin) {
    addMiniAppButton(keyboard, "📈 Analytics", "analytics");
    addMiniAppButton(keyboard, "👥 Clients", "clients");
    addMiniAppButton(keyboard, "🛡️ Risk", "risk");
    addMiniAppButton(keyboard, "🔐 Security", "security");
  }
  addMiniAppButton(keyboard, "🛟 Support", "support");

  if (!access.isAuthorized) {
    const adminUsername = (access.configuredAdminUsername || config.admin?.username || "").replace(/^@/, "");
    if (adminUsername) {
      keyboard.row().url("📱 Request Access", `https://t.me/${adminUsername}`);
    }
  }

  await replyHtml(ctx, lines.join("\n"), keyboard);
}

async function handleHelp(ctx) {
  rememberScreen(ctx, "HELP");
  const access = await getAdminStatus(ctx);
  const lines = [
    "<b>📚 Transferly Bot Guide</b>",
    "",
    "The fastest way to use the bot is through inline buttons. The visible Telegram command menu only shows the entry points; this guide lists the direct shortcuts when you need them.",
    "",
    "<b>🧭 Interactive Command Hub</b>",
    "Use the buttons below for collection, sending, account, support, provider, and operator submenus that mirror the Mini App workspaces.",
    "",
    "<b>🧭 Main Navigation</b>",
    "• /start — opens a clean Transferly home screen.",
    "• /menu — resets the current flow and returns to the main workspace menu.",
    "• /miniapp — opens Telegram Mini App launch buttons for Dashboard, Studio, Vault, Wallet, Providers, and Support.",
    "• /providers — opens the payment provider cockpit.",
    `• /provider stripe — opens a specific provider workspace. Direct shortcuts: ${PROVIDER_COMMAND_HINT}.`,
    "• /services — opens the service catalog.",
    "• /help — shows this full guide.",
    "• /cancel — cancels the current prompt or typed flow.",
    "",
    "<b>⬅️ Back Buttons</b>",
    "• Back returns to the previous screen saved in your bot session.",
    "• Main Menu always resets you to the top-level Transferly menu.",
    "• PayPal detail screens keep their list filter and page state when you return.",
    "",
    "<b>👤 Account</b>",
    "• /whoami — shows Telegram ID, username, bot role, linked Transferly user, and admin setup.",
    "• /profile — shows the linked Transferly web profile.",
    "• /balance — shows the linked user points balance.",
    "• /referral — shows referral code and referral count.",
    "",
    "<b>🧾 Receipts</b>",
    "• /services — browse Wallet Records, Verified Notifications, Receipt Vault, and Utilities.",
    "• Mini App Studio — opens the Telegram-native receipt workspace without login/register pages.",
    "• Mini App Vault — opens generated receipt history and support-ready receipt context.",
    "• Service button flow — choose a category, choose a service, then use Quick Generate, Custom Details, History, or Balance.",
    "• /receipts — shows latest generated receipts for the linked user.",
    "• /history paypal — opens service-specific receipt history where supported.",
    "• /receipt bank {\"service\":\"opay\",\"amount\":\"25.00\"} — direct receipt generation shortcut.",
    "",
    "<b>💳 PayPal Workspace</b>",
    "• /paypal — opens the PayPal provider workspace.",
    "• Services → Verified Notifications → PayPal → PayPal Workspace.",
    "• Notification — starts the PayPal receipt composer.",
    "• Official Invoices — admin invoice list with status filters, pages, detail cards, Refresh, Release, and Open PayPal Link.",
    "• Official Payouts — admin payout list with status/provider filters, pages, detail cards, Approve, Reject, Refresh, and Cancel Unclaimed.",
    "",
    "<b>🏥 Utility</b>",
    "• /health — checks Transferly API health.",
    "• /status — admin deep status with API, database, Redis, invoices, payouts, issues, and funding review.",
  ];

  if (access.isAdmin) {
    lines.push(
      "",
      "<b>🛡️ Admin Command Center</b>",
      "• /providers — provider cockpit with provider lanes and backend provider status.",
      "• /activity — operations pulse with invoices, payouts, webhooks, and open issues.",
      "• /clients — client intelligence from the admin user surface.",
      "• /risk — active risk flags.",
      "• /security — API, database, Redis, queue, dead-letter, and webhook watch.",
      "• /invoices SENT customer@example.com — list invoices by status and recipient/search text.",
      "• /payouts PENDING recipient@example.com — list payouts by status and receiver/search text.",
      "• /ops — payment operations summary.",
      "• /issues — open payment issues.",
      "• /orders — top-up orders awaiting confirmation or filtered by status.",
      "• /users — local bot access management with List, Add, Promote, and Remove buttons.",
      "• /reconcile — runs payment reconciliation.",
      "",
      "<b>💸 Admin Actions</b>",
      "• /approve_payout PAYOUT_ID — approves a payout directly.",
      "• /reject_payout PAYOUT_ID reason — rejects a payout with a reason.",
      "• /cancel_unclaimed PAYOUT_ID — requests cancellation for an unclaimed PayPal payout.",
      "• /release_invoice INVOICE_ID optional_amount optional reason — releases paid invoice funds.",
    );
  }

  lines.push(
    "",
    "Menus automatically replace the previous bot message to keep the chat clean.",
  );

  await replyHtml(ctx, lines.join("\n"), buildCommandHubKeyboard(ctx, access));
}

const COMMAND_SECTION_GUIDES = {
  MENU_COLLECT: {
    title: "<b>🧾 Collection Workflows</b>",
    summary: "Start provider-first receive, invoice, and payment-review work without losing the Mini App path.",
    flow: [
      "Choose a provider lane before opening aggregate invoice lists.",
      "Use provider workspaces for setup, receive links, invoice detail, webhook status, and ledger review.",
      "Move to Activity or Issues when a collection needs operational investigation.",
    ],
    actions: [
      "PayPal Invoices, Stripe Payments, Crypto Receive, provider catalog.",
      "Admin review: invoices, activity, issues, payment audit, and provider status.",
    ],
    miniAppMirror: "Invoices, provider workspaces, activity, and support handoff.",
    bestFor: "Creating, reviewing, refreshing, and releasing collection-side payment flows.",
    safety: "Release and void actions stay inside admin-gated invoice detail screens.",
  },
  MENU_SEND: {
    title: "<b>💸 Sending Workflows</b>",
    summary: "Guide payout and transfer work from Telegram while keeping the Mini App payout center aligned.",
    flow: [
      "Choose the provider lane that owns the payout before reviewing aggregate queues.",
      "Use detail cards for approval, rejection, refresh, or cancellation decisions.",
      "Escalate to Activity, Risk, or Security when payout state and ledger state disagree.",
    ],
    actions: [
      "PayPal Payouts, provider send lanes, payout search, approvals, rejects, and cancel-unclaimed.",
      "Admin review: payouts, operations summary, reconciliation, risk, and payment audit.",
    ],
    miniAppMirror: "Payouts, wallet, activity, risk, and provider send workspaces.",
    bestFor: "Approving, rejecting, retrying, and auditing outbound money movement.",
    safety: "Mutation buttons stay capability-gated and should always preserve idempotent payout handling.",
  },
  MENU_ACCOUNT: {
    title: "<b>🏦 Account Workspace</b>",
    summary: "Give users a clear Telegram entry point for personal Transferly state and Mini App account views.",
    flow: [
      "Check Profile before asking a user to retry an account-sensitive action.",
      "Use Balance and Receipts for quick context in chat.",
      "Open Wallet, Vault, or Profile in the Mini App when the user needs richer history or forms.",
    ],
    actions: [
      "Profile, balance, receipts, referral, support.",
      "Mini App continuity: Profile, Wallet, Vault, and history.",
    ],
    miniAppMirror: "Profile, Wallet, Vault, receipts, referral, and account history.",
    bestFor: "Self-service status checks and guided account support.",
    safety: "Never expose private tokens, provider secrets, or raw webhook payloads in account replies.",
  },
  MENU_ADMIN: {
    title: "<b>🧩 Operator Command Center</b>",
    summary: "A role-gated operations hub for payment health, webhook reliability, user access, and production checks.",
    flow: [
      "Start with Activity for the current operational pulse.",
      "Use Risk, Security, Issues, Orders, and Reconcile when a workflow needs investigation.",
      "Use Payment Audit, Bot Analytics, and subscription alerts for traceability and follow-up.",
    ],
    actions: [
      "Activity, clients, risk, security, issues, orders, reconcile, payment audit.",
      "Bot operations, bot analytics, subscription alerts, and owner-only user management.",
    ],
    miniAppMirror: "Dashboard, Studio, Analytics, Security, Activity, and operations views.",
    bestFor: "Production monitoring, incident triage, and operator workflows.",
    safety: "Admin-only actions must keep audit logs, avoid raw secret logging, and preserve ledger integrity.",
  },
  MENU_SUPPORT: {
    title: "<b>🛟 Support & Diagnostics</b>",
    summary: "Help users recover quickly from chat, Mini App, provider, or API confusion.",
    flow: [
      "Use Help and Whoami to confirm the user, role, and available commands.",
      "Check Health, Providers, Activity, or Security before blaming the user flow.",
      "Open Support in the Mini App when the user needs a richer guided support surface.",
    ],
    actions: [
      "Help guide, whoami, health check, provider status, and support handoff.",
      "Admin diagnostics: activity and security shortcuts when support needs operational context.",
    ],
    miniAppMirror: "Support, Profile, Dashboard, provider status, and diagnostics.",
    bestFor: "Guided recovery, access checks, and support handoff.",
    safety: "Keep replies helpful but avoid exposing bearer tokens, webhook headers, or private runtime state.",
  },
};

function formatCommandSectionBody(section) {
  const guide = COMMAND_SECTION_GUIDES[section] || COMMAND_SECTION_GUIDES.MENU_SUPPORT;
  return [
    guide.title,
    "",
    escapeHtml(guide.summary),
    "",
    "<b>Guided flow</b>",
    ...guide.flow.map((item) => `• ${escapeHtml(item)}`),
    "",
    "<b>Bot actions</b>",
    ...guide.actions.map((item) => `• ${escapeHtml(item)}`),
    "",
    line("Mini App mirror", guide.miniAppMirror),
    line("Best for", guide.bestFor),
    line("Safety", guide.safety),
  ].join("\n");
}

async function handleCommandSection(ctx, section) {
  const capability =
    section === "MENU_ADMIN"
      ? CAPABILITIES.SYSTEM_STATUS
      : section === "MENU_ACCOUNT"
        ? CAPABILITIES.ACCOUNT_READ
        : section === "MENU_SUPPORT"
          ? CAPABILITIES.PUBLIC
          : CAPABILITIES.SERVICES_USE;
  if (capability !== CAPABILITIES.PUBLIC && !(await requireCapability(ctx, capability, "command menu"))) return;
  const access = await getAdminStatus(ctx);
  rememberScreen(ctx, section);
  clearPendingPrompts(ctx);
  await replyHtml(ctx, formatCommandSectionBody(section), buildCommandSectionKeyboard(ctx, section, access));
}

async function handleServices(ctx) {
  if (!(await requireCapability(ctx, CAPABILITIES.SERVICES_USE, "services"))) return;
  rememberScreen(ctx, "SERVICES");
  clearPendingPrompts(ctx);
  const lines = [
    "<b>Transferly Services</b>",
    "",
    "Choose a category. Provider services open lane controls, generation tools, recent receipts, and balance shortcuts when supported.",
  ];
  await replyHtml(ctx, lines.join("\n"), buildServiceGroupsKeyboard(ctx));
}

async function startSearchFlow(ctx, type) {
  const capability =
    type === "service" ? CAPABILITIES.SERVICES_USE :
    type === "bot_user" ? CAPABILITIES.USERS_MANAGE :
    CAPABILITIES.PAYMENTS_READ;
  if (!(await requireCapability(ctx, capability, "search"))) return;
  ensureSession(ctx);
  const labels = {
    service: {
      title: "Search Transferly Services",
      prompt: "Send a service name, category, or keyword. Example: paypal, opay, crypto, qr.",
      back: buildServiceGroupsKeyboard(ctx),
    },
    paypal_invoice: {
      title: "Search PayPal Invoices",
      prompt: "Send a customer email, invoice number, internal invoice ID, or PayPal invoice ID.",
      back: buildPayPalWorkspaceKeyboard(ctx),
    },
    paypal_payout: {
      title: "Search PayPal Payouts",
      prompt: "Send a receiver email, payout ID, sender batch ID, or PayPal payout batch ID.",
      back: buildPayPalWorkspaceKeyboard(ctx),
    },
    bot_user: {
      title: "Search Bot Users",
      prompt: "Send a Telegram ID, username, role, or status. Example: @alice, 8515933901, admin, expired.",
      back: buildUsersKeyboard(ctx),
    },
  };
  const configForType = labels[type] || labels.service;
  ctx.session.meta.pendingSearch = {
    type,
    createdAt: Date.now(),
  };
  await replyHtml(
    ctx,
    [
      `<b>${escapeHtml(configForType.title)}</b>`,
      "",
      escapeHtml(configForType.prompt),
      "",
      "Send cancel to stop this search.",
    ].join("\n"),
    buildScreenKeyboard(ctx, SCREEN_TYPES.FORM),
  );
}

async function handleServiceGroup(ctx, groupId) {
  if (!(await requireCapability(ctx, CAPABILITIES.SERVICES_USE, "service category"))) return;
  rememberScreen(ctx, `GROUP:${groupId}`);
  clearPendingPrompts(ctx);
  const group = getGroup(groupId);
  if (!group) {
    await replyHtml(ctx, "Unknown service category. Use /services to browse.", buildServiceGroupsKeyboard(ctx));
    return;
  }

  const available = group.slugs
    .map((slug) => getService(slug))
    .filter(Boolean)
    .filter((service) => service.status === "available").length;
  const lines = [
    `<b>${escapeHtml(group.title)}</b>`,
    "",
    escapeHtml(group.description),
    "",
    line("Services", String(group.slugs.length)),
    line("Available", String(available)),
  ];
  await replyHtml(ctx, lines.join("\n"), buildServiceGroupKeyboard(ctx, group));
}

async function handleServiceDetail(ctx, slug) {
  if (!(await requireCapability(ctx, CAPABILITIES.SERVICES_USE, "service details"))) return;
  rememberScreen(ctx, `SERVICE:${slug}`);
  clearPendingPrompts(ctx);
  const service = getService(slug);
  if (!service) {
    await replyHtml(ctx, "Unknown Transferly service. Use /services to browse.", buildServiceGroupsKeyboard(ctx));
    return;
  }

  const commandCenter = getServiceCommandCenter(service);
  const lines = [
    `<b>${escapeHtml(service.title)}</b>`,
    "",
    escapeHtml(serviceSummary(service)),
    "",
    line("Category", service.category),
    line("Status", statusLabel(service.status)),
    line("Badge", service.badge),
    line("Generator", service.receiptType || "Web workspace"),
  ];
  if (commandCenter) {
    lines.push(
      "",
      `<b>${escapeHtml(commandCenter.title)}</b>`,
      escapeHtml(commandCenter.summary),
      "",
      ...commandCenter.lanes.map((lane) =>
        `• <b>${escapeHtml(lane.label)}</b> — ${escapeHtml(lane.status === "live" ? "Live" : "Setup")} — ${escapeHtml(lane.summary)}`,
      ),
    );
  }
  await replyHtml(ctx, lines.join("\n"), buildServiceDetailKeyboard(ctx, service));
}

async function handleServiceLane(ctx, slug, laneId) {
  if (!(await requireCapability(ctx, CAPABILITIES.SERVICES_USE, "service lane"))) return;
  const service = getService(slug);
  const lane = getServiceLane(service, laneId);
  if (!service || !lane) {
    await replyHtml(ctx, "Unknown service lane. Open the service catalog again.", buildServiceGroupsKeyboard(ctx));
    return;
  }

  rememberScreen(ctx, `SERVICE_LANE:${service.slug}:${lane.id}`);
  clearPendingPrompts(ctx);
  const commandCenter = getServiceCommandCenter(service);
  const liveSummary = await loadServiceCommandCenterSummary(ctx, service);
  const laneDetail = await loadServiceLaneDetail(ctx, service, lane.id);
  const liveLane = liveSummary?.command_center?.lanes?.find((entry) => entry.id === lane.id);
  const liveMetrics = Array.isArray(laneDetail?.lane?.live_metrics)
    ? laneDetail.lane.live_metrics
    : Array.isArray(liveLane?.live_metrics)
      ? liveLane.live_metrics
      : [];
  const lines = [
    `<b>${escapeHtml(service.title)} · ${escapeHtml(lane.label)}</b>`,
    "",
    line("Command Center", commandCenter?.title || "Service workspace"),
    line("Status", lane.status === "live" ? "Live" : "Setup required"),
    line("Mini App", lane.miniAppSection || "Service workspace"),
    "",
    escapeHtml(lane.summary),
  ];
  if (liveMetrics.length > 0) {
    lines.push("", "<b>Live Metrics</b>", ...formatServiceLaneMetricLines(liveMetrics));
  }
  if (laneDetail?.action) {
    lines.push(
      "",
      "<b>Action</b>",
      line("Primary", laneDetail.action.label || "Open lane"),
      line("Route", laneDetail.action.route || lane.miniAppSection || "Mini App"),
    );
  }
  if (Array.isArray(laneDetail?.readiness) && laneDetail.readiness.length > 0) {
    lines.push("", "<b>Readiness</b>", ...formatServiceLaneReadinessLines(laneDetail.readiness));
  }
  if (laneDetail?.activity) {
    lines.push("", "<b>Activity</b>", ...formatServiceLaneActivityLines(laneDetail.activity));
  }
  if (laneDetail?.support_context?.suggested_handoff) {
    lines.push("", "<b>Support Handoff</b>", escapeHtml(laneDetail.support_context.suggested_handoff));
  }
  lines.push(
    "",
    lane.status === "live"
      ? "Use the lane action below or open the Mini App section to continue from Telegram context."
      : "This lane is visible for planning and can be activated when backend support is connected.",
  );
  await replyHtml(ctx, lines.join("\n"), buildServiceLaneKeyboard(ctx, service, lane));
}

async function handleServiceLaneAction(ctx, slug, laneId) {
  if (!(await requireCapability(ctx, CAPABILITIES.SERVICES_USE, "service lane action"))) return;
  const service = getService(slug);
  const lane = getServiceLane(service, laneId);
  if (!service || !lane) {
    await replyHtml(ctx, "Unknown service lane. Open the service catalog again.", buildServiceGroupsKeyboard(ctx));
    return;
  }

  rememberScreen(ctx, `SERVICE_LANE:${service.slug}:${lane.id}`);
  clearPendingPrompts(ctx);

  let result = null;
  try {
    result = await recordServiceLaneActionIntent(ctx, service, lane);
  } catch (error) {
    const message =
      error?.userMessage ||
      error?.response?.data?.message ||
      error?.message ||
      "Lane action could not be recorded.";
    await replyHtml(ctx, `⚠️ ${escapeHtml(message)}`, buildServiceLaneKeyboard(ctx, service, lane));
    return;
  }

  const actionIntent = result?.action_intent;
  const route = actionIntent?.action?.route || lane.miniAppSection || "Mini App";
  const lines = [
    `<b>${escapeHtml(service.title)} · ${escapeHtml(lane.label)}</b>`,
    "",
    "<b>Action Recorded</b>",
    line("Status", actionIntent?.status || "recorded"),
    line("Intent", actionIntent?.intent || lane.action || "launch"),
    line("Route", route),
    "",
    "Open the Mini App section below to continue with the audited lane context.",
  ];

  await replyHtml(ctx, lines.join("\n"), buildServiceLaneKeyboard(ctx, service, lane));
}

async function handleServiceInfo(ctx, slug) {
  if (!(await requireCapability(ctx, CAPABILITIES.SERVICES_USE, "service information"))) return;
  rememberScreen(ctx, `INFO:${slug}`);
  const service = getService(slug);
  if (!service) {
    await replyHtml(ctx, "Unknown Transferly service.", buildBackKeyboard(ctx));
    return;
  }

  const commandCenter = getServiceCommandCenter(service);
  const lines = [
    `<b>${escapeHtml(service.title)}</b>`,
    "",
    escapeHtml(serviceSummary(service)),
    "",
    commandCenter
      ? `${commandCenter.title} is available from Telegram with service-specific lanes and Mini App handoffs.`
      : "This service is available from the Transferly catalog. A dedicated Telegram generator can be added when the backend exposes a service-specific operation.",
  ];
  await replyHtml(ctx, lines.join("\n"), buildServiceDetailKeyboard(ctx, service));
}

async function handleCustomServiceStart(ctx, slug) {
  if (!(await requireCapability(ctx, CAPABILITIES.SERVICES_USE, "service composer"))) return;
  const service = getService(slug);
  if (!service || !canGenerateService(service)) {
    await handleServiceDetail(ctx, slug);
    return;
  }

  if (service.slug === "paypal") {
    await handlePayPalWorkspace(ctx);
    return;
  }

  await startServiceComposer(ctx, service);
}

async function handleProfile(ctx) {
  if (!(await requireCapability(ctx, CAPABILITIES.ACCOUNT_READ, "profile"))) return;
  rememberScreen(ctx, "PROFILE");
  await replyLinkedCommand(ctx, "/profile", "Transferly Profile");
}

async function getLinkedProfileForWhoami(ctx) {
  try {
    const result = await runLinkedTelegramCommand(ctx, "/profile");
    return result?.data || null;
  } catch (error) {
    return {
      error: error?.userMessage || error?.response?.data?.message || error?.message || "Profile lookup failed",
    };
  }
}

async function handleWhoami(ctx) {
  rememberScreen(ctx, "WHOAMI");
  const access = await getAdminStatus(ctx);
  const profile = await getLinkedProfileForWhoami(ctx);
  const fullName = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ");
  const configuredIdLabel = access.configuredAdminId
    ? String(access.configuredAdminId)
    : "not set";
  const linkedLabel = profile?.user_id
    ? `${profile.user_id}${profile.email ? ` (${profile.email})` : ""}`
    : profile?.linked === false
      ? "not linked"
      : profile?.error
        ? `unknown (${profile.error})`
        : "unknown";

  const lines = [
    "<b>🪪 Whoami</b>",
    "",
    "<b>Telegram</b>",
    line("Telegram ID", ctx.from?.id || "unknown"),
    line("Username", ctx.from?.username ? `@${ctx.from.username}` : "none"),
    line("Name", fullName || "unknown"),
    line("Chat ID", ctx.chat?.id || "unknown"),
    "",
    "<b>Transferly Access</b>",
    line("Bot Role", access.isAdmin ? "ADMIN" : access.user ? "USER" : "Guest"),
    line("Admin", access.isAdmin ? "yes" : "no"),
    line("Admin Source", access.adminSource),
    line("Linked User", linkedLabel),
  ];

  if (profile?.points !== undefined && profile?.points !== null) {
    lines.push(line("Points", profile.points));
  }

  lines.push(
    "",
    "<b>Admin Setup</b>",
    line("Configured Admin ID", configuredIdLabel),
    line("Configured Username", access.configuredAdminUsername ? `@${access.configuredAdminUsername}` : "not set"),
  );

  if (!access.configuredAdminId && ctx.from?.id) {
    lines.push(
      "",
      `Set <code>ADMIN_TELEGRAM_ID=${escapeHtml(ctx.from.id)}</code> in <code>bot/.env</code>, then restart the bot for stable admin access.`,
    );
  }

  if (access.usernameFallbackActive) {
    lines.push(
      "",
      "Username fallback admin access is active for local testing. Numeric Telegram ID is safer for production.",
    );
  }

  await replyHtml(ctx, lines.join("\n"), buildScreenKeyboard(ctx, SCREEN_TYPES.DETAIL));
}

async function handleBalance(ctx) {
  if (!(await requireCapability(ctx, CAPABILITIES.ACCOUNT_READ, "balance"))) return;
  rememberScreen(ctx, "BALANCE");
  await replyLinkedCommand(ctx, "/balance", "Transferly Balance");
}

async function handleReceipts(ctx) {
  if (!(await requireCapability(ctx, CAPABILITIES.ACCOUNT_READ, "receipts"))) return;
  rememberScreen(ctx, "RECEIPTS");
  await replyLinkedCommand(ctx, "/history", "Recent Receipts");
}

async function handleServiceHistory(ctx, slug) {
  if (!(await requireCapability(ctx, CAPABILITIES.ACCOUNT_READ, "receipt history"))) return;
  rememberScreen(ctx, `HISTORY:${slug}`);
  const service = getService(slug);
  if (!service) {
    await handleReceipts(ctx);
    return;
  }

  const result = await runLinkedTelegramCommand(ctx, `/history ${service.slug}`);
  const receipts = Array.isArray(result?.data) ? result.data : [];
  const lines = [
    `<b>${escapeHtml(service.title)} Receipts</b>`,
    "",
    escapeHtml(result?.message || `Found ${receipts.length} receipts.`),
  ];

  if (receipts.length) {
    lines.push(
      "",
      ...receipts.slice(0, 5).map((receipt) => {
        const created = receipt.created_at || receipt.createdAt || "";
        const date = created ? new Date(created).toLocaleString() : "unknown date";
        const title = receipt.title || `${service.title} receipt`;
        return `• <b>${escapeHtml(title)}</b> — ${escapeHtml(receipt.status || "GENERATED")} — ${escapeHtml(date)}`;
      }),
    );
  }

  await replyHtml(ctx, lines.join("\n"), buildServiceDetailKeyboard(ctx, service));
}

async function handleReferral(ctx) {
  if (!(await requireCapability(ctx, CAPABILITIES.ACCOUNT_READ, "referral"))) return;
  rememberScreen(ctx, "REFERRAL");
  await replyLinkedCommand(ctx, "/referral", "Referral");
}

async function handleAccount(ctx) {
  await handleCommandSection(ctx, "MENU_ACCOUNT");
}

async function handleProviders(ctx) {
  if (!(await requireCapability(ctx, CAPABILITIES.SERVICES_USE, "provider cockpit"))) return;
  rememberScreen(ctx, "PROVIDERS");
  clearPendingPrompts(ctx);
  const access = await getAdminStatus(ctx);
  const providerWorkspaces = listProviderWorkspaces();
  const lines = [
    "<b>💳 Transferly Provider Cockpit</b>",
    "",
    "One workspace for provider lanes, official payment operations, and Mini App deep links.",
    "",
    "<b>Provider Workspaces</b>",
    ...providerWorkspaces.map((workspace) => {
      const laneSummary = workspace.lanes
        .filter((lane) => lane.id !== "overview")
        .slice(0, 4)
        .map((lane) => `${providerLaneStatusIcon(lane.status)} ${lane.label}`)
        .join(", ");
      return `• <b>${escapeHtml(workspace.displayName)}</b> — ${escapeHtml(workspace.shortDescription)}\n  ${escapeHtml(laneSummary)}`;
    }),
  ];

  if (access.isAdmin) {
    const readinessPayload = await providerApiGet(
      providerRoutes.readiness,
      {},
      contractShapes.providerReadinessList,
    ).catch(() => null);
    const fallbackPayload = readinessPayload ? null : await adminGet("/api/admin/payment-providers").catch(() => null);
    const providers = readinessPayload?.data || dataList(fallbackPayload, "providers", "items");
    lines.push(
      "",
      "<b>Provider Readiness</b>",
      ...(providers.length
        ? providers.slice(0, 8).map((provider) => {
          if (provider.operations && provider.summary) {
            return `• <b>${escapeHtml(provider.display_name || provider.provider)}</b> — ${escapeHtml(provider.ready ? "ready" : provider.status || "needs setup")} — ${escapeHtml(provider.summary.live_operations || 0)} live ops`;
          }
          return formatProvider(provider);
        })
        : ["Provider status data is not available from the API right now."]),
    );
  }

  await replyHtml(ctx, lines.join("\n"), buildProvidersKeyboard(ctx, access));
}

async function handleProviderCommand(ctx) {
  const requestedSlug = normalizeProviderSlug(getArgs(ctx)[0]);
  if (!requestedSlug) return handleProviders(ctx);
  return handleProviderWorkspace(ctx, requestedSlug);
}

async function handleProviderShortcut(ctx, slug) {
  const requestedSlug = normalizeProviderSlug(slug);
  if (!requestedSlug) return handleProviders(ctx);
  return handleProviderWorkspace(ctx, requestedSlug);
}

async function handleReceipt(ctx) {
  if (!(await requireCapability(ctx, CAPABILITIES.SERVICES_USE, "receipt generation"))) return;
  const args = getArgs(ctx);
  const type = args[0] || "bank";
  const details = args.slice(1).join(" ");
  await replyLinkedCommand(
    ctx,
    `/generate_receipt ${type}${details ? ` ${details}` : ""}`,
    "Receipt Generation",
  );
}

async function handleInvoices(ctx) {
  if (!(await requireAdmin(ctx, "invoice operations"))) return;
  const args = getArgs(ctx);
  if (!args.length) {
    rememberScreen(ctx, "INVOICE_CENTER");
    const access = await getAdminStatus(ctx);
    const lines = [
      "<b>📄 Collection Command Center</b>",
      "",
      "Choose a provider workspace for invoice, collection, or receive-money operations. PayPal and Stripe use live operational lists where backend support exists; other providers open their Transferly provider workspace until collection lanes are connected.",
      "",
      `Direct shortcuts: /provider paypal, ${PROVIDER_COMMAND_HINT}.`,
    ];
    await replyHtml(ctx, lines.join("\n"), buildInvoiceCenterKeyboard(ctx, access));
    return;
  }
  const filters = getListArgs(ctx);
  await handlePayPalInvoices(ctx, { ...filters, page: 1 });
}

async function handlePayouts(ctx) {
  if (!(await requireAdmin(ctx, "payout operations"))) return;
  const args = getArgs(ctx);
  if (!args.length) {
    rememberScreen(ctx, "PAYOUT_CENTER");
    const access = await getAdminStatus(ctx);
    const lines = [
      "<b>💸 Sending Command Center</b>",
      "",
      "Choose a provider workspace for payout, transfer, or send-money operations. PayPal and Stripe use live operational lists where backend support exists; other providers open their Transferly provider workspace until sending lanes are connected.",
      "",
      `Direct shortcuts: /provider wise, ${PROVIDER_COMMAND_HINT}.`,
    ];
    await replyHtml(ctx, lines.join("\n"), buildPayoutCenterKeyboard(ctx, access));
    return;
  }
  const filters = getListArgs(ctx);
  await handlePayPalPayouts(ctx, { ...filters, page: 1 });
}

async function handleActivity(ctx) {
  if (!(await requireAdmin(ctx, "payment activity"))) return;
  rememberScreen(ctx, "ACTIVITY");
  const [invoices, payouts, webhooks, issues] = await Promise.all([
    adminGet("/api/admin/invoices", { pageSize: 1 }).catch(adminReadFallback),
    adminGet("/api/admin/payouts", { pageSize: 1 }).catch(adminReadFallback),
    adminGet("/api/admin/webhooks", { limit: 5 }).catch(adminReadFallback),
    adminGet("/api/admin/payment-issues", { status: "OPEN", limit: 5 }).catch(adminReadFallback),
  ]);
  const webhookItems = dataList(webhooks, "events", "items").slice(0, 5);
  const issueItems = dataList(issues, "issues", "items").slice(0, 3);
  const unavailable = unavailableSummary([
    ["invoices", invoices],
    ["payouts", payouts],
    ["webhooks", webhooks],
    ["issues", issues],
  ]);
  const lines = [
    "<b>📊 Transferly Activity</b>",
    "",
    line("Invoices", invoices.pagination?.total ?? 0),
    line("Payouts", payouts.pagination?.total ?? 0),
    line("Open issues", issueItems.length),
    unavailable ? line("Unavailable", unavailable) : null,
    "",
    "<b>Recent Webhooks</b>",
    ...(webhookItems.length ? webhookItems.map(formatWebhookEvent) : ["No recent webhook events found."]),
  ].filter((item) => item !== null);
  if (issueItems.length) {
    lines.push("", "<b>Open Issues</b>", ...issueItems.map(formatIssue));
  }
  await replyHtml(ctx, lines.join("\n"), buildOpsCommandCenterKeyboard(ctx));
}

async function handleClients(ctx) {
  if (!(await requireAdmin(ctx, "client intelligence"))) return;
  rememberScreen(ctx, "CLIENTS");
  const payload = await adminGet("/api/admin/users", { limit: 10 }).catch(() => ({ data: [] }));
  const users = dataList(payload, "users", "items").slice(0, 10);
  const lines = [
    "<b>👥 Transferly Clients</b>",
    "",
    ...(users.length ? users.map(formatClient) : ["No client records were returned by the API."]),
  ];
  await replyHtml(ctx, lines.join("\n"), buildScreenKeyboard(ctx, SCREEN_TYPES.DETAIL));
}

async function handleRisk(ctx) {
  if (!(await requireAdmin(ctx, "risk review"))) return;
  rememberScreen(ctx, "RISK");
  const payload = await adminGet("/api/admin/risk-flags", { limit: 10 }).catch(adminReadFallback);
  const flags = dataList(payload, "flags", "items").slice(0, 10);
  const lines = [
    "<b>🛡️ Risk Review</b>",
    "",
    payload.error ? "Risk flags could not be loaded right now. Use Status or retry from the operations menu." : null,
    ...(flags.length ? flags.map(formatRiskFlag) : ["No active risk flags found."]),
  ].filter(Boolean);
  await replyHtml(ctx, lines.join("\n"), buildOpsCommandCenterKeyboard(ctx));
}

async function handleSecurity(ctx) {
  if (!(await requireAdmin(ctx, "security center"))) return;
  rememberScreen(ctx, "SECURITY");
  const [health, queues, deadLetters, webhooks] = await Promise.all([
    httpClient.get(null, `${config.apiUrl}/health`, { timeout: 8000 }).then((response) => response.data).catch(() => ({ status: "unreachable" })),
    adminGet("/api/admin/queues").catch(adminReadFallback),
    adminGet("/api/admin/dead-letters", { limit: 5 }).catch(adminReadFallback),
    adminGet("/api/admin/webhooks", { limit: 3 }).catch(adminReadFallback),
  ]);
  const services = health.services || {};
  const deadLetterItems = dataList(deadLetters, "items").slice(0, 5);
  const webhookItems = dataList(webhooks, "events", "items").slice(0, 3);
  const queueSummary = formatQueueSummary(queues);
  const lines = [
    "<b>🔐 Security Center</b>",
    "",
    line("API", health.status || (health.ok ? "ok" : "unknown")),
    services.database ? line("Database", services.database.connected ? "connected" : "disconnected") : null,
    services.redis ? line("Redis", services.redis.connected ? "connected" : "disconnected") : null,
    queueSummary ? line("Queues", queueSummary) : null,
    line("Dead letters", deadLetterItems.length),
    "",
    "<b>Webhook Watch</b>",
    ...(webhookItems.length ? webhookItems.map(formatWebhookEvent) : ["No recent webhook events found."]),
  ].filter((item) => item !== null);
  await replyHtml(ctx, lines.join("\n"), buildOpsCommandCenterKeyboard(ctx));
}

async function handleIssues(ctx) {
  if (!(await requireAdmin(ctx, "payment issue operations"))) return;
  rememberScreen(ctx, "ISSUES");
  const status = getArgs(ctx)[0]?.toUpperCase();
  const payload = await adminGet("/api/admin/payment-issues", {
    status: status && status !== "ALL" ? status : undefined,
    limit: 10,
  }).catch(adminReadFallback);
  const items = Array.isArray(payload.data) ? payload.data : [];
  const lines = [
    "<b>Payment Issues</b>",
    "",
    payload.error ? "Payment issues could not be loaded right now. Use Status or retry from the operations menu." : null,
    ...(items.length ? items.map(formatIssue) : ["No payment issues found."]),
  ].filter(Boolean);
  await replyHtml(ctx, lines.join("\n"), buildOpsCommandCenterKeyboard(ctx));
}

async function handleOrders(ctx) {
  if (!(await requireAdmin(ctx, "top-up order operations"))) return;
  rememberScreen(ctx, "ORDERS");
  const status = getArgs(ctx)[0]?.toLowerCase();
  const payload = await adminGet("/api/admin/top-up-orders", {
    status: status && status !== "all" ? status : undefined,
    limit: 10,
  }).catch(adminReadFallback);
  const items = Array.isArray(payload.data) ? payload.data : [];
  const lines = [
    "<b>Top-up Orders</b>",
    "",
    payload.error ? "Top-up orders could not be loaded right now. Use Status or retry from the operations menu." : null,
    ...(items.length ? items.map(formatOrder) : ["No top-up orders found."]),
  ].filter(Boolean);
  await replyHtml(ctx, lines.join("\n"), buildOpsCommandCenterKeyboard(ctx));
}

async function handleOps(ctx) {
  if (!(await requireAdmin(ctx, "payment operations summary"))) return;
  rememberScreen(ctx, "OPS");
  const [invoices, payouts, issues, orders] = await Promise.all([
    adminGet("/api/admin/invoices", { pageSize: 1 }).catch(adminReadFallback),
    adminGet("/api/admin/payouts", { pageSize: 1 }).catch(adminReadFallback),
    adminGet("/api/admin/payment-issues", { status: "OPEN", limit: 5 }).catch(adminReadFallback),
    adminGet("/api/admin/top-up-orders", { status: "awaiting_confirmation", limit: 5 }).catch(adminReadFallback),
  ]);
  const unavailable = unavailableSummary([
    ["invoices", invoices],
    ["payouts", payouts],
    ["issues", issues],
    ["orders", orders],
  ]);
  const lines = [
    "<b>Transferly Payment Ops</b>",
    "",
    line("Invoices", invoices.pagination?.total ?? 0),
    line("Payouts", payouts.pagination?.total ?? 0),
    line("Open issues", Array.isArray(issues.data) ? issues.data.length : 0),
    line("Funding review", Array.isArray(orders.data) ? orders.data.length : 0),
    unavailable ? line("Unavailable", unavailable) : null,
    "",
    "Use the controls below to inspect operations, recover failed flows, or open the Mini App dashboard.",
  ].filter((item) => item !== null);
  await replyHtml(ctx, lines.join("\n"), buildOpsCommandCenterKeyboard(ctx));
}

async function handleApprovePayout(ctx) {
  if (!(await requireAdmin(ctx, "payout approval"))) return;
  const [payoutId] = getArgs(ctx);
  if (!payoutId) {
    await replyHtml(ctx, "Usage: /approve_payout PAYOUT_ID", buildBackKeyboard(ctx));
    return;
  }
  const result = await adminPost(`/api/admin/payouts/${encodeURIComponent(payoutId)}/approve`);
  await replyHtml(ctx, `✅ Approved payout ${escapeHtml(result.payout_id || payoutId)}.`, buildBackKeyboard(ctx));
}

async function handleRejectPayout(ctx) {
  if (!(await requireAdmin(ctx, "payout rejection"))) return;
  const [payoutId, ...reasonParts] = getArgs(ctx);
  if (!payoutId) {
    await replyHtml(ctx, "Usage: /reject_payout PAYOUT_ID optional reason", buildBackKeyboard(ctx));
    return;
  }
  const result = await adminPost(`/api/admin/payouts/${encodeURIComponent(payoutId)}/reject`, {
    reason: reasonParts.join(" ") || undefined,
  });
  await replyHtml(ctx, `⛔ Rejected payout ${escapeHtml(result.payout_id || payoutId)}.`, buildBackKeyboard(ctx));
}

async function handleCancelUnclaimed(ctx) {
  if (!(await requireAdmin(ctx, "unclaimed payout cancellation"))) return;
  const [payoutId] = getArgs(ctx);
  if (!payoutId) {
    await replyHtml(ctx, "Usage: /cancel_unclaimed PAYOUT_ID", buildBackKeyboard(ctx));
    return;
  }
  const result = await adminPost(`/api/admin/payouts/${encodeURIComponent(payoutId)}/cancel-unclaimed`);
  await replyHtml(ctx, `↩️ Cancel submitted for ${escapeHtml(result.payout_id || payoutId)}.`, buildBackKeyboard(ctx));
}

async function handleReleaseInvoice(ctx) {
  if (!(await requireAdmin(ctx, "invoice fund release"))) return;
  const [invoiceId, ...rest] = getArgs(ctx);
  if (!invoiceId) {
    await replyHtml(ctx, "Usage: /release_invoice INVOICE_ID optional_amount optional reason", buildBackKeyboard(ctx));
    return;
  }
  const amountCandidate = rest[0];
  const hasAmount = amountCandidate && Number.isFinite(Number(amountCandidate));
  const reasonParts = hasAmount ? rest.slice(1) : rest;
  const body = {
    amount: hasAmount ? Number(amountCandidate) : undefined,
    reason: reasonParts.join(" ") || undefined,
  };
  const result = await adminPost(`/api/admin/invoices/${encodeURIComponent(invoiceId)}/release`, body, {
    headers: {
      "Idempotency-Key": `telegram-release-${invoiceId}-${randomUUID()}`,
    },
  });
  await replyHtml(
    ctx,
    `✅ Released invoice funds.\n${line("Invoice", result.invoice_id || invoiceId)}`,
    buildBackKeyboard(ctx),
  );
}

async function handleRefreshInvoice(ctx) {
  if (!(await requireAdmin(ctx, "invoice refresh"))) return;
  const [invoiceId] = getArgs(ctx);
  if (!invoiceId) {
    await replyHtml(ctx, "Usage: /refresh_invoice INVOICE_ID", buildBackKeyboard(ctx));
    return;
  }
  const result = await adminPost(`/api/invoices/${encodeURIComponent(invoiceId)}/refresh`);
  await replyHtml(ctx, `🔄 Invoice refreshed: ${escapeHtml(result.invoice_id || invoiceId)}.`, buildBackKeyboard(ctx));
}

async function handleRefreshPayout(ctx) {
  if (!(await requireAdmin(ctx, "payout refresh"))) return;
  const [payoutId] = getArgs(ctx);
  if (!payoutId) {
    await replyHtml(ctx, "Usage: /refresh_payout PAYOUT_ID", buildBackKeyboard(ctx));
    return;
  }
  const result = await adminPost(`/api/payouts/${encodeURIComponent(payoutId)}/refresh`);
  await replyHtml(ctx, `🔄 Payout refreshed: ${escapeHtml(result.payout_id || payoutId)}.`, buildBackKeyboard(ctx));
}

async function handleReconcile(ctx) {
  if (!(await requireAdmin(ctx, "payment reconciliation"))) return;
  const result = await adminPost("/api/admin/reconciliation/run", {
    invoiceLimit: 25,
    payoutLimit: 25,
  });
  await replyHtml(
    ctx,
    [
      "<b>Reconciliation queued</b>",
      "",
      line("Invoices", result.invoices_processed ?? result.invoice_count ?? "submitted"),
      line("Payouts", result.payouts_processed ?? result.payout_count ?? "submitted"),
    ].join("\n"),
    buildOpsCommandCenterKeyboard(ctx),
  );
}

async function handleHealth(ctx) {
  if (!(await requireCapability(ctx, CAPABILITIES.HEALTH_READ, "health"))) return;
  rememberScreen(ctx, "HEALTH");
  const response = await httpClient.get(null, `${config.apiUrl}/health`, { timeout: 8000 });
  const services = response.data?.services || {};
  await replyHtml(
    ctx,
    [
      "<b>Transferly API Health</b>",
      "",
      line("Status", response.data?.status || (response.data?.ok ? "ok" : "unknown")),
      services.database ? line("Database", services.database.connected ? "connected" : "disconnected") : null,
      services.redis ? line("Redis", services.redis.connected ? "connected" : "disconnected") : null,
      line("API", config.apiUrl),
      line("Checked", new Date().toLocaleString()),
    ].filter(Boolean).join("\n"),
    buildBackKeyboard(ctx),
  );
}

async function handleStatus(ctx) {
  if (!(await requireAdmin(ctx, "deep status"))) return;
  rememberScreen(ctx, "STATUS");
  const [health, invoices, payouts, issues, orders] = await Promise.all([
    httpClient.get(null, `${config.apiUrl}/health`, { timeout: 8000 }).then((response) => response.data).catch((error) => ({
      status: "unreachable",
      error: error?.userMessage || error?.message || "Health check failed",
    })),
    adminGet("/api/admin/invoices", { pageSize: 1 }).catch(adminReadFallback),
    adminGet("/api/admin/payouts", { pageSize: 1 }).catch(adminReadFallback),
    adminGet("/api/admin/payment-issues", { status: "OPEN", limit: 5 }).catch(adminReadFallback),
    adminGet("/api/admin/top-up-orders", { status: "awaiting_confirmation", limit: 5 }).catch(adminReadFallback),
  ]);

  const services = health.services || {};
  const lines = [
    "<b>Transferly System Status</b>",
    "",
    line("API", health.status || (health.ok ? "ok" : "unknown")),
    health.error ? line("Health error", health.error) : null,
    services.database ? line("Database", services.database.connected ? "connected" : "disconnected") : null,
    services.redis ? line("Redis", services.redis.connected ? "connected" : "disconnected") : null,
    "",
    "<b>Payment Operations</b>",
    line("Invoices", invoices.pagination?.total ?? 0),
    line("Payouts", payouts.pagination?.total ?? 0),
    line("Open issues", Array.isArray(issues.data) ? issues.data.length : 0),
    line("Funding review", Array.isArray(orders.data) ? orders.data.length : 0),
    "",
    line("Checked", new Date().toLocaleString()),
  ].filter((item) => item !== null);
  await replyHtml(ctx, lines.join("\n"), buildOpsCommandCenterKeyboard(ctx));
}

function parseRedisTarget() {
  const raw = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  try {
    const url = new URL(raw);
    return {
      host: url.hostname || "127.0.0.1",
      port: Number.parseInt(url.port || "6379", 10),
      label: `${url.hostname || "127.0.0.1"}:${url.port || "6379"}`,
    };
  } catch (_) {
    return {
      host: "127.0.0.1",
      port: 6379,
      label: "127.0.0.1:6379",
    };
  }
}

function checkRedisConnectivity(timeoutMs = 900) {
  const target = parseRedisTarget();
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (status, error = null) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({
        status,
        target: target.label,
        error,
      });
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish("connected"));
    socket.once("timeout", () => finish("timeout"));
    socket.once("error", (error) => finish("disconnected", error?.code || error?.message || "connection failed"));
    socket.connect(target.port, target.host);
  });
}

function getBotOpsStatsAsync() {
  return new Promise((resolve) => {
    getBotOpsStats((error, stats) => {
      if (error) {
        resolve({
          error: error.message || "stats unavailable",
          users: {},
          access_denials_24h: 0,
          recent_denials: [],
          recent_user_audit: [],
        });
        return;
      }
      resolve(stats);
    });
  });
}

function getUserAsync(telegramId) {
  return new Promise((resolve) => {
    getUser(telegramId, (user) => resolve(user || null));
  });
}

function getUserAuditLogsAsync(telegramId, limit = 5) {
  return new Promise((resolve) => {
    getUserAuditLogs(telegramId, limit, (error, rows) => resolve(error ? [] : rows || []));
  });
}

function getRecentUserAuditLogsAsync(limit = 10) {
  return new Promise((resolve) => {
    getRecentUserAuditLogs(limit, (error, rows) => resolve(error ? [] : rows || []));
  });
}

function getExpiringUsersAsync(days = 7, limit = 10) {
  return new Promise((resolve) => {
    getExpiringUsers(days, limit, (error, rows) => resolve(error ? [] : rows || []));
  });
}

function searchUsersAsync(query, limit = 10) {
  return new Promise((resolve) => {
    searchUsers(query, limit, (error, rows) => resolve(error ? [] : rows || []));
  });
}

function getRecentPaymentAuditLogsAsync(limit = 10) {
  return new Promise((resolve) => {
    getRecentPaymentAuditLogs(limit, (error, rows) => resolve(error ? [] : rows || []));
  });
}

function getBotAnalyticsStatsAsync() {
  return new Promise((resolve) => {
    getBotAnalyticsStats((error, stats) => resolve(error ? { error: error.message || "analytics unavailable" } : stats));
  });
}

function getDueSubscriptionAlertsAsync() {
  return new Promise((resolve) => {
    getDueSubscriptionAlerts((error, rows) => resolve(error ? [] : rows || []));
  });
}

function wasSubscriptionAlertSentAsync(telegramId, threshold, expiresAt) {
  return new Promise((resolve) => {
    wasSubscriptionAlertSent(telegramId, threshold, expiresAt, (error, sent) => resolve(error ? true : sent));
  });
}

function recordSubscriptionAlertAsync(telegramId, threshold, expiresAt) {
  return new Promise((resolve) => {
    recordSubscriptionAlert(telegramId, threshold, expiresAt, () => resolve());
  });
}

function getBotSettingAsync(key, fallback = null) {
  return new Promise((resolve) => {
    getBotSetting(key, fallback, (error, value) => resolve(error ? fallback : value));
  });
}

function setBotSettingAsync(key, value) {
  return new Promise((resolve, reject) => {
    setBotSetting(key, value, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function getUserActivityStatsAsync(telegramId) {
  return new Promise((resolve) => {
    getUserActivityStats(telegramId, (error, stats) => resolve(error ? null : stats));
  });
}

async function getAlertSettings() {
  const enabledRaw = await getBotSettingAsync("subscription_alerts_enabled", "true");
  const thresholdsRaw = await getBotSettingAsync("subscription_alert_thresholds", "7d,3d,24h,expired");
  const thresholds = String(thresholdsRaw || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return {
    enabled: enabledRaw !== "false",
    thresholds: thresholds.length ? thresholds : ["7d", "3d", "24h", "expired"],
  };
}

function thresholdToMs(threshold) {
  if (threshold === "expired") return 0;
  if (threshold.endsWith("h")) return Number.parseInt(threshold, 10) * 60 * 60 * 1000;
  if (threshold.endsWith("d")) return Number.parseInt(threshold, 10) * 24 * 60 * 60 * 1000;
  return null;
}

function chooseAlertThreshold(msLeft, thresholds = []) {
  const ordered = thresholds
    .map((threshold) => ({ threshold, ms: thresholdToMs(threshold) }))
    .filter((item) => item.threshold === "expired" || Number.isFinite(item.ms))
    .sort((a, b) => (b.ms || 0) - (a.ms || 0));
  if (msLeft <= 0 && thresholds.includes("expired")) return "expired";
  const match = ordered.find((item) => item.threshold !== "expired" && msLeft <= item.ms && msLeft > 0);
  return match?.threshold || null;
}

async function getConfiguredDueSubscriptionAlerts() {
  const settings = await getAlertSettings();
  if (!settings.enabled) return { settings, due: [] };
  const rawDue = await getDueSubscriptionAlertsAsync();
  const now = Date.now();
  const due = rawDue
    .map((user) => {
      const expiry = Date.parse(user.subscription_expires_at);
      if (!Number.isFinite(expiry)) return null;
      const threshold = chooseAlertThreshold(expiry - now, settings.thresholds);
      return threshold ? { ...user, alert_threshold: threshold } : null;
    })
    .filter(Boolean);
  return { settings, due };
}

function formatUserStatus(user = {}) {
  if (user.role !== ROLES.OWNER && isSubscriptionExpired(user.subscription_expires_at)) {
    return "EXPIRED";
  }
  return user.status || STATUS.ACTIVE;
}

function formatAuditEntry(entry = {}) {
  const target = entry.target_telegram_id || "unknown";
  const actor = entry.actor_telegram_id || "system";
  const days = entry.subscription_days ? ` · ${entry.subscription_days}d` : "";
  const created = entry.created_at ? new Date(entry.created_at).toLocaleString() : "unknown time";
  return `• <b>${escapeHtml(entry.action || "unknown")}</b>${days} — ${escapeHtml(target)} — by ${escapeHtml(actor)} — ${escapeHtml(created)}`;
}

function formatPaymentAuditEntry(entry = {}) {
  const amount = entry.amount ? ` · ${entry.amount}${entry.currency ? ` ${entry.currency}` : ""}` : "";
  const recipient = entry.recipient ? ` · ${entry.recipient}` : "";
  const actor = entry.actor_telegram_id || "system";
  const created = entry.created_at ? new Date(entry.created_at).toLocaleString() : "unknown time";
  return `• <b>${escapeHtml(entry.action || "unknown")}</b> — ${escapeHtml(entry.resource_type || "payment")} ${escapeHtml(entry.resource_id || "unknown")}${escapeHtml(amount)}${escapeHtml(recipient)} — by ${escapeHtml(actor)} — ${escapeHtml(created)}`;
}

function recordPaymentAudit(ctx, entry = {}) {
  recordBotPaymentAudit({
    actorTelegramId: ctx.from?.id || null,
    ...entry,
  }, () => {});
}

function recordAnalytics(ctx, action, category = "bot", status = "ok", details = {}) {
  const safeDetails = details && typeof details === "object" ? { ...details } : {};
  const durationMs = Number.isFinite(Number(safeDetails.durationMs)) ? Number(safeDetails.durationMs) : null;
  delete safeDetails.durationMs;
  recordBotAnalyticsEvent({
    telegramId: ctx.from?.id || null,
    username: ctx.from?.username || null,
    action,
    category,
    status,
    durationMs,
    details: Object.keys(safeDetails).length ? safeDetails : null,
  }, () => {});
}

function csvValue(value) {
  const text = value === null || typeof value === "undefined" ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows = [], columns = []) {
  const header = columns.map((column) => csvValue(column.label)).join(",");
  const body = rows.map((row) => columns.map((column) => csvValue(row[column.key])).join(","));
  return [header, ...body].join("\n");
}

async function replyCsv(ctx, filename, caption, csv) {
  const buffer = Buffer.from(csv, "utf8");
  if (InputFile) {
    await ctx.replyWithDocument(new InputFile(buffer, filename), { caption });
    return;
  }
  await replyHtml(ctx, `<b>${escapeHtml(caption)}</b>\n\n<pre>${escapeHtml(csv.slice(0, 3500))}</pre>`, buildBackKeyboard(ctx));
}

function normalizeUpper(value) {
  return String(value || "").trim().toUpperCase();
}

function invoiceReleaseGuard(invoice = {}) {
  const status = normalizeUpper(invoice.status);
  const releasedAt = invoice.summary?.released_at || invoice.metadata?.released_at;
  const remaining = invoice.remaining_releasable_amount || invoice.metadata?.remaining_releasable_amount;
  if (status === "RELEASED" || releasedAt || remaining === "0.00") {
    return "This invoice already appears to have released funds.";
  }
  if (["CANCELLED", "CANCELED", "REFUNDED", "DRAFT", "SENT", "FAILED"].includes(status)) {
    return `Invoice status ${status || "UNKNOWN"} is not releaseable from Telegram.`;
  }
  return null;
}

function payoutActionGuard(payout = {}, action) {
  const status = normalizeUpper(payout.status);
  const provider = normalizeUpper(payout.official_paypal?.provider_item_status || payout.metadata?.provider_item_status);
  if (action === "approve" || action === "reject") {
    if (status === "APPROVED" || status === "QUEUED" || status === "PROCESSING" || status === "SUCCESS") {
      return "This payout is already approved or processing.";
    }
    if (status === "REJECTED") {
      return "This payout has already been rejected.";
    }
    if (status && status !== "PENDING_APPROVAL") {
      return `Payout status ${status} cannot be ${action === "approve" ? "approved" : "rejected"} from Telegram.`;
    }
  }
  if (action === "cancel") {
    if (["CANCELED", "CANCELLED", "RETURNED", "DENIED"].includes(provider) || ["CANCELED", "CANCELLED", "RETURNED", "FAILED"].includes(status)) {
      return "This payout already appears cancelled, returned, denied, or failed.";
    }
    if (provider && provider !== "UNCLAIMED") {
      return `Provider state ${provider} is not eligible for unclaimed cancellation.`;
    }
  }
  return null;
}

async function sendPaymentGuardCard(ctx, title, reason, keyboard) {
  recordAnalytics(ctx, title.toLowerCase().replace(/\s+/g, "_"), "payments", "blocked", { reason });
  await replyHtml(
    ctx,
    [
      `<b>${escapeHtml(title)}</b>`,
      "",
      escapeHtml(reason),
      "",
      "Refresh the record before attempting another money-moving action.",
    ].join("\n"),
    keyboard,
  );
}

async function handleBotOps(ctx) {
  if (!(await requireCapability(ctx, CAPABILITIES.SYSTEM_STATUS, "bot operations"))) return;
  rememberScreen(ctx, "BOT_OPS");
  const [health, redis, stats, issues, orders] = await Promise.all([
    httpClient.get(null, `${config.apiUrl}/health`, { timeout: 5000 }).then((response) => response.data).catch((error) => ({
      ok: false,
      error: error?.message || "health unavailable",
    })),
    checkRedisConnectivity(),
    getBotOpsStatsAsync(),
    adminGet("/api/admin/payment-issues", { status: "OPEN", limit: 5 }).catch(() => ({ data: [] })),
    adminGet("/api/admin/top-up-orders", { status: "awaiting_confirmation", limit: 5 }).catch(() => ({ data: [] })),
  ]);

  const recentDenials = stats.recent_denials || [];
  const recentAudit = stats.recent_user_audit || [];
  const lines = [
    "<b>🤖 Transferly Bot Ops</b>",
    "",
    "<b>Runtime</b>",
    line("Bot Polling", "running"),
    line("Process ID", process.pid),
    line("Uptime", `${Math.round(process.uptime())}s`),
    line("API", health.ok ? "reachable" : "unreachable"),
    health.error ? line("API Error", health.error) : null,
    line("Redis", redis.status),
    line("Redis Target", redis.target),
    redis.error ? line("Redis Error", redis.error) : null,
    "",
    "<b>Access Control</b>",
    line("Owners", stats.users?.owners ?? 0),
    line("Admins", stats.users?.admins ?? 0),
    line("Active Users", stats.users?.active_users ?? 0),
    line("Expired Users", stats.users?.expired ?? 0),
    line("Suspended", stats.users?.suspended ?? 0),
    line("Revoked", stats.users?.revoked ?? 0),
    line("Denied Attempts 24h", stats.access_denials_24h ?? 0),
    "",
    "<b>Payment Signals</b>",
    line("Open Issues", Array.isArray(issues.data) ? issues.data.length : 0),
    line("Funding Review", Array.isArray(orders.data) ? orders.data.length : 0),
    "",
    "<b>Recent Denials</b>",
    ...(recentDenials.length
      ? recentDenials.map((entry) => `• ${escapeHtml(entry.telegram_id || "unknown")} — ${escapeHtml(entry.role || "GUEST")} — ${escapeHtml(entry.action_label || entry.capability || "action")}`)
      : ["No recent denials recorded."]),
    "",
    "<b>Recent User Audit</b>",
    ...(recentAudit.length
      ? recentAudit.map((entry) => `• ${escapeHtml(entry.action)} — ${escapeHtml(entry.target_telegram_id || "unknown")} — by ${escapeHtml(entry.actor_telegram_id || "unknown")}`)
      : ["No user-management changes recorded."]),
    "",
    line("Checked", new Date().toLocaleString()),
  ].filter((item) => item !== null);
  await replyHtml(ctx, lines.join("\n"), buildBackKeyboard(ctx));
}

async function handlePaymentAudit(ctx, filters = {}) {
  if (!(await requireCapability(ctx, CAPABILITIES.SYSTEM_STATUS, "payment audit"))) return;
  rememberScreen(ctx, "PAYMENT_AUDIT");
  const resourceType = filters.resourceType && filters.resourceType !== "ALL" ? filters.resourceType : null;
  const rows = await getRecentPaymentAuditLogsAsync({ limit: 10, resourceType });
  await replyHtml(
    ctx,
    [
      "<b>🧾 Payment Action Audit</b>",
      resourceType ? line("Filter", resourceType) : line("Filter", "all"),
      "",
      "",
      ...(rows.length ? rows.map(formatPaymentAuditEntry) : ["No payment action audit logs found."]),
    ].join("\n"),
    buildPaymentAuditKeyboard(ctx),
  );
}

async function handleBotAnalytics(ctx) {
  if (!(await requireCapability(ctx, CAPABILITIES.SYSTEM_STATUS, "bot analytics"))) return;
  rememberScreen(ctx, "BOT_ANALYTICS");
  const stats = await getBotAnalyticsStatsAsync();
  const actionRows = stats.action_totals_24h || [];
  const categoryRows = stats.category_totals_24h || [];
  const callbackRows = stats.callback_status_totals_24h || [];
  const slowRows = stats.slow_actions_24h || [];
  await replyHtml(
    ctx,
    [
      "<b>📊 Bot Analytics</b>",
      "",
      "<b>Last 24h</b>",
      line("Active Sessions", stats.active_sessions_24h ?? 0),
      line("Failed Actions", stats.failures_24h ?? 0),
      line("Payment Actions", stats.payment_actions_24h ?? 0),
      line("Denied Access", stats.access_denials_24h ?? 0),
      line("Callback Failures", stats.callback_failures_24h ?? 0),
      line("Recovered Menus", stats.callback_recoveries_24h ?? 0),
      line("Unknown Actions", stats.unknown_actions_24h ?? 0),
      "",
      "<b>Top Actions</b>",
      ...(actionRows.length ? actionRows.map((row) => `• ${escapeHtml(row.action)} — ${escapeHtml(row.count)}`) : ["No tracked actions yet."]),
      "",
      "<b>Top Categories</b>",
      ...(categoryRows.length ? categoryRows.map((row) => `• ${escapeHtml(row.category)} — ${escapeHtml(row.count)}`) : ["No tracked categories yet."]),
      "",
      "<b>Callback Health</b>",
      ...(callbackRows.length ? callbackRows.map((row) => `• ${escapeHtml(row.status || "unknown")} — ${escapeHtml(row.count)}`) : ["No callback events yet."]),
      "",
      "<b>Slow Actions</b>",
      ...(slowRows.length
        ? slowRows.map((row) => `• ${escapeHtml(row.action)} · ${escapeHtml(row.category)} — avg ${escapeHtml(row.avg_duration_ms || 0)}ms, max ${escapeHtml(row.max_duration_ms || 0)}ms`)
        : ["No timed actions yet."]),
      "",
      line("Generated", stats.generated_at || new Date().toISOString()),
    ].join("\n"),
    buildBotAnalyticsKeyboard(ctx),
  );
}

async function handleSubscriptionAlerts(ctx) {
  if (!(await requireCapability(ctx, CAPABILITIES.SYSTEM_STATUS, "subscription alerts"))) return;
  rememberScreen(ctx, "SUBSCRIPTION_ALERTS");
  const { settings, due } = await getConfiguredDueSubscriptionAlerts();
  const lines = [
    "<b>🔔 Subscription Alert Center</b>",
    "",
    line("Enabled", settings.enabled ? "yes" : "no"),
    line("Thresholds", settings.thresholds.join(", ")),
    "",
    "Alerts are deduped per user, threshold, and expiry timestamp.",
    "",
    ...(due.length
      ? due.slice(0, 12).map((user) => `• ${escapeHtml(user.telegram_id)} — ${escapeHtml(user.username || "unknown")} — ${escapeHtml(user.alert_threshold)} — expires ${escapeHtml(formatExpiry(user.subscription_expires_at))}`)
      : ["No active subscription alerts are due."]),
  ];
  await replyHtml(ctx, lines.join("\n"), buildSubscriptionAlertsKeyboard(ctx));
}

async function sendSubscriptionAlertMessage(user) {
  const threshold = user.alert_threshold;
  const expiry = formatExpiry(user.subscription_expires_at);
  const title = threshold === "expired" ? "Transferly subscription expired" : "Transferly subscription reminder";
  const body = [
    `<b>${escapeHtml(title)}</b>`,
    "",
    threshold === "expired"
      ? "Your bot access has expired and protected actions now return to guest mode."
      : `Your bot access expires soon (${escapeHtml(threshold)}).`,
    "",
    line("Role", user.role || ROLES.USER),
    line("Expires", expiry),
    "",
    "Contact an owner/admin to extend access.",
  ].join("\n");
  await bot.api.sendMessage(user.telegram_id, body, { parse_mode: "HTML" });
}

async function notifyOwnerAboutSubscriptionAlert(user) {
  const ownerId = getConfiguredOwnerId();
  if (!ownerId || String(ownerId) === String(user.telegram_id)) return;
  const body = [
    "<b>Subscription Alert</b>",
    "",
    line("User", `${user.telegram_id}${user.username ? ` (@${user.username})` : ""}`),
    line("Role", user.role || ROLES.USER),
    line("Threshold", user.alert_threshold),
    line("Expires", formatExpiry(user.subscription_expires_at)),
  ].join("\n");
  await bot.api.sendMessage(ownerId, body, { parse_mode: "HTML" });
}

async function runSubscriptionAlertSweep() {
  const { settings, due } = await getConfiguredDueSubscriptionAlerts();
  if (!settings.enabled) return;
  let sent = 0;
  for (const user of due) {
    const alreadySent = await wasSubscriptionAlertSentAsync(user.telegram_id, user.alert_threshold, user.subscription_expires_at);
    if (alreadySent) continue;
    try {
      await sendSubscriptionAlertMessage(user);
      if (["24h", "expired"].includes(user.alert_threshold)) {
        await notifyOwnerAboutSubscriptionAlert(user);
      }
      await recordSubscriptionAlertAsync(user.telegram_id, user.alert_threshold, user.subscription_expires_at);
      sent += 1;
    } catch (error) {
      logger.warn("Subscription alert delivery failed", {
        telegramId: user.telegram_id,
        threshold: user.alert_threshold,
        message: error?.message || String(error),
      });
    }
  }
  if (sent) {
    logger.info("Transferly subscription alert sweep completed", { sent });
  }
}

async function handleAlertToggle(ctx) {
  if (!(await requireCapability(ctx, CAPABILITIES.SYSTEM_STATUS, "subscription alert settings"))) return;
  const settings = await getAlertSettings();
  await setBotSettingAsync("subscription_alerts_enabled", settings.enabled ? "false" : "true");
  await handleSubscriptionAlerts(ctx);
}

async function handleAlertPreset(ctx, preset) {
  if (!(await requireCapability(ctx, CAPABILITIES.SYSTEM_STATUS, "subscription alert settings"))) return;
  const presets = {
    standard: "7d,3d,24h,expired",
    wide: "14d,7d,3d,24h,expired",
    expired: "expired",
  };
  await setBotSettingAsync("subscription_alert_thresholds", presets[preset] || presets.standard);
  await setBotSettingAsync("subscription_alerts_enabled", "true");
  await handleSubscriptionAlerts(ctx);
}

async function handleExport(ctx, type) {
  if (!(await requireCapability(ctx, CAPABILITIES.SYSTEM_STATUS, "bot exports"))) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  if (type === "users") {
    const users = await new Promise((resolve) => getUserList((error, rows) => resolve(error ? [] : rows || [])));
    const csv = toCsv(users.map((user) => ({
      telegram_id: user.telegram_id,
      username: user.username || "",
      role: user.role || "",
      status: formatUserStatus(user),
      subscription_expires_at: user.subscription_expires_at || "",
      last_seen_at: user.last_seen_at || "",
      updated_at: user.updated_at || "",
    })), [
      { key: "telegram_id", label: "telegram_id" },
      { key: "username", label: "username" },
      { key: "role", label: "role" },
      { key: "status", label: "status" },
      { key: "subscription_expires_at", label: "subscription_expires_at" },
      { key: "last_seen_at", label: "last_seen_at" },
      { key: "updated_at", label: "updated_at" },
    ]);
    await replyCsv(ctx, `transferly-users-${stamp}.csv`, "Transferly users export", csv);
    return;
  }

  if (type === "payment_audit") {
    const rows = await getRecentPaymentAuditLogsAsync({ limit: 100 });
    const csv = toCsv(rows, [
      { key: "created_at", label: "created_at" },
      { key: "actor_telegram_id", label: "actor_telegram_id" },
      { key: "action", label: "action" },
      { key: "resource_type", label: "resource_type" },
      { key: "resource_id", label: "resource_id" },
      { key: "provider_state", label: "provider_state" },
      { key: "transferly_state", label: "transferly_state" },
      { key: "amount", label: "amount" },
      { key: "currency", label: "currency" },
      { key: "recipient", label: "recipient" },
    ]);
    await replyCsv(ctx, `transferly-payment-audit-${stamp}.csv`, "Transferly payment audit export", csv);
    return;
  }

  if (type === "analytics") {
    const stats = await getBotAnalyticsStatsAsync();
    const rows = [
      ...(stats.action_totals_24h || []).map((row) => ({ type: "action", name: row.action, count: row.count })),
      ...(stats.category_totals_24h || []).map((row) => ({ type: "category", name: row.category, count: row.count })),
      { type: "summary", name: "failed_actions_24h", count: stats.failures_24h || 0 },
      { type: "summary", name: "payment_actions_24h", count: stats.payment_actions_24h || 0 },
      { type: "summary", name: "access_denials_24h", count: stats.access_denials_24h || 0 },
    ];
    const csv = toCsv(rows, [
      { key: "type", label: "type" },
      { key: "name", label: "name" },
      { key: "count", label: "count" },
    ]);
    await replyCsv(ctx, `transferly-analytics-${stamp}.csv`, "Transferly analytics export", csv);
    return;
  }

  if (type === "expiring") {
    const users = await getExpiringUsersAsync(30, 100);
    const csv = toCsv(users.map((user) => ({
      telegram_id: user.telegram_id,
      username: user.username || "",
      role: user.role || "",
      subscription_expires_at: user.subscription_expires_at || "",
      status: formatUserStatus(user),
    })), [
      { key: "telegram_id", label: "telegram_id" },
      { key: "username", label: "username" },
      { key: "role", label: "role" },
      { key: "status", label: "status" },
      { key: "subscription_expires_at", label: "subscription_expires_at" },
    ]);
    await replyCsv(ctx, `transferly-expiring-subscriptions-${stamp}.csv`, "Transferly expiring subscriptions export", csv);
    return;
  }

  await replyHtml(ctx, "Unknown export type.", buildBackKeyboard(ctx));
}

async function handleUsers(ctx) {
  if (!(await requireCapability(ctx, CAPABILITIES.USERS_MANAGE, "bot user management"))) return;
  rememberScreen(ctx, "USERS");
  clearPendingPrompts(ctx);
  await replyHtml(
    ctx,
    [
      "<b>Bot User Management</b>",
      "",
      "Manage Telegram accounts that can operate the Transferly bot.",
    ].join("\n"),
    buildUsersKeyboard(ctx),
  );
}

async function sendUsersList(ctx) {
  if (!(await requireCapability(ctx, CAPABILITIES.USERS_MANAGE, "bot user management"))) return;
  rememberScreen(ctx, "USERS_LIST");
  const users = await new Promise((resolve) => {
    getUserList((error, rows) => resolve(error ? [] : rows || []));
  });
  const lines = [
    "<b>Bot Access List</b>",
    "Tap a user to open detail actions.",
    "",
    ...(users.length
      ? users.map((user) => {
        return `• ${escapeHtml(user.telegram_id)} — ${escapeHtml(user.username || "unknown")} — ${escapeHtml(user.role)} — ${escapeHtml(formatUserStatus(user))} — expires ${escapeHtml(formatExpiry(user.subscription_expires_at))}`;
      })
      : ["No bot users found."]),
  ];
  await replyHtml(ctx, lines.join("\n"), buildUsersListKeyboard(ctx, users));
}

async function handleUsersAudit(ctx) {
  if (!(await requireCapability(ctx, CAPABILITIES.USERS_MANAGE, "bot audit logs"))) return;
  rememberScreen(ctx, "USERS_AUDIT");
  const rows = await getRecentUserAuditLogsAsync(10);
  await replyHtml(
    ctx,
    [
      "<b>Bot User Audit</b>",
      "",
      ...(rows.length ? rows.map(formatAuditEntry) : ["No user-management audit logs found."]),
    ].join("\n"),
    buildUsersAuditKeyboard(ctx),
  );
}

async function handleExpiringUsers(ctx) {
  if (!(await requireCapability(ctx, CAPABILITIES.USERS_MANAGE, "subscription expiry"))) return;
  rememberScreen(ctx, "USERS_EXPIRING");
  const users = await getExpiringUsersAsync(7, 10);
  const lines = [
    "<b>Subscriptions Expiring Soon</b>",
    "",
    ...(users.length
      ? users.map((user) => `• ${escapeHtml(user.telegram_id)} — ${escapeHtml(user.username || "unknown")} — ${escapeHtml(user.role)} — expires ${escapeHtml(formatExpiry(user.subscription_expires_at))}`)
      : ["No active non-owner subscriptions expire in the next 7 days."]),
  ];
  await replyHtml(ctx, lines.join("\n"), buildUsersListKeyboard(ctx, users));
}

async function handleUserDetail(ctx, telegramId) {
  if (!(await requireCapability(ctx, CAPABILITIES.USERS_MANAGE, "bot user details"))) return;
  const parsedId = parseTelegramId(telegramId);
  if (!parsedId) {
    await replyHtml(ctx, "Invalid user selection. Open the user list again.", buildUsersKeyboard(ctx));
    return;
  }
  rememberScreen(ctx, `USER_D:${parsedId}`);
  const user = await getUserAsync(parsedId);
  if (!user) {
    await replyHtml(ctx, "That bot user no longer exists. Refreshing the user list.", buildUsersKeyboard(ctx));
    await sendUsersList(ctx);
    return;
  }
  const auditRows = await getUserAuditLogsAsync(parsedId, 3);
  const activity = await getUserActivityStatsAsync(parsedId);
  const lines = [
    "<b>Bot User Detail</b>",
    "",
    line("Telegram ID", user.telegram_id),
    line("Username", user.username ? `@${user.username}` : "unknown"),
    line("Role", user.role),
    line("Status", formatUserStatus(user)),
    line("Subscription", user.role === ROLES.OWNER ? "owner access" : formatExpiry(user.subscription_expires_at)),
    line("Created", user.timestamp || "unknown"),
    line("Updated", user.updated_at || "unknown"),
    line("Last Seen", user.last_seen_at || "never"),
    "",
    "<b>Activity</b>",
    line("Actions 24h", activity?.analytics_24h ?? 0),
    line("Denied 24h", activity?.denied_24h ?? 0),
    line("Payment Actions 30d", activity?.payment_actions_30d ?? 0),
    ...(activity?.recent_actions?.length
      ? [
        "",
        "<b>Recent Bot Actions</b>",
        ...activity.recent_actions.map((entry) => `• ${escapeHtml(entry.action)} — ${escapeHtml(entry.status || "ok")} — ${escapeHtml(entry.created_at || "unknown")}`),
      ]
      : []),
    "",
    "<b>Recent Audit</b>",
    ...(auditRows.length ? auditRows.map(formatAuditEntry) : ["No recent user-management changes."]),
  ];
  await replyHtml(ctx, lines.join("\n"), buildUserDetailKeyboard(ctx, user));
}

async function setPendingUserAction(ctx, action) {
  if (!(await requireCapability(ctx, CAPABILITIES.USERS_MANAGE, "bot user management"))) return;
  const labels = {
    add: "Enter the Telegram ID to add.",
    promote: "Enter the Telegram ID to promote to ADMIN.",
    demote: "Enter the Telegram ID to demote to USER.",
    suspend: "Enter the Telegram ID to suspend.",
    reactivate: "Enter the Telegram ID to reactivate.",
    remove: "Enter the Telegram ID to revoke.",
  };
  ctx.session.meta.pendingUserAction = {
    action,
    step: "telegram_id",
    createdAt: Date.now(),
  };
  await replyHtml(ctx, labels[action] || "Enter Telegram ID.", buildCancelKeyboard(ctx));
}

async function setPendingUserDetailAction(ctx, action, telegramId) {
  if (!(await requireCapability(ctx, CAPABILITIES.USERS_MANAGE, "bot user management"))) return;
  const parsedId = parseTelegramId(telegramId);
  const user = parsedId ? await getUserAsync(parsedId) : null;
  if (!user) {
    await replyHtml(ctx, "That bot user was not found. Refresh the user list and try again.", buildUsersKeyboard(ctx));
    return;
  }
  if (user.role === ROLES.OWNER) {
    await replyHtml(ctx, "OWNER access cannot be changed from user detail actions.", buildUserDetailKeyboard(ctx, user));
    return;
  }

  const pending = {
    action,
    telegramId: parsedId,
    username: user.username || null,
    currentRole: user.role || ROLES.USER,
    step: userActionNeedsSubscription(action) ? "subscription_days" : "confirm",
    createdAt: Date.now(),
  };
  ctx.session.meta.pendingUserAction = pending;

  if (userActionNeedsSubscription(action)) {
    await askForSubscriptionDays(ctx, pending, `Choose subscription days for ${userActionLabel(action)} on ${parsedId}.`);
    return;
  }

  await renderUserActionConfirmation(ctx, pending);
}

function runDbMutation(mutator) {
  return new Promise((resolve, reject) => {
    mutator((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function parseTelegramId(value) {
  const id = Number.parseInt(String(value || "").trim(), 10);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function parseSubscriptionDays(value) {
  const days = Number.parseInt(String(value || "").trim(), 10);
  return Number.isSafeInteger(days) && days > 0 && days <= 3650 ? days : null;
}

function subscriptionExpiryPreview(days) {
  const parsed = parseSubscriptionDays(days);
  if (!parsed) return null;
  return new Date(Date.now() + parsed * 24 * 60 * 60 * 1000).toISOString();
}

function userActionLabel(action) {
  const labels = {
    add: "Add USER",
    promote: "Promote to ADMIN",
    demote: "Demote to USER",
    extend: "Extend subscription",
    suspend: "Suspend access",
    reactivate: "Reactivate access",
    remove: "Revoke access",
  };
  return labels[action] || action || "unknown";
}

function userActionTargetRole(action) {
  if (action === "promote") return ROLES.ADMIN;
  if (action === "add" || action === "demote") return ROLES.USER;
  return null;
}

function userActionNeedsSubscription(action) {
  return ["add", "promote", "demote", "reactivate", "extend"].includes(action);
}

async function renderUserActionConfirmation(ctx, pending) {
  const expiresAt = subscriptionExpiryPreview(pending.subscriptionDays);
  const lines = [
    "<b>Confirm Bot User Change</b>",
    "",
    line("Action", userActionLabel(pending.action)),
    line("Target Telegram ID", pending.telegramId),
    pending.username ? line("Username", `@${pending.username}`) : null,
    userActionTargetRole(pending.action) ? line("Target Role", userActionTargetRole(pending.action)) : null,
    ["extend", "reactivate"].includes(pending.action) && pending.currentRole ? line("Role", pending.currentRole) : null,
    pending.subscriptionDays ? line("Subscription", `${pending.subscriptionDays} days`) : null,
    expiresAt ? line("Expires On", formatExpiry(expiresAt)) : null,
    "",
    "Review this change before applying it. It will be recorded in the bot audit trail.",
  ].filter((item) => item !== null);
  await replyHtml(ctx, lines.join("\n"), buildUserConfirmKeyboard(ctx, pending));
}

async function askForSubscriptionDays(ctx, pending, prompt) {
  ctx.session.meta.pendingUserAction = {
    ...pending,
    step: "subscription_days",
  };
  await replyHtml(ctx, prompt, buildSubscriptionDurationKeyboard(ctx));
}

async function setPendingUserSubscriptionDays(ctx, days) {
  const pending = ctx.session.meta.pendingUserAction;
  const subscriptionDays = parseSubscriptionDays(days);
  if (!pending || !userActionNeedsSubscription(pending.action) || pending.step !== "subscription_days") {
    await replyHtml(ctx, "No subscription prompt is active. Open Users and choose an action again.", buildUsersKeyboard(ctx));
    return;
  }
  if (!subscriptionDays) {
    await replyHtml(ctx, "Choose a valid duration or send custom days from 1 to 3650.", buildSubscriptionDurationKeyboard(ctx));
    return;
  }
  const nextPending = {
    ...pending,
    subscriptionDays,
    step: "confirm",
  };
  ctx.session.meta.pendingUserAction = nextPending;
  await renderUserActionConfirmation(ctx, nextPending);
}

async function handleCustomSubscriptionDays(ctx) {
  const pending = ctx.session.meta.pendingUserAction;
  if (!pending || !userActionNeedsSubscription(pending.action)) {
    await replyHtml(ctx, "No subscription prompt is active. Open Users and choose an action again.", buildUsersKeyboard(ctx));
    return;
  }
  ctx.session.meta.pendingUserAction = {
    ...pending,
    step: "subscription_days",
  };
  await replyHtml(ctx, "Send custom subscription days from 1 to 3650.", buildSubscriptionDurationKeyboard(ctx));
}

async function handleChangeSubscriptionDays(ctx) {
  const pending = ctx.session.meta.pendingUserAction;
  if (!pending || !userActionNeedsSubscription(pending.action)) {
    await replyHtml(ctx, "No subscription confirmation is active. Open Users and choose an action again.", buildUsersKeyboard(ctx));
    return;
  }
  ctx.session.meta.pendingUserAction = {
    ...pending,
    step: "subscription_days",
    subscriptionDays: null,
  };
  await replyHtml(ctx, "Choose a new subscription duration, or send custom days from 1 to 3650.", buildSubscriptionDurationKeyboard(ctx));
}

async function recordUserAudit(ctx, pending, extra = {}) {
  try {
    await runDbMutation((done) => recordBotUserAudit({
      actorTelegramId: ctx.from?.id || null,
      action: pending.action,
      targetTelegramId: pending.telegramId,
      targetRole: userActionTargetRole(pending.action) || pending.currentRole || null,
      subscriptionDays: pending.subscriptionDays || null,
      subscriptionExpiresAt: subscriptionExpiryPreview(pending.subscriptionDays),
      details: {
        username: pending.username || null,
        ...extra,
      },
    }, done));
  } catch (error) {
    console.warn("Failed to write bot user audit log:", error?.message || error);
  }
}

async function completePendingUserAction(ctx) {
  const pending = ctx.session.meta.pendingUserAction;
  if (!pending || pending.step !== "confirm") {
    await replyHtml(ctx, "No user-management confirmation is active.", buildUsersKeyboard(ctx));
    return;
  }

  if (userActionNeedsSubscription(pending.action) && !parseSubscriptionDays(pending.subscriptionDays)) {
    await askForSubscriptionDays(ctx, pending, "Choose subscription days before confirming this change.");
    return;
  }

  const expiresAt = subscriptionExpiryPreview(pending.subscriptionDays);
  if (pending.action === "add") {
    await runDbMutation((done) => addUser(pending.telegramId, pending.username, ROLES.USER, pending.subscriptionDays, done));
  } else if (pending.action === "promote") {
    await runDbMutation((done) => promoteUser(pending.telegramId, pending.subscriptionDays, done));
  } else if (pending.action === "demote") {
    await runDbMutation((done) => setUserRole(pending.telegramId, ROLES.USER, pending.subscriptionDays, done));
  } else if (pending.action === "reactivate") {
    await runDbMutation((done) => setUserStatus(pending.telegramId, STATUS.ACTIVE, pending.subscriptionDays, done));
  } else if (pending.action === "extend") {
    await runDbMutation((done) => extendUserSubscription(pending.telegramId, pending.subscriptionDays, done));
  } else if (pending.action === "suspend") {
    await runDbMutation((done) => setUserStatus(pending.telegramId, STATUS.SUSPENDED, null, done));
  } else if (pending.action === "remove") {
    await runDbMutation((done) => removeUser(pending.telegramId, done));
  } else {
    delete ctx.session.meta.pendingUserAction;
    await replyHtml(ctx, "Unknown user-management action.", buildUsersKeyboard(ctx));
    return;
  }

  await recordUserAudit(ctx, pending);
  delete ctx.session.meta.pendingUserAction;
  const resultLines = [
    `<b>✅ ${escapeHtml(userActionLabel(pending.action))} Applied</b>`,
    "",
    line("Target Telegram ID", pending.telegramId),
    pending.username ? line("Username", `@${pending.username}`) : null,
    userActionTargetRole(pending.action) ? line("Role", userActionTargetRole(pending.action)) : null,
    ["extend", "reactivate"].includes(pending.action) && pending.currentRole ? line("Role", pending.currentRole) : null,
    pending.subscriptionDays ? line("Subscription", `${pending.subscriptionDays} days`) : null,
    expiresAt ? line("Expires On", formatExpiry(expiresAt)) : null,
    "",
    "Recorded in the bot audit trail.",
  ].filter((item) => item !== null);
  const updatedUser = await getUserAsync(pending.telegramId);
  await replyHtml(ctx, resultLines.join("\n"), updatedUser ? buildUserDetailKeyboard(ctx, updatedUser) : buildUsersKeyboard(ctx));
}

async function handlePendingUserText(ctx, text) {
  const pending = ctx.session.meta.pendingUserAction;
  if (!pending) return false;
  if (!(await requireCapability(ctx, CAPABILITIES.USERS_MANAGE, "bot user management"))) {
    delete ctx.session.meta.pendingUserAction;
    return true;
  }

  const normalized = String(text || "").trim();
  if (!normalized || normalized.toLowerCase() === "cancel") {
    delete ctx.session.meta.pendingUserAction;
    await replyHtml(ctx, "User-management action cancelled.", buildUsersKeyboard(ctx));
    return true;
  }

  if (pending.action === "add" && pending.step === "username") {
    const username = normalized.replace(/^@/, "");
    if (!username) {
      await replyHtml(ctx, "Username is required. Send a username or cancel.", buildCancelKeyboard(ctx));
      return true;
    }
    ctx.session.meta.pendingUserAction = {
      ...pending,
      username,
      step: "subscription_days",
    };
    await askForSubscriptionDays(ctx, ctx.session.meta.pendingUserAction, "Choose subscription days for this USER access, or send a custom number from 1 to 3650.");
    return true;
  }

  if (pending.action === "add" && pending.step === "subscription_days") {
    await setPendingUserSubscriptionDays(ctx, normalized);
    return true;
  }

  if ((pending.action === "promote" || pending.action === "reactivate" || pending.action === "demote" || pending.action === "extend") && pending.step === "subscription_days") {
    await setPendingUserSubscriptionDays(ctx, normalized);
    return true;
  }

  if (pending.step === "confirm") {
    if (["confirm", "yes", "apply"].includes(normalized.toLowerCase())) {
      await completePendingUserAction(ctx);
      return true;
    }
    await replyHtml(ctx, "Tap Confirm to apply this change, or send cancel.", buildUserConfirmKeyboard(ctx, pending));
    return true;
  }

  const telegramId = parseTelegramId(normalized);
  if (!telegramId) {
    await replyHtml(ctx, "Send a valid numeric Telegram ID, or send cancel.", buildCancelKeyboard(ctx));
    return true;
  }

  if (String(telegramId) === String(getConfiguredOwnerId()) && ["promote", "demote", "suspend", "reactivate", "remove"].includes(pending.action)) {
    delete ctx.session.meta.pendingUserAction;
    await replyHtml(ctx, "The configured OWNER account cannot be modified from the bot.", buildUsersKeyboard(ctx));
    return true;
  }

  if (pending.action === "add") {
    ctx.session.meta.pendingUserAction = {
      ...pending,
      step: "username",
      telegramId,
    };
    await replyHtml(ctx, "Enter the Telegram username for this user.", buildCancelKeyboard(ctx));
    return true;
  }

  if (pending.action === "promote") {
    await askForSubscriptionDays(ctx, {
      ...pending,
      telegramId,
    }, "Choose subscription days for this ADMIN access, or send a custom number from 1 to 3650.");
    return true;
  }

  if (pending.action === "demote") {
    await askForSubscriptionDays(ctx, {
      ...pending,
      telegramId,
    }, "Choose subscription days for this USER access after demotion, or send a custom number from 1 to 3650.");
    return true;
  }

  if (pending.action === "suspend") {
    const nextPending = {
      ...pending,
      telegramId,
      step: "confirm",
    };
    ctx.session.meta.pendingUserAction = nextPending;
    await renderUserActionConfirmation(ctx, nextPending);
    return true;
  }

  if (pending.action === "reactivate") {
    await askForSubscriptionDays(ctx, {
      ...pending,
      telegramId,
    }, "Choose subscription days for reactivated access, or send a custom number from 1 to 3650.");
    return true;
  }

  if (pending.action === "remove") {
    const nextPending = {
      ...pending,
      telegramId,
      step: "confirm",
    };
    ctx.session.meta.pendingUserAction = nextPending;
    await renderUserActionConfirmation(ctx, nextPending);
    return true;
  }

  delete ctx.session.meta.pendingUserAction;
  return false;
}

async function handlePendingServiceText(ctx, text) {
  const pending = ctx.session.meta.pendingServiceRun;
  if (!pending) return false;
  if (!(await requireCapability(ctx, CAPABILITIES.SERVICES_USE, "service generation"))) {
    delete ctx.session.meta.pendingServiceRun;
    return true;
  }
  const service = getService(pending.slug);
  delete ctx.session.meta.pendingServiceRun;

  if (!service) {
    await replyHtml(ctx, "The pending service is no longer available. Use /services to start again.", buildServiceGroupsKeyboard(ctx));
    return true;
  }

  const normalized = String(text || "").trim();
  if (normalized.toLowerCase() === "cancel") {
    await replyHtml(ctx, "Service generation cancelled.", buildServiceDetailKeyboard(ctx, service));
    return true;
  }

  await runServiceReceipt(ctx, service, {
    ...(pending.details || {}),
    ...parseDetailsText(normalized),
  });
  return true;
}

async function handlePendingSearchText(ctx, text) {
  const pending = ctx.session.meta.pendingSearch;
  if (!pending) return false;
  const requiredCapability =
    pending.type === "service" ? CAPABILITIES.SERVICES_USE :
    pending.type === "bot_user" ? CAPABILITIES.USERS_MANAGE :
    CAPABILITIES.PAYMENTS_READ;
  if (!(await requireCapability(ctx, requiredCapability, "search"))) {
    delete ctx.session.meta.pendingSearch;
    return true;
  }

  const normalized = String(text || "").trim();
  if (!normalized || normalized.toLowerCase() === "cancel") {
    delete ctx.session.meta.pendingSearch;
    const access = await getAccessStatus(ctx);
    const keyboard =
      pending.type === "service"
        ? buildServiceGroupsKeyboard(ctx)
        : pending.type === "bot_user"
        ? buildUsersKeyboard(ctx)
        : buildPayPalWorkspaceKeyboard(ctx, access);
    await replyHtml(ctx, "Search cancelled.", keyboard);
    return true;
  }

  delete ctx.session.meta.pendingSearch;

  if (pending.type === "service") {
    const matches = searchServices(normalized, 8);
    if (matches.length === 1) {
      await handleServiceDetail(ctx, matches[0].slug);
      return true;
    }

    const lines = [
      "<b>Service Search Results</b>",
      "",
      line("Search", normalized),
      line("Matches", String(matches.length)),
      "",
      ...(matches.length
        ? matches.map((service) => `• <b>${escapeHtml(service.title)}</b> — ${escapeHtml(service.category)}`)
        : ["No services matched. Try a name like PayPal, Opay, Binance, QR, or crypto."]),
    ];
    await replyHtml(ctx, lines.join("\n"), buildServiceSearchResultsKeyboard(ctx, matches));
    return true;
  }

  if (pending.type === "bot_user") {
    if (!(await requireCapability(ctx, CAPABILITIES.USERS_MANAGE, "bot user search"))) return true;
    const users = await searchUsersAsync(normalized, 10);
    const lines = [
      "<b>Bot User Search Results</b>",
      "",
      line("Search", normalized),
      line("Matches", String(users.length)),
      "",
      ...(users.length
        ? users.map((user) => `• ${escapeHtml(user.telegram_id)} — ${escapeHtml(user.username || "unknown")} — ${escapeHtml(user.role || "USER")} — ${escapeHtml(formatUserStatus(user))}`)
        : ["No users matched. Try a Telegram ID, username, role, or status."]),
    ];
    await replyHtml(ctx, lines.join("\n"), buildUsersListKeyboard(ctx, users));
    return true;
  }

  if (pending.type === "paypal_invoice") {
    if (!(await requireAdmin(ctx, "PayPal invoice search"))) return true;
    await handlePayPalInvoices(ctx, {
      recipient: normalized,
      status: "ALL",
      page: 1,
      notice: `Search: ${normalized}`,
    });
    return true;
  }

  if (pending.type === "paypal_payout") {
    if (!(await requireAdmin(ctx, "PayPal payout search"))) return true;
    await handlePayPalPayouts(ctx, {
      recipient: normalized,
      status: "ALL",
      providerState: "ALL",
      page: 1,
      notice: `Search: ${normalized}`,
    });
    return true;
  }

  return false;
}

async function handleStoredNavigationAction(ctx, action) {
  if (!action || action === "MENU") return handleMenu(ctx);
  if (action === "SERVICES") return handleServices(ctx);
  if (action === "HELP") return handleHelp(ctx);
  if (COMMAND_SECTION_ACTIONS.has(action)) return handleCommandSection(ctx, action);
  if (action === "PROFILE") return handleProfile(ctx);
  if (action === "WHOAMI") return handleWhoami(ctx);
  if (action === "BALANCE") return handleBalance(ctx);
  if (action === "RECEIPTS") return handleReceipts(ctx);
  if (action === "REFERRAL") return handleReferral(ctx);
  if (action === "HEALTH") return handleHealth(ctx);
  if (action === "STATUS") return handleStatus(ctx);
  if (action === "BOT_OPS") return handleBotOps(ctx);
  if (action === "BOT_ANALYTICS") return handleBotAnalytics(ctx);
  if (action === "SUBSCRIPTION_ALERTS") return handleSubscriptionAlerts(ctx);
  if (action === "PAYMENT_AUDIT") return handlePaymentAudit(ctx);
  if (action === "USERS") return handleUsers(ctx);
  if (action === "USERS_LIST") return sendUsersList(ctx);
  if (action === "USERS_AUDIT") return handleUsersAudit(ctx);
  if (action === "USERS_EXPIRING") return handleExpiringUsers(ctx);
  if (action === "OPS") return handleOps(ctx);
  if (action === "ACTIVITY") return handleActivity(ctx);
  if (action === "CLIENTS") return handleClients(ctx);
  if (action === "RISK") return handleRisk(ctx);
  if (action === "SECURITY") return handleSecurity(ctx);
  if (action === "ISSUES") return handleIssues(ctx);
  if (action === "ORDERS") return handleOrders(ctx);
  if (action === "RECONCILE") return handleReconcile(ctx);
  if (action === "INVOICES") return handleInvoices(ctx);
  if (action === "PP:INV") return handlePayPalInvoices(ctx);
  if (action === "PAYOUTS") return handlePayouts(ctx);
  if (action === "PP:PO") return handlePayPalPayouts(ctx);
  if (action === "PP:HOME") return handlePayPalWorkspace(ctx);
  if (action.startsWith("PROVIDER_INV:")) {
    return handlePayPalInvoices(ctx, { provider: action.slice("PROVIDER_INV:".length), page: 1 });
  }
  if (action.startsWith("PROVIDER_PO:")) {
    return handleProviderPayouts(ctx, action.slice("PROVIDER_PO:".length));
  }
  if (action.startsWith("PROVIDER_BAL:")) {
    return handleProviderBalance(ctx, action.slice("PROVIDER_BAL:".length));
  }
  if (action.startsWith("PROVIDER_WEBHOOKS:")) {
    return handleProviderWebhooks(ctx, action.slice("PROVIDER_WEBHOOKS:".length));
  }
  if (action.startsWith("PROVIDER_ISSUES:")) {
    return handleProviderIssues(ctx, action.slice("PROVIDER_ISSUES:".length));
  }

  if (action.startsWith("GROUP:")) {
    return handleServiceGroup(ctx, action.slice("GROUP:".length));
  }
  if (action.startsWith("SERVICE:")) {
    return handleServiceDetail(ctx, action.slice("SERVICE:".length));
  }
  if (action.startsWith("SERVICE_ACTION:")) {
    const [, slug, laneId] = action.split(":");
    return handleServiceLaneAction(ctx, slug, laneId);
  }
  if (action.startsWith("SERVICE_LANE:")) {
    const [, slug, laneId] = action.split(":");
    return handleServiceLane(ctx, slug, laneId);
  }
  if (action.startsWith("PROVIDER:")) {
    return handleProviderWorkspace(ctx, action.slice("PROVIDER:".length));
  }
  if (action.startsWith("PROVIDER_LANE:")) {
    const [, slug, laneId] = action.split(":");
    return handleProviderLane(ctx, slug, laneId);
  }
  if (action.startsWith("HISTORY:")) {
    return handleServiceHistory(ctx, action.slice("HISTORY:".length));
  }
  if (action.startsWith("INFO:")) {
    return handleServiceInfo(ctx, action.slice("INFO:".length));
  }
  if (action.startsWith("USER_D:")) {
    return handleUserDetail(ctx, action.slice("USER_D:".length));
  }
  if (action.startsWith("PP:INV_D:")) {
    return handlePayPalInvoiceDetail(ctx, action.slice("PP:INV_D:".length));
  }
  if (action.startsWith("PP:PO_D:")) {
    return handlePayPalPayoutDetail(ctx, action.slice("PP:PO_D:".length));
  }

  return handleMenu(ctx);
}

async function handleBack(ctx) {
  const target = popBackAction(ctx);
  await handleStoredNavigationAction(ctx, target);
}

async function recoverCallback(ctx, validation = {}) {
  clearPendingPrompts(ctx);
  const access = await getAdminStatus(ctx);
  const action = validation.action || "";
  recordAnalytics(ctx, action || "callback_recovery", "callback_recovery", validation.status || "recovered", {
    reason: validation.reason || validation.status || "callback_recovery",
  });
  const reason = validation.status === "stale"
    ? "That button belongs to an older bot session."
    : validation.status === "invalid"
      ? "That button could not be verified."
      : "That button expired.";
  await replyHtml(
    ctx,
    [
      "<b>Session Recovered</b>",
      "",
      reason,
      "I opened the closest fresh workspace so you can continue safely.",
    ].join("\n"),
    buildCallbackRecoveryKeyboard(ctx, action, access),
  );
}

function getUpdateRateKey(ctx, label) {
  const userId = ctx.from?.id || ctx.chat?.id || "anonymous";
  const command = ctx.message?.text?.startsWith("/")
    ? ctx.message.text.split(/\s+/)[0].slice(1).toLowerCase()
    : label;
  return `${userId}:${command || label}`;
}

function getRateLimitOptions(ctx, label) {
  if (label === "callback") {
    return { windowMs: 30 * 1000, max: 24 };
  }
  if (ctx.message?.text?.startsWith("/")) {
    return { windowMs: 60 * 1000, max: 18 };
  }
  return { windowMs: 60 * 1000, max: 30 };
}

async function enforceRateLimit(ctx, label) {
  const result = updateRateLimiter.check(getUpdateRateKey(ctx, label), getRateLimitOptions(ctx, label));
  if (result.allowed) return true;
  const retryAfterSeconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
  recordBotAnalyticsEvent({
    telegramId: ctx.from?.id || null,
    username: ctx.from?.username || null,
    action: label,
    category: "rate_limit",
    status: "blocked",
    details: { retryAfterSeconds },
  }, () => {});
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({
      text: `Please try again in ${retryAfterSeconds}s.`,
      show_alert: false,
    }).catch(() => {});
  }
  await replyHtml(
    ctx,
    `Too many Transferly requests. Please try again in ${retryAfterSeconds}s.`,
    buildBackKeyboard(ctx),
  );
  return false;
}

function wrap(handler, label) {
  return async (ctx) => {
    ensureSession(ctx);
    const start = Date.now();
    try {
      if (!(await enforceRateLimit(ctx, label))) {
        return;
      }
      await clearTriggerMessage(ctx);
      if (ctx.message?.text?.startsWith("/")) {
        const command = ctx.message.text.split(/\s+/)[0].slice(1).toLowerCase();
        const requiredCapability = getCommandCapability(command || label);
        if (!(await requireCapability(ctx, requiredCapability, `/${command || label}`))) {
          return;
        }
      }
      await handler(ctx);
      recordBotAnalyticsEvent({
        telegramId: ctx.from?.id || null,
        username: ctx.from?.username || null,
        action: label,
        category: "command",
        status: "ok",
        durationMs: Date.now() - start,
      }, () => {});
    } catch (error) {
      recordBotAnalyticsEvent({
        telegramId: ctx.from?.id || null,
        username: ctx.from?.username || null,
        action: label,
        category: "command",
        status: "error",
        durationMs: Date.now() - start,
        details: { message: error?.message || String(error) },
      }, () => {});
      logger.error(`${label} failed`, {
        telegramId: ctx.from?.id || null,
        message: error?.message,
        status: error?.response?.status,
        requestId: error?.apiContext?.requestId,
      });
      const message = error?.userMessage || error?.response?.data?.message || "Transferly request failed. Please try again.";
      await replyHtml(ctx, `⚠️ ${escapeHtml(message)}`, buildBackKeyboard(ctx));
    }
  };
}

bot.use(session({
  initial: initialSessionState,
  storage: {
    read: readBotSession,
    write: writeBotSession,
    delete: deleteBotSession,
  },
}));
bot.use(async (ctx, next) => {
  ensureSession(ctx);
  return next();
});

registerCommands(bot, {
  wrap,
  handlers: {
    handleStart,
    handleMenu,
    handleMiniApp,
    handleServices,
    handleProviders,
    handleProviderCommand,
    handleProviderShortcut,
    handleHelp,
    handleCommandSection,
    handleWhoami,
    handleAccount,
    handleProfile,
    handleBalance,
    handleReceipts,
    handleReceipt,
    handleReferral,
    handleInvoices,
    handlePayouts,
    handleActivity,
    handleClients,
    handleRisk,
    handleSecurity,
    handleIssues,
    handleOrders,
    handleOps,
    handleApprovePayout,
    handleRejectPayout,
    handleCancelUnclaimed,
    handleReleaseInvoice,
    handleRefreshInvoice,
    handleRefreshPayout,
    handleReconcile,
    handleHealth,
    handleStatus,
    handleBotOps,
    handleBotAnalytics,
    handleSubscriptionAlerts,
    handlePaymentAudit,
    handleAlertToggle,
    handleAlertPreset,
    handleExport,
    handleUsers,
    handleCancel,
  },
});

registerCallbackRouter(bot, {
  wrap,
  validateCallback,
  getActionCapability,
  requireCapability,
  requireAdmin,
  recordAnalytics,
  recoverCallback,
  prepareNavigationAction,
  replyHtml,
  deleteOrDisableMessage,
  buildMainMenuKeyboard,
  buildBackKeyboard,
  getAdminStatus,
  handlers: {
    getService,
    handleBack,
    handleCancel,
    handleMenu,
    handleMiniApp,
    handleServices,
    handleProviders,
    handleInvoices,
    handlePayouts,
    handleHelp,
    handleCommandSection,
    handleProfile,
    handleWhoami,
    handleBalance,
    handleReceipts,
    handleReferral,
    handleHealth,
    handleStatus,
    handleBotOps,
    handleBotAnalytics,
    handleSubscriptionAlerts,
    handlePaymentAudit,
    handleAlertToggle,
    handleAlertPreset,
    handleExport,
    handleServiceGroup,
    handleServiceDetail,
    handleServiceLane,
    handleServiceLaneAction,
    handleProviderWorkspace,
    handleProviderLane,
    handleProviderPayouts,
    handleProviderBalance,
    handleProviderWebhooks,
    handleProviderIssues,
    runServiceReceipt,
    handleCustomServiceStart,
    handleServiceHistory,
    handleServiceInfo,
    startSearchFlow,
    handlePayPalWorkspace,
    startServiceComposer,
    handleComposerAction,
    handlePayPalInvoices,
    handlePayPalPayouts,
    handlePayPalInvoiceDetail,
    handlePayPalPayoutDetail,
    handlePayPalInvoiceAction,
    handlePayPalPayoutAction,
    handleActivity,
    handleClients,
    handleRisk,
    handleSecurity,
    handleIssues,
    handleOrders,
    handleOps,
    handleReconcile,
    handleUsers,
    sendUsersList,
    handleUsersAudit,
    handleExpiringUsers,
    handleUserDetail,
    setPendingUserAction,
    setPendingUserDetailAction,
    setPendingUserSubscriptionDays,
    completePendingUserAction,
    handleCustomSubscriptionDays,
    handleChangeSubscriptionDays,
  },
});
bot.on("message:text", wrap(async (ctx) => {
  if (await handlePendingSearchText(ctx, ctx.message.text)) {
    return;
  }

  if (await handlePendingPayPalText(ctx, ctx.message.text)) {
    return;
  }

  if (await handlePendingComposerText(ctx, ctx.message.text)) {
    return;
  }

  if (await handlePendingUserText(ctx, ctx.message.text)) {
    return;
  }

  if (await handlePendingServiceText(ctx, ctx.message.text)) {
    return;
  }

  if (ctx.message.text.startsWith("/")) {
    await replyHtml(ctx, "Unsupported Transferly command. Use /help for the available command list.", buildBackKeyboard(ctx));
    return;
  }

  await replyHtml(ctx, "Use /menu for Transferly actions or /help for command examples.", buildBackKeyboard(ctx));
}, "text"));

bot.catch((error) => {
  logger.error("Bot update failed", {
    updateId: error.ctx?.update?.update_id,
    message: error.error?.message || String(error.error),
  });
});

async function validateApiConnectivity() {
  const healthUrl = new URL("/health", config.apiUrl).toString();
  const response = await httpClient.get(null, healthUrl, { timeout: 5000 });
  if (!response.data || (!response.data.ok && response.data.status && response.data.status !== "healthy")) {
    throw new Error(`Transferly API healthcheck returned an unexpected payload.`);
  }
  logger.info("Transferly API reachable", { url: healthUrl });
}

let alertTimer = null;
let sessionCleanupTimer = null;
let webhookServer = null;

function runSessionCleanup() {
  cleanupExpiredBotSessions(336, function onCleanup(error) {
    if (error) {
      logger.warn("Bot session cleanup failed", { message: error.message });
      return;
    }
    logger.debug("Bot session cleanup completed", { deleted: this?.changes || 0 });
  });
}

function startBackgroundJobs() {
  runSubscriptionAlertSweep().catch((error) => logger.warn("Initial subscription alert sweep failed", { error }));
  alertTimer = setInterval(() => {
    runSubscriptionAlertSweep().catch((error) => logger.warn("Subscription alert sweep failed", { error }));
  }, 6 * 60 * 60 * 1000);
  alertTimer.unref?.();

  runSessionCleanup();
  sessionCleanupTimer = setInterval(runSessionCleanup, 12 * 60 * 60 * 1000);
  sessionCleanupTimer.unref?.();
}

function stopBackgroundJobs() {
  if (alertTimer) {
    clearInterval(alertTimer);
    alertTimer = null;
  }
  if (sessionCleanupTimer) {
    clearInterval(sessionCleanupTimer);
    sessionCleanupTimer = null;
  }
}

function registerPollingShutdownHandlers() {
  let stopping = false;
  const stop = async (signal) => {
    if (stopping) return;
    stopping = true;
    logger.info("Transferly bot stopping", { signal, mode: "polling" });
    stopBackgroundJobs();
    try {
      if (bot.isRunning()) {
        await bot.stop();
      }
      process.exit(0);
    } catch (error) {
      logger.error("Transferly bot shutdown failed", { error });
      process.exit(1);
    }
  };
  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));
}

function registerWebhookShutdownHandlers(server) {
  let stopping = false;
  const stop = (signal) => {
    if (stopping) return;
    stopping = true;
    logger.info("Transferly webhook server stopping", { signal, mode: "webhook" });
    stopBackgroundJobs();
    server.close((error) => {
      if (error) {
        logger.error("Transferly webhook server shutdown failed", { error });
        process.exit(1);
        return;
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref?.();
  };
  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));
}

async function startPollingRuntime() {
  registerPollingShutdownHandlers();
  logger.info("Transferly bot polling started");
  await bot.start();
}

async function startWebhookRuntime() {
  if (!config.updates.webhookUrl) {
    throw new Error("BOT_WEBHOOK_URL is required when BOT_UPDATE_MODE=webhook.");
  }

  const webhookPath = config.updates.webhookPath.startsWith("/")
    ? config.updates.webhookPath
    : `/${config.updates.webhookPath}`;
  const handleUpdate = webhookCallback(bot, "http", {
    secretToken: config.updates.webhookSecret || undefined,
    timeoutMilliseconds: 10000,
  });

  webhookServer = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/healthz")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "transferly-bot" }));
      return;
    }
    if (req.method !== "POST" || url.pathname !== webhookPath) {
      res.writeHead(404).end();
      return;
    }
    try {
      await handleUpdate(req, res);
    } catch (error) {
      logger.error("Telegram webhook update failed", { error });
      if (!res.headersSent) {
        res.writeHead(500).end();
      } else {
        res.end();
      }
    }
  });

  await new Promise((resolve, reject) => {
    webhookServer.once("error", reject);
    webhookServer.listen(config.updates.port, resolve);
  });

  const webhookOptions = config.updates.webhookSecret
    ? { secret_token: config.updates.webhookSecret }
    : {};
  await bot.api.setWebhook(config.updates.webhookUrl, webhookOptions);
  registerWebhookShutdownHandlers(webhookServer);
  logger.info("Transferly bot webhook runtime started", {
    port: config.updates.port,
    path: webhookPath,
    webhookUrl: config.updates.webhookUrl,
  });
}

async function bootstrap() {
  try {
    await validateApiConnectivity();
    await bot.api.setMyCommands(TELEGRAM_COMMANDS);
    logger.info("Transferly bot commands registered");
    startBackgroundJobs();
    if (config.updates.mode === "webhook") {
      await startWebhookRuntime();
      return;
    }
    await startPollingRuntime();
  } catch (error) {
    logger.error("Failed to start Transferly bot", { error });
    process.exit(1);
  }
}

if (require.main === module) {
  bootstrap();
}

module.exports = {
  SCREEN_TYPES,
  TELEGRAM_COMMANDS,
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
  buildMiniAppUrl,
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
  buildServiceGroupKeyboard,
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
  bootstrap,
};
