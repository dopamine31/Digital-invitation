# Rasa Undangan — Undangan Digital & RSVP Premium

SaaS multi-tenant, multi-acara, 100% customizable untuk **Pengelola/Super Admin**, **Pemilik Acara/Tenant**, dan **Tamu**. Dibangun sebagai satu codebase produksi: Next.js 16 App Router, TypeScript strict, Prisma/PostgreSQL, Redis/BullMQ, MinIO, Vitest + Playwright, dan Docker Compose.

## Satu perintah (Ubuntu/Debian + bash)
```bash
./scripts/setup.sh
# setara dengan:
docker compose up -d --build
curl -fsS http://localhost:3000/api/health
```
Aplikasi: `http://localhost:3000` · MinIO console `http://localhost:9001` · Mailhog `http://localhost:8025`.

Setup tanpa Docker (butuh PostgreSQL & Redis lokal):
```bash
cp .env.example .env
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

## Akun demo
| Peran | Email | Kata sandi |
|---|---|---|
| Super Admin | `superadmin@rasa.id` | `SuperAdmin!234` |
| Owner Acara / Tenant | `owner@harmoni.id` | `Owner!234` |
| Panitia Check-in | `panitia@harmoni.id` | `Panitia!234` |
| Owner tenant lain | `owner@anggrek.id`, `owner@nusantara.id` | `Owner!234` |
| Editor / Co-Host | `editor@harmoni.id`, `cohost@harmoni.id` | `Owner!234` |

Undangan demo: `http://localhost:3000/i/pernikahan-andi-siti`. Seed berisi 3 tenant, 5 acara, 200 tamu, RSVP/check-in/kunjungan/blast/wish/invoice/acara versi, dan 8 tema.

## Perintah harian
```bash
npm run dev            # Next.js dev server (0.0.0.0:3000)
npm run lint           # ESLint + aturan no-explicit-any
npm run typecheck      # generate Prisma client + tsc --noEmit
npm test               # unit & integration Vitest
npm run test:e2e       # Playwright (butuh stack berjalan)
npm run build          # produksi
npm run db:migrate     # migrasi SQL versioned + checksum
npm run db:seed        # seed idempoten (hanya saat DB kosong)
npm run db:reset       # paksa reset + seed (FORCE_SEED=true)
npm run worker         # BullMQ worker
make up / make logs / make down
```

## Fitur utama
- **Super Admin**: KPI MRR/ARR/churn/funnel/error/storage, CRUD tenant & user, impersonate ber-audit + banner, suspend/ban, paket/limits/feature flags, kupon/reseller/payout, moderasi, marketplace template, pengumuman, pengaturan sistem, backup, audit log, GDPR/UU PDP export & delete.
- **Owner**: onboarding wizard, editor visual drag/drop + undo/redo + autosave + versioning/rollback + duplikasi, live preview desktop/tablet/mobile, 8 tema berbeda, customizer warna/font/radius/latar/musik/animasi/CSS-HTML-head tersanitasi, PIC wajib di cover & wa.me, 20 section repeatable, RSVP builder conditional logic/kuota/sesi/menu/deadline/ID-EN, CSV/XLSX import + mapping + deduplikasi, link personal & QR, blast bertahap + template + reminder H-7/H-3/H-1, check-in QR/offline/walk-in/multi-loket/meja, analitik + ekspor CSV/XLSX/PDF, tim/komentar, billing/invoice/kupon/referral.
- **Tamu**: sampul personal + nama & PIC, tap-to-open, scroll reveal/parallax, musik opsional, RSVP ≤3 langkah, e-ticket QR, Add to Calendar, share, edit/cancel via secure link, peta, ucapan, hadiah, buku tamu, tanpa login, ID/EN, “minta link saya” via WhatsApp ke PIC.
- **Platform**: REST API per tenant (Bearer + HMAC + scope + rate limit), webhook HMAC 4 event, adapter mock WA/email/payment yang dapat diganti, PWA offline, CSP/HSTS, enkripsi & masking nomor, strict tenant isolation.

