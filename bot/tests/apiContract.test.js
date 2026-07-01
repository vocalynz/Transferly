const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ApiContractError,
  IDEMPOTENCY_HEADER,
  REQUEST_ID_HEADER,
  adminRoutes,
  buildApiUrl,
  buildQuery,
  contractShapes,
  createMutationIdempotencyKey,
  createRequestId,
  providerRoutes,
  PROVIDER_CONTRACT_VERSION,
  validateApiResponseContract,
} = require("../utils/apiContract");

test("API contract exposes the API idempotency header required by Express middleware", () => {
  assert.equal(IDEMPOTENCY_HEADER, "Idempotency-Key");
  assert.equal(REQUEST_ID_HEADER, "x-request-id");
});

test("buildApiUrl skips empty query values and keeps valid filters", () => {
  const url = buildApiUrl("https://api.transferly.example/", adminRoutes.webhooks, {
    provider: "paypal",
    limit: 10,
    status: "ALL",
    empty: "",
    missing: undefined,
  });

  assert.equal(url, "https://api.transferly.example/api/admin/webhooks?provider=paypal&limit=10");
  assert.equal(buildQuery({ status: "OPEN" }), "?status=OPEN");
});

test("provider routes expose bot-friendly provider scoped endpoints", () => {
  assert.equal(providerRoutes.providers, "/api/providers");
  assert.equal(providerRoutes.lane("paypal", "custom-details"), "/api/providers/paypal/lanes/custom-details");
  assert.equal(providerRoutes.providerHealth("paypal"), "/api/providers/paypal/health");
  assert.equal(providerRoutes.providerStatus("paypal"), "/api/providers/paypal/status");
  assert.equal(providerRoutes.actionPreflight("paypal", "invoices"), "/api/providers/paypal/actions/invoices/preflight");

  const url = buildApiUrl("https://api.transferly.example/", providerRoutes.invoices("stripe"), {
    limit: 10,
    status: "ALL",
  });

  assert.equal(url, "https://api.transferly.example/api/providers/stripe/invoices?limit=10");
});

test("mutation idempotency keys include the bot actor, route, and known entity hint", () => {
  const key = createMutationIdempotencyKey("/api/admin/payouts/payout-1/approve", {
    payoutId: "payout-1",
  });

  assert.match(key, /^bot:\/api\/admin\/payouts\/payout-1\/approve:payout-1:/);
});

test("request IDs use bot-safe prefixes for API correlation", () => {
  assert.match(createRequestId("bot-test"), /^bot-test:/);
  assert.doesNotMatch(createRequestId("bot test/unsafe"), /[ /]/);
});

