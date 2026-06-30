const {
  PROVIDER_CONTRACT_VERSION,
  PROVIDER_OPERATION_KEYS,
  getProviderLane,
  getProviderLanes,
  getProviderWorkspace,
  isProviderOperationImplemented,
  listProviderWorkspaces
} = require('../constants/providerWorkspaceContract');
const { paymentProviderRegistry } = require('./paymentProviderRegistry');
const { AppError } = require('../utils/errors');

const OPERATION_SUPPORT = Object.freeze({
  invoices: Object.freeze({
    paypal: 'live',
    stripe: 'live',
    wise: 'unsupported',
    paystack: 'setup',
    flutterwave: 'setup',
    crypto: 'live'
  }),
  payouts: Object.freeze({
    paypal: 'live',
    stripe: 'live',
    wise: 'setup',
    paystack: 'setup',
    flutterwave: 'setup',
    crypto: 'unsupported'
  }),
  balance: Object.freeze({
    paypal: 'setup',
    stripe: 'live',
    wise: 'setup',
    paystack: 'setup',
    flutterwave: 'setup',
    crypto: 'unsupported'
  }),
  activity: Object.freeze({
    paypal: 'live',
    stripe: 'live',
    wise: 'setup',
    paystack: 'setup',
    flutterwave: 'setup',
    crypto: 'live'
  })
});

const OPERATION_LABELS = Object.freeze({
  invoices: 'invoice collection',
  payouts: 'payout submission',
  balance: 'provider balance lookup',
  activity: 'provider activity'
});

function normalizeProviderKey(provider) {
  return String(provider || '').trim().toLowerCase();
}

function listImplementedProviders(operation) {
  const support = OPERATION_SUPPORT[operation] || {};
  return Object.entries(support)
    .filter(([, status]) => isProviderOperationImplemented(status))
    .map(([provider]) => provider);
}

function readRegistryStatus(provider) {
  try {
    return paymentProviderRegistry.getProviderStatus(provider);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 404) {
      throw error;
    }
    return null;
  }
}

function readInvoiceFeatures(provider) {
  try {
    return paymentProviderRegistry.getProviderInvoiceFeatures(provider);
  } catch (_error) {
    return null;
  }
}

function presentOperationSupport(provider) {
  return Object.fromEntries(
    Object.entries(OPERATION_SUPPORT).map(([operation, support]) => [
      operation,
      {
        status: support[provider] || 'unsupported',
        implemented: isProviderOperationImplemented(support[provider])
      }
    ])
  );
}

function presentProviderCapability(provider) {
  const providerKey = normalizeProviderKey(provider.slug || provider.id);
  const registryStatus = readRegistryStatus(providerKey);
  const invoiceFeatures = readInvoiceFeatures(providerKey);

  return {
    id: provider.id,
    slug: provider.slug,
    display_name: provider.displayName,
    short_description: provider.shortDescription,
    icon: provider.icon,
    accent_color: provider.accentColor,
    docs_url: provider.docsUrl,
    support_url: provider.supportUrl,
    environments: provider.environments || [],
    status: provider.status,
    capabilities: provider.capabilities || [],
    operations: presentOperationSupport(providerKey),
    lanes: getProviderLanes(providerKey).map((lane) => ({
      id: lane.id,
      label: lane.label,
      command_label: lane.commandLabel || lane.label,
      intent: lane.intent,
      status: lane.status,
      summary: lane.summary,
      bot_action: lane.botAction || null,
      mini_app_section: lane.miniAppSection,
      requires_admin: Boolean(lane.requiresAdmin)
    })),
    registry_status: registryStatus
      ? {
          key: registryStatus.key,
          status: registryStatus.status,
          missing_env: registryStatus.missing_env || [],
          capabilities: registryStatus.capabilities || {}
        }
      : null,
    invoice_features: invoiceFeatures?.invoice_features || null
  };
}

function listProviderCapabilities() {
  return listProviderWorkspaces().map(presentProviderCapability);
}

function getProviderCapabilities(provider) {
  const providerKey = normalizeProviderKey(provider);
  const workspace = getProviderWorkspace(providerKey);
  if (!workspace) {
    paymentProviderRegistry.getProviderStatus(providerKey);
    throw new AppError(404, 'PAYMENT_PROVIDER_NOT_FOUND', 'Payment provider was not found.', {
      provider: providerKey
    });
  }
  return presentProviderCapability(workspace);
}

function listProviderLanes(provider) {
  getProviderCapabilities(provider);
  return getProviderLanes(provider).map((lane) => ({
    id: lane.id,
    label: lane.label,
    command_label: lane.commandLabel || lane.label,
    intent: lane.intent,
    status: lane.status,
    summary: lane.summary,
    bot_action: lane.botAction || null,
    mini_app_section: lane.miniAppSection,
    requires_admin: Boolean(lane.requiresAdmin)
  }));
}

function getProviderLaneCapability(provider, laneId) {
  getProviderCapabilities(provider);
  const lane = getProviderLane(provider, laneId);
  if (!lane) {
    throw new AppError(404, 'PROVIDER_LANE_NOT_FOUND', 'Provider lane was not found.', {
      provider: normalizeProviderKey(provider),
      lane: String(laneId || '').toLowerCase(),
      available_lanes: getProviderLanes(provider).map((entry) => entry.id)
    });
  }
  return listProviderLanes(provider).find((entry) => entry.id === lane.id);
}

function assertProviderOperation(provider, operation) {
  const providerKey = normalizeProviderKey(provider);
  getProviderCapabilities(providerKey);
  const support = OPERATION_SUPPORT[operation]?.[providerKey] || 'unsupported';
  if (isProviderOperationImplemented(support)) {
    return {
      provider: providerKey,
      operation,
      status: support
    };
  }

  throw new AppError(501, 'PROVIDER_OPERATION_NOT_AVAILABLE', 'Provider operation is not available yet.', {
    provider: providerKey,
    operation,
    operation_label: OPERATION_LABELS[operation] || operation,
    status: support,
    supported_providers: listImplementedProviders(operation)
  });
}

module.exports = {
  OPERATION_SUPPORT,
  PROVIDER_CONTRACT_VERSION,
  PROVIDER_OPERATION_KEYS,
  providerCapabilityService: {
    assertProviderOperation,
    getProviderCapabilities,
    getProviderLaneCapability,
    listProviderCapabilities,
    listProviderLanes
  }
};
