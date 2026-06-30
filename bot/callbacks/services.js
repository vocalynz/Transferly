async function handleServiceCallback(ctx, action, { handlers }) {
  if (action.startsWith("GROUP:")) {
    await handlers.handleServiceGroup(ctx, action.slice("GROUP:".length));
    return true;
  }

  if (action.startsWith("SERVICE:")) {
    await handlers.handleServiceDetail(ctx, action.slice("SERVICE:".length));
    return true;
  }

  if (action.startsWith("SERVICE_ACTION:")) {
    const [, slug, laneId] = action.split(":");
    await handlers.handleServiceLaneAction(ctx, slug, laneId);
    return true;
  }

  if (action.startsWith("SERVICE_LANE:")) {
    const [, slug, laneId] = action.split(":");
    await handlers.handleServiceLane(ctx, slug, laneId);
    return true;
  }

  if (action.startsWith("RUN:")) {
    const service = handlers.getService(action.slice("RUN:".length));
    await handlers.runServiceReceipt(ctx, service);
    return true;
  }

  if (action.startsWith("CUSTOM:")) {
    await handlers.handleCustomServiceStart(ctx, action.slice("CUSTOM:".length));
    return true;
  }

  if (action.startsWith("PROVIDER:")) {
    await handlers.handleProviderWorkspace(ctx, action.slice("PROVIDER:".length));
    return true;
  }

  if (action.startsWith("PROVIDER_CUSTOM:")) {
    const service = handlers.getService(action.slice("PROVIDER_CUSTOM:".length));
    if (!service) {
      await handlers.handleServiceDetail(ctx, action.slice("PROVIDER_CUSTOM:".length));
      return true;
    }
    await handlers.startServiceComposer(ctx, service, { mode: "custom_details" });
    return true;
  }

  if (action.startsWith("PROVIDER_LANE:")) {
    const [, slug, laneId] = action.split(":");
    await handlers.handleProviderLane(ctx, slug, laneId);
    return true;
  }

  if (action.startsWith("PROVIDER_INV:")) {
    const provider = action.slice("PROVIDER_INV:".length);
    await handlers.handlePayPalInvoices(ctx, {
      provider,
      page: 1,
      notice: `${provider} invoice workspace`
    });
    return true;
  }

  if (action.startsWith("PROVIDER_PO:")) {
    await handlers.handleProviderPayouts(ctx, action.slice("PROVIDER_PO:".length));
    return true;
  }

  if (action.startsWith("PROVIDER_BAL:")) {
    await handlers.handleProviderBalance(ctx, action.slice("PROVIDER_BAL:".length));
    return true;
  }

  if (action.startsWith("PROVIDER_WEBHOOKS:")) {
    await handlers.handleProviderWebhooks(ctx, action.slice("PROVIDER_WEBHOOKS:".length));
    return true;
  }

  if (action.startsWith("PROVIDER_ISSUES:")) {
    await handlers.handleProviderIssues(ctx, action.slice("PROVIDER_ISSUES:".length));
    return true;
  }

  if (action.startsWith("HISTORY:")) {
    await handlers.handleServiceHistory(ctx, action.slice("HISTORY:".length));
    return true;
  }

  if (action.startsWith("INFO:")) {
    await handlers.handleServiceInfo(ctx, action.slice("INFO:".length));
    return true;
  }

  if (action === "SEARCH:SERVICE") {
    await handlers.startSearchFlow(ctx, "service");
    return true;
  }

  if (action === "PP:HOME") {
    await handlers.handlePayPalWorkspace(ctx);
    return true;
  }

  if (action === "PP:EMAIL") {
    await handlers.startServiceComposer(ctx, handlers.getService("paypal"), { mode: "flash_email" });
    return true;
  }

  if (action === "CMP:OK") {
    await handlers.handleComposerAction(ctx, "confirm");
    return true;
  }

  if (action === "CMP:EDIT") {
    await handlers.handleComposerAction(ctx, "edit");
    return true;
  }

  if (action === "CMP:CANCEL") {
    await handlers.handleComposerAction(ctx, "cancel");
    return true;
  }

  return false;
}

module.exports = {
  handleServiceCallback,
};
