# Transferly Project Development Instructions

## Project Context
This is a **production-grade payment processing platform** with strict requirements for:
- Security (payment handling)
- Reliability (financial transactions)
- Auditability (transaction logging)
- Data consistency (ledger integrity)

## When You See...

### "help me build payment features"
→ Follow these principles:
1. **Ledger is the source of truth** for balances, not external provider
2. **Idempotent operations** - all PayPal calls use deterministic IDs
3. **Atomic transactions** - wallet + ledger updates together
4. **Audit logging** - every state change is recorded
5. **Risk assessment** - payouts evaluated before processing
6. **No balance-changing operations** without database transaction

### "add new invoice/payout functionality"
→ Use this pattern:
```
controllers/ → handles HTTP request
  ↓
services/ → validates, checks balance, runs risk check
  ↓
repositories/ → persists to database
  ↓
jobs/ → queue external PayPal call (if needed)
  ↓
webhooks/ → handle async response
  ↓
auditLogService → log the transaction
```

### "improve the mini app design"
→ Refer to: `/home/codespace/.copilot/session-state/.../files/miniapp-enhancement-roadmap.md`
→ Use new components: `/home/codespace/.copilot/session-state/.../files/quick-start-components.jsx`
→ Apply design tokens: `/home/codespace/.copilot/session-state/.../files/tailwind-config-enhanced.js`

### "verify payment processing"
→ Run in order:
```bash
cd api && npm run lint
cd api && npm run db:migrate
cd api && npm run db:seed
cd api && npm test
# Optional sandbox test
cd api && npm run verify:paypal:sandbox
```

### "test webhook integration"
→ Remember:
1. Webhook signature verification is required
2. Use deterministic event deduplication
3. Process asynchronously with job queue
4. Update both invoice + ledger
5. Log entire flow for audit trail

### "add a new API endpoint"
→ Create files in this order:
```
schemas/:endpoint.js        (Zod schema)
  ↓
repositories/:model.js      (if new data access needed)
  ↓
services/:service.js        (business logic)
  ↓
controllers/:controller.js   (request handler)
  ↓
routes/:routes.js          (route registration)
  ↓
tests/:endpoint.test.js    (comprehensive tests)
```

## Code Quality Standards

### Backend (api/)
- **Style**: CommonJS, Express middleware-first
- **Validation**: Zod schemas on all inputs
- **Logging**: Pino with context
- **Testing**: Node --test runner
- **Database**: SQLite transactions for balance changes
- **Jobs**: BullMQ with exponential backoff
- **Errors**: Custom error classes with codes

### Bot
- **Framework**: grammY with callbacks
- **Commands**: Organized by domain
- **State**: SQLite-backed persistence
- **Auth**: Token-based verification
- **Logging**: Important operations logged

### MiniApp
- **Framework**: React 18+ with React Router
- **Styling**: Tailwind CSS with design tokens
- **Forms**: React Hook Form + Zod
- **State**: Context API for app state
- **Requests**: Fetch API with error handling
- **Testing**: Playwright e2e tests
- **Components**: Small, focused, reusable

## Payment Processing Rules

### Balance Mutations
```javascript
// NEVER modify balance directly
❌ wallet.available_balance -= amount

// ALWAYS use ledger service
✅ ledgerService.createLedgerEntry({
  walletId,
  type: 'DEBIT',
  amount,
  reason: 'payout_request',
  relatedId: payoutId
})
// This automatically updates balance AND creates audit record
```

### Payout Flow
1. User requests payout → `POST /api/payouts`
2. Check: sufficient `available_balance`
3. Check: pass risk evaluation
4. Reserve: move funds to `frozen_balance`
5. Queue: job to submit to PayPal
6. Track: monitor batch status
7. Complete: move from `frozen_balance` to `paid_out_balance`

### Invoice Flow
1. Create: `POST /api/invoices`
2. Send: to PayPal immediately
3. Wait: PayPal webhook confirms payment
4. Webhook: `INVOICING.INVOICE.PAID` received
5. Update: add to `pending_balance`
6. Release: admin manually releases to `available_balance`

### Database Changes
```javascript
// All balance-changing operations MUST be in transaction
db.serialize(async () => {
  db.run('BEGIN TRANSACTION');
  try {
    // 1. Update wallet
    await walletRepo.updateBalance(walletId, { pending: +amount });
    
    // 2. Create ledger entry
    await ledgerRepo.create({
      walletId,
      type: 'CREDIT',
      amount,
      reason: 'invoice_paid',
      relatedId: invoiceId
    });
    
    // 3. Create audit log
    await auditLogService.log({
      actor: 'webhook_processor',
      action: 'invoice_payment_confirmed',
      resourceId: invoiceId,
      details: { amount }
    });
    
    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
});
```

## Common Mistakes to Avoid

### ❌ Don't
- Trust PayPal status as source of truth
- Process balance changes without transaction
- Create PayPal calls without idempotency key
- Skip webhook signature verification
- Log sensitive payment data
- Add endpoints without schemas
- Modify ledger directly
- Forget audit logging

### ✅ Do
- Use ledger for all balance queries
- Wrap multi-step changes in transactions
- Use deterministic batch IDs for payouts
- Always verify webhook signatures
- Log only transaction IDs, not amounts
- Validate all inputs with Zod
- Use ledgerService for mutations
- Log all user actions

## File Organization

