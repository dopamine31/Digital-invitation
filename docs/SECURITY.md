# Keamanan
**Diterapkan di kode**
- Password di-hash `scrypt` + salt; cookie sesi httpOnly, SameSite=Lax, ditandatangani HMAC, `secure` di produksi.
- RBAC dipaksakan di server: layout/halaman (`requireCustomer/requireStaff/requirePerm/requireOwner`) dan setiap server action (`assert*`). Role tidak pernah dibaca dari input klien; registrasi selalu `customer`.
- Isolasi data: semua query undangan/tamu/order memfilter `userId` pemilik (uji: PUT undangan milik user lain → 404).
- Entitlement paket dihitung di server (`src/lib/entitlements.ts`) pada API simpan, aksi tamu/check-in/export, dan render publik (section yang tidak diizinkan tidak dirender).
- Harga order dihitung ulang di server; voucher divalidasi di server (kuota, periode, minimal, paket, pemilik).
- Validasi Zod (RSVP, ucapan, simpan undangan), sanitasi tag HTML, validasi URL (`javascript:` ditolak), foto hanya `data:image/jpeg|png|webp`, batas ukuran upload, tipe file dibatasi.
- Anti-spam: rate limit per IP+undangan, honeypot, batas jumlah tamu. Brute-force login dibatasi.
- Export CSV mencegah formula injection. Data tamu tidak pernah ditampilkan ke pihak lain; halaman undangan hanya menerima nama dari kode tamu milik undangan itu.
- Undangan privat: password + cookie bertanda tangan; `noindex`.
- Custom CSS pelanggan tidak didukung. Service worker tidak meng-cache `/app`, `/admin`, `/api`.
- Audit log aktivitas penting.

**Batasan yang diketahui**
- Rate limiter in-memory; password undangan privat disimpan apa adanya (kode akses bersama, bukan kredensial akun) — pertimbangkan hash.
- 2FA, CAPTCHA, dan webhook payment sungguhan belum diaktifkan.
- Webhook pembayaran **wajib** memverifikasi signature (contoh di `supabase/functions/payment-webhook`).
