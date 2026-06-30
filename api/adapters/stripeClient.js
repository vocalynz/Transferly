const { AppError } = require('../utils/errors');

function appendFormValue(params, key, value) {
  if (value === undefined || value === null || value === '') {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      appendFormValue(params, `${key}[${index}]`, entry);
    });
    return;
  }

  if (typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value)) {
      appendFormValue(params, `${key}[${childKey}]`, childValue);
    }
    return;
  }

  params.append(key, String(value));
}

function encodeFormBody(body = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    appendFormValue(params, key, value);
  }
  return params.toString();
}

class StripeClient {
  constructor({ secretKey, apiVersion, baseUrl }) {
    this.secretKey = secretKey;
    this.apiVersion = apiVersion;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async request({ method, path, body, idempotencyKey, stripeAccount }) {
    if (!this.secretKey) {
      throw new AppError(503, 'STRIPE_NOT_CONFIGURED', 'Stripe is not configured.');
    }

    const headers = {
      Authorization: `Bearer ${this.secretKey}`,
      Accept: 'application/json',
      'Stripe-Version': this.apiVersion
    };

    const request = {
      method,
      headers
    };

    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    if (stripeAccount) {
      headers['Stripe-Account'] = stripeAccount;
    }

    if (body !== undefined) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      request.body = encodeFormBody(body);
    }

    const response = await fetch(`${this.baseUrl}${path}`, request);
    const payload = await this.safeJson(response);

    if (!response.ok) {
      throw new AppError(response.status, 'STRIPE_API_ERROR', 'Stripe API request failed.', payload);
    }

    return payload;
  }

  retrieveInvoice(invoiceId) {
    return this.request({
      method: 'GET',
      path: `/v1/invoices/${encodeURIComponent(invoiceId)}`
    });
  }

  retrieveBalance(options = {}) {
    return this.request({
      method: 'GET',
      path: '/v1/balance',
      stripeAccount: options.stripeAccount
    });
  }

  createAccount(input, idempotencyKey) {
    return this.request({
      method: 'POST',
      path: '/v1/accounts',
      idempotencyKey,
      body: {
        country: input.country,
        email: input.email,
        business_type: input.businessType,
        controller: input.controller,
        capabilities: input.capabilities,
        metadata: input.metadata
      }
    });
  }

  retrieveAccount(accountId) {
    return this.request({
      method: 'GET',
      path: `/v1/accounts/${encodeURIComponent(accountId)}`
    });
  }

  createAccountLink(input) {
    return this.request({
      method: 'POST',
      path: '/v1/account_links',
      body: {
        account: input.account,
        refresh_url: input.refreshUrl,
        return_url: input.returnUrl,
        type: input.type || 'account_onboarding',
        collect: input.collect
      }
    });
  }

  createTransfer(input, idempotencyKey) {
    return this.request({
      method: 'POST',
      path: '/v1/transfers',
      idempotencyKey,
      body: {
        amount: input.amount,
        currency: input.currency,
        destination: input.destination,
        description: input.description,
        metadata: input.metadata,
        transfer_group: input.transferGroup,
        source_transaction: input.sourceTransaction,
        source_type: input.sourceType
      }
    });
  }

  retrieveTransfer(transferId) {
    return this.request({
      method: 'GET',
      path: `/v1/transfers/${encodeURIComponent(transferId)}`
    });
  }

  voidInvoice(invoiceId, idempotencyKey) {
    return this.request({
      method: 'POST',
      path: `/v1/invoices/${encodeURIComponent(invoiceId)}/void`,
      idempotencyKey
    });
  }

  async safeJson(response) {
    const text = await response.text();
    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch (_error) {
      return { message: text };
    }
  }
}

module.exports = {
  StripeClient,
  encodeFormBody
};
