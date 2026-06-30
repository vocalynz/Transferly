function registerSystemCommands(bot, { wrap, handlers }) {
  bot.command("health", wrap(handlers.handleHealth, "health"));
  bot.command("status", wrap(handlers.handleStatus, "status"));
  bot.command("bot_ops", wrap(handlers.handleBotOps, "bot_ops"));
}

module.exports = {
  registerSystemCommands,
};
