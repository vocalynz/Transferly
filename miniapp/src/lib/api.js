import { getRawTelegramInitData, getTelegramStartParam } from './telegramMiniApp';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const API_REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_REQUEST_TIMEOUT_MS || 15000);
const API_SAFE_RETRY_ATTEMPTS = Number(import.meta.env.VITE_API_SAFE_RETRY_ATTEMPTS || 1);
const TOKEN_STORAGE_KEY = 'transferly_api_token';
const ADMIN_TOKEN_STORAGE_KEY = 'transferly_admin_api_token';
const LEGACY_TOKEN_STORAGE_KEY = 'slipcraft_api_token';
const SAFE_RETRY_METHODS = new Set(['GET', 'HEAD']);
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

function buildUrl(path) {
  if (!path.startsWith('/')) {
    throw new Error(`API path must start with "/": ${path}`);
  }

  return `${API_BASE_URL}${path}`;
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === 'ALL') {
      return;
    }
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

async function parseJsonSafely(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getRequestMethod(options = {}) {
  return String(options.method || 'GET').toUpperCase();
}

function getRetryDelay(attempt, response) {
  const retryAfter = response?.headers?.get('retry-after');

  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) {
      return Math.min(Math.max(seconds * 1000, 250), 2500);
    }

    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) {
      return Math.min(Math.max(retryAt - Date.now(), 250), 2500);
    }
  }

  return Math.min(300 * 2 ** attempt, 1800);
}

function createNetworkError(error, requestId) {
  const requestError = new Error(
    error.name === 'AbortError'
      ? 'Request timed out. Please try again.'
      : 'Unable to reach Transferly. Please check your connection.'
  );
  requestError.code = error.name === 'AbortError' ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR';
  requestError.requestId = requestId;
  return requestError;
}

export function getStoredToken() {
  const currentToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (currentToken) {
    return currentToken;
  }

  const legacyToken = window.localStorage.getItem(LEGACY_TOKEN_STORAGE_KEY);
  if (legacyToken) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, legacyToken);
    return legacyToken;
  }

  return null;
}

export function getStoredAdminToken() {
  return window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || null;
}

