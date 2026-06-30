# GitHub Copilot Configuration for Transferly

## Project Overview
Transferly is a production-grade payments platform built with Node.js, React, and Telegram integration. The project consists of three main packages:
- **api/**: Payment processing backend (Express, SQLite, BullMQ, Redis)
- **bot/**: Telegram operations bot (grammY, SQLite)
- **miniapp/**: Telegram Mini App frontend (Vite, React, Tailwind)

## Command Reference
See `/help` for all available Copilot commands.

### Essential Commands
- `/skills` - Manage skills for enhanced capabilities
- `/mcp` - Manage MCP server configuration
- `/init` - Initialize Copilot instructions for repository
- `/delegate` - Send session to GitHub and create PR
- `/review` - Run code review agent
- `/diff` - Review changes in current directory
- `/lsp` - Manage language server configuration

### Session Management
- `/tasks` - View and manage tasks (subagents and shell commands)
- `/context` - Show context window usage
- `/usage` - Display session usage metrics
- `/session` - View and manage sessions
- `/resume` - Switch to different session

## Working with Transferly

### Repository Structure
```
transferly/
├── api/                    # Backend API
│   ├── app.js             # Express app entry point
│   ├── config.js          # Configuration
│   ├── controllers/       # Request handlers
│   ├── services/          # Business logic
│   ├── repositories/      # Data access
│   ├── routes/            # Route definitions
│   ├── jobs/              # Background jobs (BullMQ)
│   ├── webhooks/          # Webhook handlers
│   ├── db/                # Database schema & migration
│   └── package.json
│
├── bot/                   # Telegram Operations Bot
│   ├── bot.js            # Bot entry point
│   ├── commands/         # Bot commands
│   ├── callbacks/        # Callback handlers
│   └── package.json
│
├── miniapp/              # Telegram Mini App
│   ├── src/
│   │   ├── App.jsx       # Main app component
│   │   ├── pages/        # Page components
│   │   ├── components/   # Reusable components
│   │   ├── context/      # Context providers
│   │   └── lib/          # Utilities
│   └── package.json
│
├── docs/                 # Documentation
│   ├── codex/           # Reference docs
│   └── deployment/      # Deployment guides
│
└── .github/
    └── workflows/       # GitHub Actions workflows
```

### Installation & Setup
```bash
# API setup
cd api
npm install
cp .env.example .env        # Configure with your credentials
npm run db:migrate
npm run db:seed

# Bot setup
cd bot
npm install

# MiniApp setup
cd miniapp
npm install
```

### Running Services
```bash
# API server (port 3000)
cd api && npm run dev

# API worker (background jobs)
cd api && npm run dev:worker

# Bot
cd bot && npm run dev

# MiniApp (dev server)
cd miniapp && npm run dev

# Redis server (required for API)
redis-server --save "" --appendonly no
```

### Testing
```bash
# API tests
cd api && npm test

# Bot tests
cd bot && npm test

# MiniApp e2e tests
cd miniapp && npm run test:e2e
```

### Linting & Formatting
```bash
# API linting
cd api && npm run lint

# Bot linting
cd bot && npm test

# MiniApp build
cd miniapp && npm run build
```

## Code Guidelines

### Backend (Node.js/Express)
- Use CommonJS (not ESM)
- Keep controllers thin (request handling only)
- Put business logic in services
- Use repositories for data access
- Write database transactions for state changes
- Include audit logs for user actions
- Use Zod for request validation
- Log with Pino
- Handle idempotency with keys

### Bot (Telegram)
- Organize by commands and callbacks
- Use context for state management
- Handle middleware for authentication
- Log important operations
- Use SQLite for persistence

### Frontend (React)
- Use React Router for navigation
- Manage state with Context API
- Use React Hook Form for forms
- Apply Tailwind CSS consistently
- Test with Playwright e2e
- Keep components small and focused
- Use Lucide React for icons

## Payment & Ledger Architecture

### Key Principles
1. **Ledger is source of truth** - Not PayPal status
2. **Atomic transactions** - Wallet + ledger updates together
3. **Idempotency** - All external calls must be idempotent
4. **Audit trail** - Every meaningful state change logged
5. **Risk evaluation** - All payouts checked before processing

### Balance Tiers
- `available_balance` - Ready for payout
- `pending_balance` - Awaiting approval (from paid invoices)
- `frozen_balance` - Reserved for pending payouts
- `paid_out_balance` - Cumulative paid

### Key Services
- `paypalInvoiceService` - Create, send, fetch invoices
- `paypalPayoutService` - Submit and track payouts
- `ledgerService` - Manage balance mutations
- `riskService` - Evaluate risk
- `webhookService` - Handle PayPal webhooks
- `auditLogService` - Track all changes

## Environment Variables

### API Required
```
REDIS_URL=redis://localhost:6379
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
PAYPAL_WEBHOOK_ID=your_webhook_id
JWT_SECRET=your_jwt_secret
```

### Optional Controls
```
PAYPAL_ENVIRONMENT=sandbox|live
INLINE_QUEUE_MODE=true|false    # For local testing
MAX_SINGLE_PAYOUT=5000          # Max per payout
DAILY_PAYOUT_LIMIT=50000        # Daily limit
HIGH_RISK_COUNTRIES=RU,IR,KP    # High-risk zones
```

### Seed Variables
```
SEED_USER_ID=demo-user
SEED_USER_EMAIL=demo@example.com
SEED_WALLET_CURRENCY=USD
SEED_PENDING_BALANCE=250000      # In cents
```

## Common Tasks

### Creating an Invoice
1. Make POST request to `/api/invoices`
2. PayPal invoice created immediately
3. Database record persisted
4. Return invoice link to user

### Processing a Payout
1. User POSTs to `/api/payouts` with idempotency key
2. Balance checked + risk evaluated
3. Funds reserved in ledger
4. Queued for processing
5. PayPal batch submitted with deterministic batch ID
6. Status tracked until completion

### Handling Webhooks
1. PayPal sends webhook to `/webhooks/paypal`
2. Signature verified
3. Event deduplicated
4. Asynchronously processed
5. Ledger updated if needed
6. Audit logged

## Verification Commands

### Quick Checks
```bash
# Lint check
cd api && npm run lint

# Database schema check
cd api && npm run db:migrate

# Seed demo data
cd api && npm run db:seed

# Run tests
cd api && npm test

# PayPal sandbox verification
cd api && npm run verify:paypal:sandbox
```

### Full Verification
```bash
# All checks in sequence
cd api && npm run lint && npm run db:migrate && npm run db:seed && npm test
```

## Git Workflow

### Branch Naming
- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code improvements
- `docs/description` - Documentation

### Commit Messages
- Use clear, descriptive messages
- Reference GitHub issues when applicable
- Include scope: `[api]`, `[bot]`, `[miniapp]`

### Pull Requests
- Write clear PR descriptions
- Link related issues
- Ensure all checks pass
- Request reviews from team

## Performance Considerations

### API
- Lazy load routes
- Cache frequently accessed data
- Use connection pooling for SQLite
- Queue long-running operations
- Monitor BullMQ queues

### Bot
- Throttle rapid commands
- Cache user session data
- Use efficient queries

### MiniApp
- Code-split by route
- Lazy-load images
- Use virtualization for large lists
- Memoize expensive computations

## Security Practices

### No Secrets in Code
- Use environment variables
- Don't commit `.env` files
- No API keys in logs
- No bearer tokens in responses

### Input Validation
- Validate all inputs with Zod
- Sanitize user content
- Check authorization before operations

### Payment Security
- Verify webhook signatures
- Use HTTPS everywhere
- Keep payment data minimal
- Audit all transactions

## Documentation

### Where to Find Info
- `README.md` - Project overview and setup
- `docs/premium-roadmap.md` - Feature roadmap
- `docs/codex/references/project-architecture.md` - Architecture details
- `docs/codex/references/paypal-integration.md` - PayPal specifics
- `docs/deployment/ec2.md` - EC2 deployment guide

### Adding Documentation
- Keep docs in `/docs` directory
- Use Markdown format
- Include code examples
- Update when changing behavior

## When to Ask for Help

Feel free to use Copilot for:
- ✅ Understanding existing code patterns
- ✅ Implementing new features within established patterns
- ✅ Writing tests and fixing bugs
- ✅ Refactoring and optimization
- ✅ Configuration and setup
- ✅ Documentation

For:
- ❓ Architecture decisions affecting multiple systems
- ❓ Payment flow changes
- ❓ Significant refactoring
- ❓ Production deployment issues

## Useful Patterns

### Creating a New Route
1. Define schema in `schemas/`
2. Create controller in `controllers/`
3. Add service logic in `services/`
4. Register route in `routes/`
5. Write tests
6. Update documentation

### Adding a Background Job
1. Create job file in `jobs/`
2. Register with BullMQ
3. Add error handling
4. Log important steps
5. Test with `INLINE_QUEUE_MODE=true`

### New Page in MiniApp
1. Create page component in `pages/`
2. Add route in `App.jsx`
3. Create necessary sub-components
4. Style with Tailwind
5. Add to navigation
6. Test on mobile

## Quick References

### Useful npm scripts
```bash
# API
npm run dev              # Start dev server
npm run dev:worker      # Start background worker
npm run lint            # Run linter
npm test               # Run tests
npm run db:migrate     # Run migrations
npm run db:seed        # Seed demo data
npm run verify:paypal:sandbox  # Test PayPal integration

# Bot
npm run dev            # Start bot
npm test              # Run tests

# MiniApp
npm run dev           # Start Vite dev server
npm run build         # Build for production
npm run test:e2e      # Run e2e tests
```

### Key Files to Know
- `api/config.js` - All configuration defaults
- `api/schemas/` - Zod validation schemas
- `api/services/` - Business logic
- `api/repositories/` - Database queries
- `api/routes/` - Route definitions
- `miniapp/tailwind.config.js` - Styling configuration
- `miniapp/src/lib/servicesCatalog.js` - Service definitions

## Copilot-Specific Tips

1. **Start with `/init`** to load this configuration
2. **Use `/review`** for code review before pushing
3. **Use `/diff`** to see all changes before committing
4. **Use `/tasks`** to manage multiple work items
5. **Set `/cwd`** if working in specific package
6. **Use `/lsp`** for language server if IDE support needed
7. **Check `/context`** to ensure you have enough context
8. **Use `/compact`** if context gets too large

## Next Steps

1. Run `/init` to initialize repository configuration
2. Use `/skills` to see available enhancements
3. Check `/env` to verify configuration loaded
4. Review this file when starting work on Transferly

Good luck with your Transferly work! 🚀
