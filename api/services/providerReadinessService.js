const {
  PROVIDER_CONTRACT_VERSION,
  PROVIDER_OPERATION_KEYS,
  isProviderOperationImplemented
} = require('../constants/providerWorkspaceContract');
const { providerCapabilityService } = require('./providerCapabilityService');

function summarizeOperationReadiness(operations = {}) {
  return PROVIDER_OPERATION_KEYS.map((operation) => {
    const support = operations[operation] || {
      status: 'unsupported',
      implemented: false
    };

    return {
      operation,
      status: support.status,
      implemented: Boolean(support.implemented),
      actionable: !isProviderOperationImplemented(support.status)
    };
  });
}

function summarizeLaneReadiness(lanes = []) {
  return lanes.map((lane) => ({
    id: lane.id,
    label: lane.label,
    status: lane.status,
    bot_action: lane.bot_action || null,
    mini_app_section: lane.mini_app_section,
    needs_backend: lane.status === 'setup',
    needs_product_review: lane.status === 'preview'
  }));
}

function buildReadiness(capability) {
  const operations = summarizeOperationReadiness(capability.operations);
  const lanes = summarizeLaneReadiness(capability.lanes);
  const missingEnv = capability.registry_status?.missing_env || [];
  const liveOperations = operations.filter((operation) => operation.implemented);
  const setupOperations = operations.filter((operation) => operation.status === 'setup');
  const unsupportedOperations = operations.filter((operation) => operation.status === 'unsupported');

  return {
    provider: capability.slug,
    contract_version: PROVIDER_CONTRACT_VERSION,
    display_name: capability.display_name,
    status: capability.status,
    ready: missingEnv.length === 0 && liveOperations.length > 0,
    registry_status: capability.registry_status,
    missing_env: missingEnv,
    operations,
    lanes,
    summary: {
      live_operations: liveOperations.length,
      setup_operations: setupOperations.length,
      unsupported_operations: unsupportedOperations.length,
      live_lanes: lanes.filter((lane) => lane.status === 'live').length,
      preview_lanes: lanes.filter((lane) => lane.status === 'preview').length,
      setup_lanes: lanes.filter((lane) => lane.status === 'setup').length
    },
    recommended_next_steps: buildNextSteps(capability, operations, lanes, missingEnv)
  };
}

function buildNextSteps(capability, operations, lanes, missingEnv) {
  const steps = [];

  if (missingEnv.length > 0) {
    steps.push({
      code: 'CONFIGURE_ENV',
      label: 'Configure missing provider environment variables.',
      detail: missingEnv.join(', ')
    });
  }

  for (const operation of operations) {
    if (operation.status === 'setup') {
      steps.push({
        code: `ENABLE_${operation.operation.toUpperCase()}`,
        label: `Finish ${operation.operation} backend support for ${capability.display_name}.`,
        detail: 'Add adapter implementation, validation, tests, and provider-specific operational checks.'
      });
    }
  }

  for (const lane of lanes) {
    if (lane.status === 'preview') {
      steps.push({
        code: `REVIEW_${lane.id.toUpperCase()}`,
        label: `Review ${lane.label} before promoting it to live.`,
        detail: 'Confirm API behavior, bot action, Mini App route state, and production logging.'
      });
    }
  }

  if (steps.length === 0) {
    steps.push({
      code: 'MONITOR',
      label: 'Monitor provider activity, errors, and webhook delivery.',
      detail: 'Keep dashboards and logs tied to request ids, provider ids, and resource ids.'
    });
  }

  return steps;
}

function listProviderReadiness() {
  return providerCapabilityService.listProviderCapabilities().map(buildReadiness);
}

function getProviderReadiness(provider) {
  return buildReadiness(providerCapabilityService.getProviderCapabilities(provider));
}

module.exports = {
  PROVIDER_CONTRACT_VERSION,
  providerReadinessService: {
    getProviderReadiness,
    listProviderReadiness
  }
};
