# Pengujian
- Unit/integrasi (Vitest): `npx vitest run` — harga & voucher, entitlement, format/CSV/ICS/sanitasi, integritas 30 template.
- E2E (Playwright): `BASE_URL=http://localhost:3000 npx playwright test` — halaman publik & pencarian, login/role/proteksi route, undangan personal + RSVP + ucapan + hadiah, registrasi → template gratis → editor autosave → publish, checkout premium + voucher + simulasi bayar, tanpa horizontal overflow pada 320/375/414/768/1280 px.
- Tipe: `npx tsc --noEmit`. Build: `npm run build`.
- Linux tanpa library browser: install dependensi sistem Chromium (`npx playwright install-deps`).

Belum otomatis diuji: editor di perangkat sentuh nyata, scan QR kamera, pemutaran musik, Safari iOS, integrasi payment/email sungguhan.
