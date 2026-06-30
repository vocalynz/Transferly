# Transferly Copilot - Tools & Utilities Configuration

## 🛠️ Available Tools in Copilot Environment

### Built-In Tools (Always Available)

#### File Operations
- `view` - View files and directories
- `create` - Create new files
- `edit` - Edit existing files
- `glob` - Find files by pattern
- `grep` - Search file contents

#### Shell & Execution
- `bash` - Execute shell commands
- `read_bash` - Read output from async bash
- `stop_bash` - Stop running bash process
- `list_bash` - List active bash sessions

#### Code Intelligence
- `grep` - Fast code search with ripgrep
- `glob` - File pattern matching
- (IDE integration via `/lsp` or `/ide`)

#### Git & Version Control
- Direct `git` commands via bash
- `gh` CLI for GitHub operations
- Branch/PR information retrieval

#### Utilities
- `web_fetch` - Fetch URLs from internet
- `session_store_sql` - Query session history
- `sql` - Local session database

### Task Delegation

#### Specialized Agents
- `explore` - Fast codebase exploration
- `task` - Execute commands with verbose output
- `general-purpose` - Complex multi-step tasks
- `code-review` - Code quality analysis
- `research` - Deep GitHub/web research

### MCP Servers (Optional)

These can be configured via `/mcp`:
- **GitHub** - Issue/PR integration
- **SQL** - Database query tools
- **Node.js** - Package management
- **Custom tools** - Define your own

---

## 📋 Essential npm Scripts by Package

### API Package (`api/`)

```bash
# Development
npm run dev              # Start dev server (port 3000)
npm run dev:worker      # Start background job worker

# Database
npm run db:migrate      # Run schema migrations
npm run db:seed         # Seed demo data

# Quality
npm run lint            # Run ESLint
npm test               # Run tests

# Verification
npm run verify:paypal:sandbox  # Test PayPal integration

# Production
npm start               # Start production server
npm run worker          # Start production worker
```

### Bot Package (`bot/`)

```bash
# Development
npm run dev             # Start bot with hot-reload
npm start              # Start production bot

# Testing
npm test               # Run test suite

# Configuration
npm run setup          # Setup environment
npm run miniapp:menu   # Configure mini app menu
npm run smoke:telegram # Test live Telegram
```

### MiniApp Package (`miniapp/`)

```bash
# Development
npm run dev             # Start Vite dev server

# Building
npm run build          # Build for production
npm run preview        # Preview production build

# Testing
npm run test:e2e       # Run Playwright tests
npm run test:e2e:list # List available e2e tests
npm run test:e2e:headed # Run tests with browser visible
```

---

## 🗄️ Database Tools

### SQLite3 (Built-in)

```bash
# Connect to database
sqlite3 /path/to/database.db

# Common commands
.tables              # List all tables
.schema table_name   # View table schema
SELECT * FROM wallets;  # Query
.exit               # Quit
```

### Database Files
- **API**: `api/data/transferly.db` (configurable)
- **Bot**: Uses SQLite for state
- **Schema**: `api/db/schema.sql`

### Migration & Seeding
```bash
cd api
npm run db:migrate   # Apply schema
npm run db:seed      # Add demo data
```

---

## 🔄 Job Queue Tools (BullMQ + Redis)

### Redis Commands

```bash
# Redis CLI
redis-cli

# Common commands
KEYS *              # List all keys
HGETALL key_name    # View hash
LLEN queue_name     # Queue length
MONITOR             # Watch all commands
FLUSHDB             # Clear database
```

### Queue Monitoring
```bash
# View queue status
cd api
npm run dev         # Start server
# Then check: http://localhost:3000/api/admin/queues
```

### Start Redis
```bash
redis-server --save "" --appendonly no
```

---

## 🧪 Testing Tools

### Node.js Test Runner
```bash
# Run all tests
cd api && npm test

# Run specific test file
node --test test/payments.test.js

# Run with pattern matching
node --test --test-name-pattern="invoice" test/**/*.test.js

# Watch mode
npm test -- --watch
```

