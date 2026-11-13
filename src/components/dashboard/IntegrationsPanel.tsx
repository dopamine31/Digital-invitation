"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Webhook, Plus, Trash2, Send, ShieldCheck } from "lucide-react";
import { Button, Badge, EmptyState } from "@/components/ui";
import { toast, CopyButton } from "@/components/client-ui";
import { WEBHOOK_EVENTS, type WebhookEvent } from "@/lib/webhook";
import { createApiKeyAction, revokeApiKeyAction, saveWebhookAction, deleteWebhookAction, testWebhookAction } from "@/server/actions/integrations";
import { formatDateTime } from "@/lib/format";

interface KeyRow { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null }
interface HookRow { id: string; url: string; events: string[]; active: boolean; description: string; deliveries: number }

export function IntegrationsPanel({ keys, hooks }: { keys: KeyRow[]; hooks: HookRow[] }) {
  const router = useRouter();
  const [keyName, setKeyName] = useState("Integrasi CRM");
  const [scopes, setScopes] = useState("events.read,rsvp.read,rsvp.write,checkin.write");
  const [created, setCreated] = useState<{ key: string; secret: string } | null>(null);
  const [hook, setHook] = useState({ url: "", description: "", events: ["rsvp.created"] as WebhookEvent[] });
  const [createdSecret, setCreatedSecret] = useState("");

  const createKey = async () => {
    const result = await createApiKeyAction(keyName, scopes.split(",").map((item) => item.trim()).filter(Boolean));
    if (!result.ok) { toast(result.error, "err"); return; }
    setCreated({ key: result.data.key, secret: result.data.secret });
    toast("API key dibuat — salin sekarang, tidak ditampilkan lagi"); router.refresh();
  };
  const saveHook = async () => {
    const result = await saveWebhookAction({ url: hook.url, events: hook.events, description: hook.description });
    if (!result.ok) { toast(result.error, "err"); return; }
    if (result.data.secret) setCreatedSecret(result.data.secret);
    toast("Webhook tersimpan"); setHook({ url: "", description: "", events: ["rsvp.created"] }); router.refresh();
  };

  return (
    <div className="page">
      <div className="page-header"><div><h1 className="page-title">API & Webhook</h1><p className="page-subtitle">REST API per-tenant dengan Bearer key + HMAC, rate limit, dan event webhook bertanda tangan.</p></div><Badge tone="primary"><ShieldCheck size={12} /> Isolasi tenant</Badge></div>
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="stack">
          <div className="card">
            <h3><KeyRound size={17} style={{ verticalAlign: -3 }} /> API keys</h3>
            <div className="row" style={{ margin: "14px 0" }}><input className="input" value={keyName} onChange={(e) => setKeyName(e.target.value)} aria-label="Nama API key" /><Button variant="primary" onClick={createKey}><Plus size={15} /> Buat key</Button></div>
            <div className="field"><label className="label">Scopes (pisah koma)</label><input className="input mono" value={scopes} onChange={(e) => setScopes(e.target.value)} /></div>
            {created ? <div className="notice" style={{ marginTop: 12 }}><strong>Salin sekarang:</strong><div className="mono tiny" style={{ wordBreak: "break-all" }}>{created.key}</div><div className="mono tiny" style={{ wordBreak: "break-all" }}>HMAC secret: {created.secret}</div><div style={{ marginTop: 8 }}><CopyButton value={JSON.stringify(created)} label="Salin keduanya" /></div></div> : null}
            <div className="divider" />
            {keys.length === 0 ? <EmptyState title="Belum ada API key" /> : keys.map((row) => (
              <div className="row-between" key={row.id} style={{ borderBottom: "1px solid var(--ui-border)", padding: "8px 0" }}>
                <div><strong className="small">{row.name}</strong><div className="tiny muted mono">{row.prefix}_… · {formatDateTime(row.createdAt)}</div></div>
                <div className="row"><Badge tone={row.revokedAt ? "danger" : "success"}>{row.revokedAt ? "Dicabut" : "Aktif"}</Badge>{!row.revokedAt ? <Button size="sm" variant="danger" onClick={async () => { const r = await revokeApiKeyAction(row.id); if (r.ok) { toast("Dicabut"); router.refresh(); } }}><Trash2 size={13} /></Button> : null}</div>
              </div>
            ))}
          </div>
          <div className="card">
            <h3>Contoh permintaan bertanda tangan</h3>
            <pre className="mono tiny" style={{ whiteSpace: "pre-wrap", background: "var(--ui-surface-2)", padding: 14, borderRadius: 10, overflowX: "auto" }}>{`TS=$(date +%s)
BODY='{"eventId":"...","token":"..."}'
SIG=$(printf "%s.%s" "$TS" "$BODY" | openssl dgst -sha256 -hmac "$HMAC_SECRET" -hex | cut -d' ' -f2)
curl -X POST /api/v1/rsvp \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "X-Rasa-Timestamp: $TS" \\
  -H "X-Rasa-Signature: $SIG" \\
  -H "Content-Type: application/json" -d "$BODY"`}</pre>
          </div>
        </div>
        <div className="stack">
          <div className="card">
            <h3><Webhook size={17} style={{ verticalAlign: -3 }} /> Webhook endpoints</h3>
            <div className="stack" style={{ margin: "14px 0" }}>
              <div className="field"><label className="label">URL HTTPS</label><input className="input mono" value={hook.url} onChange={(e) => setHook({ ...hook, url: e.target.value })} placeholder="https://crm.example.id/webhooks/rasa" /></div>
              <div className="field"><label className="label">Deskripsi</label><input className="input" value={hook.description} onChange={(e) => setHook({ ...hook, description: e.target.value })} /></div>
              <div className="field"><label className="label">Event yang dikirim</label><div className="pill-row">{WEBHOOK_EVENTS.map((event) => <label key={event} className="row tiny" style={{ gap: 6, border: "1px solid var(--ui-border)", borderRadius: 999, padding: "6px 10px" }}><input type="checkbox" className="checkbox" checked={hook.events.includes(event)} onChange={(e) => setHook({ ...hook, events: e.target.checked ? [...hook.events, event] : hook.events.filter((item) => item !== event) })} />{event}</label>)}</div></div>
              <div className="row"><Button variant="primary" onClick={saveHook} disabled={!hook.url.startsWith("https://") || hook.events.length === 0}><Plus size={15} /> Simpan webhook</Button><Button onClick={async () => { const r = await testWebhookAction(); if (r.ok) toast(`${r.data.queued} event tes dikirim`); else toast(r.error, "err"); }}><Send size={15} /> Tes kirim</Button></div>
            </div>
            {createdSecret ? <div className="notice">Signing secret (salin sekarang): <code className="mono">{createdSecret}</code> <CopyButton value={createdSecret} label="Salin" /></div> : null}
            <div className="divider" />
            {hooks.length === 0 ? <EmptyState title="Belum ada webhook" /> : hooks.map((row) => (
              <div className="row-between" key={row.id} style={{ borderBottom: "1px solid var(--ui-border)", padding: "9px 0" }}>
                <div><strong className="small mono">{row.url}</strong><div className="tiny muted">{row.events.join(", ")} · {row.deliveries} delivery</div></div>
                <Button size="sm" variant="danger" onClick={async () => { const r = await deleteWebhookAction(row.id); if (r.ok) { toast("Dihapus"); router.refresh(); } }}><Trash2 size={13} /></Button>
              </div>
            ))}
          </div>
          <div className="card">
            <h3>Header & endpoint</h3>
            <div className="tiny muted" style={{ marginTop: 10 }}>Event: {WEBHOOK_EVENTS.join(" · ")}. Signature <code>X-Rasa-Signature = HMAC_SHA256(secret, timestamp + &quot;.&quot; + rawBody)</code> dengan jendela 5 menit dan retry eksponensial.</div>
            <div className="stack" style={{ marginTop: 12 }}>
              {["GET /api/v1/events", "GET /api/v1/rsvp?eventId=…", "POST /api/v1/rsvp", "POST /api/v1/checkin", "GET /api/public/{slug}?to=…"].map((item) => <code key={item} className="mono tiny">{item}</code>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
