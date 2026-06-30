const config = require('../../config');
const { AppError } = require('../../utils/errors');

function hasConfiguredValue(value) {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

function resolveEnv(name) {
  return config[name] ?? process.env[name] ?? '';
}

function getReadiness(requiredEnv) {
  const missingEnv = requiredEnv.filter((name) => !hasConfiguredValue(resolveEnv(name)));

  return {
    configured: missingEnv.length === 0,
    required_env: requiredEnv,
    missing_env: missingEnv
  };
}

function createProviderAdapter(definition) {
  const requiredEnv = definition.requiredEnv || [];
  const invoiceFeatures = definition.invoiceFeatures || {
    supported: false,
    provider_resource: 'none',
    collection_method: 'not_supported',
    reason: 'This provider does not expose an invoice collection flow for Transferly.'
  };

  function buildSummary() {
    const readiness = getReadiness(requiredEnv);

    return {
      key: definition.key,
      display_name: definition.displayName,
      status: readiness.configured ? 'configured' : 'not_configured',
      mode: definition.mode || 'external',
      capabilities: definition.capabilities,
      invoice_features: invoiceFeatures,
      supported_operations: definition.supportedOperations,
      required_env: readiness.required_env,
      missing_env: readiness.missing_env,
      docs: definition.docs,
      next_actions: readiness.configured
        ? definition.configuredNextActions
        : definition.nextActions
    };
  }

  async function operationNotImplemented(operation) {
    throw new AppError(
      501,
      'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED',
      `${definition.displayName} ${operation} is registered but not implemented yet.`,
      {
        provider: definition.key,
        operation
      }
    );
  }

  return {
    key: definition.key,
    getSummary: buildSummary,
    getStatus() {
      return {
        ...buildSummary(),
        notes: definition.notes || []
      };
    },
    getInvoiceFeatures() {
      const summary = buildSummary();

      return {
        provider: {
          key: summary.key,
          display_name: summary.display_name,
          status: summary.status,
          mode: summary.mode
        },
        invoice_features: invoiceFeatures,
        required_env: summary.required_env,
        missing_env: summary.missing_env,
        docs: summary.docs
      };
    },
    createInvoice: () => operationNotImplemented('invoice creation'),
    createPayout: () => operationNotImplemented('payout creation'),
    refreshResource: () => operationNotImplemented('resource refresh'),
    verifyWebhook: () => operationNotImplemented('webhook verification')
  };
}

module.exports = {
  createProviderAdapter
};
