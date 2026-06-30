# Payment Provider Adapter Registry

## Purpose
- Keep PayPal as the default live invoice and payout provider.
- Route invoice creation through a provider-aware service while keeping money movement guarded by readiness checks.
- Register future providers behind a common discovery surface before enabling payout or ledger movement.
- Expose provider readiness to admin tools without leaking secret values.

## Registered Providers
- PayPal: default invoice, hosted payment link, payout, webhook workflows.
- Stripe Connect: hosted invoice creation is implemented through Customer -> Invoice Item -> Invoice -> Finalize -> Send. Invoice refresh, void, webhook settlement, hosted link/PDF admin actions, reconciliation, platform balance retrieval, guarded payout preview, and gated connected-account transfer submission are implemented. Refunds, disputes, and bank-account manual payout management remain adapter work.
- Wise Platform: future payout corridors with quote, recipient, transfer, funding, balance, and receipt support.
- Paystack: future African card/bank collection plus transfer recipient, transfer, refund, dispute, and webhook support.
- Flutterwave: future African and cross-border collection/payout support with transfer recipients, rates, transfers, refunds, and webhooks.
- Crypto Commerce: hosted charge creation is implemented for invoice-like collection. Charge refresh, signed webhook settlement, settlement-review flags, hosted charge admin actions, and reconciliation are implemented. Outgoing crypto payouts remain unsupported until a custody/payout provider is approved.

## Admin API
- `GET /api/admin/payment-providers`
  - Lists each provider, status, capabilities, supported operations, required environment variable names, missing environment variable names, docs, and next actions.
- `GET /api/admin/payment-providers/:provider`
  - Returns detailed readiness notes for one provider.
- `GET /api/admin/payment-providers/invoice-features`
  - Lists the invoice, hosted payment link, or crypto checkout feature contract for every provider.
- `GET /api/admin/payment-providers/:provider/invoice-features`
  - Returns one provider's invoice feature contract.
- `GET /api/admin/payment-providers/:provider/balance`
  - Returns normalized provider balance data. Stripe is currently supported and can be scoped to `STRIPE_CONNECTED_ACCOUNT_ID` or a `connectedAccountId` query value.
- `GET /api/admin/payment-providers/stripe/connected-accounts`
  - Lists locally tracked Stripe connected accounts and their readiness fields.
- `POST /api/admin/payment-providers/stripe/connected-accounts`
  - Creates a Stripe connected account or registers an existing `acct_...` account id, then stores normalized readiness locally.
- `POST /api/admin/payment-providers/stripe/connected-accounts/:id/onboarding-link`
  - Creates a single-use Stripe-hosted onboarding link. The URL is returned to the caller but not persisted.
- `POST /api/admin/payment-providers/stripe/connected-accounts/:id/refresh`
  - Retrieves the Stripe account and refreshes local readiness.

## Implementation Rules
- Never expose configured secret values through provider discovery responses.
- Keep provider money movement disabled until the provider has:
  - signed request client
  - webhook verifier
  - idempotency strategy
  - provider-to-internal state mapping
  - ledger transaction rules
  - audit log events
  - sandbox smoke test coverage
- Treat the internal ledger as the source of truth for balances; provider status is only reconciliation input.

## Invoice Feature Model
- PayPal uses official invoices and exposes a hosted invoice payment URL after create/send.
- Stripe uses official invoices and hosted invoice pages. The implementation creates invoice items before creating, finalizing, and sending the invoice so the hosted invoice URL and PDF can be persisted.
- Wise is payout-only in Transferly and should not appear as an invoice creation option.
- Paystack maps invoice-like flows to Payment Requests, including draft/finalize/notify/archive support.
- Flutterwave maps invoice-like flows to hosted checkout/payment links and transaction verification.
- Crypto maps invoice-like flows to hosted crypto charges/checkouts. Charges are not treated as settled until webhook or reconciliation work confirms payment, confirmation depth, underpayment/overpayment handling, and network-match rules.

