const assert = require("node:assert/strict");
const test = require("node:test");

process.env.ADMIN_TELEGRAM_ID ||= "1001";
process.env.ADMIN_TELEGRAM_USERNAME ||= "admin";
process.env.API_URL ||= "http://localhost:3000";
process.env.BOT_TOKEN ||= "123456:test-token";
process.env.ADMIN_API_TOKEN ||= "admin-token";
process.env.MINI_APP_URL ||= "https://mini.transferly.test/miniapp";

const {
  getBotAnalyticsStats,
  recordBotAnalyticsEvent,
} = require("../db/db");

function recordEvent(entry) {
  return new Promise((resolve, reject) => {
    recordBotAnalyticsEvent(entry, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function getStats() {
  return new Promise((resolve, reject) => {
    getBotAnalyticsStats((error, stats) => {
      if (error) reject(error);
      else resolve(stats);
    });
  });
}

test("bot analytics aggregates callback health and action duration", async () => {
  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const callbackAction = `TEST_CALLBACK_${suffix}`;
  const recoveryAction = `TEST_RECOVERY_${suffix}`;
  const slowDurationMs = 987654;

  await recordEvent({
    telegramId: 9001,
    username: "analytics_test",
    action: callbackAction,
    category: "callback",
    status: "unknown",
    durationMs: slowDurationMs,
    details: { route: "test" },
  });
  await recordEvent({
    telegramId: 9001,
    username: "analytics_test",
    action: recoveryAction,
    category: "callback_recovery",
    status: "stale",
    details: { reason: "test" },
  });

  const stats = await getStats();
  const statusTotals = stats.callback_status_totals_24h || [];
  const slowActions = stats.slow_actions_24h || [];

  assert.ok(stats.callback_failures_24h >= 1);
  assert.ok(stats.callback_recoveries_24h >= 1);
  assert.ok(stats.unknown_actions_24h >= 1);
  assert.ok(statusTotals.some((row) => row.status === "unknown" && row.count >= 1));
  assert.ok(slowActions.some((row) => row.action === callbackAction && row.avg_duration_ms >= slowDurationMs));
});
