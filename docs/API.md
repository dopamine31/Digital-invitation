# REST API & Webhook

Semua endpoint `/api/v1/*` memerlukan header:

```
Authorization: Bearer rk_<prefix>_<secret>
X-Rasa-Timestamp: <unix-seconds>
X-Rasa-Signature: sha256=<hex>
Content-Type: application/json
```

Signature dihitung sebagai `HMAC_SHA256(hmacSecret, timestamp + "." + rawBody)`. `hmacSecret` diberikan sekali saat `createApiKeyAction`. Timestamp valid ±5 menit. GET cukup Bearer; POST/PUT/DELETE wajib HMAC. Rate limit 120 request/menit per API key.

| Method | Endpoint | Scope | Keterangan |
|---|---|---|---|
| GET | `/api/health` | publik | healthcheck Docker/CI |
| GET | `/api/v1/events` | `events.read` | daftar acara tenant |
| GET | `/api/v1/rsvp?eventId=…` | `rsvp.read` | jawaban RSVP |
| POST | `/api/v1/rsvp` | `rsvp.write` | submit/update RSVP via token tamu |
| POST | `/api/v1/checkin` | `checkin.write` | check-in dari signed QR payload |
| GET | `/api/public/{slug}?to=…` | publik + rate limit | ringkasan undangan |
| GET | `/api/exports/{eventId}?type=guests|rsvp|checkin|analytics|wishes&format=csv|xlsx|pdf` | sesi owner | laporan |
| GET | `/api/qr/{guestId}?token=…` | token tamu | PNG QR e-ticket |
| POST | `/api/uploads/sign` | `asset.upload` | signed upload MinIO/S3 |
| GET | `/api/admin/backup` | `system.manage` | backup konfigurasi |
| POST | `/api/webhooks/payment` | provider | verifikasi signature payment adapter |

## Webhook keluar
Event: `rsvp.created`, `rsvp.updated`, `guest.checked_in`, `order.paid`. Header `X-Rasa-Event`, `X-Rasa-Delivery`, `X-Rasa-Timestamp`, `X-Rasa-Signature`. Retry eksponensial dicatat di `WebhookDelivery`.

## Contoh
```bash
TS=$(date +%s)
BODY='{"eventId":"evt_harmoni_wedding","token":"tok_evt_harmoni_wedding_001","status":"ATTENDING","pax":2,"answers":{"relation":"teman"},"consent":true}'
SIG=$(printf "%s.%s" "$TS" "$BODY" | openssl dgst -sha256 -hmac "$HMAC_SECRET" -hex | cut -d' ' -f2)
curl -X POST http://localhost:3000/api/v1/rsvp \
  -H "Authorization: Bearer $API_KEY" \
  -H "X-Rasa-Timestamp: $TS" \
  -H "X-Rasa-Signature: sha256=$SIG" \
  -H "Content-Type: application/json" -d "$BODY"
```
