# Transferly Project Instructions

## Intent
- Build and maintain Transferly across the API, Telegram bot, and Telegram Mini App.
- Keep payment, ledger, webhook, and user-facing flows modular, auditable, and operationally safe.

## Stack Constraints
- `api/`: Node.js, CommonJS, Express, SQLite, Redis/BullMQ, Zod, Pino.
- `bot/`: Node.js Telegram operations bot using grammY-style command/callback modules.
- `miniapp/`: Vite, React, Tailwind CSS, Supabase client, Playwright e2e tests.

## Repository Workflow
- Start with a focused, reviewable diff that moves the requested package or workflow forward.
- Match the existing module boundaries for the touched package before introducing new structure.
- Run package-manager commands with `--prefix api`, `--prefix bot`, or `--prefix miniapp`.
- Keep transport logic in controllers/routes, business logic in services, persistence in repositories, and side effects in jobs/webhooks.
- Prefer additive changes over premature abstraction.
- Do not expose PayPal secrets, bearer tokens, webhook headers, or raw event payloads in logs.
- Do not commit real `.env` files, production SQLite data, tokens, or service-role keys.

## Deep Work Defaults
- Inspect the owning package plus at least one local analog before editing.
- Trace impacted routes, services, repositories, tests, and UI entry points when a change crosses package or payment boundaries.
- Prefer `rg`, package scripts, and existing helper scripts for broad checks before adding new tooling.
- When a first verification check passes, run the next most relevant check if the change affects shared behavior, payment state, auth, deployment, or user-facing flows.
- Capture follow-up risks explicitly instead of silently narrowing scope.

## Targeted Docs Policy For This Repo
- Load `/home/codespace/.codex/skills/transferly-project/SKILL.md` for repo-specific workflows when available.
- For PayPal invoice, payout, OAuth, webhook, or provider adapter contract changes, consult the nearest local reference and official provider docs when endpoint behavior, payload shape, auth, idempotency, or webhook verification is relevant.
- For new modules or cross-package infrastructure, consult `docs/codex/references/project-architecture.md` when the existing package layout does not make ownership clear.
- If docs and local code disagree on an externally meaningful behavior, call out the mismatch before patching.

## Backend Conventions
- Use idempotency for payout submission and webhook ingestion.
- Persist every externally meaningful state transition in the database before acknowledging it as complete.
- Trust the internal ledger for balances, not PayPal resource status alone.
- Wrap balance-changing operations in database transactions.
- Record audit logs for invoice creation, payout requests, approval/rejection actions, webhook processing, and ledger mutations.
- Prefer enum-backed state machines over free-form status strings when data is persisted.

## Verification
- Use the fastest relevant checks first.
- API checks:
  - `npm run lint --prefix api`
  - `npm run db:migrate --prefix api`
  - `npm test --prefix api`
- Bot checks:
  - `npm test --prefix bot`
- Miniapp checks:
  - `npm run build --prefix miniapp`
  - `npm run test:e2e:list --prefix miniapp`
  - `npm run test:e2e --prefix miniapp`
- If a check cannot run, state the exact missing prerequisite.
