'use strict';

function createRateLimiter(defaults = {}) {
  const buckets = new Map();
  const defaultWindowMs = defaults.windowMs || 60 * 1000;
  const defaultMax = defaults.max || 24;

  function check(key, options = {}) {
    const windowMs = options.windowMs || defaultWindowMs;
    const max = options.max || defaultMax;
    const now = Date.now();
    const bucketKey = String(key || 'anonymous');
    const current = buckets.get(bucketKey);

    if (!current || current.resetAt <= now) {
      const next = { count: 1, resetAt: now + windowMs };
      buckets.set(bucketKey, next);
      return {
        allowed: true,
        remaining: Math.max(0, max - 1),
        resetAt: next.resetAt,
        retryAfterMs: 0,
      };
    }

    if (current.count >= max) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: current.resetAt,
        retryAfterMs: Math.max(0, current.resetAt - now),
      };
    }

    current.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, max - current.count),
      resetAt: current.resetAt,
      retryAfterMs: 0,
    };
  }

  function prune() {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }

  return {
    check,
    prune,
    size: () => buckets.size,
    reset: (key) => {
      if (typeof key === 'undefined') {
        buckets.clear();
        return;
      }
      buckets.delete(String(key || 'anonymous'));
    },
  };
}

module.exports = { createRateLimiter };
