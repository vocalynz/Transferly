async function handlePaymentCallback(ctx, action, { requireAdmin, handlers }) {
  if (action === "PROVIDERS") {
    await handlers.handleProviders(ctx);
    return true;
  }

  if (action === "INVOICES") {
    await handlers.handleInvoices(ctx);
    return true;
  }

  if (action === "PP:INV") {
    await handlers.handlePayPalInvoices(ctx);
    return true;
  }

  if (action === "PAYOUTS") {
    await handlers.handlePayouts(ctx);
    return true;
  }

  if (action === "PP:PO") {
    await handlers.handlePayPalPayouts(ctx);
    return true;
  }

  if (action === "PP:INV_SEARCH") {
    if (!(await requireAdmin(ctx, "PayPal invoice search"))) return true;
    await handlers.startSearchFlow(ctx, "paypal_invoice");
    return true;
  }

  if (action === "PP:PO_SEARCH") {
    if (!(await requireAdmin(ctx, "PayPal payout search"))) return true;
    await handlers.startSearchFlow(ctx, "paypal_payout");
    return true;
  }

  if (action.startsWith("PP:INV_P:")) {
    await handlers.handlePayPalInvoices(ctx, { page: action.slice("PP:INV_P:".length) });
    return true;
  }

  if (action.startsWith("PP:PO_P:")) {
    await handlers.handlePayPalPayouts(ctx, { page: action.slice("PP:PO_P:".length) });
    return true;
  }

  if (action.startsWith("PP:INV_S:")) {
    await handlers.handlePayPalInvoices(ctx, { status: action.slice("PP:INV_S:".length), page: 1 });
    return true;
  }

  if (action.startsWith("PP:PO_S:")) {
    await handlers.handlePayPalPayouts(ctx, { status: action.slice("PP:PO_S:".length), page: 1 });
    return true;
  }

  if (action.startsWith("PP:PO_PR:")) {
    await handlers.handlePayPalPayouts(ctx, { providerState: action.slice("PP:PO_PR:".length), page: 1 });
    return true;
  }

  if (action.startsWith("PP:INV_D:")) {
    await handlers.handlePayPalInvoiceDetail(ctx, action.slice("PP:INV_D:".length));
    return true;
  }

  if (action.startsWith("PP:PO_D:")) {
    await handlers.handlePayPalPayoutDetail(ctx, action.slice("PP:PO_D:".length));
    return true;
  }

  if (action.startsWith("PP:INV_REFRESH:")) {
    await handlers.handlePayPalInvoiceAction(ctx, "refresh", action.slice("PP:INV_REFRESH:".length));
    return true;
  }

  if (action.startsWith("PP:INV_RELEASE:")) {
    await handlers.handlePayPalInvoiceAction(ctx, "release", action.slice("PP:INV_RELEASE:".length));
    return true;
  }

  if (action.startsWith("PP:INV_VOID:")) {
    await handlers.handlePayPalInvoiceAction(ctx, "void", action.slice("PP:INV_VOID:".length));
    return true;
  }

  if (action.startsWith("PP:INV_REVIEW:")) {
    await handlers.handlePayPalInvoiceAction(ctx, "review", action.slice("PP:INV_REVIEW:".length));
    return true;
  }

  if (action.startsWith("PP:INV_DO_RELEASE:")) {
    await handlers.handlePayPalInvoiceAction(ctx, "release", action.slice("PP:INV_DO_RELEASE:".length), { confirmed: true });
    return true;
  }

  if (action.startsWith("PP:PO_APPROVE:")) {
    await handlers.handlePayPalPayoutAction(ctx, "approve", action.slice("PP:PO_APPROVE:".length));
    return true;
  }

  if (action.startsWith("PP:PO_DO_APPROVE:")) {
    await handlers.handlePayPalPayoutAction(ctx, "approve", action.slice("PP:PO_DO_APPROVE:".length), { confirmed: true });
    return true;
  }

  if (action.startsWith("PP:PO_REJECT:")) {
    await handlers.handlePayPalPayoutAction(ctx, "reject", action.slice("PP:PO_REJECT:".length));
    return true;
  }

  if (action.startsWith("PP:PO_REFRESH:")) {
    await handlers.handlePayPalPayoutAction(ctx, "refresh", action.slice("PP:PO_REFRESH:".length));
    return true;
  }

  if (action.startsWith("PP:PO_CANCEL:")) {
    await handlers.handlePayPalPayoutAction(ctx, "cancel", action.slice("PP:PO_CANCEL:".length));
    return true;
  }

  if (action.startsWith("PP:PO_DO_CANCEL:")) {
    await handlers.handlePayPalPayoutAction(ctx, "cancel", action.slice("PP:PO_DO_CANCEL:".length), { confirmed: true });
    return true;
  }

  if (action === "ISSUES") {
    await handlers.handleIssues(ctx);
    return true;
  }

  if (action === "ACTIVITY") {
    await handlers.handleActivity(ctx);
    return true;
  }

  if (action === "CLIENTS") {
    await handlers.handleClients(ctx);
    return true;
  }

  if (action === "RISK") {
    await handlers.handleRisk(ctx);
    return true;
  }

  if (action === "SECURITY") {
    await handlers.handleSecurity(ctx);
    return true;
  }

  if (action === "ORDERS") {
    await handlers.handleOrders(ctx);
    return true;
  }

  if (action === "OPS") {
    await handlers.handleOps(ctx);
    return true;
  }

  if (action === "RECONCILE") {
    await handlers.handleReconcile(ctx);
    return true;
  }

  return false;
}

module.exports = {
  handlePaymentCallback,
};
