function registerUserCommands(bot, { wrap, handlers }) {
  bot.command("users", wrap(handlers.handleUsers, "users"));
}

module.exports = {
  registerUserCommands,
};
