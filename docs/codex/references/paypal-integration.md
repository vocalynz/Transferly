# PayPal Integration Reference

## Official Sources
- Invoicing API v2:
  - https://developer.paypal.com/docs/api/invoicing/v2/
- Invoicing integration guide:
  - https://developer.paypal.com/docs/invoicing/integrate/
- Payouts API:
  - https://developer.paypal.com/docs/api/payments.payouts-batch/v1/
- Webhooks API:
  - https://developer.paypal.com/docs/api/webhooks/v1/
- Webhook event names:
  - https://developer.paypal.com/api/rest/webhooks/event-names/

## Confirmed Behavior
- Invoice flow:
  - Create draft invoice with `POST /v2/invoicing/invoices`
  - Send invoice with `POST /v2/invoicing/invoices/{invoice_id}/send`
  - The invoice resource metadata includes `recipient_view_url`, which is the customer payment link that must be returned by the API.
- Payout flow:
  - Submit payout batch with `POST /v1/payments/payouts`
  - Retrieve batch details with `GET /v1/payments/payouts/{id}`
  - Retrieve item details with `GET /v1/payments/payouts-item/{payout_item_id}`
  - Re-using a `sender_batch_id` within 30 days is rejected as a duplicate; safe retries after server errors should reuse the same batch ID.
- Webhook verification:
  - Verification requires the `PAYPAL-AUTH-ALGO`, `PAYPAL-CERT-URL`, `PAYPAL-TRANSMISSION-ID`, `PAYPAL-TRANSMISSION-SIG`, and `PAYPAL-TRANSMISSION-TIME` headers plus the configured webhook ID and full webhook event body.

## Invoice Events Used In This Project
- `INVOICING.INVOICE.PAID`
- `INVOICING.INVOICE.CANCELLED`
- `INVOICING.INVOICE.REFUNDED`
- `INVOICING.INVOICE.UPDATED`

## Integration Rules For This Repo
- Always request an OAuth access token from PayPal and cache it until close to expiry.
- Always persist the invoice resource returned by PayPal after create/send so the stored payment URL matches the actual invoice state.
- Always verify webhook signatures before mutating database state.
- Always map PayPal payout status into the internal payout state machine instead of leaking raw provider states through core services.
- Never perform balance mutations directly inside controllers.
- Keep the raw Express request body available for webhook verification workflows.
