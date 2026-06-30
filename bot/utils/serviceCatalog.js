const SERVICE_GROUPS = [
  {
    id: "BANK",
    title: "Verified Wallets",
    description: "Create Transferly wallet records for support and receipt workflows.",
    slugs: ["opay", "kuda", "palmpay"],
  },
  {
    id: "PAYMENT_PROVIDERS",
    title: "Payment Providers",
    description: "Provider workspaces for custom details, invoices, payouts, balances, and activity.",
    slugs: ["paypal", "stripe", "wise", "paystack", "flutterwave", "crypto"],
  },
  {
    id: "FLASH",
    title: "Verified Notifications",
    description: "Create branded Transferly notification receipts.",
    slugs: [
      "binance",
      "bybit",
      "coinbase",
      "crypto-com",
      "cash-app",
      "zelle",
      "venmo",
      "trust-wallet",
      "gcash",
    ],
  },
  {
    id: "CRYPTO",
    title: "Receipt Vault",
    description: "Crypto and provider receipt review workflows.",
    slugs: ["crypto-receipts"],
  },
  {
    id: "UTILITIES",
    title: "Utilities",
    description: "Support, wallet, QR, link, and content tools.",
    slugs: [
      "ai-reply",
      "articles",
      "faker-data",
      "support-sites",
      "pass-clone",
      "wallet-tracker",
      "qr-code",
      "link-shortener",
      "investinnova",
    ],
  },
];

const SERVICE_CATALOG = [
  { slug: "ai-reply", title: "Support AI Reply", category: "Featured", status: "available", badge: "New", launchMode: "info" },
  { slug: "articles", title: "Ops Playbooks", category: "Knowledge Library", status: "available", badge: "Utility", launchMode: "info" },
  { slug: "faker-data", title: "Sandbox Test Data", category: "Sandbox Tools", status: "available", badge: "Utility", launchMode: "info" },
  { slug: "opay", title: "Opay", category: "Verified Wallets", status: "available", badge: "Popular", receiptType: "bank" },
  { slug: "kuda", title: "Kuda", category: "Verified Wallets", status: "available", badge: "Popular", receiptType: "bank" },
  { slug: "palmpay", title: "Palmpay", category: "Verified Wallets", status: "comingSoon", badge: "Soon", receiptType: "bank" },
  { slug: "binance", title: "Binance", category: "Verified Notifications", status: "available", badge: "Live", receiptType: "email" },
  { slug: "bybit", title: "Bybit", category: "Verified Notifications", status: "available", badge: "Live", receiptType: "email" },
  { slug: "coinbase", title: "Coinbase", category: "Verified Notifications", status: "available", badge: "Live", receiptType: "email" },
  { slug: "paypal", title: "PayPal", category: "Payment Providers", status: "available", badge: "Live", receiptType: "email" },
  { slug: "stripe", title: "Stripe Connect", category: "Payment Providers", status: "available", badge: "Adapter", receiptType: "email" },
  { slug: "paystack", title: "Paystack", category: "Payment Providers", status: "available", badge: "Adapter", receiptType: "email" },
  { slug: "flutterwave", title: "Flutterwave", category: "Payment Providers", status: "available", badge: "Adapter", receiptType: "email" },
  { slug: "crypto", title: "Crypto Commerce", category: "Payment Providers", status: "available", badge: "Adapter", receiptType: "email" },
  { slug: "crypto-com", title: "Crypto.com", category: "Verified Notifications", status: "available", badge: "Live", receiptType: "email" },
  { slug: "wise", title: "Wise", category: "Payment Providers", status: "available", badge: "Live", receiptType: "email" },
  { slug: "cash-app", title: "Cash App", category: "Verified Notifications", status: "available", badge: "New", receiptType: "email" },
  { slug: "zelle", title: "Zelle", category: "Verified Notifications", status: "available", badge: "New", receiptType: "email" },
  { slug: "venmo", title: "Venmo", category: "Verified Notifications", status: "available", badge: "New", receiptType: "email" },
  { slug: "trust-wallet", title: "Trust Wallet", category: "Verified Notifications", status: "available", badge: "New", receiptType: "email" },
  { slug: "gcash", title: "GCash", category: "Verified Notifications", status: "available", badge: "New", receiptType: "email" },
  { slug: "crypto-receipts", title: "Receipt Vault", category: "Receipt Vault", status: "available", badge: "Live", receiptType: "email" },
  { slug: "support-sites", title: "Support Desk", category: "Support Desk", status: "available", badge: "Suite", launchMode: "info" },
  { slug: "pass-clone", title: "Security Center", category: "Security Center", status: "available", badge: "Suite", launchMode: "info" },
  { slug: "wallet-tracker", title: "Provider Balance Tracker", category: "Provider Balance Tracker", status: "available", badge: "New", launchMode: "info" },
  { slug: "qr-code", title: "Payment QR", category: "Payment QR", status: "available", badge: "New", launchMode: "info" },
  { slug: "link-shortener", title: "Payment Link Shortener", category: "Payment Links", status: "available", badge: "New", launchMode: "info" },
  { slug: "investinnova", title: "Workflow Templates", category: "Template Marketplace", status: "available", badge: "Premium", launchMode: "info" },
];

