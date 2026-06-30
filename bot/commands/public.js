function registerPublicCommands(bot, { wrap, handlers }) {
  bot.command("start", wrap(handlers.handleStart, "start"));
  bot.command("menu", wrap(handlers.handleMenu, "menu"));
  bot.command("miniapp", wrap(handlers.handleMiniApp, "miniapp"));
  bot.command("help", wrap(handlers.handleHelp, "help"));
  bot.command("whoami", wrap(handlers.handleWhoami, "whoami"));
  bot.command("cancel", wrap(handlers.handleCancel, "cancel"));
}

module.exports = {
  registerPublicCommands,
};