### Playwright E2E (MiniApp)
```bash
# Run all tests
npm run test:e2e

# Run specific test
npm run test:e2e -- tests/dashboard.spec.js

# Visual mode
npm run test:e2e:headed

# Debug mode
PWDEBUG=1 npm run test:e2e
```

---

## 🔍 Code Quality Tools

### ESLint
```bash
cd api
npm run lint                    # Check all files
npm run lint -- --fix           # Auto-fix issues
npm run lint -- src/index.js   # Specific file
```

### Build Validation
```bash
# MiniApp build
cd miniapp
npm run build

# Check build size
npm run build -- --analyze
```

---

## 🚀 Deployment & Verification

### Local Verification
```bash
cd api
npm run lint                     # Code quality
npm run db:migrate              # Schema setup
npm run db:seed                 # Demo data
npm test                        # All tests
```

### PayPal Sandbox Testing
```bash
cd api
npm run verify:paypal:sandbox   # End-to-end test
```

### Health Checks
```bash
# Check API
curl http://localhost:3000/health

# Check Bot
ps aux | grep bot

# Check Redis
redis-cli ping  # Should return PONG
```

---

## 🔐 Environment Management

### .env Files

```bash
# API environment
cp api/.env.example api/.env

# Bot environment
cp bot/.env.example bot/.env

# MiniApp environment
cp miniapp/.env.local miniapp/.env
```

### Local Development Setup
```bash
# 1. Install dependencies
npm install --prefix api
npm install --prefix bot
npm install --prefix miniapp

# 2. Setup databases
cd api
npm run db:migrate
npm run db:seed

# 3. Start services
# Terminal 1: Redis
redis-server --save "" --appendonly no

# Terminal 2: API server
cd api && npm run dev

# Terminal 3: API worker
cd api && npm run dev:worker

# Terminal 4: Bot
cd bot && npm run dev

# Terminal 5: MiniApp
cd miniapp && npm run dev
```

---

## 📊 Monitoring & Logging

### Pino Logger (API)

```javascript
// View logs in pretty format
node --loader=pino/esm app.js | pino-pretty

// Structured logging
logger.info({ invoiceId: 123 }, 'Invoice created');
```

### View Audit Logs
```sql
-- SQLite query
SELECT * FROM audit_logs 
ORDER BY created_at DESC 
LIMIT 20;
```

### Check Queue Status
```bash
# Endpoint: GET /api/admin/queues
curl http://localhost:3000/api/admin/queues \
  -H "Authorization: Bearer $ADMIN_API_TOKEN"
```

---

## 🐛 Debugging Techniques

### Browser DevTools (MiniApp)
- Open DevTools (F12)
- Network tab - Monitor API calls
- Console - View logs and errors
- React DevTools extension

### Node.js Debugging (API/Bot)
```bash
# Start with debugger
node --inspect app.js

# Open chrome://inspect in Chrome
```

### Database Debugging
```bash
# View wallet state
sqlite3 data/transferly.db
SELECT id, available_balance, pending_balance, frozen_balance FROM wallets;

# View recent transactions
SELECT * FROM ledger_entries ORDER BY created_at DESC LIMIT 10;

# View audit trail
SELECT * FROM audit_logs WHERE resource_id = 'invoice-123';
```

---

## 📦 Package Management

### npm Scripts
```bash
# View all available scripts
npm run

# Install new dependency
npm install package-name --prefix api

# Update dependencies
npm update --prefix api

# Clean install (remove node_modules)
rm -rf node_modules && npm install
```

### Lock Files
- `package-lock.json` - Node dependencies lock
- Keep committed to version control
- Use `npm ci` for reproducible installs

---

## 🔗 Useful Integrations

### GitHub CLI (gh)
```bash
# List issues
gh issue list

# View PR
gh pr view

# Create issue
gh issue create --title "Title" --body "Description"

# Check CI status
gh run list
```

