const { AppError } = require('./errors');

function parseAmount(value) {
  const normalized = typeof value === 'number' ? value.toFixed(2) : String(value).trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new AppError(400, 'INVALID_AMOUNT', `Invalid money amount "${value}".`);
  }

  return Math.round(Number(normalized) * 100);
}

function ensurePositiveMoney(value) {
  const cents = typeof value === 'number' ? value : parseAmount(value);
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new AppError(400, 'INVALID_AMOUNT', 'Amount must be greater than zero.');
  }

  return cents;
}

function formatMoney(cents) {
  return (Number(cents) / 100).toFixed(2);
}

function sumInvoiceItems(items) {
  return items.reduce((sum, item) => {
    return sum + Math.round(Number(item.quantity) * Number(item.unitAmount) * 100);
  }, 0);
}

function ensureSameCurrency(actual, expected) {
  if (String(actual).toUpperCase() !== String(expected).toUpperCase()) {
    throw new AppError(409, 'CURRENCY_MISMATCH', 'Currency mismatch detected for wallet operation.');
  }
}

module.exports = {
  parseAmount,
  ensurePositiveMoney,
  formatMoney,
  sumInvoiceItems,
  ensureSameCurrency
};
