const config = require('../config');
const { telegramWebhookSchema } = require('../schemas/telegramSchemas');
const { telegramBotService } = require('../services/telegramBotService');
const { AppError } = require('../utils/errors');

async function telegramWebhookController(request, response) {
  if (config.TELEGRAM_WEBHOOK_SECRET) {
    const secret =
      request.headers['x-telegram-bot-api-secret-token'] ||
      request.headers['X-Telegram-Bot-Api-Secret-Token'];

    if (secret !== config.TELEGRAM_WEBHOOK_SECRET) {
      throw new AppError(401, 'INVALID_TELEGRAM_WEBHOOK_SECRET', 'Invalid Telegram webhook secret.');
    }
  }

  const body = telegramWebhookSchema.parse(request.body || {});
  const result = await telegramBotService.handleWebhook(body);
  response.json(result);
}

module.exports = {
  telegramWebhookController
};