### Git Operations
```bash
# View changes
git diff
git status

# Commit with Copilot trailer
git commit -m "Feature: add X" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

# Push changes
git push origin branch-name
```

---

## 🎯 Copilot-Specific Tools

### Context Management
```bash
# Check context usage
/context

# View session information
/session show

# Rewind changes
/rewind

# Search history
/search "keyword"
```

### Code Analysis
```bash
# Show code diff
/diff

# Get code review
/review

# View environment
/env
```

### Task Delegation
```bash
# View task status
/tasks

# Move to background
ctrl+x → b

# Delegate to background agents
# (Use `explore`, `task`, or `general-purpose`)
```

---

## 🔧 Advanced Configuration

### Custom Aliases (in .bashrc or .zshrc)
```bash
# Add to your shell config
alias tdev='cd /workspaces/Transferly && npm run dev --prefix api'
alias ttest='cd /workspaces/Transferly && npm test --prefix api'
alias tlint='cd /workspaces/Transferly && npm run lint --prefix api'
```

### Git Hooks (pre-commit)
```bash
# Create .git/hooks/pre-commit
#!/bin/bash
npm run lint --prefix api
npm test --prefix api
```

### VS Code Extensions
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- Thunder Client (API testing)
- SQLite Viewer
- Playwright Test for VSCode

---

## ⚡ Performance Optimization

### Parallel Testing
```bash
# Run tests in parallel (API uses --test-concurrency=1)
node --test --test-concurrency=4 test/**/*.test.js
```

### Build Caching
```bash
# Docker layer caching
npm ci --prefer-offline --no-audit
```

### Dependency Optimization
```bash
# Check for unused dependencies
npm prune

# Check for security vulnerabilities
npm audit

# Update security patches
npm audit fix
```

---

## 📋 Tool Checklist for Development

- ✅ Node.js v20 installed
- ✅ npm and npm ci working
- ✅ SQLite3 available
- ✅ Redis running (for API)
- ✅ .env files configured
- ✅ Database migrated (`npm run db:migrate`)
- ✅ Demo data seeded (`npm run db:seed`)
- ✅ Linting clean (`npm run lint`)
- ✅ Tests passing (`npm test`)
- ✅ All three services can start

---

## 🚨 Common Tool Issues

### "npm not found"
```bash
# Ensure Node.js is installed
node --version
npm --version

# Install Node.js if needed
# Or use nvm to switch versions
```

### "Redis connection refused"
```bash
# Start Redis server
redis-server --save "" --appendonly no

# Check Redis is running
redis-cli ping  # Should return PONG
```

### "Database is locked"
```bash
# SQLite concurrency issue
# Restart API server
# Or: npm run db:migrate to reset
```

### "Tests timing out"
```bash
# Increase timeout
node --test-timeout=10000 test/file.test.js
```

---

## 📚 Quick Tool Reference

| Tool | Command | Purpose |
|------|---------|---------|
| npm | `npm run dev` | Start dev server |
| npm test | `npm test` | Run tests |
| sqlite3 | `sqlite3 data/transferly.db` | Query database |
| redis-cli | `redis-cli` | Monitor job queue |
| curl | `curl http://localhost:3000/` | Test API |
| gh | `gh issue list` | GitHub operations |
| git | `git diff` | View changes |
| node | `node --inspect app.js` | Debug Node.js |
| npm audit | `npm audit` | Check vulnerabilities |

---

## 🎓 Learning Resources

### Official Docs
- [Node.js](https://nodejs.org/docs/)
- [npm](https://docs.npmjs.com/)
- [SQLite](https://www.sqlite.org/docs.html)
- [Redis](https://redis.io/docs/)

### Transferly Docs
- `README.md` - Project overview
- `docs/codex/references/project-architecture.md` - Architecture
- `docs/deployment/ec2.md` - Deployment guide

---

**All tools are now configured and ready for development! 🚀**

Start with `/init` in Copilot and use this guide as reference. Good luck! 💪
