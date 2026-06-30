# Transferly Premium Roadmap

This roadmap tracks the top-tier features planned for Transferly as a Telegram mini app, bot, and backend finance operations platform. The implementation should happen phase-by-phase with small, reviewable changes that preserve existing behavior.

## Feature Set

1. **Unified Provider Command Center**
   - One cockpit for PayPal, Stripe, Crypto, Paystack, Flutterwave, and Wise.
   - Provider readiness checks, missing environment variables, webhook health, payout capability, balance snapshots, incident warnings, and per-provider invoices, payouts, disputes, webhooks, reconciliation, and audit trail.

2. **Real-Time Finance Operations Dashboard**
   - Live wallet balances, pending payouts, failed payments, provider latency, payment volume, revenue, refunds, and chargeback or dispute risk.
   - Streamed updates and drill-down pages for every invoice, payout, customer, provider, and ledger event.

3. **Advanced Ledger And Reconciliation Engine**
   - Immutable internal ledger entries as the source of truth.
   - Provider reconciliation against PayPal, Stripe, Crypto, and other rails.
   - Automatic detection for missing webhooks, duplicate payouts, mismatched statuses, stale pending funds, and failed settlement chains.
   - Explain-balance views showing why a user has each available, pending, frozen, or paid-out balance.

4. **Premium Telegram Bot Experience**
   - Bot command center that mirrors the mini app.
   - Role-aware admin menus, provider workspaces, invoice and payout detail pages, incident triage, quick approvals, webhook replay, and reconciliation summaries.
   - Rich inline keyboards with provider-specific navigation.

5. **Immersive Mini App UI**
   - Mobile-first fintech interface with polished dashboards.
   - Tabs for Overview, Invoices, Payouts, Wallet, Providers, Activity, Security, and Admin.
   - Smooth route transitions, skeleton loading, optimistic actions, swipeable detail sheets, status timelines, and responsive data tables.
   - Visual payment lifecycle timelines for invoices and payouts.

6. **Enterprise-Grade Admin Console**
   - User management, roles, permissions, KYC flags, account restrictions, payout limits, risk scores, and audit logs.
   - Approval queues for high-risk payouts.
   - Bulk payout review, batch exports, manual holds, escalation notes, and operator assignment.

7. **Risk And Fraud Intelligence**
   - Rule engine for suspicious payout behavior.
   - Velocity checks, country and currency risk, repeated failed payment attempts, unusual invoice size, and sudden wallet drains.
   - Risk labels such as normal, review, hold, and blocked.
   - Admin override flow with reason capture and audit logging.

8. **Webhook Reliability Suite**
   - Webhook inbox with provider, event type, status, attempts, signature verification result, and linked resource.
   - Replay webhook, mark ignored, inspect sanitized payload metadata.
   - Dead-letter queue for failed events.
   - Provider health score based on webhook freshness and processing failures.

9. **Smart Notifications**
   - Telegram alerts for paid invoices, payout approvals, failed payouts, balance threshold changes, provider downtime, webhook failures, and security events.
   - User-configurable notification preferences.
   - Admin incident digests.

10. **Invoice Builder Pro**
    - Rich invoice creation with line items, tax, discounts, due dates, notes, attachments, customer profiles, recurring templates, and preview.
    - Branded hosted invoice page.
    - Multi-provider payment links.
    - Partial payments and payment reminders.

11. **Payout Operations Pro**
    - Scheduled payouts, instant and manual payout modes, batch payout imports, payout limits, recipient verification, and approval workflows.
    - Provider fallback routing when a provider is unavailable.
    - Detailed payout status timeline from request to settlement.

12. **Customer And Recipient Profiles**
    - Full customer and recipient pages with invoice history, payout history, risk notes, saved methods, country, currency, contact info, and lifetime value.
    - Search, filters, and segmentation.