export function setStoredToken(token) {
  if (!token) {
    clearStoredToken();
    return;
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function setStoredAdminToken(token) {
  if (!token) {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken() {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
}

function getStoredTokenForPath(path) {
  if (path.startsWith('/api/admin')) {
    return getStoredAdminToken() || getStoredToken();
  }

  if (path === '/api/me' || path === '/api/me/command-center') {
    return getStoredToken() || getStoredAdminToken();
  }

  return getStoredToken();
}

function createIdempotencyKey(prefix) {
  if (window.crypto?.randomUUID) {
    return `${prefix}:${window.crypto.randomUUID()}`;
  }

  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function createRequestId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `miniapp:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function createRequestSignal(parentSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();

  if (parentSignal?.aborted) {
    abort();
  } else {
    parentSignal?.addEventListener('abort', abort, { once: true });
  }

  const timeout = window.setTimeout(abort, API_REQUEST_TIMEOUT_MS);

  return {
    signal: controller.signal,
    cleanup() {
      window.clearTimeout(timeout);
      parentSignal?.removeEventListener('abort', abort);
    }
  };
}

export async function apiRequest(path, options = {}) {
  const { retries, signal: parentSignal, ...fetchOptions } = options;
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  headers.set('X-Transferly-Client', 'telegram-miniapp');

  if (!headers.has('X-Request-Id')) {
    headers.set('X-Request-Id', createRequestId());
  }

  const telegramInitData = getRawTelegramInitData();
  if (telegramInitData && !headers.has('X-Telegram-Init-Data')) {
    headers.set('X-Telegram-Init-Data', telegramInitData);
  }

  const telegramStartParam = getTelegramStartParam();
  if (telegramStartParam && !headers.has('X-Telegram-Start-Param')) {
    headers.set('X-Telegram-Start-Param', telegramStartParam);
  }

  let body = options.body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }

  const token = getStoredTokenForPath(path);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const method = getRequestMethod(options);
  const retryAttempts = Number.isFinite(Number(retries))
    ? Math.max(0, Number(retries))
    : (SAFE_RETRY_METHODS.has(method) ? API_SAFE_RETRY_ATTEMPTS : 0);
  const requestId = headers.get('X-Request-Id');
  let response;

  for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
    const requestSignal = createRequestSignal(parentSignal);

    try {
      response = await fetch(buildUrl(path), {
        ...fetchOptions,
        headers,
        body,
        signal: requestSignal.signal
      });
    } catch (error) {
      requestSignal.cleanup();

      if (attempt < retryAttempts && !parentSignal?.aborted && error.name !== 'AbortError') {
        await sleep(getRetryDelay(attempt));
        continue;
      }

      throw createNetworkError(error, requestId);
    }

    requestSignal.cleanup();

    if (
      response.ok ||
      !RETRYABLE_STATUS_CODES.has(response.status) ||
      attempt >= retryAttempts ||
      parentSignal?.aborted
    ) {
      break;
    }

    await sleep(getRetryDelay(attempt, response));
  }

  const payload = await parseJsonSafely(response);
  const responseRequestId = response.headers.get('x-request-id') || payload?.requestId || requestId;

  if (!response.ok) {
    const error = new Error(
      payload?.error?.message ||
        payload?.message ||
        `Request failed with status ${response.status}`
    );
    error.status = response.status;
    error.payload = payload;
    error.code = payload?.error?.code || payload?.code || null;
    error.retryAfter =
      response.headers.get('retry-after') ||
      payload?.retryAfter ||
      payload?.error?.retryAfter ||
      null;
    error.requestId = responseRequestId;
    throw error;
  }

  return payload;
}

export function getBootstrap() {
  return apiRequest('/api/bootstrap');
}

export function getMe() {
  return apiRequest('/api/me');
}

export function getMiniAppCommandCenter() {
  return apiRequest('/api/me/command-center');
}

export function getServiceCommandCenterSummary(slug) {
  return apiRequest(`/api/services/${encodeURIComponent(slug)}/command-center`);
}

export function getServiceLaneDetail(slug, laneId) {
  return apiRequest(`/api/services/${encodeURIComponent(slug)}/lanes/${encodeURIComponent(laneId)}`);
}

export function createServiceLaneActionIntent(slug, laneId, payload = {}) {
  return apiRequest(`/api/services/${encodeURIComponent(slug)}/lanes/${encodeURIComponent(laneId)}/actions`, {
    method: 'POST',
    body: payload
  });
}

export function loginWithTelegramMiniApp({ initData, startParam }) {
  return apiRequest('/api/auth/telegram-mini-app', {
    method: 'POST',
    body: {
      initData,
      startParam: startParam || undefined
    }
  });
}

export function generateReceipt(payload) {
  return apiRequest('/api/receipt/generate', {
    method: 'POST',
    body: payload
  });
}

export function getReferralStats() {
  return apiRequest('/api/referral', {
    method: 'POST',
    body: { action: 'stats' }
  });
}

export function updateProfile(payload) {
  return apiRequest('/api/user/me/profile', {
    method: 'PATCH',
    body: payload
  });
}

export function deleteAccount() {
  return apiRequest('/api/user/me', {
    method: 'DELETE'
  });
}

export function listTopUpOrders() {
  return apiRequest('/api/user/me/top-up-orders');
}

export function createTopUpOrder(payload) {
  return apiRequest('/api/user/me/top-up-orders', {
    method: 'POST',
    body: payload
  });
}

export function updateTopUpOrderStatus(orderId, payload) {
  return apiRequest(`/api/user/me/top-up-orders/${encodeURIComponent(orderId)}/status`, {
    method: 'PATCH',
    body: payload
  });
}

export function listAdminTopUpOrders(params = {}) {
  const search = new URLSearchParams();
  if (params.status) {
    search.set('status', params.status);
  }
  if (params.userId) {
    search.set('userId', params.userId);
  }
  if (params.limit) {
    search.set('limit', String(params.limit));
  }
  const query = search.toString();
  return apiRequest(`/api/admin/top-up-orders${query ? `?${query}` : ''}`);
}

export function completeAdminTopUpOrder(orderId, notes) {
  return apiRequest(`/api/admin/top-up-orders/${encodeURIComponent(orderId)}/complete`, {
    method: 'POST',
    body: notes ? { notes } : {}
  });
}

export function cancelAdminTopUpOrder(orderId, notes) {
  return apiRequest(`/api/admin/top-up-orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'POST',
    body: notes ? { notes } : {}
  });
}

export function getAdminUsers() {
  return apiRequest('/api/admin/users');
}

export function listAdminInvoiceTemplates() {
  return apiRequest('/api/admin/invoice-templates');
}

export function listAdminInvoices(params = {}) {
  return apiRequest(`/api/admin/invoices${buildQuery(params)}`);
}

export function listPaymentProviders() {
  return apiRequest('/api/admin/payment-providers');
}

export function listPaymentProviderHealth() {
  return apiRequest('/api/admin/payment-providers/health');
}

export function listPaymentProviderInvoiceFeatures() {
  return apiRequest('/api/admin/payment-providers/invoice-features');
}

export function getPaymentProviderBalance(provider) {
  return apiRequest(`/api/admin/payment-providers/${encodeURIComponent(provider)}/balance`);
}

function buildProviderPath(provider, suffix = '') {
  const basePath = `/api/providers/${encodeURIComponent(provider)}`;
  return suffix ? `${basePath}/${suffix}` : basePath;
}

export function listProviderCapabilities() {
  return apiRequest('/api/providers');
}

export function getProviderCapability(provider) {
  return apiRequest(buildProviderPath(provider));
}

export function listProviderReadiness() {
  return apiRequest('/api/providers/readiness');
}

export function getProviderReadiness(provider) {
  return apiRequest(buildProviderPath(provider, 'readiness'));
}

export function getProviderHealth(provider) {
  return apiRequest(buildProviderPath(provider, 'health'));
}

export function getProviderStatus(provider) {
  return apiRequest(buildProviderPath(provider, 'status'));
}

export function preflightProviderAction(provider, operation) {
  return apiRequest(`${buildProviderPath(provider, 'actions')}/${encodeURIComponent(operation)}/preflight`);
}

export function listProviderLanes(provider) {
  return apiRequest(buildProviderPath(provider, 'lanes'));
}

export function getProviderLane(provider, laneId) {
  return apiRequest(`${buildProviderPath(provider, 'lanes')}/${encodeURIComponent(laneId)}`);
}

export function listProviderInvoices(provider, params = {}) {
  return apiRequest(`${buildProviderPath(provider, 'invoices')}${buildQuery(params)}`);
}

export function previewProviderInvoice(provider, payload) {
  return apiRequest(buildProviderPath(provider, 'invoices/preview'), {
    method: 'POST',
    body: payload
  });
}

export function createProviderInvoice(provider, payload) {
  return apiRequest(buildProviderPath(provider, 'invoices'), {
    method: 'POST',
    body: payload
  });
}

export function listProviderPayouts(provider, params = {}) {
  return apiRequest(`${buildProviderPath(provider, 'payouts')}${buildQuery(params)}`);
}

export function previewProviderPayout(provider, payload) {
  return apiRequest(buildProviderPath(provider, 'payouts/preview'), {
    method: 'POST',
    body: payload
  });
}

export function createProviderPayout(provider, payload = {}) {
  const { idempotencyKey, ...body } = payload;
  return apiRequest(buildProviderPath(provider, 'payouts'), {
    method: 'POST',
    headers: {
      'Idempotency-Key': idempotencyKey || createIdempotencyKey(`provider-payout:${provider}`)
    },
    body
  });
}

export function getProviderScopedBalance(provider, params = {}) {
  return apiRequest(`${buildProviderPath(provider, 'balance')}${buildQuery(params)}`);
}

export function listProviderActivity(provider, params = {}) {
  return apiRequest(`${buildProviderPath(provider, 'activity')}${buildQuery(params)}`);
}

export function listStripeConnectedAccounts(params = {}) {
  return apiRequest(`/api/admin/payment-providers/stripe/connected-accounts${buildQuery(params)}`);
}

export function createStripeConnectedAccount(payload) {
  return apiRequest('/api/admin/payment-providers/stripe/connected-accounts', {
    method: 'POST',
    body: payload
  });
}

export function refreshStripeConnectedAccount(accountId) {
  return apiRequest(`/api/admin/payment-providers/stripe/connected-accounts/${encodeURIComponent(accountId)}/refresh`, {
    method: 'POST'
  });
}

export function createStripeConnectedAccountOnboardingLink(accountId, payload = {}) {
  return apiRequest(`/api/admin/payment-providers/stripe/connected-accounts/${encodeURIComponent(accountId)}/onboarding-link`, {
    method: 'POST',
    body: payload
  });
}

export function listInvoiceReminderConfigurations(type) {
  const search = type ? `?type=${encodeURIComponent(type)}` : '';
  return apiRequest(`/api/admin/invoice-reminders${search}`);
}

export function updateInvoiceReminderConfiguration(configurationId, payload) {
  return apiRequest(`/api/admin/invoice-reminders/${encodeURIComponent(configurationId)}`, {
    method: 'PUT',
    body: payload
  });
}

export function suspendInvoiceReminderConfiguration(configurationId) {
  return apiRequest(`/api/admin/invoice-reminders/${encodeURIComponent(configurationId)}/suspend`, {
    method: 'POST'
  });
}

export function resumeInvoiceReminderConfiguration(configurationId) {
  return apiRequest(`/api/admin/invoice-reminders/${encodeURIComponent(configurationId)}/resume`, {
    method: 'POST'
  });
}

export function createAdminInvoiceTemplate(payload) {
  return apiRequest('/api/admin/invoice-templates', {
    method: 'POST',
    body: payload
  });
}

export function updateAdminInvoiceTemplate(templateId, payload) {
  return apiRequest(`/api/admin/invoice-templates/${encodeURIComponent(templateId)}`, {
    method: 'PATCH',
    body: payload
  });
}

export function deleteAdminInvoiceTemplate(templateId) {
  return apiRequest(`/api/admin/invoice-templates/${encodeURIComponent(templateId)}`, {
    method: 'DELETE'
  });
}

export function listPaymentOpsIssues(params = {}) {
  return apiRequest(`/api/admin/payment-issues${buildQuery(params)}`);
}

export function listAdminWebhookEvents(params = {}) {
  return apiRequest(`/api/admin/webhooks${buildQuery(params)}`);
}

export function listDeadLetterJobs(params = {}) {
  return apiRequest(`/api/admin/dead-letters${buildQuery(params)}`);
}

export function recoverDeadLetterJob(jobId, note) {
  return apiRequest(`/api/admin/dead-letters/${encodeURIComponent(jobId)}/recover`, {
    method: 'POST',
    body: note ? { note } : {}
  });
}

export function getAdminWebhookEvent(webhookEventId) {
  return apiRequest(`/api/admin/webhooks/${encodeURIComponent(webhookEventId)}`);
}

export function replayAdminWebhookEvent(webhookEventId, note) {
  return apiRequest(`/api/admin/webhooks/${encodeURIComponent(webhookEventId)}/replay`, {
    method: 'POST',
    body: note ? { note } : {}
  });
}

export function ignoreAdminWebhookEvent(webhookEventId, note) {
  return apiRequest(`/api/admin/webhooks/${encodeURIComponent(webhookEventId)}/ignore`, {
    method: 'POST',
    body: note ? { note } : {}
  });
}

export function acknowledgePaymentOpsIssue(issueId, note) {
  return apiRequest(`/api/admin/payment-issues/${encodeURIComponent(issueId)}/acknowledge`, {
    method: 'POST',
    body: note ? { note } : {}
  });
}

export function resolvePaymentOpsIssue(issueId, note) {
  return apiRequest(`/api/admin/payment-issues/${encodeURIComponent(issueId)}/resolve`, {
    method: 'POST',
    body: note ? { note } : {}
  });
}

export function reopenPaymentOpsIssue(issueId, note) {
  return apiRequest(`/api/admin/payment-issues/${encodeURIComponent(issueId)}/reopen`, {
    method: 'POST',
    body: note ? { note } : {}
  });
}

export function adjustUserPoints(userId, delta, reason) {
  return apiRequest(`/api/admin/users/${encodeURIComponent(userId)}/points`, {
    method: 'POST',
    body: { delta, reason }
  });
}

export function updatePlatformConfig(payload) {
  return apiRequest('/api/admin/config', {
    method: 'PATCH',
    body: payload
  });
}

export function createFaq(payload) {
  return apiRequest('/api/admin/faqs', {
    method: 'POST',
    body: payload
  });
}

export function updateFaq(faqId, payload) {
  return apiRequest(`/api/admin/faqs/${faqId}`, {
    method: 'PATCH',
    body: payload
  });
}

export function deleteFaq(faqId) {
  return apiRequest(`/api/admin/faqs/${faqId}`, {
    method: 'DELETE'
  });
}

export function createTestimonial(payload) {
  return apiRequest('/api/admin/testimonials', {
    method: 'POST',
    body: payload
  });
}

export function updateTestimonial(testimonialId, payload) {
  return apiRequest(`/api/admin/testimonials/${testimonialId}`, {
    method: 'PATCH',
    body: payload
  });
}

export function deleteTestimonial(testimonialId) {
  return apiRequest(`/api/admin/testimonials/${testimonialId}`, {
    method: 'DELETE'
  });
}

export function listInvoices(params = {}) {
  return apiRequest(`/api/invoices${buildQuery(params)}`);
}

export function createInvoice(payload) {
  return apiRequest('/api/invoices', {
    method: 'POST',
    body: payload
  });
}

export function previewInvoice(payload) {
  return apiRequest('/api/invoices/preview', {
    method: 'POST',
    body: payload
  });
}

export function getInvoice(invoiceId) {
  return apiRequest(`/api/invoices/${encodeURIComponent(invoiceId)}`);
}

export function refreshInvoice(invoiceId) {
  return apiRequest(`/api/invoices/${encodeURIComponent(invoiceId)}/refresh`, {
    method: 'POST'
  });
}

export function sendInvoiceReminder(invoiceId) {
  return apiRequest(`/api/invoices/${encodeURIComponent(invoiceId)}/remind`, {
    method: 'POST'
  });
}

export function cancelInvoiceAutoReminders(invoiceId) {
  return apiRequest(`/api/invoices/${encodeURIComponent(invoiceId)}/cancel-reminders`, {
    method: 'POST'
  });
}

export function generateInvoiceQr(invoiceId) {
  return apiRequest(`/api/invoices/${encodeURIComponent(invoiceId)}/qr`, {
    method: 'POST'
  });
}

export function cancelInvoice(invoiceId) {
  return apiRequest(`/api/invoices/${encodeURIComponent(invoiceId)}/cancel`, {
    method: 'POST'
  });
}

export function getInvoiceTimeline(invoiceId, limit = 25) {
  return apiRequest(`/api/invoices/${encodeURIComponent(invoiceId)}/timeline?limit=${encodeURIComponent(limit)}`);
}

export function listPayouts(params = {}) {
  return apiRequest(`/api/payouts${buildQuery(params)}`);
}

export function listAdminPayouts(params = {}) {
  return apiRequest(`/api/admin/payouts${buildQuery(params)}`);
}

export function createPayout(payload) {
  const { idempotencyKey, ...body } = payload || {};

  return apiRequest('/api/payouts', {
    method: 'POST',
    headers: {
      'Idempotency-Key': idempotencyKey || createIdempotencyKey('payout')
    },
    body
  });
}

export function previewPayout(payload) {
  return apiRequest('/api/payouts/preview', {
    method: 'POST',
    body: payload
  });
}

export function getPayout(payoutId) {
  return apiRequest(`/api/payouts/${encodeURIComponent(payoutId)}`);
}

export function approveAdminPayout(payoutId) {
  return apiRequest(`/api/admin/payouts/${encodeURIComponent(payoutId)}/approve`, {
    method: 'POST'
  });
}

export function rejectAdminPayout(payoutId, reason) {
  return apiRequest(`/api/admin/payouts/${encodeURIComponent(payoutId)}/reject`, {
    method: 'POST',
    body: reason ? { reason } : {}
  });
}

export function releaseAdminInvoiceFunds(invoiceId, payload = {}) {
  return apiRequest(`/api/admin/invoices/${encodeURIComponent(invoiceId)}/release`, {
    method: 'POST',
    headers: {
      'Idempotency-Key': `invoice-release:${invoiceId}:${Date.now()}`
    },
    body: payload
  });
}

export function markAdminInvoiceReviewRequired(invoiceId, payload = {}) {
  return apiRequest(`/api/admin/invoices/${encodeURIComponent(invoiceId)}/review-required`, {
    method: 'POST',
    body: payload
  });
}

export function addAdminInvoiceNote(invoiceId, note) {
  return apiRequest(`/api/admin/invoices/${encodeURIComponent(invoiceId)}/notes`, {
    method: 'POST',
    body: { note }
  });
}

export function addAdminPayoutNote(payoutId, note) {
  return apiRequest(`/api/admin/payouts/${encodeURIComponent(payoutId)}/notes`, {
    method: 'POST',
    body: { note }
  });
}

export function refreshPayout(payoutId) {
  return apiRequest(`/api/payouts/${encodeURIComponent(payoutId)}/refresh`, {
    method: 'POST'
  });
}

export function cancelUnclaimedPayout(payoutId) {
  return apiRequest(`/api/admin/payouts/${encodeURIComponent(payoutId)}/cancel-unclaimed`, {
    method: 'POST'
  });
}

export function getPayoutTimeline(payoutId, limit = 25) {
  return apiRequest(`/api/payouts/${encodeURIComponent(payoutId)}/timeline?limit=${encodeURIComponent(limit)}`);
}

export function runPaymentReconciliation(payload = {}) {
  return apiRequest('/api/admin/reconciliation/run', {
    method: 'POST',
    body: payload
  });
}
