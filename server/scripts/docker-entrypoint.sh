#!/bin/bash
set -euo pipefail

MARKER_FILE="${PRISMA_BOOTSTRAP_MARKER:-/app/.docker-prisma-bootstrapped}"

if [ ! -d node_modules ] || [ "${FORCE_NPM_INSTALL:-0}" = "1" ]; then
  echo "Installing npm dependencies..."
  npm install
fi

if [ "${SKIP_DB_BOOTSTRAP:-0}" != "1" ]; then
  if [ ! -f "$MARKER_FILE" ]; then
    echo "Generating Prisma client..."
    npx prisma generate
    echo "Applying Prisma migrations..."
    npx prisma migrate deploy
    echo "Running Prisma seed..."
    npx prisma db seed
    touch "$MARKER_FILE"
  else
    echo "Prisma bootstrap already completed (marker: $MARKER_FILE). Skipping migrate/seed."
  fi
else
  echo "SKIP_DB_BOOTSTRAP=1 detected. Skipping migrations and seed."
fi

exec "$@"
