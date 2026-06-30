const { AppError } = require('../utils/errors');

const baseUrlByEnvironment = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  production: 'https://api-m.paypal.com'
};

class PayPalClient {
  constructor(clientId, clientSecret, environment) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.environment = environment;
    this.accessToken = null;
  }

  async request({ method, path, body, requestId, headers = {} }) {
    const token = await this.getAccessToken();
    const requestHeaders = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...headers
    };

    if (requestId) {
      requestHeaders['PayPal-Request-Id'] = requestId;
    }

    if (body !== undefined) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${baseUrlByEnvironment[this.environment]}${path}`, {
      method,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const errorBody = await this.safeJson(response);
      throw new AppError(response.status, 'PAYPAL_API_ERROR', 'PayPal API request failed.', errorBody);
    }

    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }

    return response.text();
  }

  verifyWebhookSignature(payload) {
    return this.request({
      method: 'POST',
      path: '/v1/notifications/verify-webhook-signature',
      body: payload
    });
  }

  async getAccessToken() {
    const now = Date.now();
    if (this.accessToken && this.accessToken.expiresAt > now) {
      return this.accessToken.value;
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await fetch(`${baseUrlByEnvironment[this.environment]}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      const errorBody = await this.safeJson(response);
      throw new AppError(response.status, 'PAYPAL_AUTH_ERROR', 'Failed to obtain PayPal access token.', errorBody);
    }

    const tokenBody = await response.json();
    this.accessToken = {
      value: tokenBody.access_token,
      expiresAt: now + Math.max(tokenBody.expires_in - 60, 30) * 1000
    };

    return this.accessToken.value;
  }

  async safeJson(response) {
    try {
      return await response.json();
    } catch (_error) {
      return { message: await response.text() };
    }
  }
}

module.exports = {
  PayPalClient
};