const PAYMENT_PROVIDER_SLUGS = new Set(["paypal", "stripe", "wise", "paystack", "flutterwave", "crypto"]);

const CATEGORY_COMMAND_CENTERS = Object.freeze({
  "Verified Notifications": {
    title: "Notification Command Center",
    summary: "Run provider-styled notification receipts, templates, and vault follow-up from one service workspace.",
    capabilities: ["Custom notification details", "Deposit notification flow", "Template library", "Receipt vault handoff"],
    lanes: [
      { id: "custom-notification", label: "Custom Notification", summary: "Compose a branded notification with operator-entered sender, amount, memo, and recipient details.", miniAppSection: "studio", action: "custom" },
      { id: "deposit-notification", label: "Deposit Notification", summary: "Generate a quick deposit-style notification from the supported receipt engine.", miniAppSection: "generate", action: "run" },
      { id: "template-library", label: "Template Library", summary: "Open reusable notification templates and provider-safe copy patterns for this service.", miniAppSection: "studio" },
      { id: "receipt-vault", label: "Receipt Vault", summary: "Review recent generated receipts and support-ready receipt context.", miniAppSection: "vault", action: "history" },
    ],
  },
  "Verified Wallets": {
    title: "Wallet Record Command Center",
    summary: "Create wallet records, inspect support context, and track readiness around wallet-style receipts.",
    capabilities: ["Wallet record composer", "Support context", "Wallet activity", "Balance readiness"],
    lanes: [
      { id: "wallet-record", label: "Wallet Record", summary: "Create a wallet-record receipt with customer, amount, reference, and status details.", miniAppSection: "studio", action: "custom" },
      { id: "support-context", label: "Support Context", summary: "Open support notes and Telegram-linked context for wallet receipt questions.", miniAppSection: "support" },
      { id: "wallet-activity", label: "Wallet Activity", summary: "Review recent wallet receipt activity and operator handoffs.", miniAppSection: "activity", action: "history" },
      { id: "balance-readiness", label: "Balance Readiness", summary: "Check Transferly wallet and points readiness before generating or reviewing wallet records.", miniAppSection: "wallet", action: "balance" },
    ],
  },
  "Receipt Vault": {
    title: "Receipt Vault Command Center",
    summary: "Search, duplicate, inspect, and hand off receipt records without leaving the service workspace.",
    capabilities: ["Vault search", "Duplicate receipt review", "Support handoff", "Activity audit trail"],
    lanes: [
      { id: "vault-search", label: "Vault Search", summary: "Open recent receipt history and search-ready vault context.", miniAppSection: "vault", action: "history" },
      { id: "duplicate-receipt", label: "Duplicate Receipt", summary: "Review an existing receipt before launching a duplicate or adjusted version.", miniAppSection: "studio", action: "custom" },
      { id: "support-handoff", label: "Support Handoff", summary: "Prepare receipt context for a support conversation.", miniAppSection: "support" },
      { id: "activity-trail", label: "Activity Trail", summary: "Inspect generated receipt activity and audit context.", miniAppSection: "activity" },
    ],
  },
});

