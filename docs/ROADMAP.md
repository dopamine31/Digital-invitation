# Roadmap lanjutan (setelah fondasi produksi ini)

1. **Provider nyata**: aktifkan adapter Fonnte/Watzap/Meta Cloud API, Midtrans/Xendit, dan SMTP produksi dengan sertifikasi webhook + rekonsiliasi otomatis.
2. **Custom domain otomatis**: verifikasi DNS, sertifikat wildcard, mapping subdomain/white-label per tenant, dan isolasi cookie lintas domain.
3. **Realtime**: WebSocket/SSE untuk counter check-in, notifikasi RSVP, dan kolaborasi editor multi-pengguna (CRDT).
4. **Analytics lanjutan**: warehouse event stream, cohort, funnel per section, A/B theme, anomaly detection, dan PDF branded.
5. **Editor lanjutan**: template marketplace dengan versi, impor/ekspor tema, asset library, dan AI copy assistant (opsional, tetap no-code).
6. **Seating visual**: drag/drop denah meja, kapasitas otomatis, cetak kartu meja PDF, dan check-in per pax.
7. **Observability**: OpenTelemetry traces, Sentry, metrik BullMQ, alert error rate, dan dashboard on-call.
8. **Compliance**: retention otomatis, DSAR self-service, consent ledger, encryption key rotation terenkripsi ulang, dan audit export terjadwal.
9. **Skalabilitas**: partisi `GuestVisit`, read replica, queue terpisah, CDN, multi-region object storage.
10. **Mobile**: PWA install prompt, kamera QR fallback `jsQR`, dan native wrapper bila diperlukan.
