# Database
## PostgreSQL (mode default, dipakai aplikasi saat ini)
1. Buat database, isi `DATABASE_URL`.
2. `npx drizzle-kit push` membuat tabel dari `src/db/schema.ts`.
3. Saat request pertama, `src/lib/seed.ts` mengisi data demo bila tabel `users` kosong (30+ template, paket, voucher, pesanan, undangan, RSVP, dll).

## Supabase
1. Buat project di supabase.com → SQL Editor → jalankan `supabase/migrations/0001_init.sql` (33 tabel, constraint, index, RLS, trigger profil) lalu `supabase/seed.sql`.
2. Isi `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publik) dan `SUPABASE_SERVICE_ROLE_KEY` (rahasia, hanya server/Edge Function).
3. Cara paling mudah memakai Supabase sebagai database: arahkan `DATABASE_URL` ke connection string Postgres Supabase (pooler, mode transaction) lalu `npx drizzle-kit push`. Skema Drizzle (versi ringkas) dan migrasi SQL (versi lengkap dengan RLS) berbagi konsep yang sama; samakan nama tabel bila Anda menjalankan migrasi SQL lengkap.
4. Langkah lanjutan untuk Supabase Auth + Storage penuh: ganti `src/lib/auth.ts` dengan `@supabase/ssr`, pindahkan data URL gambar ke bucket Storage (`invitation-assets`, privat + signed URL), dan panggil operasi sensitif (verifikasi pembayaran, rate limit RSVP) lewat Edge Function.

## Kebijakan RLS ringkas
- Customer hanya membaca/mengubah undangan, tamu, RSVP, order, notifikasi, tiket miliknya.
- Tamu (anon) hanya membaca undangan terbit tanpa password & ucapan yang disetujui; boleh INSERT RSVP/ucapan (dibatasi constraint panjang) — tambahkan rate limit via Edge Function.
- Staff dibatasi `has_perm('...')`; Owner penuh. Role tidak dapat diubah user.
- Tabel tamu (`invitation_guests`) tidak terbaca publik. `check_ins.guest_id UNIQUE` mencegah check-in ganda.