const SERVICE_COMMAND_CENTER_OVERRIDES = Object.freeze({
  "ai-reply": {
    title: "Support AI Command Center",
    summary: "Draft support replies with Transferly context while keeping the final message operator-controlled.",
    capabilities: ["Draft reply", "Support context", "Saved replies", "Activity review"],
    lanes: [
      { id: "draft-reply", label: "Draft Reply", summary: "Open the support workspace for a guided, operator-reviewed response draft.", miniAppSection: "support" },
      { id: "support-context", label: "Support Context", summary: "Review linked Telegram profile, current workspace, receipt, and provider context.", miniAppSection: "support" },
      { id: "saved-replies", label: "Saved Replies", summary: "Use reusable response patterns for common Transferly support scenarios.", miniAppSection: "support" },
      { id: "activity-review", label: "Activity Review", summary: "Inspect recent account and receipt activity before sending a reply.", miniAppSection: "activity" },
    ],
  },
  articles: {
    title: "Ops Knowledge Command Center",
    summary: "Keep provider runbooks, support playbooks, activity lessons, and security notes close to the operator flow.",
    capabilities: ["Provider runbooks", "Support playbooks", "Activity lessons", "Security notes"],
    lanes: [
      { id: "provider-runbooks", label: "Provider Runbooks", summary: "Open provider operation playbooks for invoice, payout, and webhook handling.", miniAppSection: "ops" },
      { id: "support-playbooks", label: "Support Playbooks", summary: "Review support scripts and decision trees for active user cases.", miniAppSection: "support" },
      { id: "activity-lessons", label: "Activity Lessons", summary: "Inspect activity patterns and examples operators should recognize.", miniAppSection: "activity" },
      { id: "security-notes", label: "Security Notes", summary: "Open security and access-control notes before sensitive actions.", miniAppSection: "security" },
    ],
  },
  "faker-data": {
    title: "Sandbox Data Command Center",
    summary: "Generate clearly marked sandbox-only payloads for QA, demos, and operator training.",
    capabilities: ["Sandbox payloads", "Studio preview", "Vault review", "Operator training"],
    lanes: [
      { id: "sandbox-payload", label: "Sandbox Payload", summary: "Prepare non-production receipt and customer data for testing.", miniAppSection: "studio" },
      { id: "studio-preview", label: "Studio Preview", summary: "Open the receipt studio with sandbox-safe context.", miniAppSection: "studio" },
      { id: "vault-review", label: "Vault Review", summary: "Review generated demo receipts in the vault workspace.", miniAppSection: "vault" },
      { id: "operator-training", label: "Operator Training", summary: "Route sandbox examples into training and activity review workflows.", miniAppSection: "activity" },
    ],
  },
  "support-sites": {
    title: "Support Desk Command Center",
    summary: "Bring identity, receipt, provider, and security context into one support-first workspace.",
    capabilities: ["Support desk", "Escalation states", "Receipt context", "Security context"],
    lanes: [
      { id: "support-desk", label: "Support Desk", summary: "Open the Telegram-native support desk for the active account context.", miniAppSection: "support" },
      { id: "escalation-states", label: "Escalation States", summary: "Review support priority, blocked state, and handoff readiness.", miniAppSection: "support" },
      { id: "receipt-context", label: "Receipt Context", summary: "Open vault context for recent receipt questions.", miniAppSection: "vault" },
      { id: "security-context", label: "Security Context", summary: "Check access and sensitive workflow context before escalation.", miniAppSection: "security" },
    ],
  },
  "pass-clone": {
    title: "Security Center Command Center",
    summary: "Keep account-linking, provider readiness, support safety, and audit checks visible before sensitive actions.",
    capabilities: ["Security center", "Provider readiness", "Support safety", "Activity audit"],
    lanes: [
      { id: "security-center", label: "Security Center", summary: "Open sensitive workflow posture, audit, and access-control context.", miniAppSection: "security" },
      { id: "provider-readiness", label: "Provider Readiness", summary: "Review provider setup and operational readiness before action.", miniAppSection: "ops" },
      { id: "support-safety", label: "Support Safety", summary: "Route questionable cases to support before operators continue.", miniAppSection: "support" },
      { id: "activity-audit", label: "Activity Audit", summary: "Review recent activity for suspicious or duplicate patterns.", miniAppSection: "activity" },
    ],
  },
  "wallet-tracker": {
    title: "Provider Balance Command Center",
    summary: "Track provider balances and payout readiness beside Transferly wallet context.",
    capabilities: ["Balance overview", "Provider ops", "Payout activity", "Support handoff"],
    lanes: [
      { id: "balance-overview", label: "Balance Overview", summary: "Open wallet and balance context for the linked Transferly user.", miniAppSection: "wallet", action: "balance" },
      { id: "provider-ops", label: "Provider Ops", summary: "Review provider command-center readiness and operational controls.", miniAppSection: "ops" },
      { id: "payout-activity", label: "Payout Activity", summary: "Inspect payout and funding activity from the mini app.", miniAppSection: "payouts" },
      { id: "support-handoff", label: "Support Handoff", summary: "Prepare support context for balance or payout questions.", miniAppSection: "support" },
    ],
  },
  "qr-code": {
    title: "Payment QR Command Center",
    summary: "Create payment QR handoffs tied to invoices, vault records, and activity review.",
    capabilities: ["QR studio", "Invoice handoff", "Vault reference", "QR activity"],
    lanes: [
      { id: "qr-studio", label: "QR Studio", summary: "Open the studio for a QR-led payment or receipt handoff.", miniAppSection: "studio" },
      { id: "invoice-handoff", label: "Invoice Handoff", summary: "Move from QR context into invoice review.", miniAppSection: "invoices" },
      { id: "vault-reference", label: "Vault Reference", summary: "Attach recent receipt context from the vault.", miniAppSection: "vault" },
      { id: "qr-activity", label: "QR Activity", summary: "Review QR-related payment and support activity.", miniAppSection: "activity" },
    ],
  },
  "link-shortener": {
    title: "Payment Links Command Center",
    summary: "Manage payment link handoffs, provider context, and support visibility from one workspace.",
    capabilities: ["Payment links", "Studio link", "Provider links", "Link support"],
    lanes: [
      { id: "payment-links", label: "Payment Links", summary: "Open payment link activity and collection context.", miniAppSection: "activity" },
      { id: "studio-link", label: "Studio Link", summary: "Create a studio-backed payment or receipt link.", miniAppSection: "studio" },
      { id: "provider-links", label: "Provider Links", summary: "Review provider-side payment link readiness.", miniAppSection: "ops" },
      { id: "link-support", label: "Link Support", summary: "Prepare support context for failed or disputed links.", miniAppSection: "support" },
    ],
  },
  investinnova: {
    title: "Template Marketplace Command Center",
    summary: "Open premium workflow templates, provider onboarding playbooks, and operator triage flows.",
    capabilities: ["Template marketplace", "Provider onboarding", "Support triage", "Payout operations"],
    lanes: [
      { id: "template-marketplace", label: "Template Marketplace", summary: "Browse reusable workflow templates for Transferly operators.", miniAppSection: "studio" },
      { id: "provider-onboarding", label: "Provider Onboarding", summary: "Review provider setup and onboarding playbooks.", miniAppSection: "ops" },
      { id: "support-triage", label: "Support Triage", summary: "Route template questions into guided support context.", miniAppSection: "support" },
      { id: "payout-operations", label: "Payout Operations", summary: "Open payout operations context connected to the template workflow.", miniAppSection: "payouts" },
    ],
  },
});

