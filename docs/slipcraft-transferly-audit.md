# Slipcraft to Transferly Mini App Audit

Last updated: 2026-06-04

Scope: authenticated Slipcraft web app screens inspected from the prior live session are compared against the Transferly Telegram mini app. Public web-only authentication and marketing surfaces are tracked, but intentionally not cloned as full routes because Transferly is a Telegram mini app.

Status legend: Fully matched, Partially matched, Missing, Visually inaccurate, Functionally incomplete, Broken.

## Route Checklist

| Slipcraft area | Transferly mini app surface | Status | Notes |
| --- | --- | --- | --- |
| Public home | `/miniapp` dashboard equivalents | Partially matched | Slipcraft marketing sections are not mini-app routes. Core service entry points, featured services, AI Reply, stats, community prompt, and service catalog are adapted. |
| Login | Telegram launch/auth context | Missing | Intentional mini-app exclusion. Transferly authenticates from Telegram/browser preview and does not expose email/password web login. |
| Register | Telegram launch/auth context | Missing | Intentional mini-app exclusion. |
| Forgot password | Telegram/support handoff | Missing | Intentional mini-app exclusion. |
| Dashboard | `/miniapp` | Partially matched | Quick actions, featured services, AI Reply, all services, wallet points, account identity, community modal, desktop rail, mobile bottom nav, and theme toggle are adapted. Some web-only nav labels are converted to mini-app routes. |
| Community modal | `/miniapp` first-load modal | Fully matched | Includes Telegram CTA, support/help/points/report/update bullets, close, and already-joined action. |
| Services catalog | `/miniapp/services` | Partially matched | Category cards, Bank Slips, Flash Emails, service details, purchase entry points, and adapted service names are implemented. Some sensitive/source labels remain Transferly-safe. |
| PayPal service picker | `/miniapp/services/paypal` | Partially matched | Slipcraft-style picker now exists with PayPal logo, `Choose the type of mail to Send`, Custom Mail, Deposit Mail, Mail History, and Back to Dashboard. Transferly also keeps a provider workspace link for real PayPal operations. |
| Service detail | `/miniapp/services/:slug` | Partially matched | Core description, pricing/context, purchase actions, and related navigation exist for non-mail services. Flash Email services use the cloned Slipcraft-style mail picker and route into mini-app studio/vault flows. |
| Transactions | `/miniapp/vault` | Partially matched | Search, type/sort controls, status filters, transaction cards, stats, empty state, and refresh-style review behavior are adapted. |
| Flash Mail history | `/miniapp/studio` | Partially matched | Sent/delivered/bounced/pending counters, service/status filters, create form, history summary, loading and empty states are adapted. |
| Referral | `/miniapp/profile` | Partially matched | Share/Get Rewarded steps and copy action exist with Telegram bot start links instead of web referral URLs. |
| Profile | `/miniapp/profile` | Partially matched | Avatar initials, USER role, member date, balance, Naira/pt, referral copy, profile information fields, phone country select, WhatsApp placeholder, tabs, Save, and Logout are adapted. Account edits remain read-only in Telegram preview. |
| Buy Points | `/miniapp/wallet` | Partially matched | Bank Transfer and Crypto cards now match Slipcraft copy, timing badges, and verified-vendor/instant-confirmation positioning. Transferly also includes mini-app point order creation and paid-state tracking. |
| Orders | `/miniapp/orders` | Partially matched | Order tabs, order cards, status handling, empty states, and wallet handoff are present. Exact web table layout is adapted for mobile-first cards. |
| Settings/theme | shell + `/miniapp/settings` | Partially matched | Theme toggle is available from shell; haptics and default screen are mini-app-specific additions. |
| Support/community links | shell, dashboard, settings | Partially matched | Telegram community/support links are implemented. Some Slipcraft web support site/article links are adapted to mini-app support actions. |

## Component And State Checklist

| Component/state | Status | Notes |
| --- | --- | --- |
| Desktop sidebar rail | Partially matched | Transferly uses compact mini-app rail with equivalent primary destinations. |
| Mobile bottom navigation | Fully matched | Home, Services, Mail, Wallet, Settings are stable fixed controls with active states. |
| Header identity chip | Partially matched | Name, initials, points, referral count, back button, and theme button are implemented. |
| Theme toggle | Fully matched | Dark/light mode is available and persisted in local storage. |
| Buttons and active states | Partially matched | Primary, secondary, tab, card, bottom-nav, and modal states exist. Hover coverage is present on desktop controls; mini-app touch states use active scale/haptics. |
| Dropdowns/selects | Partially matched | Transaction filters, flash-mail filters, default screen select, and profile phone country select exist. |
| Search fields | Partially matched | Transaction/service-style search behavior exists where mini-app routes expose lists. |
| Cards | Partially matched | Dashboard, service, wallet, profile, transaction, flash-mail, and order cards are implemented with Transferly naming and Telegram spacing. |
| Tables | Partially matched | Slipcraft web tables are adapted into mobile-first cards/lists rather than copied as wide tables. |
| Empty states | Partially matched | Wallet orders, transactions, flash mail, and orders expose no-data messages. |
| Loading states | Partially matched | Mini-app create/mark-paid/main-button progress states exist; exact Slipcraft skeletons are not fully cloned. |
| Error states | Partially matched | Toast validation and failed actions exist for wallet/order/referral copy flows; full Slipcraft web validation catalog is not cloned. |
| Success states | Partially matched | Toasts, Telegram haptics/notifications, and status updates exist. |
| Notifications/toasts | Partially matched | Transferly uses mini-app toasts and Telegram notify hooks. |
| Validation | Partially matched | Wallet minimum-point validation, auth checks, and form guards exist. Web auth validation is intentionally absent. |
| Animations | Partially matched | Mini-app entry animation and tap scale states exist. Exact Slipcraft transition timing has not been pixel-matched. |
| Responsive layout: mobile | Partially matched | Primary routes are mobile-first and bottom-nav safe. |
| Responsive layout: tablet | Partially matched | Two-column grids and constrained content are implemented; exact Slipcraft tablet breakpoints remain adapted. |
| Responsive layout: desktop | Partially matched | Rail/header/content layout is implemented; web app desktop tables/nav are adapted for mini-app constraints. |

## Remaining Adaptation Notes

- Full equality is not expected for public auth/marketing pages because Transferly is a Telegram mini app.
- Some Slipcraft labels remain intentionally adapted for Transferly safety and mini-app fit: `Password Clone` to `Security Center`, descriptive provider workspaces for real payment operations, and web referral URLs to Telegram bot start links.
- Web-only wide tables are represented as card/list views to keep mobile mini-app ergonomics.
- Future visual regression can promote this checklist into Playwright `toHaveScreenshot()` baselines once approved reference screenshots are stable and authenticated Slipcraft access is available again.