## Dokumentasi
`docs/ARCHITECTURE.md`, `docs/API.md`, `docs/DEPLOYMENT.md`, `docs/TESTING.md`, `docs/SECURITY.md`, `docs/ROADMAP.md`.

## Asumsi
1. Acceptance dijalankan di Linux dengan Docker Compose; WhatsApp, email, dan pembayaran memakai adapter **mock** sehingga tidak ada layanan berbayar.
2. `REDIS_URL` kosong → rate limit in-memory dan job diproses inline; saat Compose aktif, Redis/BullMQ dipakai penuh.
3. `binaries.prisma.sh` tidak dapat diakses di sandbox build; `scripts/prisma-generate.sh` memakai placeholder engine untuk `prisma generate`, sementara runtime memakai WASM query compiler `@prisma/adapter-pg` tanpa binary native.
4. Auth.js/Lucia tidak dipakai: sesi kustom dipilih agar impersonate, CSRF, OTP/magic link, dan Google OAuth exchange tetap terkontrol tanpa adapter tambahan.
5. Seluruh kredensial berasal dari `.env`; `.env` lokal tidak di-commit. Nilai default `.env.example` hanya untuk development.
6. `SEED_DEMO_DATA=true` mengisi data demo hanya saat database masih kosong, sehingga restart container tidak menghapus data produksi.
7. Bahasa default `id`, mata uang `IDR`, timezone `Asia/Jakarta`; `en` siap dipakai lewat `?lang=en` atau pengaturan acara.
8. Custom domain/white-label tersedia di model & flag paket, namun provisioning DNS/TLS otomatis masuk roadmap (lihat `docs/ROADMAP.md`).
9. Lighthouse ≥90 perlu dijalankan pada lingkungan dengan PostgreSQL/Redis/MinIO aktif; angkanya tidak diklaim tanpa eksekusi. E2E sudah dijalankan lokal memakai PostgreSQL embedded dan Chromium dari paket npm karena CDN Playwright tidak dapat diakses di sandbox.
10. `docker compose up` dan GitHub Actions belum dieksekusi di sandbox (Docker tidak tersedia); YAML, Dockerfile, entrypoint, dan workflow diperiksa statis.

## Checklist penerimaan
- [x] Register → tenant + trial + owner otomatis.
- [x] Buat acara via wizard → editor/theme/section/form RSVP/versi awal.
- [x] Ubah tema, warna, font, urutan section, show/hide, PIC nama+HP di cover & kontak + wa.me prefilled.
- [x] Impor 100 tamu CSV/XLSX dengan mapping, preview, deteksi duplikat.
- [x] Link personal + QR per tamu.
- [x] WhatsApp mock blast tercatat di `Blast`/`BlastMessage`/`NotificationLog`.
- [x] Tamu membuka link, RSVP dengan pertanyaan kustom & consent.
- [x] Notifikasi RSVP ke owner & PIC (in-app + WA mock).
- [x] Panitia check-in QR/manual tanpa duplikat + offline sync.
- [x] Owner ekspor laporan CSV/XLSX/PDF.
- [x] Super Admin KPI, ganti paket, impersonate ber-audit, suspend tenant.
- [x] Lint, typecheck, 20 unit/integration test, production build, migrasi + seed idempoten, health/REST/OG/QR, dan 2 Playwright E2E lulus lokal.
- [ ] `docker compose up` + GitHub Actions: belum dieksekusi di sandbox; konfigurasi sudah disiapkan dan divalidasi statis.

## Status validasi
Ringkasan perintah dan hasilnya ada di `docs/TESTING.md`. PR ini tidak mengklaim Docker/CI runtime pass karena binary Docker tidak tersedia di sandbox.

## Roadmap singkat
Provider nyata, custom domain otomatis, realtime collaboration, analytics warehouse, editor AI opsional, observability, dan partisi data skala besar — rincian di `docs/ROADMAP.md`.
