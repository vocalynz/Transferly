const {
  PROVIDER_CONTRACT_VERSION,
  PROVIDER_OPERATION_KEYS,
  isProviderOperationImplemented
} = require('../constants/providerWorkspaceContract');
const { AppError } = require('../utils/errors');
const { providerCapabilityService } = require('./providerCapabilityService');
const { providerHealthService } = require('./providerHealthService');
const { providerReadinessService } = require('./providerReadinessService');

const OPERATION_LABELS = Object.freeze({
  invoices: 'Invoices',
  payouts: 'Payouts',
  balance: 'Balance',
  activity: 'Activity'
});

function summarizeOperations(readiness = {}) {
  const operations = Array.isArray(readiness.operations) ? readiness.operations : [];
  return PROVIDER_OPERATION_KEYS.map((operation) => {
    const item = operations.find((entry) => entry.operation === operation) || {};
    const status = item.status || 'setup';
    return {
      operation,
      label: OPERATION_LABELS[operation] || operation,
      status,
      implemented: Boolean(item.implemented || isProviderOperationImplemented(status)),
      actionable: Boolean(item.actionable || !isProviderOperationImplemented(status))
    };
  });
}

function summarizeWarnings(readiness = {}, health = {}) {
  const warnings = [];
  const missingEnv = Array.isArray(readiness.missing_env) ? readiness.missing_env : [];
  const reasons = Array.isArray(health.reasons) ? health.reasons : [];

  if (missingEnv.length > 0) {
    warnings.push(`Missing provider environment variables: ${missingEnv.join(', ')}`);
  }
  if (health.status && health.status !== 'operational') {
    warnings.push(...reasons);
  }
  if (readiness.ready === false) {
    warnings.push('Provider setup is not fully ready.');
  }

  return [...new Set(warnings)].slice(0, 5);
}

function summarizeNextActions(readiness = {}, health = {}) {
  const readinessActions = Array.isArray(readiness.recommended_next_steps)
    ? readiness.recommended_next_steps.map((step) => [step.label, step.detail].filter(Boolean).join(' '))
    : [];
  const healthActions = Array.isArray(health.next_actions) ? health.next_actions : [];

  return [...new Set([...readinessActions, ...healthActions].filter(Boolean))].slice(0, 5);
}

async function getProviderStatus(provider) {
  const capability = providerCapabilityService.getProviderCapabilities(provider);
  const [readiness, health] = await Promise.all([
    Promise.resolve(providerReadinessService.getProviderReadiness(provider)),
    providerHealthService.getProviderHealth(provider)
  ]);

  return {
    provider: capability.slug,
    display_name: capability.display_name,
    status: readiness.ready ? 'ready' : readiness.status || capability.status || 'setup',
    ready: Boolean(readiness.ready),
    provider_status: health.provider_status,
    health_status: health.status,
    health_score: health.score,
    contract_version: PROVIDER_CONTRACT_VERSION,
    operations: summarizeOperations(readiness),
    lanes: readiness.lanes || [],
    warnings: summarizeWarnings(readiness, health),
    next_actions: summarizeNextActions(readiness, health)
  };
}

async function preflightProviderAction(provider, operation) {
  const status = await getProviderStatus(provider);
  const operationStatus = status.operations.find((entry) => entry.operation === operation) || {
    operation,
    label: OPERATION_LABELS[operation] || operation,
    status: 'setup'
  };

  try {
    providerCapabilityService.assertProviderOperation(provider, operation);
    return {
      allowed: true,
      provider: status.provider,
      operation,
      label: operationStatus.label,
      status: operationStatus.status,
      reason: null,
      code: null,
      supported_providers: [],
      warnings: status.warnings,
      next_actions: status.next_actions.slice(0, 3)
    };
  } catch (error) {
    if (!(error instanceof AppError) || error.code !== 'PROVIDER_OPERATION_NOT_AVAILABLE') {
      throw error;
    }

    return {
      allowed: false,
      provider: status.provider,
      operation,
      label: operationStatus.label,
      status: error.details?.status || operationStatus.status,
      reason: error.message,
      code: error.code,
      supported_providers: error.details?.supported_providers || [],
      warnings: status.warnings,
      next_actions: status.next_actions.slice(0, 3)
    };
  }
}

module.exports = {
  providerStatusService: {
    getProviderStatus,
    preflightProviderAction
  }
};
