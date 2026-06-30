function registerAccountCommands(bot, { wrap, handlers }) {
  bot.command("account", wrap(handlers.handleAccount, "account"));
  bot.command("profile", wrap(handlers.handleProfile, "profile"));
  bot.command("balance", wrap(handlers.handleBalance, "balance"));
  bot.command(["receipts", "history"], wrap(handlers.handleReceipts, "receipts"));
  bot.command("referral", wrap(handlers.handleReferral, "referral"));
}

module.exports = {
  registerAccountCommands,
};
