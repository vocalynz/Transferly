// Bot-local provider workspace contract used to keep command menus aligned
// with API provider routes and Mini App provider routes.
const PROVIDER_CONTRACT_VERSION = '2026-06-provider-v1';

const PROVIDER_WORKSPACES = Object.freeze([
  {
    id: "paypal",
    slug: "paypal",
    displayName: "PayPal",
    shortDescription: "Invoices, payouts, receipts, and webhook operations.",
    icon: "paypal",
    accentColor: "#0070BA",
    docsUrl: "https://developer.paypal.com/docs/",
    supportUrl: "https://www.paypal.com/us/cshelp/",
    environments: ["sandbox", "live"],
    capabilities: ["invoices", "payouts", "webhooks", "receipts"],
    status: "live",
    lanes: [
      {
        id: "overview",
        label: "Overview",
        intent: "overview",
        status: "live",
        summary: "Connection readiness, provider health, and Transferly capability snapshot.",
        miniAppSection: "services/paypal/overview",
        requiresAdmin: false,
        showInCommandCenter: false,
      },
      {
        id: "custom-details",
        label: "Notification",
        commandLabel: "PayPal Notification",
        intent: "custom",
        status: "live",
        summary: "Guided receipt-style notification composer using Transferly templates.",
        botAction: "PROVIDER_CUSTOM:paypal",
        miniAppSection: "services/paypal/overview",
        requiresAdmin: false,
      },
      {
        id: "invoices",
        label: "Invoices",
        commandLabel: "PayPal Invoices",
        intent: "collect",
        status: "live",
        summary: "Create, send, refresh, inspect, remind, cancel, and release invoice funds where supported.",
        botAction: "PP:INV",
        miniAppSection: "services/paypal/invoices",
      },
      {
        id: "payouts",
        label: "Payouts",
        commandLabel: "PayPal Payouts",
        intent: "send",
        status: "live",
        summary: "Create, review, approve, reject, refresh, and cancel eligible payout records.",
        botAction: "PP:PO",
        miniAppSection: "services/paypal/payouts",
      },
      {
        id: "activity",
        label: "Activity",
        commandLabel: "PayPal Activity",
        intent: "activity",
        status: "live",
        summary: "Webhook intake, provider state sync, operational timelines, and audit entries.",
        botAction: "PROVIDER_WEBHOOKS:paypal",
        miniAppSection: "services/paypal/activity",
      },
      {
        id: "developer",
        label: "Developer",
        commandLabel: "PayPal Developer",
        intent: "developer",
        status: "preview",
        summary: "Webhook diagnostics, traceability, replay notes, idempotency guidance, and docs.",
        miniAppSection: "services/paypal/developer",
      },
    ],
  },
  {
    id: "stripe",
    slug: "stripe",
    displayName: "Stripe",
    shortDescription: "Payments, billing, connected accounts, and developer operations.",
    icon: "stripe",
    accentColor: "#635BFF",
    docsUrl: "https://docs.stripe.com/",
    supportUrl: "https://support.stripe.com/",
    environments: ["test", "live"],
    capabilities: ["payments", "billing", "connect", "webhooks"],
    status: "preview",
    lanes: [
      {
        id: "overview",
        label: "Overview",
        intent: "overview",
        status: "live",
        summary: "Connection readiness and payment capability snapshot.",
        miniAppSection: "services/stripe/overview",
        requiresAdmin: false,
        showInCommandCenter: false,
      },
      {
        id: "payments",
        label: "Payments",
        commandLabel: "Stripe Payments",
        intent: "collect",
        status: "live",
        summary: "Payment collection records surfaced through the existing Transferly invoice adapter.",
        botAction: "PROVIDER_INV:stripe",
        miniAppSection: "services/stripe/payments",
      },
      {
        id: "billing",
        label: "Billing",
        commandLabel: "Stripe Billing",
        intent: "collect",
        status: "preview",
        summary: "Billing and subscription workspace placeholder until backend billing APIs are enabled.",
        miniAppSection: "services/stripe/billing",
      },
      {
        id: "connect",
        label: "Connect",
        commandLabel: "Stripe Payouts",
        intent: "send",
        status: "live",
        summary: "Connected-account payout review using Transferly payout operations.",
        botAction: "PROVIDER_PO:stripe",
        miniAppSection: "services/stripe/connect",
      },
      {
        id: "activity",
        label: "Activity",
        intent: "activity",
        status: "live",
        summary: "Webhook and payment event activity filtered to Stripe records.",
        botAction: "PROVIDER_WEBHOOKS:stripe",
        miniAppSection: "services/stripe/activity",
      },
      {
        id: "developer",
        label: "Developer",
        intent: "developer",
        status: "preview",
        summary: "Request IDs, webhook diagnostics, idempotency guidance, and official docs links.",
        miniAppSection: "services/stripe/developer",
      },
    ],
  },
  {
    id: "wise",
    slug: "wise",
    displayName: "Wise",
    shortDescription: "Receive, send, balances, activity, and compliance readiness.",
    icon: "wise",
    accentColor: "#9FE870",
    docsUrl: "https://docs.wise.com/",
    supportUrl: "https://wise.com/help/",
    environments: ["sandbox", "live"],
    capabilities: ["receive", "send", "balances", "compliance"],
    status: "setup",
    lanes: [
      {
        id: "overview",
        label: "Overview",
        intent: "overview",
        status: "setup",
        summary: "Wise account readiness, capabilities, and setup checklist.",
        miniAppSection: "services/wise/overview",
        requiresAdmin: false,
        showInCommandCenter: false,
      },
      {
        id: "receive",
        label: "Receive",
        commandLabel: "Wise Receive",
        intent: "collect",
        status: "setup",
        summary: "Receive-money workspace placeholder until Wise account details are connected.",
        miniAppSection: "services/wise/receive",
      },
      {
        id: "send",
        label: "Send",
        commandLabel: "Wise Send",
        intent: "send",
        status: "setup",
        summary: "Money-sending workspace placeholder until Wise transfer APIs are connected.",
        miniAppSection: "services/wise/send",
      },
      {
        id: "balances",
        label: "Balances",
        intent: "balance",
        status: "setup",
        summary: "Balance checks and currency account readiness.",
        miniAppSection: "services/wise/balances",
      },
      {
        id: "activity",
        label: "Activity",
        intent: "activity",
        status: "setup",
        summary: "Wise transfer and balance activity timeline once backend support is enabled.",
        miniAppSection: "services/wise/activity",
      },
      {
        id: "compliance",
        label: "Compliance",
        intent: "compliance",
        status: "setup",
        summary: "Recipient, transfer, and compliance readiness checks.",
        miniAppSection: "services/wise/compliance",
      },
    ],
  },
  {
    id: "paystack",
    slug: "paystack",
    displayName: "Paystack",
    shortDescription: "Collections, customers, virtual accounts, subscriptions, and activity.",
    icon: "paystack",
    accentColor: "#0BA4DB",
    docsUrl: "https://paystack.com/docs/",
    supportUrl: "https://support.paystack.com/",
    environments: ["test", "live"],
    capabilities: ["collections", "customers", "virtual_accounts", "subscriptions", "webhooks"],
    status: "setup",
    lanes: [
      {
        id: "overview",
        label: "Overview",
        intent: "overview",
        status: "setup",
        summary: "Paystack connection readiness and capability overview.",
        miniAppSection: "services/paystack/overview",
        requiresAdmin: false,
        showInCommandCenter: false,
      },
      {
        id: "collections",
        label: "Collections",
        commandLabel: "Paystack Collections",
        intent: "collect",
        status: "setup",
        summary: "Payment collection workspace placeholder until Paystack APIs are enabled.",
        miniAppSection: "services/paystack/collections",
      },
      {
        id: "customers",
        label: "Customers",
        intent: "account",
        status: "setup",
        summary: "Customer lookup and profile readiness.",
        miniAppSection: "services/paystack/customers",
      },
      {
        id: "virtual-accounts",
        label: "Virtual Accounts",
        intent: "collect",
        status: "setup",
        summary: "Dedicated account collection setup and monitoring.",
        miniAppSection: "services/paystack/virtual-accounts",
      },
      {
        id: "subscriptions",
        label: "Subscriptions",
        intent: "collect",
        status: "setup",
        summary: "Recurring billing workspace placeholder.",
        miniAppSection: "services/paystack/subscriptions",
      },
      {
        id: "activity",
        label: "Activity",
        intent: "activity",
        status: "setup",
        summary: "Paystack event and payment timeline once webhooks are enabled.",
        miniAppSection: "services/paystack/activity",
      },
      {
        id: "developer",
        label: "Developer",
        intent: "developer",
        status: "setup",
        summary: "Webhook, request tracing, and docs workspace.",
        miniAppSection: "services/paystack/developer",
      },
    ],
  },
  {
    id: "flutterwave",
    slug: "flutterwave",
    displayName: "Flutterwave",
    shortDescription: "Collections, transfers, settlements, refunds, and developer operations.",
    icon: "flutterwave",
    accentColor: "#F5A623",
    docsUrl: "https://developer.flutterwave.com/docs/",
    supportUrl: "https://support.flutterwave.com/",
    environments: ["staging", "live"],
    capabilities: ["collections", "transfers", "settlements", "refunds", "webhooks"],
    status: "setup",
    lanes: [
      {
        id: "overview",
        label: "Overview",
        intent: "overview",
        status: "setup",
        summary: "Flutterwave readiness and Transferly capability overview.",
        miniAppSection: "services/flutterwave/overview",
        requiresAdmin: false,
        showInCommandCenter: false,
      },
      {
        id: "collections",
        label: "Collections",
        commandLabel: "Flutterwave Collections",
        intent: "collect",
        status: "setup",
        summary: "Collection workflow placeholder until Flutterwave APIs are connected.",
        miniAppSection: "services/flutterwave/collections",
      },
      {
        id: "transfers",
        label: "Transfers",
        commandLabel: "Flutterwave Transfers",
        intent: "send",
        status: "setup",
        summary: "Transfer workflow placeholder with setup guidance.",
        miniAppSection: "services/flutterwave/transfers",
      },
      {
        id: "settlements",
        label: "Settlements",
        intent: "activity",
        status: "setup",
        summary: "Settlement tracking workspace placeholder.",
        miniAppSection: "services/flutterwave/settlements",
      },
      {
        id: "refunds",
        label: "Refunds",
        intent: "activity",
        status: "setup",
        summary: "Refund tracking and review workspace placeholder.",
        miniAppSection: "services/flutterwave/refunds",
      },
      {
        id: "activity",
        label: "Activity",
        intent: "activity",
        status: "setup",
        summary: "Flutterwave event and transaction timeline.",
        miniAppSection: "services/flutterwave/activity",
      },
      {
        id: "developer",
        label: "Developer",
        intent: "developer",
        status: "setup",
        summary: "Webhook diagnostics, request tracing, and official docs links.",
        miniAppSection: "services/flutterwave/developer",
      },
    ],
  },
  {
    id: "crypto",
    slug: "crypto",
    displayName: "Crypto",
    shortDescription: "Receive, send, confirmations, activity, and security workflows.",
    icon: "crypto",
    accentColor: "#2AABEE",
    docsUrl: "https://docs.transferly.local/providers/crypto",
    supportUrl: "https://t.me/",
    environments: ["testnet", "mainnet"],
    capabilities: ["receive", "send", "confirmations", "security"],
    status: "preview",
    lanes: [
      {
        id: "overview",
        label: "Overview",
        intent: "overview",
        status: "live",
        summary: "Transferly crypto workspace readiness and capability snapshot.",
        miniAppSection: "services/crypto/overview",
        requiresAdmin: false,
        showInCommandCenter: false,
      },
      {
        id: "receive",
        label: "Receive",
        commandLabel: "Crypto Receive",
        intent: "collect",
        status: "live",
        summary: "Receive/payment request records surfaced through Transferly invoice operations.",
        botAction: "PROVIDER_INV:crypto",
        miniAppSection: "services/crypto/receive",
      },
      {
        id: "send",
        label: "Send",
        commandLabel: "Crypto Send",
        intent: "send",
        status: "setup",
        summary: "Send workflow placeholder until custody, signing, risk, and ledger controls are enabled.",
        miniAppSection: "services/crypto/send",
      },
      {
        id: "confirmations",
        label: "Confirmations",
        intent: "activity",
        status: "preview",
        summary: "Confirmation tracking and settlement status once chain adapters are enabled.",
        miniAppSection: "services/crypto/confirmations",
      },
      {
        id: "activity",
        label: "Activity",
        intent: "activity",
        status: "live",
        summary: "Crypto provider events and operational history filtered through Transferly records.",
        botAction: "PROVIDER_WEBHOOKS:crypto",
        miniAppSection: "services/crypto/activity",
      },
      {
        id: "security",
        label: "Security",
        intent: "security",
        status: "setup",
        summary: "Withdrawal controls, policy checks, and risk readiness.",
        miniAppSection: "services/crypto/security",
      },
    ],
  },
]);

