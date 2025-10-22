#!/bin/sh
set -e

echo "[entrypoint] Running prisma migrate deploy..."
npx prisma migrate deploy

if [ "$SEED_ON_START" = "true" ] || [ "$SEED_ON_START" = "1" ]; then
  echo "[entrypoint] SEED_ON_START is true -> running prisma db seed..."
  npx prisma db seed
else
  echo "[entrypoint] SEED_ON_START not set -> skipping seed."
fi

echo "[entrypoint] Starting server..."
exec node src/server.js
