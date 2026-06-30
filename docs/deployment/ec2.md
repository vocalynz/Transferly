# EC2 Deployment

This guide deploys the Transferly API, BullMQ worker, and Telegram bot on a single EC2 host with PM2. It assumes the repository has already been cloned onto the server.

## Prerequisites

- Ubuntu EC2 instance with SSH access.
- Node.js, npm, Redis, and PM2 installed.
- Redis running and reachable through `REDIS_URL`.
- Production PayPal, Telegram, and Transferly API secrets ready.
- Optional reverse proxy and TLS configured separately, for example Nginx in front of the API.

Install PM2 if it is not already present:

```bash
npm install -g pm2
```

## Environment Files

Create production env files from the examples:

```bash
cp api/.env.example api/.env
cp bot/.env.example bot/.env
chmod 600 api/.env bot/.env
```

Edit `api/.env` and set at least:

```bash
NODE_ENV=production
PORT=3000
REDIS_URL=redis://127.0.0.1:6379
SQLITE_DATABASE_PATH=./data/transferly.sqlite
APP_BASE_URL=https://api.your-domain.example
FRONTEND_URL=https://your-domain.example
JWT_SECRET=replace-with-a-long-random-secret
ADMIN_API_TOKEN=replace-with-a-long-random-admin-token
PAYPAL_ENVIRONMENT=live
PAYPAL_CLIENT_ID=your-live-client-id
PAYPAL_CLIENT_SECRET=your-live-client-secret
PAYPAL_WEBHOOK_ID=your-live-webhook-id
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_WEBHOOK_SECRET=replace-with-a-long-random-webhook-secret
TELEGRAM_MINI_APP_URL=https://your-domain.example/miniapp
```

Edit `bot/.env` and set at least:

```bash
ADMIN_TELEGRAM_ID=123456789
ADMIN_TELEGRAM_USERNAME=your_admin_username
BOT_TOKEN=your-telegram-bot-token
API_URL=https://api.your-domain.example
MINI_APP_URL=https://your-domain.example/miniapp
ADMIN_API_TOKEN=replace-with-the-same-admin-token-from-api-env
```

Keep `ADMIN_API_TOKEN` identical in `api/.env` and `bot/.env`. Do not paste real secrets into logs, issue comments, screenshots, or committed files.

## First Deploy

Run the deployment helper from the repository root:

```bash
./scripts/deploy-ec2.sh
```

The script:

- verifies `node`, `npm`, and `pm2` are available
- verifies `api/.env` and `bot/.env` exist
- installs API and bot dependencies with `npm ci`
- creates PM2 log directories
- runs API database migrations
- starts or reloads the API, worker, and bot PM2 apps
- saves the PM2 process list

If the server cannot use `npm ci`, run the helper with:

```bash
NPM_INSTALL_COMMAND=install ./scripts/deploy-ec2.sh
```

## Mini App Build

The Telegram Mini App is a static Vite build. Build it separately from the API and bot PM2 processes, then serve `miniapp/dist` behind TLS with your reverse proxy or static host:

```bash
npm ci --prefix miniapp
VITE_API_BASE_URL=https://api.your-domain.example npm run build --prefix miniapp
```

Point `TELEGRAM_MINI_APP_URL` in `api/.env` and `MINI_APP_URL` in `bot/.env` to the same public HTTPS Mini App URL. Keep the bot menu button, Telegram Web App settings, and reverse proxy route aligned so Telegram users always enter the miniapp through the deployed static build.

## PM2 Startup

After the first successful deploy, configure PM2 to restart apps after a server reboot:

```bash
pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

Run the command printed by PM2, then save the current process list:

```bash
pm2 save
```

Use the actual Linux user and home directory if the EC2 user is not `ubuntu`.

## Health Checks

Check process state:

```bash
pm2 status
```

Check recent logs:

```bash
pm2 logs transferly-api --lines 100
pm2 logs transferly-api-worker --lines 100
pm2 logs transferly-bot --lines 100
```

Check the API directly from the host:

```bash
curl http://127.0.0.1:3000/health
```

If the API sits behind a reverse proxy, also check the public URL:

```bash
curl https://api.your-domain.example/health
```

## Webhooks

Configure PayPal to deliver events to:

```text
https://api.your-domain.example/webhooks/paypal
```

If using the Telegram webhook flow, the API endpoint is:

```text
https://api.your-domain.example/api/telegram/webhook
```

Make sure webhook secrets in provider dashboards match the values in the server env files.

## Updates

For normal updates:

```bash
git pull
./scripts/deploy-ec2.sh
```

The helper uses `pm2 startOrReload`, so it can be used for both first deploys and later reloads.

## Backups

Back up the SQLite database paths used by production env files. By default, the API database is:

```text
api/data/transferly.sqlite
```

If the bot uses its local SQLite database, also back up:

```text
bot/db/data.db
```

Take backups before migrations and before server maintenance.
