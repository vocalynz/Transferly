process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || 'provider-smoke-client-id';
process.env.PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || 'provider-smoke-client-secret';
process.env.PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || 'provider-smoke-webhook-id';

const { PROVIDER_CONTRACT_VERSION, providerCapabilityService } = require('../services/providerCapabilityService');
const { providerHealthService } = require('../services/providerHealthService');
const { providerReadinessService } = require('../services/providerReadinessService');

async function main() {
  const capabilities = providerCapabilityService.listProviderCapabilities();
  const readiness = providerReadinessService.listProviderReadiness();
  const health = await providerHealthService.getProviderHealthReport();
  const mismatchedReadiness = readiness.filter((entry) => entry.contract_version !== PROVIDER_CONTRACT_VERSION);

  if (capabilities.length === 0) {
    throw new Error('No provider capabilities are registered.');
  }
  if (mismatchedReadiness.length > 0) {
    throw new Error(`Provider readiness contract mismatch: ${mismatchedReadiness.map((entry) => entry.provider).join(', ')}`);
  }
  if (!Array.isArray(health.data) || health.data.length === 0) {
    throw new Error('Provider health report did not return provider health rows.');
  }

  console.log(JSON.stringify({
    ok: true,
    contract_version: PROVIDER_CONTRACT_VERSION,
    providers: capabilities.length,
    readiness: readiness.length,
    health: health.data.length
  }));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
