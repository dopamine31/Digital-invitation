# Digital Invitation Studio

Platform bisnis undangan digital (Super Admin, Staff, Customer, Tamu) berbahasa Indonesia, mata uang IDR, zona waktu Asia/Jakarta.
Mobile-first (Android/iPhone), dashboard dapat dipasang sebagai PWA.

> **Catatan jujur tentang teknologi.** Prompt awal meminta React + Vite. Lingkungan build proyek ini adalah **Next.js (App Router) + PostgreSQL (Drizzle ORM)**, sehingga aplikasi dibangun dengan stack itu. Keuntungannya: halaman undangan publik di-*render di server* sehingga **metadata Open Graph/WhatsApp benar-benar terbaca crawler**, dan hak akses (RBAC, entitlement paket) dipaksakan di server. Zustand/React Hook Form/Framer Motion tidak dipakai (editor memakai reducer + riwayat undo/redo sendiri, animasi memakai CSS ringan, validasi memakai Zod di server). Tidak ada mode "mock tanpa database": data demo disimpan di PostgreSQL asli dan di-*seed* otomatis saat pertama kali dijalankan.

## Fitur
- **Homepage** (hero, template unggulan, kategori, keunggulan, cara kerja, paket harga dari database, testimoni, FAQ, CTA, footer).
- **30+ template** dengan kombinasi berbeda: 8 layout cover, 12 ornamen SVG, 6 gaya galeri, 6 animasi, 5 gaya tombol, 4 layout detail acara, 30+ font, palet unik (diuji otomatis: tidak ada dua template identik).
- **Undangan publik** `/i/{slug}`: cover, intro, countdown, acara (4 layout), kalender (Google Calendar + .ics), cerita, galeri + lightbox/slideshow, video, peta, live streaming, RSVP, buku tamu (moderasi, anti-spam), hadiah digital + salin nomor, musik (tidak autoplay sebelum interaksi), penutup, footer + QR.
- **Undangan personal** `?to=Nama&g=kode`: kelola tamu, impor/ekspor CSV, link WhatsApp, QR per tamu, status dibagikan/dibuka/hadir.
- **Editor**: Simple & Advanced, live preview (mobile/desktop/layar penuh), autosave, undo/redo, drag-and-drop urutan section, hide/show, reset section, custom section, upload + crop + kompres foto, mode mobile berbasis tab & bottom bar.
- **Customer**: dashboard, katalog (filter, pencarian debounce, favorit), checkout (paket, add-on, voucher), invoice cetak, upload bukti transfer, simulasi pembayaran demo, undangan (publish/unpublish/arsip/duplikasi/ganti template/hapus), RSVP & statistik, check-in QR, tiket bantuan, notifikasi, akun.
- **Owner/Admin**: overview + grafik, pesanan (status, verifikasi pembayaran, diskon, catatan, instruksi, penugasan, riwayat, checklist kelengkapan), pembayaran + export CSV, customer (blokir/aktifkan), template (CRUD + konfigurasi desain), kategori, paket & add-on (entitlement dapat diedit), voucher, konten (hero/FAQ/testimoni/legal), staff & permission, audit log, pengaturan website & sistem (maintenance mode berfungsi).
- **Staff**: dashboard berbeda (tugas, tiket), menu mengikuti permission yang diberikan Owner (dipaksakan di server).
- **Entitlement paket**: batas tamu/foto, fitur personal/guestbook/hadiah/video/live/QR/check-in/export/password/jadwal/custom section dihitung dari paket + add-on **di server** (API, aksi, dan render publik).
- **PWA**: manifest, service worker (cache aset aman, halaman privat & API tidak di-cache), fallback offline, notifikasi update, tombol pasang.
- **Siap Supabase**: `supabase/migrations/0001_init.sql` (33 tabel + RLS), Edge Functions contoh, adapter pembayaran & email.

## Akun demo
| Peran | Email | Kata sandi |
|---|---|---|
| Owner | owner@demo.id | owner123 |
| Staff (orders, support, customers) | staff@demo.id | staff123 |
| Customer | customer@demo.id | customer123 |

