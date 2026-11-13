# QA & Pengujian

```bash
npm run lint
npm run typecheck
npm test                  # Vitest: RSVP, quota, conditional logic, RBAC, billing, webhook, sanitizer, REST integration
docker compose up -d --build
npm run test:e2e          # Playwright: alur kritikal + super admin
```

Jika CDN browser Playwright tidak tersedia, arahkan `CHROMIUM_EXECUTABLE_PATH` ke binary Chromium lokal:
```bash
CHROMIUM_EXECUTABLE_PATH=/path/to/chromium npm run test:e2e
```

E2E `tests/e2e/acceptance-flow.spec.ts` mencakup: register → wizard acara → theme/PIC → impor 100 tamu CSV → link personal + QR → blast WhatsApp mock → RSVP tamu dengan pertanyaan kustom → notifikasi owner → check-in manual + anti-duplikat → ekspor CSV. Spec kedua memverifikasi KPI, ubah paket, impersonate dengan banner/audit, dan suspend tenant.

CI `.github/workflows/ci.yml` menjalankan lint, typecheck, unit/integration tests, build, dan E2E terhadap PostgreSQL/Redis service.

## Hasil validasi lokal — 2026-11-13

| Perintah | Hasil |
|---|---|
| `npm run lint` | bersih, 0 error/warning |
| `npm run typecheck` | bersih |
| `npm test` | 5 file / 20 test lulus |
| `npm run build` | sukses, seluruh route App Router terdaftar |
| `npm run db:migrate` | `20261113000100_init` diterapkan |
| `npm run db:seed` / `db:reset` / `db:seed` | idempoten: seed → skip → reset → seed → skip |
| `npm run test:e2e` | 2/2 lulus (PostgreSQL 18 embedded + Chromium 153 lokal) |
| `/api/health` | 200, `database: ok`, `queue: inline-fallback` |
| `/i/[slug]`, `/api/public/[slug]`, `/api/og/[slug]`, `/api/qr/[guestId]` | 200 |
| `/api/v1/events` + `POST /api/v1/rsvp` (Bearer + HMAC) | 200 |

`docker compose up` dan workflow GitHub Actions belum dieksekusi di sandbox karena binary Docker tidak tersedia; YAML Compose/CI dan seluruh shell script sudah divalidasi secara statis. Playwright menyimpan trace/screenshot saat gagal.

Checklist manual tambahan:
- Lighthouse mobile ≥90 pada `/i/pernikahan-andi-siti`, CLS <0.1, keyboard nav, focus visible, reduced motion.
- Dark mode, cetak kartu meja, offline check-in lalu reconnect.
- Ubah `WHATSAPP_ADAPTER`/`PAYMENT_ADAPTER` di staging dengan kredensial sandbox.
