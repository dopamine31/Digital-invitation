# Deployment
Aplikasi adalah Next.js full-stack (server actions + route handlers + PostgreSQL), bukan SPA statis. **GitHub Pages tidak cukup** (tidak ada backend).

## Opsi yang direkomendasikan
1. **GitHub** menyimpan kode. 2. **Vercel / Render / Railway / VPS (Docker)** menjalankan Next.js (`npm run build && npm start`, Node 20+). 3. **Supabase / Neon / PostgreSQL terkelola** untuk database.

Langkah umum: push ke GitHub → import repo di hosting → isi variabel dari `.env.example` (minimal `DATABASE_URL`, `SESSION_SECRET`, `NEXT_PUBLIC_APP_URL`) → jalankan `npx drizzle-kit push` sekali terhadap database produksi → deploy.

## Cloudflare Pages
Next.js dengan server actions membutuhkan runtime server. Gunakan adapter **OpenNext** (`@opennextjs/cloudflare`) atau Cloudflare Workers; database harus dapat dijangkau dari edge (Supabase pooler/Hyperdrive). Driver `pg` memerlukan kompatibilitas Node (`nodejs_compat`). Jika ingin cara paling sederhana, pakai Vercel/Render untuk aplikasi dan Cloudflare hanya untuk DNS/CDN. Routing SPA fallback tidak diperlukan (routing ditangani Next.js).

## Domain
Arahkan DNS ke hosting, set `NEXT_PUBLIC_APP_URL=https://domainanda.com` (dipakai untuk canonical, OG image, QR). Custom domain per customer: fitur entitlement `customDomain` + tabel `custom_domains` (verifikasi DNS = langkah lanjutan).

## Payment gateway
1. `PAYMENT_PROVIDER=midtrans|xendit` + kunci server. 2. Implementasikan `createCharge` di `src/adapters/payment.ts`. 3. Deploy webhook (`supabase/functions/payment-webhook` atau route Next.js) yang **memverifikasi signature** lalu memanggil `applyPaidOrder`. 4. Uji di sandbox sebelum live. Selama belum, aplikasi tetap berjalan dalam mode demo dan menampilkan statusnya di Admin → Pengaturan.

## Email
Isi `RESEND_API_KEY` dan `EMAIL_FROM` → notifikasi mengirim email otomatis (`src/adapters/email.ts`).

## Checklist produksi
`SESSION_SECRET` acak • HTTPS • ubah password akun demo / hapus data demo • backup database • rate limit berbasis Redis bila multi-instance.