Undangan demo publik: `/i/andi-dan-siti?to=Bapak%20Budi` (kode tamu demo: `demo0001`…`demo0012`). Voucher: `HEMAT10`, `WELCOME25K`, `EXCLUSIVE50`.

## Menjalankan
Persyaratan: Node.js 20+, PostgreSQL 14+.
```bash
cp .env.example .env            # isi DATABASE_URL & SESSION_SECRET
npm install
npx drizzle-kit push            # membuat tabel
npm run dev                     # http://localhost:3000 (data demo di-seed otomatis)
# produksi
npm run build && npm start
```
Pengujian:
```bash
npx vitest run                              # unit + integrasi (17 tes)
npx playwright install chromium
BASE_URL=http://localhost:3000 npx playwright test   # E2E (server harus berjalan)
npx tsc --noEmit
```

## Struktur
```
src/app/            route Next.js: (public), (auth), app (customer), admin, i/[slug], preview, api
src/components/     UI, editor, undangan (invitation/), katalog, form
src/templates/      registry 30 template + data bawaan per kategori
src/server/         core (settings, paket), invitations, orders, actions/ (server actions)
src/adapters/       payment (demo/Midtrans/Xendit), email (demo/Resend)
src/lib/            auth, entitlements, pricing, format, ratelimit, seed
src/db/             skema Drizzle
supabase/           migrasi SQL + RLS, Edge Functions, seed
tests/              unit, integration, e2e
docs/               dokumentasi teknis
```

## Kustomisasi cepat
- **Logo / nama / warna brand / sosial / SEO**: Admin → Pengaturan (disimpan di tabel `settings`). Ikon PWA: ganti `public/icons/*.png`.
- **Menambah template**: Admin → Template → *Tambah*, atau tambahkan entri di `src/templates/registry.ts` (lihat `docs/TEMPLATE_GUIDE.md`).
- **Mengubah paket/harga/batas fitur**: Admin → Paket & Produk (JSON entitlements). Tidak ada harga yang di-hardcode di komponen.
- **Payment gateway / email / Supabase / domain / deploy**: lihat `docs/DEPLOYMENT.md`, `docs/ENVIRONMENT.md`, `docs/DATABASE_SETUP.md`.

## Demo vs butuh integrasi (transparan)
| Fitur | Status |
|---|---|
| Pembayaran | **Demo**: transfer manual + verifikasi admin, dan "Simulasi pembayaran" (tanpa uang nyata). Midtrans/Xendit hanya kerangka adapter; belum aktif tanpa kunci server + webhook ber-signature. |
| Email | Demo (log server). Aktif otomatis jika `RESEND_API_KEY` & `EMAIL_FROM` diisi. |
| Push notification, live chat, custom domain otomatis, 2FA | Struktur/pengaturan tersedia; **belum** terintegrasi (butuh layanan eksternal / Supabase Auth). |
| Penyimpanan media | Foto dikompres di browser dan disimpan sebagai data URL di PostgreSQL (cukup untuk demo). Produksi: pindahkan ke Supabase Storage / S3. |
| Rate limiting | In-memory per instance. Produksi multi-instance: gunakan Redis/Upstash. |
| Scan QR kamera | Memakai `BarcodeDetector` (Chrome/Android). iPhone/Safari: gunakan input kode manual. |
| Custom CSS pelanggan | Sengaja **tidak** didukung demi keamanan (tersedia pengaturan warna/font/layout). |
| Supabase | Migrasi & RLS disiapkan; aplikasi saat ini berjalan di atas PostgreSQL langsung via Drizzle. Migrasi penuh ke Supabase Auth/Storage = langkah lanjutan (lihat docs). |

## Mengunggah ke GitHub (manual)
```bash
unzip digital-invitation-studio-complete.zip -d digital-invitation-studio && cd digital-invitation-studio
git init && git add . && git commit -m "Initial commit: Digital Invitation Studio"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```
Pastikan `.env` tidak ikut ter-commit (sudah ada di `.gitignore`).