const PROVIDER_KEYS = Object.freeze(PROVIDER_WORKSPACES.map((provider) => provider.slug));
const PROVIDER_OPERATION_KEYS = Object.freeze(["invoices", "payouts", "balance", "activity"]);
const PROVIDER_OPERATION_STATUSES = Object.freeze(["live", "preview", "setup", "unsupported"]);

function isProviderOperationImplemented(status) {
  return status === "live" || status === "preview";
}

function listProviderWorkspaces() {
  return PROVIDER_WORKSPACES;
}

function getProviderWorkspace(slug) {
  const normalized = String(slug || "").toLowerCase();
  return PROVIDER_WORKSPACES.find((provider) => provider.slug === normalized) || null;
}

function getProviderLanes(slug) {
  return getProviderWorkspace(slug)?.lanes || [];
}

function getProviderLane(slug, laneId) {
  const normalizedLane = String(laneId || "").toLowerCase();
  return getProviderLanes(slug).find((lane) => lane.id === normalizedLane) || null;
}

function getProviderLaneStatus(slug, laneId) {
  return getProviderLane(slug, laneId)?.status || "setup";
}

function getDefaultProviderLane(slug) {
  return getProviderLane(slug, "overview") || getProviderLanes(slug)[0] || null;
}

function findProviderLanesByIntent(intent) {
  const normalizedIntent = String(intent || "").toLowerCase();
  return PROVIDER_WORKSPACES.flatMap((workspace) =>
    workspace.lanes
      .filter((lane) => lane.intent === normalizedIntent && lane.showInCommandCenter !== false)
      .map((lane) => ({ workspace, lane })),
  );
}

function buildProviderMiniAppSection(slug, laneId = "overview") {
  const lane = getProviderLane(slug, laneId) || getDefaultProviderLane(slug);
  return lane?.miniAppSection || `services/${String(slug || "").toLowerCase()}/${String(laneId || "overview").toLowerCase()}`;
}

module.exports = {
  PROVIDER_CONTRACT_VERSION,
  PROVIDER_KEYS,
  PROVIDER_OPERATION_KEYS,
  PROVIDER_OPERATION_STATUSES,
  PROVIDER_WORKSPACES,
  isProviderOperationImplemented,
  listProviderWorkspaces,
  getProviderWorkspace,
  getProviderLanes,
  getProviderLane,
  getProviderLaneStatus,
  getDefaultProviderLane,
  findProviderLanesByIntent,
  buildProviderMiniAppSection,
};
