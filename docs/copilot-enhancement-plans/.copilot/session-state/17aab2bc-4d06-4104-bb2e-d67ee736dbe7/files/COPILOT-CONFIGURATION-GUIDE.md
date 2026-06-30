# 🚀 Copilot Configuration Guide for Transferly

## Complete Setup Instructions

### Step 1: Initialize Copilot for Transferly

In your Copilot CLI session:

```bash
/init
```

This loads all custom instructions from:
- `.github/copilot-instructions.md` (main configuration)
- `.github/instructions/transferly-project.instructions.md` (payment rules & patterns)
- `.github/workflows/copilot-setup-steps.yml` (environment setup)

### Step 2: Verify Configuration Loaded

```bash
/env
```

Expected output should show:
```
Custom Instructions:
  - .github/copilot-instructions.md
  - .github/instructions/transferly-project.instructions.md

Workflows:
  - copilot-setup-steps.yml
```

### Step 3: Set Working Directory

```bash
# For API work
/cwd api

# For Bot work
/cwd bot

# For MiniApp work
/cwd miniapp
```

### Step 4: Review Available Skills

```bash
/skills
```

This shows available skills for enhanced capabilities.

---

## Essential Copilot Commands for Transferly

### Development Workflow

```bash
# Initialize repository context
/init

# See what you changed
/diff

# Get code review before pushing
/review

# View available skills
/skills

# Check current working directory
/cwd

# See session context usage
/context

# Show usage statistics
/usage

# Manage background tasks
/tasks
```

### Code Analysis

```bash
# Search conversation history
/search "keyword"

# View current session
/session show

# Rewind last change
/rewind

# List all active sessions
/session list

# Switch to different session
/resume session-id
```

### Environment

```bash
# Show all configured environment
/env

# Show instructions being used
/instructions

# Configure language server
/lsp

# Manage MCP servers
/mcp

# Add directory to allowed paths
/add-dir /path/to/dir

# List allowed directories
/list-dirs
```

---

## Transferly-Specific Workflows

### Adding a New Payment Feature

```bash
# 1. Start session focused on API
/cwd api

# 2. Review architecture
# Ask: "Explain the payment flow architecture"

# 3. Create feature following pattern
# Ask: "Create new endpoint for [feature] following existing patterns"

# 4. Review changes
/review

# 5. Check diff
/diff

# 6. Run verification
npm run lint
npm run db:migrate
npm test
```

### Working on MiniApp Enhancements

```bash
# 1. Switch to MiniApp
/cwd miniapp

# 2. Get design guidance
# Ask: "Show me how to use the new premium components"

# 3. Build component
# Ask: "Create [ComponentName] using GlassCard and Tailwind tokens"

# 4. Build for validation
npm run build

# 5. Test on mobile
npm run test:e2e
```

### Debugging Payment Issues

```bash
# 1. Check current context
/context

# 2. Ask for diagnosis
# Ask: "Diagnose this payment issue: [description]"

# 3. Review suggested fixes
/diff

# 4. Run specific test
npm run db:migrate
npm test -- test/payments.test.js

# 5. Verify logs
# Check: audit_logs table for transaction trail
```

---

## Context Management

### If Context Gets Large

```bash
# Compact conversation history
/compact summarize what we've done so far on payments

# Then continue working
```

### Checking Context Usage

```bash
/context
```

Shows:
- Tokens used so far
- Tokens remaining
- Approximate space available

---

## Session Management

### Starting a Fresh Session

```bash
/new
```

Use when starting completely different task.

### Resuming Previous Work

```bash
# List all sessions
/session list

# Switch to specific session
/resume session-id-123
```

### Background Work

```bash
# Move current task to background
ctrl+x → b

# Later, bring back to foreground
/tasks
```

---

## Skill Management

### View Available Skills

```bash
/skills
```

### Enable a Skill

```bash
/skills enable skill-name
```

### Recommended Skills for Transferly

- `customize-cloud-agent` - Already enabled (for environment setup)
- Check `/skills` for others that match your work

---

## File Access & Permissions

### Add Directory Access

```bash
/add-dir /workspaces/Transferly/api
/add-dir /workspaces/Transferly/miniapp
/add-dir /workspaces/Transferly/bot
```

### View Allowed Directories

```bash
/list-dirs
```

### Reset Permissions

```bash
/reset-allowed-tools
```

---

## MCP Server Configuration

### Check Configured MCP Servers

```bash
/mcp
```

### Common MCP Servers for Transferly

Consider configuring:
- **Node.js LSP** - For better code intelligence
- **GitHub MCP** - For issue/PR integration
- **SQL tools** - For database queries

---

## Language Server Setup

### Enable Language Server

```bash
/lsp
```

### For IDE Integration

```bash
/ide
```

Connects Copilot to your IDE workspace for better context.

---

## Workflow Examples

### Example 1: Adding New Invoice Endpoint

```bash
# 1. Initialize
/init

# 2. Set context
/cwd api

# 3. Review architecture
# User: "What's the pattern for new endpoints?"

# 4. Create feature
# User: "Create POST /api/invoices/batch endpoint following patterns"

# 5. Check changes
/diff

# 6. Get code review
/review

# 7. Run tests
npm run lint
npm test

# 8. Commit if ready
```

