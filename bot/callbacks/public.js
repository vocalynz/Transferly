async function handlePublicCallback(ctx, action, { handlers }) {
  switch (action) {
    case "CANCEL":
      await handlers.handleCancel(ctx);
      return true;
    case "MENU":
      await handlers.handleMenu(ctx);
      return true;
    case "SERVICES":
      await handlers.handleServices(ctx);
      return true;
    case "HELP":
      await handlers.handleHelp(ctx);
      return true;
    case "MENU_COLLECT":
    case "MENU_SEND":
    case "MENU_ACCOUNT":
    case "MENU_ADMIN":
    case "MENU_SUPPORT":
      await handlers.handleCommandSection(ctx, action);
      return true;
    case "PROFILE":
      await handlers.handleProfile(ctx);
      return true;
    case "WHOAMI":
      await handlers.handleWhoami(ctx);
      return true;
    case "BALANCE":
      await handlers.handleBalance(ctx);
      return true;
    case "RECEIPTS":
      await handlers.handleReceipts(ctx);
      return true;
    case "REFERRAL":
      await handlers.handleReferral(ctx);
      return true;
    case "HEALTH":
      await handlers.handleHealth(ctx);
      return true;
    case "STATUS":
      await handlers.handleStatus(ctx);
      return true;
    case "BOT_OPS":
      await handlers.handleBotOps(ctx);
      return true;
    case "BOT_ANALYTICS":
      await handlers.handleBotAnalytics(ctx);
      return true;
    case "SUBSCRIPTION_ALERTS":
      await handlers.handleSubscriptionAlerts(ctx);
      return true;
    case "PAYMENT_AUDIT":
      await handlers.handlePaymentAudit(ctx);
      return true;
    case "ALERT_TOGGLE":
      await handlers.handleAlertToggle(ctx);
      return true;
    case "EXPORT_USERS":
      await handlers.handleExport(ctx, "users");
      return true;
    case "EXPORT_PAYMENT_AUDIT":
      await handlers.handleExport(ctx, "payment_audit");
      return true;
    case "EXPORT_ANALYTICS":
      await handlers.handleExport(ctx, "analytics");
      return true;
    case "EXPORT_EXPIRING":
      await handlers.handleExport(ctx, "expiring");
      return true;
    default:
      if (action.startsWith("ALERT_PRESET:")) {
        await handlers.handleAlertPreset(ctx, action.slice("ALERT_PRESET:".length));
        return true;
      }
      if (action.startsWith("PAY_AUDIT_F:")) {
        await handlers.handlePaymentAudit(ctx, { resourceType: action.slice("PAY_AUDIT_F:".length) });
        return true;
      }
      return false;
  }
}

module.exports = {
  handlePublicCallback,
};
