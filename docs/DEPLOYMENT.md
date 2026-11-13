# Panduan Deploy

## Lokal / VPS Ubuntu 22.04 atau Debian 12
```bash
sudo apt update && sudo apt install -y curl git ca-certificates
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker
git clone <repo-url> digital-invitation && cd digital-invitation
./scripts/setup.sh              # atau: docker compose up -d --build
curl -fsS http://localhost:3000/api/health
```
Layanan: app `:3000`, PostgreSQL `:5432`, Redis `:6379`, MinIO API `:9000`/console `:9001`, Mailhog `:8025`.

Entrypoint app menjalankan `wait-for-db` → `npm run db:migrate` → seed hanya bila database masih kosong → `npm start`. Worker memakai image sama dengan `docker/worker-entrypoint.sh`.

## VPS + reverse proxy
- Arahkan domain ke VPS; jalankan Nginx/Caddy terminated TLS.
- `APP_URL` dan `NEXT_PUBLIC_APP_URL` harus memakai `https://domain`.
- Rotasi `AUTH_SECRET`, `ENCRYPTION_KEY`, `CSRF_SALT`; jangan pakai nilai `.env.example`.
- `Strict-Transport-Security` dan CSP aktif; tambahkan domain font/pixel/analytics ke `next.config.ts` bila dibutuhkan.
- Backup harian: `pg_dump`, snapshot volume MinIO, dan `/api/admin/backup`.

## Coolify
1. Import repo sebagai Docker Compose project.
2. Isi environment sesuai `.env.example`; `DATABASE_URL` mengarah ke Postgres internal, `REDIS_URL` ke Redis internal.
3. Set health check path `/api/health` dan port `3000`.
4. Jalankan deploy; migrasi otomatis via entrypoint.

## Vercel + Neon/Supabase + Upstash + S3
Vercel tidak menjalankan container Postgres/Redis/MinIO. Gunakan:
- PostgreSQL terkelola (Neon/Supabase) + `DATABASE_URL` pooled;
- Upstash Redis + `REDIS_URL`;
- Cloudflare R2/AWS S3 + kredensial `S3_*`;
- worker terpisah (Railway/Fly/VPS) untuk BullMQ;
- jalankan `npm run db:migrate && npm run db:seed` sekali dari CI;
- `NEXT_PUBLIC_APP_URL`, `APP_URL`, dan callback Google diset ke domain produksi.

## Skalabilitas
- App stateless: scale horizontal di belakang LB dengan sticky session tidak wajib (sesi di DB).
- Pisahkan worker per queue (`blast`, `reminder`, `webhook`, `notification`) dan naikkan `WORKER_CONCURRENCY`.
- Pindahkan rate limit ke Redis, tambahkan read replica untuk analitik, dan object CDN di depan MinIO/S3.
- Partisi `GuestVisit` per bulan untuk volume tinggi; terapkan retensi audit/analytics.
