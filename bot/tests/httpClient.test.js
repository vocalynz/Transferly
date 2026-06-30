const assert = require("node:assert/strict");
const test = require("node:test");

process.env.ADMIN_TELEGRAM_ID ||= "1001";
process.env.ADMIN_TELEGRAM_USERNAME ||= "admin";
process.env.API_URL ||= "http://localhost:3000";
process.env.BOT_TOKEN ||= "123456:test-token";
process.env.ADMIN_API_TOKEN ||= "admin-token";

const axios = require("axios");
const httpClient = require("../utils/httpClient");
const { contractShapes } = require("../utils/apiContract");

function transientError(status = 500) {
  const error = new Error("Request failed with status code " + status);
  error.response = {
    status,
    headers: {},
    data: {},
  };
  return error;
}

test("POST requests are not retried unless they carry an idempotency key", async (t) => {
  const originalPost = axios.post;
  let attempts = 0;
  t.after(() => {
    axios.post = originalPost;
  });

  axios.post = async () => {
    attempts += 1;
    throw transientError(500);
  };

  await assert.rejects(
    () => httpClient.post(null, "http://localhost:3000/admin/test", { ok: true }),
    /API error|Request failed/i,
  );
  assert.equal(attempts, 1);
});

test("POST requests with idempotency keys retry once and pass tracing headers", async (t) => {
  const originalPost = axios.post;
  let attempts = 0;
  let capturedOptions = null;
  t.after(() => {
    axios.post = originalPost;
  });

  axios.post = async (_url, _data, options) => {
    attempts += 1;
    capturedOptions = options;
    if (attempts === 1) {
      throw transientError(500);
    }
    return { data: { ok: true } };
  };

  const response = await httpClient.post(
    null,
    "http://localhost:3000/admin/test",
    { ok: true },
    { idempotencyKey: "idem-123", requestId: "req-123" },
  );

  assert.deepEqual(response.data, { ok: true });
  assert.equal(attempts, 2);
  assert.equal(capturedOptions.headers["Idempotency-Key"], "idem-123");
  assert.equal(capturedOptions.headers["x-request-id"], "req-123");
  assert.equal(capturedOptions.headers.Authorization, "Bearer admin-token");
  assert.equal("idempotencyKey" in capturedOptions, false);
  assert.equal("requestId" in capturedOptions, false);
});

test("GET requests retry transient API failures by default", async (t) => {
  const originalGet = axios.get;
  let attempts = 0;
  t.after(() => {
    axios.get = originalGet;
  });

  axios.get = async () => {
    attempts += 1;
    if (attempts < 3) {
      throw transientError(503);
    }
    return { data: { ok: true } };
  };

  const response = await httpClient.get(null, "http://localhost:3000/health", { requestId: "req-get" });

  assert.deepEqual(response.data, { ok: true });
  assert.equal(attempts, 3);
});

test("response contracts validate API payloads and stay out of axios options", async (t) => {
  const originalGet = axios.get;
  let capturedOptions = null;
  t.after(() => {
    axios.get = originalGet;
  });

  axios.get = async (_url, options) => {
    capturedOptions = options;
    return { data: { data: [], pagination: { page: 1, total: 0 } } };
  };

  const response = await httpClient.get(null, "http://localhost:3000/api/admin/invoices", {
    contract: contractShapes.paginatedData,
    requestId: "req-contract-ok",
  });

  assert.deepEqual(response.data.data, []);
  assert.equal("contract" in capturedOptions, false);

  axios.get = async () => ({ data: { pagination: {} } });

  await assert.rejects(
    () =>
      httpClient.get(null, "http://localhost:3000/api/admin/invoices", {
        contract: contractShapes.paginatedData,
        requestId: "req-contract-bad",
      }),
    (error) => {
      assert.equal(error.code, "API_CONTRACT_MISMATCH");
      assert.match(error.userMessage, /bot contract/i);
      return true;
    },
  );
});
