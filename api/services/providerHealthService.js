const { paymentOpsIssueService } = require('./paymentOpsIssueService');
const { paymentProviderRegistry } = require('./paymentProviderRegistry');
const { webhookEventRepository } = require('../repositories/webhookEventRepository');

const FAILED_WEBHOOK_STATUSES = new Set(['FAILED', 'REJECTED', 'RETRYING', 'DEAD_LETTER']);
const ACTIVE_ISSUE_STATUSES = ['OPEN', 'ACKNOWLEDGED'];

function scoreProvider({ provider, webhooks, issues }) {
  const reasons = [];
  let score = 100;

  if (provider.status !== 'ready') {
    score -= provider.status === 'configured' ? 15 : 35;
    reasons.push(provider.status === 'configured' ? 'Provider is configured but not fully ready.' : 'Provider is not configured.');
  }

  const failedWebhooks = webhooks.filter((event) => FAILED_WEBHOOK_STATUSES.has(String(event.status || '').toUpperCase()));
  if (failedWebhooks.length > 0) {
    score -= Math.min(30, failedWebhooks.length * 10);
    reasons.push(`${failedWebhooks.length} recent webhook event${failedWebhooks.length === 1 ? '' : 's'} need attention.`);
  }

  if (issues.length > 0) {
    score -= Math.min(25, issues.length * 8);
    reasons.push(`${issues.length} unresolved payment issue${issues.length === 1 ? '' : 's'} detected.`);
  }

  if (provider.status === 'ready' && webhooks.length === 0) {
    score -= 5;
    reasons.push('No recent webhook activity has been recorded.');
  }

  return {
    score: Math.max(0, score),
    failedWebhooks: failedWebhooks.length,
    reasons
  };
}

function classifyHealth(score) {
  if (score >= 90) {
    return 'operational';
  }
  if (score >= 70) {
    return 'watch';
  }
  if (score >= 45) {
    return 'degraded';
  }
  return 'critical';
}

function lastWebhookTimestamp(webhooks) {
  return webhooks.reduce((latest, event) => {
    const value = event.createdAt || event.updatedAt;
    if (!value) {
      return latest;
    }
    if (!latest || new Date(value).getTime() > new Date(latest).getTime()) {
      return value;
    }
    return latest;
  }, null);
}

async function listActiveIssues(provider) {
  const batches = await Promise.all(
    ACTIVE_ISSUE_STATUSES.map((status) => paymentOpsIssueService.listIssues({ provider, status, limit: 100 }))
  );
  return batches.flat();
}

async function buildProviderHealth(provider) {
  const [webhooks, issues] = await Promise.all([
    webhookEventRepository.findMany({ provider: provider.key, limit: 50 }),
    listActiveIssues(provider.key)
  ]);
  const scoring = scoreProvider({ provider, webhooks, issues });
  const nextActions = [...(provider.next_actions || [])];

  if (scoring.failedWebhooks > 0) {
    nextActions.push('Review failed webhook events and replay safe failures.');
  }
  if (issues.length > 0) {
    nextActions.push('Resolve or acknowledge open payment operations issues.');
  }

  return {
    provider: provider.key,
    display_name: provider.display_name,
    provider_status: provider.status,
    score: scoring.score,
    status: classifyHealth(scoring.score),
    failed_webhooks: scoring.failedWebhooks,
    recent_webhooks: webhooks.length,
    unresolved_issues: issues.length,
    last_webhook_at: lastWebhookTimestamp(webhooks),
    reasons: scoring.reasons,
    next_actions: nextActions
  };
}

async function getProviderHealthReport() {
  const providers = paymentProviderRegistry.listProviders();
  const data = await Promise.all(providers.map(buildProviderHealth));

  return {
    generated_at: new Date().toISOString(),
    data
  };
}

async function getProviderHealth(providerKey) {
  const normalized = String(providerKey || '').trim().toLowerCase();
  const provider = paymentProviderRegistry.listProviders().find((entry) => entry.key === normalized);
  if (!provider) {
    const registryStatus = paymentProviderRegistry.getProviderStatus(normalized);
    return buildProviderHealth({
      key: registryStatus.key || normalized,
      display_name: registryStatus.display_name || registryStatus.name || normalized,
      status: registryStatus.status || 'unknown',
      next_actions: registryStatus.next_actions || []
    });
  }
  return buildProviderHealth(provider);
}

module.exports = {
  providerHealthService: {
    getProviderHealth,
    getProviderHealthReport
  },
  getProviderHealth,
  getProviderHealthReport
};