### Example 2: Fixing Bug in Payment Processing

```bash
# 1. Initialize
/init

# 2. Set context
/cwd api

# 3. Describe issue
# User: "Fix: Ledger not updating on webhook. Describe the issue"

# 4. Review changes
/review

# 5. Check before commit
/diff

# 6. Run specific test
npm test -- test/webhooks.test.js

# 7. Verify with sandbox
npm run verify:paypal:sandbox
```

### Example 3: Enhancing MiniApp UI

```bash
# 1. Initialize
/init

# 2. Set context
/cwd miniapp

# 3. Review components
# User: "Show me how to use premium components"

# 4. Create feature
# User: "Create dashboard with animated stats"

# 5. Build & test
npm run build
npm run test:e2e

# 6. Review changes
/review

# 7. Commit when ready
```

---

## Troubleshooting

### "Instructions not loading"
```bash
/init        # Reinitialize
/env         # Verify configuration
```

### "Can't access files"
```bash
/list-dirs   # Check allowed directories
/add-dir     # Add if needed
```

### "Low context window"
```bash
/context     # Check usage
/compact     # Summarize if needed
```

### "Lost previous work"
```bash
/session list    # Find previous session
/resume session-id  # Resume it
```

---

## Performance Tips

### For Better Results

1. **Be specific** - "Create invoice endpoint" vs "I need something for invoices"
2. **Reference files** - "In `paypalInvoiceService`, add..."
3. **Use /diff frequently** - See exactly what changed
4. **Use /review before committing** - Catch issues early
5. **Keep context focused** - Use `/cwd` to focus on package
6. **Reference patterns** - "Following the pattern from `payoutService`..."

### Session Tips

1. Start with `/init` always
2. Use `/cwd` to focus on specific package
3. Run `/diff` before pushing
4. Use `/review` for quality checks
5. Check `/context` if slow
6. Use `/compact` if context is large

---

## Custom Instructions Files Explained

### `.github/copilot-instructions.md`
- **What**: Main Copilot configuration for Transferly
- **When**: Loaded automatically on `/init`
- **Contains**: Project structure, commands, setup instructions, guidelines
- **Edit**: When onboarding changes or adding new patterns

### `.github/instructions/transferly-project.instructions.md`
- **What**: Payment-specific rules and patterns
- **When**: Loaded automatically on `/init`
- **Contains**: Payment flow rules, code patterns, mistakes to avoid
- **Edit**: When adding new payment features or changing rules

### `.github/workflows/copilot-setup-steps.yml`
- **What**: GitHub Actions workflow for Copilot environment
- **When**: Runs before Copilot starts working
- **Contains**: Dependency installation, database setup, environment validation
- **Edit**: When adding new tools or dependencies

---

## Environment Variables for Copilot

### Set in GitHub Repository

```
Settings → Environments → copilot
```

Add as secrets or variables:
- `REDIS_URL` (secret)
- `PAYPAL_CLIENT_ID` (secret)
- `PAYPAL_CLIENT_SECRET` (secret)
- `PAYPAL_WEBHOOK_ID` (secret)
- `JWT_SECRET` (secret)

These will be available to Copilot in its environment.

---

## Quick Reference Cheatsheet

```bash
# Initialize & Setup
/init                    # Load all configuration
/env                     # Verify setup
/cwd api                 # Focus on API

# Code Review & Validation
/diff                    # See changes
/review                  # Get code review
/test                    # Run tests (if available)

# Context & Sessions
/context                 # Check context usage
/session list            # List sessions
/resume session-id       # Switch session
/compact                 # Summarize if needed

# File Access
/add-dir path            # Add directory access
/list-dirs              # See allowed directories

# Help & Info
/help                    # Show all commands
?                        # Quick help
/version                 # Copilot version
/changelog               # Recent changes
```

---

## When to Use What

| Task | Command |
|------|---------|
| Start any work | `/init` |
| Focus on specific package | `/cwd api/bot/miniapp` |
| Before pushing | `/diff` + `/review` |
| Check what's loaded | `/env` |
| See code quality | `/review` |
| Large context | `/compact` |
| Previous work | `/session list` + `/resume` |
| Need help | `/help` or `?` |

---

## Next Steps

1. **Today**: Run `/init` to load configuration
2. **First task**: Use `/cwd` to focus, then `/diff` to review
3. **Before pushing**: Always run `/review`
4. **If stuck**: Check `/context` and this guide

---

## Support & Documentation

### In-Repository Documentation
- **Setup**: See `/help` and `/init`
- **Architecture**: See `docs/codex/references/project-architecture.md`
- **Payment flows**: See `docs/codex/references/paypal-integration.md`
- **Deployment**: See `docs/deployment/ec2.md`

### Quick Commands
- `npm run lint` - Validate code quality
- `npm test` - Run all tests
- `npm run db:migrate` - Setup schema
- `npm run verify:paypal:sandbox` - Test PayPal

### Ask Copilot
- "What are the key services?"
- "Explain the payment flow"
- "What's the pattern for new endpoints?"
- "How do I add a new component?"

---

**🎉 You're now fully configured to work with Transferly using Copilot!**

Start by running `/init` in your next Copilot session. Good luck! 🚀
