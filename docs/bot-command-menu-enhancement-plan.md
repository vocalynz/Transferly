# Bot Command Menu Enhancement Plan

## Goal

Make the Telegram bot feel like a professional command surface for the Transferly API and Mini App by giving every major workflow a clear command, menu, submenu, and Mini App handoff.

## Phase 1: Provider-First Entry Points

Status: implemented.

- Keep `/providers` as the provider cockpit.
- Add `/provider <slug>` for direct workspace routing.
- Add hidden direct shortcuts for `/paypal`, `/stripe`, `/wise`, `/paystack`, `/flutterwave`, and `/crypto`.
- Keep provider commands under the existing `services.use` capability so active users can open provider workspaces without payment-admin permissions.

## Phase 2: Collection And Sending Command Centers

Status: implemented.

- Make `/invoices` open a collection command center when no filters are supplied.
- Make `/payouts` open a sending command center when no filters are supplied.
- Preserve the older filtered PayPal list behavior when arguments are supplied, such as `/invoices SENT customer@example.com`.
- Mirror Mini App handoffs with buttons for provider dashboards, invoices, and payouts.

## Phase 3: Provider Submenus

Status: implemented.

- Add provider-specific submenu copy for supported lanes: overview, invoices, payouts, activity, developer, balances, compliance, or security.
- Keep provider-native labels while using Transferly as the primary product shell.
- Avoid pretending placeholder-backed lanes are live; mark unavailable lanes clearly.

## Phase 4: Admin Operations Menus

Status: implemented.

- Add focused admin submenus for activity, issues, risk, reconciliation, clients, and security.
- Add guided action rows for approve/reject/cancel/refresh flows where the API already supports them.
- Add clearer empty and error states for failed API calls.

## Phase 5: Reliability And Observability

Status: implemented.

- Expand callback analytics to identify invalid, stale, blocked, unknown, failed, and successfully routed menu actions.
- Track callback route family and action duration so high-error or slow menu paths are visible from bot analytics.
- Record callback recovery events separately so expired/stale menu buttons can be measured.
- Surface callback health, recovered menus, unknown actions, and slow actions from the `/analytics` admin view.
- Preserve existing API request ID and idempotency handling in the shared HTTP client and mutation responses.
- Keep retry guidance in bot responses concise and action-oriented.

## Mini App Parity Map

- Provider cockpit: `/providers`, `/provider <slug>`, direct provider shortcuts.
- Collection flows: `/invoices`, provider invoice buttons, Mini App invoices handoff.
- Sending flows: `/payouts`, provider payout/send buttons, Mini App payouts handoff.
- Operations center: `/ops`, activity, issues, risk, security, orders, reconciliation, audit, analytics, and Mini App dashboard/studio handoffs.
- Service studio: `/services`, service lane buttons, Mini App Studio handoff.
- Account surfaces: `/profile`, `/balance`, `/receipts`, Mini App Wallet/Vault handoffs.