13. **Multi-Currency Support**
    - Wallet balances by currency.
    - Currency conversion estimates.
    - Provider-specific currency support matrix.
    - FX fee visibility and settlement currency tracking.

14. **Disputes, Refunds, And Chargebacks**
    - Dispute inbox with provider status, evidence deadlines, amount at risk, linked invoices, and recommended next action.
    - Refund flow with audit logs and balance impact.
    - Chargeback analytics.

15. **Security Center**
    - Session and device activity, API token management, admin action history, suspicious login alerts, 2FA readiness, and secret rotation reminders.
    - Fine-grained permissions for finance, support, admin, developer, and auditor roles.

16. **Developer And API Portal**
    - API keys, webhook endpoints, event logs, sandbox or test mode, API request logs, and integration docs.
    - Sample payloads and replayable test events.
    - Per-client rate limits and token scopes.

17. **Reporting And Exports**
    - Revenue reports, payout reports, provider comparison, failed payment reports, ledger exports, and tax-ready summaries.
    - CSV and PDF exports.
    - Date-range filters and saved reports.

18. **Provider Routing Intelligence**
    - Payment and payout provider selection based on country, currency, fees, availability, success rate, and user preference.
    - Explain why a provider was selected.
    - Admin-configurable routing rules.

19. **Operational Incident Mode**
    - Detect provider outage or degraded webhook processing.
    - Freeze risky flows, show admin banners, route traffic to backup provider, and notify affected users.
    - Incident timeline and postmortem notes.

20. **Production Polish**
    - Useful empty states and actionable error states.
    - Mobile QA for 360px, 390px, and 430px widths.
    - Accessibility, keyboard focus, reduced motion support, dark and light mode, and polished loading states.

## Implementation Phases

### SlipCraft-Inspired Safe Marketplace Mapping

This project should mirror the high-density marketplace feel, fast service navigation, and premium command-center polish from SlipCraft-style apps without copying unsafe behavior, credential-capture concepts, fake document language, or web login/register flows. Transferly remains a Telegram mini app launched from the bot.

1. **Flash Emails → Verified Notifications**
   - Provider-styled notification receipt flows for supported services.
   - Status: Implemented in the mini app catalog, services pages, receipt studio labels, history/vault copy, and bot menu labels.

2. **Bank Slips → Verified Wallets**
   - Opay, Kuda, and Palmpay wallet-record generation flows.
   - Status: Implemented in the mini app catalog, service detail pages, receipt studio labels, admin fee labels, and bot menu labels.

3. **Crypto Receipts → Receipt Vault**
   - Searchable receipt archive, duplication, preview, export, and support handoff.
   - Status: Implemented as the Mini App Vault and catalog lane while preserving legacy route slugs for compatibility.

4. **Support Sites → Support Desk**
   - Guided support workspace with Telegram identity, current screen, order, receipt, and provider context.
   - Status: Implemented as a mini app support route and service catalog lane.

5. **Password Clone / Pass Clone → Security Center**
   - Safe security posture, account-linking, audit, export-control, and sensitive-workflow checks.
   - Status: Implemented as a mini app security route and catalog lane.

6. **Wallet Tracker → Provider Balance Tracker**
   - Provider balance snapshots and operational readiness monitoring.
   - Status: Implemented through the provider command center and service catalog lane.

7. **QR Code Generator → Payment QR**
   - Mobile-first payment QR launch lane connected to Transferly collection workflows.
   - Status: Implemented as a catalog and marketplace lane that routes into the receipt studio.

8. **Link Shortener → Payment Links**
   - Short payment-link workflow and activity tracking.
   - Status: Implemented as a catalog and marketplace lane that routes into activity.

9. **Scripts / Marketplace → Template Marketplace**
   - Premium workflow templates and reusable operator playbooks.
   - Status: Implemented as a services marketplace section and mini app marketplace lane.