## Implemented Provider Invoice Routes
- `POST /api/invoices/preview` accepts `provider=paypal|stripe|crypto` and returns draft totals plus provider readiness. PayPal previews keep the existing PayPal shape.
- `POST /api/invoices` accepts `provider=paypal|stripe|crypto`.
- `GET /api/invoices` accepts `provider=paypal|stripe|crypto` so provider launchers can show focused workspaces.
- PayPal remains the default when `provider` is omitted.
- Stripe requires `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to be present in provider readiness before hosted invoice creation.
- Crypto Commerce requires `CRYPTO_COMMERCE_API_KEY` and `CRYPTO_COMMERCE_WEBHOOK_SECRET` to be present in provider readiness before hosted charge creation.
- Non-PayPal provider records still use existing invoice persistence columns for compatibility. The owning provider is stored in invoice metadata and remote provider details.

## Implemented Provider Webhooks
- `POST /webhooks/stripe` verifies the `Stripe-Signature` HMAC before storing and processing events.
- Stripe invoice events sync provider state for finalized, sent, paid, payment succeeded, payment failed, updated, and voided invoice events.
- `POST /webhooks/crypto` verifies the `X-Hook0-Signature` HMAC before storing and processing events.
- Crypto charge events sync provider state for created, pending, confirmed, failed, delayed, resolved, checkout success, checkout failed, and checkout expired events.
- Provider invoice settlement uses a stable provider-resource ledger key, not a webhook event key, so a paid invoice refreshed from the API and later delivered by webhook is credited only once.

## Admin Invoice Actions
- PayPal invoices expose refresh, release funds, open hosted link, and cancel actions.
- Stripe invoices expose refresh, release funds, open hosted link, open PDF, and void actions.
- Crypto charges expose refresh, release funds, open hosted charge, and mark review required actions.
- Admin routes are:
  - `POST /api/admin/invoices/:id/refresh`
  - `POST /api/admin/invoices/:id/void`
  - `POST /api/admin/invoices/:id/review-required`

## Reconciliation
- Admin reconciliation refreshes reconcilable PayPal, Stripe, and Crypto invoice records through the provider-aware invoice service.
- Reconciliation still treats the internal ledger as source of truth; provider status can move invoice state and trigger guarded pending credits, but available balance changes remain controlled by release actions.

## Provider Balance And Payout Preview
- Stripe wallet balance is live for admins through the provider launcher and Telegram provider lane.
- `POST /api/payouts/preview` accepts `provider=stripe` and returns fee, total debit, internal wallet impact, risk path, and admin-only Stripe balance context.
- `POST /api/payouts` accepts `provider=stripe` only when `STRIPE_PAYOUTS_ENABLED=true`; otherwise it rejects with `STRIPE_PAYOUT_SUBMISSION_DISABLED`.
- Stripe payout submission currently creates a Stripe Connect transfer from platform balance to a connected account. The destination can come from the request receiver when it is an `acct_...` id, request metadata, or `STRIPE_CONNECTED_ACCOUNT_ID`.
- Admin approval for Stripe review payouts processes the transfer, records the Stripe transfer id in payout metadata, and settles frozen wallet funds after a successful transfer response.
- Admins can create or register connected accounts, create hosted onboarding links, refresh account requirements, and receive `account.updated` webhook sync into local readiness.
- Stripe balance retrieval uses `GET /v1/balance`; connected account scoping uses the `Stripe-Account` header when a connected account id is provided.

## Provider Launcher UX Contract
- Every payment provider service uses the same launcher lane structure:
  - Custom Details
  - Invoices
  - Payouts
  - Wallet Balance
  - Provider Activity
- Lanes with production backend support are marked `live`; lanes that still need signed clients, webhook verification, idempotency rules, provider state mapping, ledger rules, and sandbox tests remain visible as `setup` lanes.
- PayPal keeps live invoice and payout workspaces.
- Stripe keeps live invoice, wallet balance, guarded payout preview, and gated connected-account transfer support. Crypto keeps live invoice workspaces, with payout and balance lanes visible but not enabled for money movement.
- Wise, Paystack, and Flutterwave use the same launcher shell while their official payout, invoice, balance, and activity lanes remain setup-only until adapters are completed.
- The Telegram bot mirrors this structure with a Payment Providers group and provider workspace screens so PayPal is no longer the only provider with a workspace-style entry point.

## Official References
- PayPal Invoicing API: https://developer.paypal.com/docs/api/invoicing/v2/
- PayPal Payouts API: https://developer.paypal.com/docs/api/payments.payouts-batch/v1/
- PayPal Webhooks API: https://developer.paypal.com/docs/api/webhooks/v1/
- Stripe Connect: https://docs.stripe.com/connect
- Stripe Balance API: https://docs.stripe.com/api/balance
- Stripe Accounts API: https://docs.stripe.com/api/accounts
- Stripe Account Links API: https://docs.stripe.com/api/account_links
- Stripe Transfers API: https://docs.stripe.com/api/transfers/create
- Stripe Invoices API: https://docs.stripe.com/api/invoices
- Stripe finalize invoice API: https://docs.stripe.com/api/invoices/finalize
- Stripe Connect payouts: https://docs.stripe.com/connect/payouts-connected-accounts
- Stripe webhooks: https://docs.stripe.com/webhooks
- Wise enterprise payouts: https://docs.wise.com/api-docs/guides/payouts
- Wise transfer API: https://docs.wise.com/api-reference/transfer
- Paystack transfers: https://paystack.com/docs/api/transfer/
- Paystack payment requests: https://paystack.com/docs/api/payment-request/
- Paystack webhooks: https://paystack.com/docs/payments/webhooks
- Flutterwave standard payments: https://developer.flutterwave.com/v3.0/reference/checkout
- Flutterwave general transfer flow: https://developer.flutterwave.com/docs/general-transfer-flow
- Flutterwave create transfer: https://developer.flutterwave.com/v3.0/reference/create-a-transfer
- Flutterwave webhooks: https://developer.flutterwave.com/docs/webhooks
- Coinbase Commerce overview: https://docs.cdp.coinbase.com/commerce/docs
- Coinbase Commerce charge migration/API mapping: https://docs.cdp.coinbase.com/coinbase-business/checkout-apis/migrate-from-commerce/api-schema-mapping
- Coinbase Business checkout webhooks: https://docs.cdp.coinbase.com/coinbase-business/checkout-apis/webhooks
- Coinbase webhook signature verification: https://docs.cdp.coinbase.com/webhooks/verify-signatures
