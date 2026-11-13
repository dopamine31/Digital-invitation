# Arsitektur Rasa Undangan

## Ringkasan (≤20 baris)
1. Next.js 16 App Router + TypeScript strict, React 19, Tailwind 4, Server Actions & Route Handlers.
2. PostgreSQL 16 + Prisma 6 `prisma-client` generator (`engineType=client`, `@prisma/adapter-pg`): tanpa native engine binary.
3. Redis/BullMQ untuk antrean blast, reminder, notifikasi, dan webhook; fallback inline saat `REDIS_URL` kosong.
4. MinIO/S3 untuk aset dengan signed URL, validasi MIME/ukuran, dan pencatatan `MediaAsset`.
5. Isolasi tenant: `tenantId` di setiap tabel operasional + `tenantClient()` extension menyuntikkan filter dan menolak `where` lintas tenant.
6. RBAC server-side: `SUPER_ADMIN`, `TENANT_ADMIN`, `EVENT_OWNER`, `CO_HOST`, `EDITOR`, `CHECKIN_STAFF`, `VIEWER`, guest token tanpa login.
7. `requireEvent()` adalah satu-satunya pintu akses acara: permission + ownership + tenant scope + kuota + audit.
8. Auth: sesi cookie httpOnly, bcrypt, CSRF double-submit, OTP email/WA, magic link, Google OAuth exchange.
9. Editor: section array terurut, undo/redo, autosave, versioning/rollback, duplikasi, live preview 3 device.
10. 8 tema dengan layout/ornamen/tipografi berbeda + customizer warna, font, radius, latar, overlay, musik, animasi, CSS/HTML/head tersanitasi.
11. PIC wajib di cover & kontak, wa.me prefilled, sekaligus target notifikasi konfirmasi RSVP.
12. RSVP: form builder conditional logic, Zod, kuota pax, sesi/menu, deadline/autoclose, ID/EN, e-ticket QR, edit/cancel via signed link.
13. Tamu: CSV/XLSX mapping + deteksi duplikat, grup/label/custom fields, link personal + QR, opt-out/blacklist.
14. Blast: template variabel, throttle, H-7/H-3/H-1, status delivery/read/reply, adapter mock/WA/email swappable.
15. Check-in: QR bertanda tangan, unique `(eventId, guestId)` + P2002, offline-first PWA sync, walk-in, multi-loket, meja/kursi.
16. Analitik: visit/unique, RSVP rate, UTM, heatmap section, jawaban kustom; ekspor CSV/XLSX/PDF.
17. Billing: paket/limits/features, faktur, transaksi, kupon, referral/payout, trial, grace, expiry, payment adapter mock/Midtrans/Xendit.
18. Admin: KPI MRR/ARR/churn/funnel/error, CRUD tenant/user, impersonate ber-audit, suspend, plan, kupon, template, moderasi, flag, setting, GDPR.
19. REST API + webhook HMAC dengan API key per tenant, scope, rate limit; event `rsvp.created`, `rsvp.updated`, `guest.checked_in`, `order.paid`.
20. CI: lint/typecheck/unit/integration/build; Playwright E2E alur kritikal; Docker Compose app/postgres/redis/minio/mailhog/worker.

## Keputusan teknis & alasan singkat
| Keputusan | Alasan |
|---|---|
| Next.js App Router + Server Actions | SSR/ISR untuk undangan publik, OG dinamis, mutasi bertipe tanpa layer API duplikat. |
| Prisma `prisma-client` + `PrismaPg` | Tetap type-safe, migrasi SQL versioned, dan dapat generate offline di lingkungan tanpa `binaries.prisma.sh`. |
| Custom session, bukan Auth.js/Lucia | Kontrol penuh atas impersonate, CSRF, OTP/magic link, Google exchange, dan cookie lintas subdomain tanpa dependency adapter tambahan. |
| Redis opsional dengan inline fallback | `docker compose up` tetap memakai BullMQ; `npm run dev` lokal tetap bisa berjalan tanpa Redis. |
| Mock adapter default | Acceptance 100% lokal tanpa layanan berbayar; antarmuka `WhatsAppAdapter`, `EmailAdapter`, `PaymentAdapter` tinggal diganti via env. |
| JSON untuk section/theme/settings | Editor no-code iteratif tanpa migrasi tiap perubahan UI; tetap divalidasi Zod/parser bertipe. |
| Semua tabel operasional memakai scalar `tenantId` | Policy tenant dapat diaudit per query dan mencegah nested write melewati scope. |

## ERD ringkas
```
Plan ──< Tenant ──< User ──< Membership >── Event
                     │                     ├── EventVersion
 Tenant ─────────────┴< Event ──────────────┼── EventSchedule
                             ├── RsvpForm ──┼── Rsvp ──< Guest
                             ├── Guest ──────┼── GuestVisit / CheckIn / BlastMessage
                             ├── Blast ──────┼── BlastMessage / Reminder
                             ├── Wish / GuestBookEntry / SeatingTable / Comment
                             ├── Notification / NotificationLog / MediaAsset / QuotaUsage
                             └── ApiKey / Webhook / WebhookDelivery
Tenant ──< Subscription / Invoice / Transaction / CouponRedemption / Referral / Payout
Platform ── Template / Announcement / FeatureFlag / SystemSetting / AuditLog / ReportAbuse
```
Aturan kunci: `Guest.token` & `Guest.qrPayload` unik; `Guest @@unique([eventId, phoneHash])`; `Rsvp @@unique([eventId, guestId])`; `CheckIn @@unique([eventId, guestId])`; `RsvpForm.eventId` unik; `Event.slug` unik global; `Tenant.slug/customDomain/subdomain` unik. Nomor telepon disimpan `phoneEncrypted` (AES-256-GCM), `phoneMasked`, dan `phoneHash` untuk deduplikasi.

## Alur data
- Public `/i/{slug}?to={token}` → `loadInvitation()` → `GuestVisit` → render section + OG personal.
- RSVP → `rateLimit` + honeypot + Zod + kuota → `Rsvp` → notifikasi owner/PIC → webhook.
- QR check-in → `verifyGuestQr()` → `CheckIn` unique → `guest.checked_in`; offline queue disinkron idempoten.
- Blast → `Blast`/`BlastMessage` → job BullMQ → adapter WA/email → `NotificationLog`.
- Order → invoice → payment adapter/webhook → subscription `ACTIVE` → `order.paid`.
