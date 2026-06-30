const assert = require("node:assert/strict");
const test = require("node:test");

const { createRateLimiter } = require("../utils/rateLimit");

test("rate limiter blocks after the configured window budget", () => {
  const limiter = createRateLimiter({ windowMs: 1000, max: 2 });

  const first = limiter.check("user:menu");
  const second = limiter.check("user:menu");
  const third = limiter.check("user:menu");

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.equal(third.remaining, 0);
  assert.ok(third.retryAfterMs > 0);
});

test("rate limiter reset clears stored buckets", () => {
  const limiter = createRateLimiter({ windowMs: 1000, max: 1 });

  assert.equal(limiter.check("user:callback").allowed, true);
  assert.equal(limiter.check("user:callback").allowed, false);

  limiter.reset("user:callback");

  assert.equal(limiter.check("user:callback").allowed, true);
});
