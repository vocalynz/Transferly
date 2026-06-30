export const PROVIDER_CONTRACT_VERSION = '2026-06-provider-v1';

export const PROVIDER_OPERATION_KEYS = Object.freeze([
  'invoices',
  'payouts',
  'balance',
  'activity'
]);

export const PROVIDER_OPERATION_STATUSES = Object.freeze([
  'live',
  'preview',
  'setup',
  'unsupported'
]);

export function isProviderOperationImplemented(status) {
  return status === 'live' || status === 'preview';
}
