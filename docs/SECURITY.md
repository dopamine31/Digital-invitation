# Keamanan & Privasi

- Isolasi tenant: `tenantClient()` menyuntikkan `tenantId` pada semua query model operasional dan menolak `where.tenantId` yang berbeda; `requireEvent()` memeriksa ownership.
- RBAC: daftar izin eksplisit di `src/lib/rbac.ts`; keputusan selalu di server, UI hanya menyembunyikan kontrol.
- Password bcrypt (cost 12); sesi cookie httpOnly + `SameSite=Lax`, CSRF double-submit, rotasi secret, OTP/magic link ber-hash.
- Nomor telepon: AES-256-GCM (`phoneEncrypted`), hash SHA-256 untuk deduplikasi, masked di UI/log; logger menyensor token/secret/phone.
- Upload: signed URL, allowlist MIME, batas ukuran, nama asli dicatat; tidak ada secret di browser.
- HTML/CSS/head kustom melewati sanitizer: script/event handler/@import/position fixed dibuang; CSP membatasi sumber skrip, font, gambar, dan frame.
- RSVP publik: rate limit per IP, honeypot, validasi Zod, kuota pax, deadline/autoclose, token tamu, edit token ber-hash.
- QR check-in: HMAC payload + unique constraint `(eventId, guestId)` + penanganan P2002; offline sync idempoten.
- API: Bearer key hash, HMAC `timestamp.body`, jendela 5 menit, scope, rate limit; webhook keluar ditandatangani dan retry.
- Privasi: noindex default, opsi indexable, consent, opt-out blast, blacklist, laporan abuse, kebijakan privasi, ekspor/penghapusan data UU PDP/GDPR lewat Super Admin dengan audit.
- Header: HSTS, `X-Content-Type-Options`, `X-Frame-Options`, Referrer-Policy, Permissions-Policy, CSP.
