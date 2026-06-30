#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NPM_INSTALL_COMMAND="${NPM_INSTALL_COMMAND:-ci}"

cd "$ROOT_DIR"

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

require_file() {
  local file_path="$1"
  local hint="$2"

  if [[ ! -f "$file_path" ]]; then
    echo "Missing required file: $file_path" >&2
    echo "$hint" >&2
    exit 1
  fi
}

run() {
  echo "+ $*"
  "$@"
}

case "$NPM_INSTALL_COMMAND" in
  ci|install)
    ;;
  *)
    echo "NPM_INSTALL_COMMAND must be either 'ci' or 'install'." >&2
    exit 1
    ;;
esac

require_command node
require_command npm
require_command pm2

require_file "api/.env" "Copy api/.env.example to api/.env and fill production values."
require_file "bot/.env" "Copy bot/.env.example to bot/.env and fill production values."
require_file "api/ecosystem.config.js" "The API PM2 ecosystem config is required for deployment."
require_file "bot/ecosystem.config.js" "The bot PM2 ecosystem config is required for deployment."

if [[ "$NPM_INSTALL_COMMAND" == "ci" ]]; then
  require_file "api/package-lock.json" "api/package-lock.json is required when using npm ci."
  require_file "bot/package-lock.json" "bot/package-lock.json is required when using npm ci."
fi

run npm "$NPM_INSTALL_COMMAND" --prefix api
run npm "$NPM_INSTALL_COMMAND" --prefix bot

run mkdir -p logs/api logs/bot
run npm run db:migrate --prefix api

run pm2 startOrReload api/ecosystem.config.js --env production
run pm2 startOrReload bot/ecosystem.config.js --env production
run pm2 save

echo
echo "Deployment complete."
echo "Check status with: pm2 status"
echo "Check API logs with: pm2 logs transferly-api --lines 100"
echo "Check bot logs with: pm2 logs transferly-bot --lines 100"