const SERVICE_BY_SLUG = new Map(SERVICE_CATALOG.map((service) => [service.slug, service]));
const SERVICE_GROUP_BY_ID = new Map(SERVICE_GROUPS.map((group) => [group.id, group]));

function getService(slug) {
  return SERVICE_BY_SLUG.get(String(slug || "").toLowerCase()) || null;
}

function getGroup(groupId) {
  return SERVICE_GROUP_BY_ID.get(String(groupId || "").toUpperCase()) || null;
}

function canGenerateService(service) {
  return Boolean(service?.receiptType && service.status === "available");
}

function getServiceGroupId(service) {
  const group = SERVICE_GROUPS.find((item) => item.slugs.includes(service?.slug));
  return group?.id || "UTILITIES";
}

function serviceSummary(service) {
  if (!service) return "Unknown service.";
  if (canGenerateService(service)) {
    const flow = service.receiptType === "bank" ? "Wallet-record receipt" : "Notification receipt";
    return `${flow} service in the ${service.category} workspace.`;
  }
  if (service.status === "comingSoon") {
    return "This service is visible in the catalog but is not enabled for generation yet.";
  }
  return "This catalog service is available as an informational or web-app workspace entry.";
}

function getServiceCommandCenter(service) {
  if (!service || PAYMENT_PROVIDER_SLUGS.has(service.slug)) return null;
  const template = SERVICE_COMMAND_CENTER_OVERRIDES[service.slug] || CATEGORY_COMMAND_CENTERS[service.category];
  if (!template) return null;

  return {
    title: template.title,
    summary: template.summary,
    capabilities: template.capabilities || [],
    lanes: (template.lanes || []).map((lane) => ({
      ...lane,
      status: service.status === "available" ? lane.status || "live" : "setup",
    })),
  };
}

function getServiceLane(service, laneId) {
  const commandCenter = getServiceCommandCenter(service);
  return commandCenter?.lanes.find((lane) => lane.id === laneId) || null;
}

function searchServices(term, limit = 8) {
  const query = String(term || "").trim().toLowerCase();
  if (!query) return [];

  return SERVICE_CATALOG
    .map((service) => {
      const fields = [service.slug, service.title, service.category, service.badge].map((value) =>
        String(value || "").toLowerCase(),
      );
      const exact = fields.some((field) => field === query);
      const startsWith = fields.some((field) => field.startsWith(query));
      const includes = fields.some((field) => field.includes(query));
      if (!exact && !startsWith && !includes) {
        return null;
      }
      return {
        service,
        score: exact ? 0 : startsWith ? 1 : 2,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score || a.service.title.localeCompare(b.service.title))
    .slice(0, limit)
    .map((entry) => entry.service);
}

module.exports = {
  SERVICE_GROUPS,
  SERVICE_CATALOG,
  getService,
  getGroup,
  searchServices,
  canGenerateService,
  getServiceGroupId,
  serviceSummary,
  getServiceCommandCenter,
  getServiceLane,
};
