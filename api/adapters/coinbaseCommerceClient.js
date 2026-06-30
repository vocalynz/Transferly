const { AppError } = require('../utils/errors');

class CoinbaseCommerceClient {
  constructor({ apiKey, baseUrl }) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async request({ method, path, body }) {
    if (!this.apiKey) {
      throw new AppError(503, 'CRYPTO_COMMERCE_NOT_CONFIGURED', 'Crypto Commerce is not configured.');
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CC-Api-Key': this.apiKey
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    const payload = await this.safeJson(response);

    if (!response.ok) {
      throw new AppError(response.status, 'CRYPTO_COMMERCE_API_ERROR', 'Crypto Commerce API request failed.', payload);
    }

    return payload && payload.data ? payload.data : payload;
  }

  retrieveCharge(chargeIdOrCode) {
    return this.request({
      method: 'GET',
      path: `/charges/${encodeURIComponent(chargeIdOrCode)}`
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
  CoinbaseCommerceClient
};
