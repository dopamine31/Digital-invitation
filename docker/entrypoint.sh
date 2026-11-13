#!/usr/bin/env bash
set -euo pipefail
cd /app
echo "[entrypoint] menunggu PostgreSQL..."
npx tsx scripts/wait-for-db.ts
echo "[entrypoint] menjalankan migrasi..."
npm run db:migrate
if [ "${SEED_DEMO_DATA:-true}" = "true" ]; then
  echo "[entrypoint] seed data demo (idempoten)..."
  npm run db:seed
fi
echo "[entrypoint] memulai Next.js..."
exec npm start
