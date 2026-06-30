function registerServiceCommands(bot, { wrap, handlers }) {
  bot.command("services", wrap(handlers.handleServices, "services"));
  bot.command("receipt", wrap(handlers.handleReceipt, "receipt"));
}

module.exports = {
  registerServiceCommands,
};
