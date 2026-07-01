'use strict';

const { randomUUID } = require('node:crypto');
const { PROVIDER_CONTRACT_VERSION } = require('./providerWorkspaces');

const ADMIN_AUTH_HEADER = 'Authorization';
const IDEMPOTENCY_HEADER = 'Idempotency-Key';
const REQUEST_ID_HEADER = 'x-request-id';

const adminRoutes = Object.freeze({
  health: '/health',
  invoices: '/api/admin/invoices',
  payouts: '/api/admin/payouts',
  paymentIssues: '/api/admin/payment-issues',
  paymentProviders: '/api/admin/payment-providers',
  providerHealth: '/api/admin/payment-providers/health',
  queues: '/api/admin/queues',
  deadLetters: '/api/admin/dead-letters',
  webhooks: '/api/admin/webhooks',
  reconciliationRun: '/api/admin/reconciliation/run',
});

const providerRoutes = Object.freeze({
  providers: '/api/providers',
  readiness: '/api/providers/readiness',
  provider: (provider) => `/api/providers/${encodeURIComponent(provider)}`,
  providerReadiness: (provider) => `/api/providers/${encodeURIComponent(provider)}/readiness`,
  providerHealth: (provider) => `/api/providers/${encodeURIComponent(provider)}/health`,
  providerStatus: (provider) => `/api/providers/${encodeURIComponent(provider)}/status`,
  actionPreflight: (provider, operation) =>
    `/api/providers/${encodeURIComponent(provider)}/actions/${encodeURIComponent(operation)}/preflight`,
  lanes: (provider) => `/api/providers/${encodeURIComponent(provider)}/lanes`,
  lane: (provider, laneId) => `/api/providers/${encodeURIComponent(provider)}/lanes/${encodeURIComponent(laneId)}`,
  invoices: (provider) => `/api/providers/${encodeURIComponent(provider)}/invoices`,
  invoicePreview: (provider) => `/api/providers/${encodeURIComponent(provider)}/invoices/preview`,
  payouts: (provider) => `/api/providers/${encodeURIComponent(provider)}/payouts`,
  payoutPreview: (provider) => `/api/providers/${encodeURIComponent(provider)}/payouts/preview`,
  balance: (provider) => `/api/providers/${encodeURIComponent(provider)}/balance`,
  activity: (provider) => `/api/providers/${encodeURIComponent(provider)}/activity`,
});

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === 'ALL') {
      return;
    }
    query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : '';
}

