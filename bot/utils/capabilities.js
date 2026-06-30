const ROLES = Object.freeze({
  GUEST: "GUEST",
  USER: "USER",
  ADMIN: "ADMIN",
  OWNER: "OWNER",
});

const STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  REVOKED: "REVOKED",
});

const ROLE_LEVEL = {
  [ROLES.GUEST]: 0,
  [ROLES.USER]: 1,
  [ROLES.ADMIN]: 2,
  [ROLES.OWNER]: 3,
};

const CAPABILITIES = Object.freeze({
  PUBLIC: "public",
  SERVICES_USE: "services.use",
  ACCOUNT_READ: "account.read",
  HEALTH_READ: "health.read",
  PAYMENTS_READ: "payments.read",
  PAYMENTS_MUTATE: "payments.mutate",
  USERS_MANAGE: "users.manage",
  SYSTEM_STATUS: "system.status",
});

const CAPABILITY_MIN_ROLE = {
  [CAPABILITIES.PUBLIC]: ROLES.GUEST,
  [CAPABILITIES.SERVICES_USE]: ROLES.USER,
  [CAPABILITIES.ACCOUNT_READ]: ROLES.USER,
  [CAPABILITIES.HEALTH_READ]: ROLES.USER,
  [CAPABILITIES.PAYMENTS_READ]: ROLES.ADMIN,
  [CAPABILITIES.PAYMENTS_MUTATE]: ROLES.ADMIN,
  [CAPABILITIES.USERS_MANAGE]: ROLES.OWNER,
  [CAPABILITIES.SYSTEM_STATUS]: ROLES.ADMIN,
};

function normalizeRole(role) {
  const value = String(role || "").toUpperCase();
  return ROLE_LEVEL[value] !== undefined ? value : ROLES.GUEST;
}

function normalizeStatus(status) {
  const value = String(status || STATUS.ACTIVE).toUpperCase();
  return Object.values(STATUS).includes(value) ? value : STATUS.ACTIVE;
}

function hasCapability(access = {}, capability = CAPABILITIES.PUBLIC) {
  if (capability === CAPABILITIES.PUBLIC) return true;
  if (normalizeStatus(access.status) !== STATUS.ACTIVE) return false;
  const role = normalizeRole(access.role);
  if (role !== ROLES.OWNER && access.subscriptionExpired) return false;
  const minRole = CAPABILITY_MIN_ROLE[capability] || ROLES.ADMIN;
  return ROLE_LEVEL[role] >= ROLE_LEVEL[minRole];
}

