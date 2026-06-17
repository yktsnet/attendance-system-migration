#!/usr/bin/env bash
set -euo pipefail

if [[ -f .env ]]; then
  set -a; source .env; set +a
fi

if [[ -z "${DEPLOY_HOST:-}" ]]; then
  echo "❌ Error: DEPLOY_HOST environment variable is not set."
  exit 1
fi

if [[ -z "${DEPLOY_USER:-}" ]]; then
  echo "❌ Error: DEPLOY_USER environment variable is not set."
  exit 1
fi

REMOTE="${DEPLOY_HOST}"
REMOTE_USER="${DEPLOY_USER}"
APP_PATH="${DEPLOY_PATH:-/home/${REMOTE_USER}/github-public/attendance-system-migration}"

echo "==> [1/2] .env 転送"
rsync -az .env "$REMOTE:$APP_PATH/.env"

echo "==> [2/2] docker compose up --build"
ssh "$REMOTE" "cd $APP_PATH && docker compose up -d --build"

echo "==> done"
