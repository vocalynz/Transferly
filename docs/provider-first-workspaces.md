# Provider-First Workspaces

## Summary
Transferly now treats payment providers as first-class service workspaces inside the Telegram Mini App. The mini app keeps Transferly as the primary shell, uses restrained provider identity, and routes provider-specific collection, sending, activity, developer, and setup flows through shared workspace primitives.

## Files Added
- `miniapp/src/lib/providerManifests.js`
- `miniapp/src/components/ProviderWorkspaceShell.jsx`
- `miniapp/src/components/ProviderWorkspaceFoundation.jsx`
- `miniapp/src/components/PayPalProviderWorkspace.jsx`
- `docs/provider-first-workspaces.md`

## Files Changed
- `miniapp/src/App.jsx`
- `miniapp/src/pages/MiniAppPage.jsx`
- `miniapp/src/components/AdminTabs/PaymentsTab.jsx`
- `miniapp/src/components/MiniAppFinanceSuite.jsx`
- `miniapp/src/components/MiniAppPointsWallet.jsx`
- `miniapp/src/components/MiniAppShell.jsx`
- `miniapp/src/components/RouteTransition.jsx`
- `miniapp/src/components/ui/BalanceCard.jsx`
- `miniapp/src/components/ui/ConfirmationModal.jsx`
- `miniapp/src/components/ui/PremiumButton.jsx`
- `miniapp/src/components/ui/PremiumInput.jsx`
- `miniapp/src/components/ui/StatGrid.jsx`
- `miniapp/src/components/ui/TransactionItem.jsx`
- `miniapp/src/index.css`
- `miniapp/src/lib/telegramMiniApp.js`
- `miniapp/tests/smoke.spec.js`

## Provider Routes Introduced
- `/miniapp/services/paypal/overview`
- `/miniapp/services/paypal/invoices`
- `/miniapp/services/paypal/payouts`
- `/miniapp/services/paypal/activity`
- `/miniapp/services/paypal/developer`
- `/miniapp/services/stripe/overview`
- `/miniapp/services/stripe/payments`
- `/miniapp/services/stripe/billing`
- `/miniapp/services/stripe/connect`
- `/miniapp/services/stripe/activity`
- `/miniapp/services/stripe/developer`
- `/miniapp/services/wise/overview`
- `/miniapp/services/wise/receive`
- `/miniapp/services/wise/send`
- `/miniapp/services/wise/balances`
- `/miniapp/services/wise/activity`
- `/miniapp/services/wise/compliance`
- `/miniapp/services/paystack/overview`
- `/miniapp/services/paystack/collections`
- `/miniapp/services/paystack/customers`
- `/miniapp/services/paystack/virtual-accounts`
- `/miniapp/services/paystack/subscriptions`
- `/miniapp/services/paystack/activity`
- `/miniapp/services/paystack/developer`
- `/miniapp/services/flutterwave/overview`
- `/miniapp/services/flutterwave/collections`
- `/miniapp/services/flutterwave/transfers`
- `/miniapp/services/flutterwave/settlements`
- `/miniapp/services/flutterwave/refunds`
- `/miniapp/services/flutterwave/activity`
- `/miniapp/services/flutterwave/developer`
- `/miniapp/services/crypto/overview`
- `/miniapp/services/crypto/receive`
- `/miniapp/services/crypto/send`
- `/miniapp/services/crypto/confirmations`
- `/miniapp/services/crypto/activity`
- `/miniapp/services/crypto/security`

## Provider Lanes
- PayPal: overview, custom details, invoices, payouts, wallet, activity, developer.
- Stripe: overview, payments, billing, connect, activity, developer.
- Wise: overview, receive, send, balances, activity, compliance.
- Paystack: overview, collections, customers, virtual accounts, subscriptions, activity, developer.
- Flutterwave: overview, collections, transfers, settlements, refunds, activity, developer.
- Crypto Commerce: overview, receive, send, confirmations, activity, security.

## Legacy Routes Redirected
- `/services/:slug?view=...` redirects into `/miniapp/services/:slug/:lane` for known provider manifests.
- `/miniapp/services/:slug` redirects to `/miniapp/services/:slug/overview` for known provider manifests.
- Provider-scoped `/miniapp/invoices?provider=:slug` redirects into the provider's preferred collection lane.
- Provider-scoped `/miniapp/payouts?provider=:slug` redirects into the provider's preferred sending lane.

## Known Limitations
- PayPal is the only fully migrated provider workspace with dedicated lane behavior.
- Stripe and Crypto reuse existing aggregate payment views only where backend support already exists.
- Wise, Paystack, and Flutterwave lanes are intentionally setup-backed until provider adapters, secrets, webhooks, and persistence are connected.
- Global invoice and payout pages remain available as aggregate/operator views for backward compatibility.
- Provider health and balance summaries still depend on the existing operations context.

## Recommended Follow-Up
- Add provider-specific backend adapters and persistence for setup-backed lanes.
- Add route-level tests for provider workspace redirects and unsupported-lane fallbacks.
- Promote provider health, balances, and activity loaders into reusable provider data hooks.
- Convert remaining generic invoice and payout entry points into clearly labeled aggregate operator dashboards.
- Add production monitoring events for provider workspace load failures and unavailable-lane hits.