test("API response contracts accept expected shapes", () => {
  assert.doesNotThrow(() =>
    validateApiResponseContract(
      { data: [], pagination: { page: 1, total: 0 } },
      contractShapes.paginatedData,
      { method: "GET", url: "/api/admin/invoices", requestId: "req-contract" },
    ),
  );

  assert.doesNotThrow(() =>
    validateApiResponseContract(
      { ok: true, status: "healthy" },
      contractShapes.health,
      { method: "GET", url: "/health" },
    ),
  );

  assert.doesNotThrow(() =>
    validateApiResponseContract(
      {
        data: [
          {
            slug: "paypal",
            display_name: "PayPal",
            operations: {},
            lanes: [],
          },
        ],
        requestId: "req-provider",
        contract_version: PROVIDER_CONTRACT_VERSION,
      },
      contractShapes.providerCapabilityList,
      { method: "GET", url: "/api/providers", requestId: "req-provider" },
    ),
  );

  assert.doesNotThrow(() =>
    validateApiResponseContract(
      {
        data: [
          {
            id: "invoices",
            label: "Invoices",
            intent: "Create and track invoices",
            bot_action: "provider:paypal:invoices",
          },
        ],
        provider: "paypal",
      },
      contractShapes.providerLaneList,
      { method: "GET", url: "/api/providers/paypal/lanes", requestId: "req-lanes" },
    ),
  );

  assert.doesNotThrow(() =>
    validateApiResponseContract(
      {
        data: {
          provider: "stripe",
          display_name: "Stripe",
          ready: true,
          operations: [
            { operation: "invoices", status: "live", implemented: true },
          ],
          lanes: [],
          recommended_next_steps: [],
        },
        requestId: "req-provider-readiness",
        contract_version: PROVIDER_CONTRACT_VERSION,
      },
      contractShapes.providerReadiness,
      { method: "GET", url: "/api/providers/stripe/readiness", requestId: "req-provider-readiness" },
    ),
  );

  assert.doesNotThrow(() =>
    validateApiResponseContract(
      {
        data: [
          {
            provider: "stripe",
            display_name: "Stripe",
            ready: true,
            operations: [],
            lanes: [],
            recommended_next_steps: [],
          },
        ],
        requestId: "req-provider-readiness-list",
        contract_version: PROVIDER_CONTRACT_VERSION,
      },
      contractShapes.providerReadinessList,
      { method: "GET", url: "/api/providers/readiness", requestId: "req-provider-readiness-list" },
    ),
  );

  assert.doesNotThrow(() =>
    validateApiResponseContract(
      {
        data: {
          provider: "stripe",
          display_name: "Stripe",
          provider_status: "ready",
          score: 100,
          status: "operational",
          failed_webhooks: 0,
          recent_webhooks: 2,
          unresolved_issues: 0,
          reasons: [],
          next_actions: [],
        },
        provider: "stripe",
        contract_version: PROVIDER_CONTRACT_VERSION,
        requestId: "req-provider-health",
      },
      contractShapes.providerHealth,
      { method: "GET", url: "/api/providers/stripe/health", requestId: "req-provider-health" },
    ),
  );

  assert.doesNotThrow(() =>
    validateApiResponseContract(
      {
        data: {
          provider: "stripe",
          display_name: "Stripe",
          status: "ready",
          ready: true,
          provider_status: "ready",
          health_status: "operational",
          health_score: 100,
          operations: [],
          lanes: [],
          warnings: [],
          next_actions: [],
        },
        provider: "stripe",
        contract_version: PROVIDER_CONTRACT_VERSION,
        requestId: "req-provider-status",
      },
      contractShapes.providerStatus,
      { method: "GET", url: "/api/providers/stripe/status", requestId: "req-provider-status" },
    ),
  );

  assert.doesNotThrow(() =>
    validateApiResponseContract(
      {
        data: {
          allowed: false,
          provider: "wise",
          operation: "payouts",
          label: "Payouts",
          status: "setup",
          reason: "Provider operation is not available.",
          code: "PROVIDER_OPERATION_NOT_AVAILABLE",
          supported_providers: ["paypal", "stripe"],
          warnings: [],
          next_actions: [],
        },
        provider: "wise",
        contract_version: PROVIDER_CONTRACT_VERSION,
        requestId: "req-provider-preflight",
      },
      contractShapes.providerActionPreflight,
      { method: "GET", url: "/api/providers/wise/actions/payouts/preflight", requestId: "req-provider-preflight" },
    ),
  );

  assert.doesNotThrow(() =>
    validateApiResponseContract(
      {
        error: {
          message: "Provider API rate limit reached.",
          code: "RATE_LIMITED",
          retryAfter: "2",
        },
        requestId: "req-provider-rate-limit",
        retryAfter: "2",
      },
      contractShapes.errorResponse,
      { method: "GET", url: "/api/providers/stripe/readiness", requestId: "req-provider-rate-limit" },
    ),
  );
});

test("API response contracts fail with safe operator diagnostics", () => {
  assert.throws(
    () =>
      validateApiResponseContract(
        { pagination: {} },
        contractShapes.paginatedData,
        { method: "GET", url: "/api/admin/invoices", requestId: "req-bad" },
      ),
    (error) => {
      assert.ok(error instanceof ApiContractError);
      assert.equal(error.code, "API_CONTRACT_MISMATCH");
      assert.equal(error.details.path, "data");
      assert.equal(error.details.method, "GET");
      assert.equal(error.details.requestId, "req-bad");
      assert.match(error.userMessage, /bot contract/i);
      return true;
    },
  );
});
