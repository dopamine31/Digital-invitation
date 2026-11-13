# Environment Variables
Lihat `.env.example`. Hanya variabel berawalan `NEXT_PUBLIC_` yang terbaca browser. Jangan commit `.env`.
| Variabel | Wajib | Keterangan |
|---|---|---|
| DATABASE_URL | ya | Koneksi PostgreSQL |
| SESSION_SECRET | ya (produksi) | Kunci HMAC cookie sesi |
| NEXT_PUBLIC_APP_URL | disarankan | URL publik (canonical/OG/QR) |
| PAYMENT_PROVIDER, MIDTRANS_SERVER_KEY, XENDIT_SECRET_KEY, PAYMENT_WEBHOOK_SECRET | tidak | Pembayaran; default `demo` |
| RESEND_API_KEY, EMAIL_FROM | tidak | Email |
| NEXT_PUBLIC_SUPABASE_URL / ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | tidak | Integrasi Supabase (service role = rahasia server) |
| INSECURE_COOKIES | tidak | `1` hanya untuk uji lokal via http |
