# PayPal Branding Integration

## Scope

Transferly presents PayPal as a connected payment provider inside the Transferly mini app shell. The PayPal workspace may use lightweight provider identity, PayPal terminology, and approved resource links, but it must not imitate the official PayPal dashboard, wallet, emails, or native app.

## Current Implementation

- PayPal provider metadata lives in `miniapp/src/lib/providerManifests.js`.
- The reusable provider branding panel lives in `miniapp/src/components/ProviderWorkspaceShell.jsx`.
- The existing PayPal logo asset is referenced from `miniapp/public/brand-logos/paypal.png`.
- PayPal workspace routes remain under `/miniapp/services/paypal/*`.

## Approved Resource Links

- PayPal media resources: `https://newsroom.paypal-corp.com/media-resources`
- PayPal developer policies: `https://developer.paypal.com/reference/guidelines/policiesAndGuidelines/`
- PayPal button design guide: `https://developer.paypal.com/docs/log-in-with-paypal/customize/button-design-guide/`

## UI Boundary

The PayPal workspace should:

- keep Transferly as the primary product shell;
- keep PayPal branding secondary and contextual;
- use approved PayPal logo assets only;
- use PayPal-native provider terminology where relevant;
- link to official PayPal resources for brand and developer guidance.

The PayPal workspace should not:

- copy the official PayPal dashboard layout;
- present itself as a PayPal-owned product;
- create fake PayPal wallet or account screens;
- use scraped screenshots, dashboards, emails, or unauthorized brand assets.

## Future Updates

When PayPal changes brand assets or integration guidance, update the manifest resource links and logo asset after reviewing the latest official PayPal resource pages and applicable usage terms.
