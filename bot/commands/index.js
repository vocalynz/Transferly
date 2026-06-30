const { registerPublicCommands } = require("./public");
const { registerAccountCommands } = require("./account");
const { registerServiceCommands } = require("./services");
const { registerPaymentCommands } = require("./payments");
const { registerSystemCommands } = require("./system");
const { registerUserCommands } = require("./users");

function registerCommands(bot, deps) {
  registerPublicCommands(bot, deps);
  registerServiceCommands(bot, deps);
  registerAccountCommands(bot, deps);
  registerPaymentCommands(bot, deps);
  registerSystemCommands(bot, deps);
  registerUserCommands(bot, deps);
}

module.exports = {
  registerCommands,
};
