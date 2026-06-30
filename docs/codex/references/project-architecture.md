# Transferly Backend Architecture

## Primary Modules
- `paypalInvoiceService`: creates, sends, fetches, and normalizes PayPal invoices.
- `paypalPayoutService`: submits and tracks PayPal payouts using idempotent batch identifiers.
- `ledgerService`: owns wallet balance mutations and ledger entries.
- `riskService`: evaluates payout and invoice risk signals.
- `webhookService`: verifies PayPal signatures, deduplicates events, dispatches handlers, and records results.
- `auditLogService`: persists action trails for system and operator actions.

## Reference Style
- This repo mirrors the `vocalynz/voicednut/api` handling style:
  - a single backend runtime subtree
  - CommonJS modules
  - Express middleware-first request flow
  - SQLite-backed persistence helpers
  - small feature registrars instead of a compiled application tree

## Directory Shape
- `api/app.js`: Express app factory plus runtime bootstrap.
- `api/start/`: HTTP kernel and server lifecycle bootstrap, similar to a lightweight Laravel/Adonis startup layer.
- `api/config.js`: environment parsing and runtime policy defaults.
- `api/routes/`: route registration grouped by domain.
- `api/controllers/`: request handlers only.
- `api/services/`: business logic and orchestration.
- `api/repositories/`: SQLite-backed data access helpers.
- `api/adapters/`: external provider clients, including PayPal OAuth and REST calls.
- `api/jobs/`: BullMQ queue producers and workers.
- `api/webhooks/`: webhook handlers and event routing.
- `api/middleware/`: request context, idempotency, admin actor, and error translation.
- `api/db/`: SQLite bootstrap, schema, and transaction helper.
- `api/schemas/`: Zod request schemas.
- `api/presenters/`: outward API response shaping.
- `api/utils/`: constants, money helpers, logging, serialization, and shared errors.

## Domain Rules
- Invoice creation stores both internal and PayPal identifiers plus the recipient payment URL.
- `INVOICING.INVOICE.PAID` increases `pending_balance` first.
- Release operations move funds from `pending_balance` to `available_balance`.
- Payout creation never calls PayPal until balance checks and risk checks succeed.
- Risk outcomes:
  - `APPROVED`: may process immediately.
  - `REVIEW`: store and wait for admin approval.
  - `BLOCKED`: reject and audit.
- Every payout submission must use a deterministic `sender_batch_id` derived from the internal payout record.

## Data Consistency Rules
- Use SQLite transactions for wallet updates plus matching ledger rows.
- Enforce uniqueness for:
  - webhook event IDs
  - payout idempotency keys
  - PayPal invoice IDs
  - PayPal payout batch IDs where present
- Persist webhook receipts before deep processing so retries remain safe.

## Operational Notes
- Queue invoice delivery, payout execution, webhook processing, and payout retries.
- Apply exponential backoff to retriable jobs and route terminal failures to a dead-letter queue.
- Keep synchronous API responses small and deterministic; long-running PayPal work should complete through jobs where possible.
- The active runtime and npm package live entirely under `api/`. Install dependencies and run backend scripts from that directory.