### Controllers
```javascript
// app.js (Express setup)
// config.js (all configuration)
// controllers/invoiceController.js (request handlers)
// services/paypalInvoiceService.js (PayPal API calls)
// services/ledgerService.js (balance management)
// repositories/invoiceRepository.js (database queries)
// routes/invoices.js (route registration)
```

### Services Layer
```
services/
├── paypalInvoiceService     (PayPal invoice operations)
├── paypalPayoutService      (PayPal payout operations)
├── ledgerService            (balance mutations)
├── riskService              (risk evaluation)
├── webhookService           (webhook verification & dispatch)
└── auditLogService          (transaction logging)
```

### Database
```
db/
├── migrate.js               (run migrations)
├── schema.sql              (table definitions)
└── seed.js                 (demo data)
```

## Testing Guidelines

### Unit Tests
```javascript
// Test service logic in isolation
// Mock database and external services
// Test error cases
// Verify audit logging
```

### Integration Tests
```javascript
// Test with real database
// Test full request → response
// Test ledger consistency
// Test webhook processing
```

### For Payment Features
```javascript
// Always test: happy path, error case, idempotency
// Always verify: balance updates, audit logs, webhook handling
// Always check: transaction rollback on error
```

## Deployment Checklist

### Before Deploy
- [ ] All tests passing
- [ ] Linting clean
- [ ] No secrets in code
- [ ] Database migrations tested
- [ ] Webhook URLs configured
- [ ] PayPal credentials verified
- [ ] Environment variables set
- [ ] Backup strategy confirmed

### Environment Variables
```bash
# Required
REDIS_URL=...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...
JWT_SECRET=...

# Important
PAYPAL_ENVIRONMENT=sandbox  # or: live
ADMIN_API_TOKEN=...
APP_BASE_URL=https://yoursite.com

# Optional
MAX_SINGLE_PAYOUT=10000
DAILY_PAYOUT_LIMIT=100000
HIGH_RISK_COUNTRIES=RU,IR,KP
```

## Quick References

### Key Services to Know
- **ledgerService**: Manages all balance changes
- **paypalInvoiceService**: Creates & sends invoices
- **paypalPayoutService**: Submits & tracks payouts
- **riskService**: Evaluates transaction risk
- **webhookService**: Verifies & processes PayPal events
- **auditLogService**: Records all actions

### Database Tables
- **wallets**: User wallet records with balance tiers
- **ledger_entries**: Transaction log (immutable)
- **invoices**: PayPal invoice records
- **payouts**: Payout request records
- **audit_logs**: Action trail for compliance

### API Endpoints
```
POST   /api/invoices               Create invoice
GET    /api/invoices/:id           Get invoice details
GET    /api/invoices               List invoices
POST   /api/payouts                Request payout
GET    /api/payouts/:id            Get payout status
GET    /api/payouts                List payouts
POST   /api/admin/payouts/:id/approve    Approve payout
POST   /api/admin/payouts/:id/reject     Reject payout
POST   /api/admin/invoices/:id/release   Release funds
POST   /webhooks/paypal            PayPal webhook endpoint
GET    /api/admin/risk-flags       View flagged transactions
```

## Design System Updates

The MiniApp has a comprehensive enhancement roadmap. When working on UI:
1. Check `.github/copilot-instructions.md` for setup
2. Use new components from `quick-start-components.jsx`
3. Apply colors from `tailwind-config-enhanced.js`
4. Follow animation guidelines
5. Test on mobile first
6. Ensure accessibility (WCAG 2.1 AA)

## Red Flags - When to Double-Check

🚩 **Code that modifies `wallet.available_balance` directly**
→ Should use `ledgerService.createLedgerEntry()` instead

🚩 **No idempotency key in payout request**
→ Add `Idempotency-Key` header requirement

🚩 **Webhook processing without signature verification**
→ Always call `webhookService.verifySignature()` first

🚩 **Balance-changing code without database transaction**
→ Wrap in `db.serialize()` with COMMIT/ROLLBACK

🚩 **Sensitive data in logs (amounts, emails, etc)**
→ Remove before logging, use transaction IDs only

🚩 **New endpoint without Zod schema**
→ Create schema first, use in validation middleware

🚩 **PayPal API call without error handling**
→ Include retry logic and dead-letter queue handling

## Session Tips

### At Session Start
1. Run `/init` to load this configuration
2. Set `/cwd` to appropriate package (api, bot, or miniapp)
3. Check `/env` to verify variables loaded
4. Review this file for context

### During Session
1. Use `/diff` before committing
2. Use `/review` for code quality check
3. Use `/tasks` to manage work items
4. Reference this file if uncertain

### Documentation Commands
- `npm run lint` - Check code quality
- `npm test` - Run all tests
- `npm run db:migrate` - Setup schema
- `npm run verify:paypal:sandbox` - Test PayPal integration

## When You're Stuck

### Payment Logic Questions
→ Review `docs/codex/references/paypal-integration.md`

### Architecture Questions
→ Review `docs/codex/references/project-architecture.md`

### UI/UX Questions
→ Review `/home/codespace/.copilot/session-state/.../files/miniapp-enhancement-roadmap.md`

### General Questions
→ Check `README.md` and project documentation first

---

**Remember**: In payment systems, correctness > speed. When in doubt, verify with tests, check audit logs, and confirm with a human before deploying. 🚀