function getCommandCapability(command) {
  const name = String(command || "").replace(/^\//, "").toLowerCase();
  if (["start", "menu", "miniapp", "help", "whoami", "cancel"].includes(name)) return CAPABILITIES.PUBLIC;
  if (["services", "receipt", "providers", "provider", "paypal", "stripe", "wise", "paystack", "flutterwave", "crypto"].includes(name)) {
    return CAPABILITIES.SERVICES_USE;
  }
  if (["account", "profile", "balance", "receipts", "history", "referral"].includes(name)) return CAPABILITIES.ACCOUNT_READ;
  if (["health"].includes(name)) return CAPABILITIES.HEALTH_READ;
  if (["invoices", "payouts", "activity", "risk", "issues", "orders", "ops", "reconcile", "refresh_invoice", "refresh_payout"].includes(name)) {
    return CAPABILITIES.PAYMENTS_READ;
  }
  if (["approve_payout", "reject_payout", "cancel_unclaimed", "release_invoice"].includes(name)) {
    return CAPABILITIES.PAYMENTS_MUTATE;
  }
  if (["status", "bot_ops", "clients", "security"].includes(name)) return CAPABILITIES.SYSTEM_STATUS;
  if (["users"].includes(name)) return CAPABILITIES.USERS_MANAGE;
  return CAPABILITIES.PUBLIC;
}

function getActionCapability(action) {
  const value = String(action || "");
  if (!value || ["BACK", "MENU", "HELP", "WHOAMI", "CANCEL", "MENU_SUPPORT"].includes(value)) return CAPABILITIES.PUBLIC;
  if (
    value.startsWith("GROUP:") ||
    value.startsWith("SERVICE:") ||
    value.startsWith("SERVICE_ACTION:") ||
    value.startsWith("SERVICE_LANE:") ||
    value.startsWith("PROVIDER:") ||
    value.startsWith("PROVIDER_CUSTOM:") ||
    value.startsWith("PROVIDER_LANE:") ||
    value.startsWith("RUN:") ||
    value.startsWith("CUSTOM:") ||
    value.startsWith("HISTORY:") ||
    value.startsWith("INFO:") ||
    value === "SERVICES" ||
    value === "PROVIDERS" ||
    value === "MENU_COLLECT" ||
    value === "MENU_SEND" ||
    value === "SEARCH:SERVICE" ||
    value === "PP:HOME" ||
    value === "PP:EMAIL" ||
    value.startsWith("CMP:")
  ) {
    return CAPABILITIES.SERVICES_USE;
  }
  if (["PROFILE", "BALANCE", "RECEIPTS", "REFERRAL", "MENU_ACCOUNT"].includes(value)) return CAPABILITIES.ACCOUNT_READ;
  if (value === "HEALTH") return CAPABILITIES.HEALTH_READ;
  if (
    ["STATUS", "BOT_OPS", "BOT_ANALYTICS", "SUBSCRIPTION_ALERTS", "PAYMENT_AUDIT", "CLIENTS", "SECURITY", "MENU_ADMIN"].includes(value) ||
    value.startsWith("ALERT_") ||
    value.startsWith("PAY_AUDIT_F:") ||
    value.startsWith("EXPORT_")
  ) return CAPABILITIES.SYSTEM_STATUS;
  if (
    value === "INVOICES" ||
    value === "PAYOUTS" ||
    value === "OPS" ||
    value === "ACTIVITY" ||
    value === "RISK" ||
    value === "ISSUES" ||
    value === "ORDERS" ||
    value === "RECONCILE" ||
    value === "PP:INV" ||
    value === "PP:PO" ||
    value === "PP:INV_SEARCH" ||
    value === "PP:PO_SEARCH" ||
    value.startsWith("PP:INV_P:") ||
    value.startsWith("PP:PO_P:") ||
    value.startsWith("PP:INV_S:") ||
    value.startsWith("PP:PO_S:") ||
    value.startsWith("PP:PO_PR:") ||
    value.startsWith("PP:INV_D:") ||
    value.startsWith("PP:PO_D:") ||
    value.startsWith("PP:INV_REFRESH:") ||
    value.startsWith("PP:PO_REFRESH:")
  ) {
    return CAPABILITIES.PAYMENTS_READ;
  }
  if (
    value.startsWith("PROVIDER_INV:") ||
    value.startsWith("PROVIDER_PO:") ||
    value.startsWith("PROVIDER_BAL:") ||
    value.startsWith("PROVIDER_WEBHOOKS:") ||
    value.startsWith("PROVIDER_ISSUES:")
  ) return CAPABILITIES.PAYMENTS_READ;
  if (
    value.startsWith("PP:INV_RELEASE:") ||
    value.startsWith("PP:INV_DO_RELEASE:") ||
    value.startsWith("PP:PO_APPROVE:") ||
    value.startsWith("PP:PO_DO_APPROVE:") ||
    value.startsWith("PP:PO_REJECT:") ||
    value.startsWith("PP:PO_CANCEL:") ||
    value.startsWith("PP:PO_DO_CANCEL:")
  ) {
    return CAPABILITIES.PAYMENTS_MUTATE;
  }
  if (value === "USERS" || value.startsWith("USERS_") || value.startsWith("USER_")) return CAPABILITIES.USERS_MANAGE;
  return CAPABILITIES.PUBLIC;
}

module.exports = {
  ROLES,
  STATUS,
  CAPABILITIES,
  normalizeRole,
  normalizeStatus,
  hasCapability,
  getCommandCapability,
  getActionCapability,
};