10. **Faker Data → Sandbox Test Data**
   - Clearly marked sandbox-only QA and demo data generation.
   - Status: Implemented as a safe catalog and marketplace lane.

### PayPal-Style Service Command Center Parity

All non-provider services should feel like first-class Transferly workspaces instead of simple catalog links. The PayPal command-center pattern is now mirrored across supported services with service-specific lanes, status badges, launch pages, and sub-pages that route into existing mini app workspaces.

- **Verified Notifications:** custom notification, deposit notification, template library, and receipt vault lanes.
- **Verified Wallets:** wallet record, support context, wallet activity, and balance readiness lanes.
- **Support AI:** draft reply, support context, saved replies, and activity review lanes.
- **Ops And Knowledge:** provider runbooks, support playbooks, activity lessons, and security notes lanes.
- **Sandbox Test Data:** sandbox payload, studio preview, vault review, and operator training lanes.
- **Receipt Vault:** vault search, duplicate receipt, support handoff, and activity trail lanes.
- **Support Desk:** support desk, escalation states, receipt context, and security context lanes.
- **Security Center:** security center, provider readiness, support safety, and activity audit lanes.
- **Provider Balance Tracker:** balance overview, provider ops, payout activity, and support handoff lanes.
- **Payment QR:** QR studio, invoice handoff, vault reference, and QR activity lanes.
- **Payment Links:** payment links, studio link, provider links, and link support lanes.
- **Template Marketplace:** template marketplace, provider onboarding, support triage, and payout operations lanes.

Status: Phase 1 implemented in the mini app service detail route using existing Transferly routes and provider-safe wording. Phase 2A implemented Telegram bot inline lane keyboards and lane detail callbacks for service command centers. Phase 2B adds backend-backed command-center summaries, live Mini App lane metrics, and Telegram lane metric overlays. Phase 2C adds authenticated lane-detail action kits with readiness checks, generator prefill context, recent receipt previews, Mini App action panels, and Telegram action/readiness overlays. Phase 2D adds audited service-lane action intents for Mini App launches and Telegram lane callbacks without executing provider-side money movement. Later phases should convert selected recorded intents into reviewed, idempotent backend mutations where appropriate.

1. **Provider-Scoped Operations**
   - Add server-side provider filters for webhook events and payment issues.
   - Keep legacy PayPal records without provider metadata visible in PayPal-scoped views.
   - Update bot provider screens to call provider-scoped API filters.
   - Status: Implemented for provider-scoped mini app and bot navigation surfaces.

2. **Provider Detail Navigation**
   - Make invoice and payout detail screens return to the provider workspace they came from.
   - Remove PayPal-specific wording from generic provider flows.

3. **Mini App Provider Command Center**
   - Build provider tabs, readiness panels, live balances, webhook health, payment issues, and per-provider invoice and payout lists.
   - Run mobile browser QA after implementation.
   - Status: Implemented in the Mini App ops route with provider tabs, readiness, balances, webhook health, issue triage, invoices, and payouts.

4. **Webhook Reliability Suite**
   - Add webhook detail pages, replay, ignore, sanitized metadata inspection, and provider health scoring.
   - Add dead-letter recovery workflows.
   - Status: Implemented with admin webhook detail, replay, ignore, sanitized payload metadata, verification flags, provider health scoring API, dead-letter recovery API, and Mini App operator controls.

5. **Reconciliation Timeline**
   - Add a unified timeline that joins invoices, payouts, webhooks, audit logs, and ledger entries.
   - Add mismatch detection and operator-facing remediation hints.

6. **Risk And Approval Operations**
   - Add richer payout risk queues, manual holds, operator assignment, approval notes, and rule-driven escalation.

7. **Advanced User And Finance Workflows**
   - Add customer and recipient profiles, multi-currency wallet views, reporting exports, and scheduled payout operations.

8. **Final Product Polish**
   - Complete accessibility, responsive QA, notifications, incident mode, and production-grade empty and error states.
