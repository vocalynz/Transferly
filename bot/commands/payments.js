function registerPaymentCommands(bot, { wrap, handlers }) {
  bot.command("providers", wrap(handlers.handleProviders, "providers"));
  bot.command("provider", wrap(handlers.handleProviderCommand || handlers.handleProviders, "provider"));
  ["paypal", "stripe", "wise", "paystack", "flutterwave", "crypto"].forEach((provider) => {
    bot.command(provider, wrap((ctx) => handlers.handleProviderShortcut(ctx, provider), provider));
  });
  bot.command("invoices", wrap(handlers.handleInvoices, "invoices"));
  bot.command("payouts", wrap(handlers.handlePayouts, "payouts"));
  bot.command("activity", wrap(handlers.handleActivity, "activity"));
  bot.command("clients", wrap(handlers.handleClients, "clients"));
  bot.command("risk", wrap(handlers.handleRisk, "risk"));
  bot.command("security", wrap(handlers.handleSecurity, "security"));
  bot.command("issues", wrap(handlers.handleIssues, "issues"));
  bot.command("orders", wrap(handlers.handleOrders, "orders"));
  bot.command("ops", wrap(handlers.handleOps, "ops"));
  bot.command("approve_payout", wrap(handlers.handleApprovePayout, "approve_payout"));
  bot.command("reject_payout", wrap(handlers.handleRejectPayout, "reject_payout"));
  bot.command("cancel_unclaimed", wrap(handlers.handleCancelUnclaimed, "cancel_unclaimed"));
  bot.command("release_invoice", wrap(handlers.handleReleaseInvoice, "release_invoice"));
  bot.command("refresh_invoice", wrap(handlers.handleRefreshInvoice, "refresh_invoice"));
  bot.command("refresh_payout", wrap(handlers.handleRefreshPayout, "refresh_payout"));
  bot.command("reconcile", wrap(handlers.handleReconcile, "reconcile"));
}

module.exports = {
  registerPaymentCommands,
};
