async function handleUserCallback(ctx, action, { handlers }) {
  if (action === "USERS") {
    await handlers.handleUsers(ctx);
    return true;
  }

  if (action === "USERS_LIST") {
    await handlers.sendUsersList(ctx);
    return true;
  }

  if (action === "USERS_SEARCH") {
    await handlers.startSearchFlow(ctx, "bot_user");
    return true;
  }

  if (action === "USERS_AUDIT") {
    await handlers.handleUsersAudit(ctx);
    return true;
  }

  if (action === "USERS_EXPIRING") {
    await handlers.handleExpiringUsers(ctx);
    return true;
  }

  if (action.startsWith("USER_D:")) {
    await handlers.handleUserDetail(ctx, action.slice("USER_D:".length));
    return true;
  }

  if (action.startsWith("USER_EXTEND:")) {
    await handlers.setPendingUserDetailAction(ctx, "extend", action.slice("USER_EXTEND:".length));
    return true;
  }

  if (action.startsWith("USER_PROMOTE:")) {
    await handlers.setPendingUserDetailAction(ctx, "promote", action.slice("USER_PROMOTE:".length));
    return true;
  }

  if (action.startsWith("USER_DEMOTE:")) {
    await handlers.setPendingUserDetailAction(ctx, "demote", action.slice("USER_DEMOTE:".length));
    return true;
  }

  if (action.startsWith("USER_SUSPEND:")) {
    await handlers.setPendingUserDetailAction(ctx, "suspend", action.slice("USER_SUSPEND:".length));
    return true;
  }

  if (action.startsWith("USER_REACTIVATE:")) {
    await handlers.setPendingUserDetailAction(ctx, "reactivate", action.slice("USER_REACTIVATE:".length));
    return true;
  }

  if (action.startsWith("USER_REVOKE:")) {
    await handlers.setPendingUserDetailAction(ctx, "remove", action.slice("USER_REVOKE:".length));
    return true;
  }

  if (action === "USERS_ADD") {
    await handlers.setPendingUserAction(ctx, "add");
    return true;
  }

  if (action === "USERS_PROMOTE") {
    await handlers.setPendingUserAction(ctx, "promote");
    return true;
  }

  if (action === "USERS_DEMOTE") {
    await handlers.setPendingUserAction(ctx, "demote");
    return true;
  }

  if (action === "USERS_SUSPEND") {
    await handlers.setPendingUserAction(ctx, "suspend");
    return true;
  }

  if (action === "USERS_REACTIVATE") {
    await handlers.setPendingUserAction(ctx, "reactivate");
    return true;
  }

  if (action === "USERS_REMOVE") {
    await handlers.setPendingUserAction(ctx, "remove");
    return true;
  }

  if (action.startsWith("USERS_DAYS:")) {
    await handlers.setPendingUserSubscriptionDays(ctx, action.slice("USERS_DAYS:".length));
    return true;
  }

  if (action === "USERS_CUSTOM_DAYS") {
    await handlers.handleCustomSubscriptionDays(ctx);
    return true;
  }

  if (action === "USERS_CHANGE_DAYS") {
    await handlers.handleChangeSubscriptionDays(ctx);
    return true;
  }

  if (action === "USERS_CONFIRM") {
    await handlers.completePendingUserAction(ctx);
    return true;
  }

  return false;
}

module.exports = {
  handleUserCallback,
};
