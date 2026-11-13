#!/usr/bin/env bash
# Satu perintah setup di Linux: ./scripts/setup.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker belum terpasang. Install: curl -fsSL https://get.docker.com | sh" >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "Plugin 'docker compose' belum tersedia." >&2
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "[setup] .env dibuat dari .env.example"
fi

# Pastikan kunci rahasia lokal tidak memakai nilai contoh.
if grep -q 'change-me-to-a-long-random' .env && command -v openssl >/dev/null 2>&1; then
  SECRET="$(openssl rand -hex 32)"
  sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=$SECRET|" .env
  sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$(openssl rand -hex 32)|" .env
  sed -i "s|^CSRF_SALT=.*|CSRF_SALT=$(openssl rand -hex 16)|" .env
  echo "[setup] AUTH_SECRET / ENCRYPTION_KEY / CSRF_SALT diacak"
fi

echo "[setup] build image & menjalankan seluruh layanan..."
docker compose up -d --build

echo "[setup] menunggu health check aplikasi..."
for i in $(seq 1 90); do
  if curl -fsS http://localhost:3000/api/health >/dev/null 2>&1; then
    echo ""
    echo "✅ Rasa Undangan siap di http://localhost:3000"
    echo "   Super Admin : superadmin@rasa.id / SuperAdmin!234"
    echo "   Owner       : owner@harmoni.id / Owner!234"
    echo "   Panitia     : panitia@harmoni.id / Panitia!234"
    echo "   MinIO       : http://localhost:9001  Mailhog: http://localhost:8025"
    exit 0
  fi
  sleep 2
done
echo "Aplikasi belum sehat. Cek: docker compose logs -f app" >&2
exit 1
