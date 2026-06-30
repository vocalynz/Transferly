const { authService } = require('../services/authService');
const { telegramMiniAppLoginSchema } = require('../schemas/authSchemas');

async function telegramMiniAppLoginController(request, response) {
  const body = telegramMiniAppLoginSchema.parse(request.body || {});
  const result = await authService.loginWithTelegramMiniApp(body);
  response.json(result);
}

module.exports = {
  telegramMiniAppLoginController
};