function buildApiUrl(baseUrl, path, params = {}) {
  const normalizedBase = String(baseUrl || '').replace(/\/+$/, '');
  const normalizedPath = String(path || '').startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}${buildQuery(params)}`;
}

function createMutationIdempotencyKey(path, body = {}) {
  const bodyHint =
    body && typeof body === 'object'
      ? [body.id, body.invoiceId, body.payoutId, body.batchId, body.action].filter(Boolean).join(':')
      : '';
  const safePath = String(path || 'mutation').replace(/[^a-zA-Z0-9:_/-]/g, '-');
  return `bot:${safePath}:${bodyHint || randomUUID()}:${randomUUID()}`;
}

function createRequestId(prefix = 'bot') {
  const safePrefix = String(prefix || 'bot').replace(/[^a-zA-Z0-9:_-]/g, '-');
  return `${safePrefix}:${randomUUID()}`;
}

class ApiContractError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ApiContractError';
    this.code = 'API_CONTRACT_MISMATCH';
    this.details = details;
    this.userMessage = 'API response did not match the bot contract. Please check API deployment compatibility.';
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function formatPath(pathParts = []) {
  if (!pathParts.length) return '$';
  return pathParts
    .map((part, index) => (typeof part === 'number' ? `[${part}]` : index === 0 ? part : `.${part}`))
    .join('');
}

function describeRule(rule = {}) {
  if (typeof rule === 'string') return rule;
  if (Array.isArray(rule.oneOf)) return rule.oneOf.join(' | ');
  return rule.type || 'any';
}

function assertRule(condition, message, context) {
  if (!condition) {
    throw new ApiContractError(message, context);
  }
}

function validateRule(value, rule = {}, pathParts = [], context = {}) {
  const normalizedRule = typeof rule === 'string' ? { type: rule } : rule || {};
  const path = formatPath(pathParts);

  if (value === undefined) {
    if (normalizedRule.optional) return;
    throw new ApiContractError(`Missing API response field: ${path}`, { ...context, path, expected: describeRule(normalizedRule) });
  }

  if (value === null) {
    if (normalizedRule.allowNull) return;
    throw new ApiContractError(`Unexpected null API response field: ${path}`, { ...context, path, expected: describeRule(normalizedRule) });
  }

  if (Array.isArray(normalizedRule.oneOf) && normalizedRule.oneOf.length > 0) {
    assertRule(
      normalizedRule.oneOf.includes(value),
      `Unexpected API response value at ${path}`,
      { ...context, path, expected: normalizedRule.oneOf.join(' | ') },
    );
  }

  const type = normalizedRule.type || (normalizedRule.fields || normalizedRule.required ? 'object' : 'any');
  if (type === 'any') return;
  if (type === 'array') {
    assertRule(Array.isArray(value), `Unexpected API response type at ${path}`, { ...context, path, expected: 'array' });
    if (normalizedRule.items) {
      value.forEach((item, index) => validateRule(item, normalizedRule.items, [...pathParts, index], context));
    }
    return;
  }
  if (type === 'object') {
    assertRule(isPlainObject(value), `Unexpected API response type at ${path}`, { ...context, path, expected: 'object' });
    (normalizedRule.required || []).forEach((key) => {
      validateRule(value[key], { type: 'any' }, [...pathParts, key], context);
    });
    Object.entries(normalizedRule.fields || {}).forEach(([key, fieldRule]) => {
      validateRule(value[key], fieldRule, [...pathParts, key], context);
    });
    return;
  }
  assertRule(typeof value === type, `Unexpected API response type at ${path}`, { ...context, path, expected: type });
}

function validateApiResponseContract(data, contract, context = {}) {
  if (!contract) return data;
  validateRule(data, contract, [], context);
  return data;
}

const contractShapes = Object.freeze({
  okObject: { type: 'object' },
  errorResponse: {
    type: 'object',
    fields: {
      error: {
        type: 'object',
        fields: {
          message: { type: 'string' },
          code: { type: 'string', optional: true },
          retryAfter: { type: 'any', optional: true },
        },
      },
      requestId: { type: 'string', optional: true },
      retryAfter: { type: 'any', optional: true },
    },
  },
  dataArray: {
    type: 'object',
    fields: {
      data: { type: 'array' },
    },
  },
  paginatedData: {
    type: 'object',
    fields: {
      data: { type: 'array' },
      pagination: { type: 'object', optional: true },
    },
  },
  providerList: {
    type: 'object',
    fields: {
      data: { type: 'array' },
      providers: { type: 'array', optional: true },
      contract_version: { type: 'string', optional: true },
    },
  },
  providerCapabilityList: {
    type: 'object',
    fields: {
      data: {
        type: 'array',
        items: {
          type: 'object',
          fields: {
            slug: { type: 'string' },
            display_name: { type: 'string' },
            operations: { type: 'object' },
            lanes: { type: 'array' },
          },
        },
      },
      contract_version: { type: 'string', optional: true },
      requestId: { type: 'string', optional: true },
    },
  },
  providerLaneList: {
    type: 'object',
    fields: {
      data: {
        type: 'array',
        items: {
          type: 'object',
          fields: {
            id: { type: 'string' },
            label: { type: 'string' },
            intent: { type: 'string' },
            bot_action: { type: 'string', allowNull: true, optional: true },
          },
        },
      },
      provider: { type: 'string', optional: true },
      contract_version: { type: 'string', optional: true },
      requestId: { type: 'string', optional: true },
    },
  },
  providerActivityList: {
    type: 'object',
    fields: {
      data: {
        type: 'array',
        items: {
          type: 'object',
          fields: {
            type: { type: 'string' },
            provider: { type: 'string' },
            id: { type: 'string' },
            status: { type: 'string' },
            label: { type: 'string' },
          },
        },
      },
      pagination: { type: 'object', optional: true },
      provider: { type: 'string', optional: true },
      contract_version: { type: 'string', optional: true },
      requestId: { type: 'string', optional: true },
    },
  },
  providerReadinessList: {
    type: 'object',
    fields: {
      data: {
        type: 'array',
        items: {
          type: 'object',
          fields: {
            provider: { type: 'string' },
            display_name: { type: 'string' },
            ready: { type: 'boolean' },
            operations: { type: 'array' },
            lanes: { type: 'array' },
            recommended_next_steps: { type: 'array' },
          },
        },
      },
      contract_version: { type: 'string', optional: true },
      requestId: { type: 'string', optional: true },
    },
  },
  providerReadiness: {
    type: 'object',
    fields: {
      data: {
        type: 'object',
        fields: {
          provider: { type: 'string' },
          display_name: { type: 'string' },
          ready: { type: 'boolean' },
          operations: { type: 'array' },
          lanes: { type: 'array' },
          recommended_next_steps: { type: 'array' },
        },
      },
      provider: { type: 'string', optional: true },
      contract_version: { type: 'string', optional: true },
      requestId: { type: 'string', optional: true },
    },
  },
  providerHealth: {
    type: 'object',
    fields: {
      data: {
        type: 'object',
        fields: {
          provider: { type: 'string' },
          display_name: { type: 'string' },
          provider_status: { type: 'string' },
          score: { type: 'number' },
          status: { type: 'string' },
          failed_webhooks: { type: 'number' },
          recent_webhooks: { type: 'number' },
          unresolved_issues: { type: 'number' },
          reasons: { type: 'array' },
          next_actions: { type: 'array' },
        },
      },
      provider: { type: 'string', optional: true },
      contract_version: { oneOf: [PROVIDER_CONTRACT_VERSION], optional: true },
      requestId: { type: 'string', optional: true },
    },
  },
  providerStatus: {
    type: 'object',
    fields: {
      data: {
        type: 'object',
        fields: {
          provider: { type: 'string' },
          display_name: { type: 'string' },
          status: { type: 'string' },
          ready: { type: 'boolean' },
          provider_status: { type: 'string', optional: true },
          health_status: { type: 'string' },
          health_score: { type: 'number' },
          operations: { type: 'array' },
          lanes: { type: 'array' },
          warnings: { type: 'array' },
          next_actions: { type: 'array' },
        },
      },
      provider: { type: 'string', optional: true },
      contract_version: { oneOf: [PROVIDER_CONTRACT_VERSION], optional: true },
      requestId: { type: 'string', optional: true },
    },
  },
  providerActionPreflight: {
    type: 'object',
    fields: {
      data: {
        type: 'object',
        fields: {
          allowed: { type: 'boolean' },
          provider: { type: 'string' },
          operation: { type: 'string' },
          label: { type: 'string' },
          status: { type: 'string' },
          reason: { type: 'string', allowNull: true },
          code: { type: 'string', allowNull: true },
          supported_providers: { type: 'array' },
          warnings: { type: 'array' },
          next_actions: { type: 'array' },
        },
      },
      provider: { type: 'string', optional: true },
      contract_version: { oneOf: [PROVIDER_CONTRACT_VERSION], optional: true },
      requestId: { type: 'string', optional: true },
    },
  },
  health: {
    type: 'object',
    fields: {
      ok: { type: 'boolean', optional: true },
      status: { type: 'string', optional: true },
    },
  },
});

module.exports = {
  ADMIN_AUTH_HEADER,
  ApiContractError,
  IDEMPOTENCY_HEADER,
  REQUEST_ID_HEADER,
  adminRoutes,
  buildApiUrl,
  buildQuery,
  contractShapes,
  createMutationIdempotencyKey,
  createRequestId,
  providerRoutes,
  PROVIDER_CONTRACT_VERSION,
  validateApiResponseContract,
};
