#!/usr/bin/env bash
set -euo pipefail
cd /app
npx tsx scripts/wait-for-db.ts
exec npm run worker
