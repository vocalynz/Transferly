const { paymentProviderAdapters } = require('../adapters/paymentProviders');
const { AppError } = require('../utils/errors');

const adaptersByKey = new Map(paymentProviderAdapters.map((adapter) => [adapter.key, adapter]));

function listProviders() {
  return paymentProviderAdapters.map((adapter) => adapter.getSummary());
}

function getProvider(providerKey) {
  const normalizedKey = String(providerKey || '').trim().toLowerCase();
  const adapter = adaptersByKey.get(normalizedKey);

  if (!adapter) {
    throw new AppError(404, 'PAYMENT_PROVIDER_NOT_FOUND', 'Payment provider not found.', {
      provider: providerKey,
      available_providers: paymentProviderAdapters.map((entry) => entry.key)
    });
  }

  return adapter;
}

function getProviderStatus(providerKey) {
  return getProvider(providerKey).getStatus();
}

function listInvoiceFeatures() {
  return paymentProviderAdapters.map((adapter) => adapter.getInvoiceFeatures());
}

function getProviderInvoiceFeatures(providerKey) {
  return getProvider(providerKey).getInvoiceFeatures();
}

module.exports = {
  paymentProviderRegistry: {
    listProviders,
    getProvider,
    getProviderStatus,
    listInvoiceFeatures,
    getProviderInvoiceFeatures
  }
};
