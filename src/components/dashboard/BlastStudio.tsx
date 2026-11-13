"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Clock, BellRing, Eye, RotateCcw, XCircle } from "lucide-react";
import { Button, Badge, EmptyState } from "@/components/ui";
import { Modal, Tabs, toast } from "@/components/client-ui";
import { BLAST_VARIABLE_KEYS } from "@/lib/template-vars";
import { createBlastAction, scheduleRemindersAction, cancelBlastAction, retryBlastAction } from "@/server/actions/blast";
import { formatDateTime } from "@/lib/format";
import type { EventWorkspace } from "@/server/queries";

interface BlastRow {
  id: string; name: string; channel: string; status: string; total: number; sent: number; failed: number;
  scheduledAt: string | null; createdAt: string; templateBody: string;
}
interface MessageRow { id: string; toMasked: string | null; status: string; body: string; sentAt: string | null; error: string | null }

const DEFAULT_TEMPLATE = `Assalamu'alaikum {{nama}},

Dengan hormat, kami mengundang Bapak/Ibu ke *{{acara}}*.

Undangan personal: {{link}}
Tanggal: {{tanggal}}

Konfirmasi kehadiran dapat dibalas ke PIC {{pic_nama}} ({{pic_hp}}).

Terima kasih.`;

export function BlastStudio({ workspace, blasts, messages }: { workspace: EventWorkspace; blasts: BlastRow[]; messages: Record<string, MessageRow[]> }) {
  const router = useRouter();
  const [tab, setTab] = useState("compose");
  const [name, setName] = useState("Undangan perdana");
  const [body, setBody] = useState(DEFAULT_TEMPLATE);
  const [channel, setChannel] = useState<"WHATSAPP" | "EMAIL">("WHATSAPP");
  const [groups, setGroups] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [throttle, setThrottle] = useState(60);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<BlastRow | null>(null);

  const create = async () => {
    setBusy(true);
    const result = await createBlastAction({
      eventId: workspace.id, name, templateBody: body, channel, groups,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      throttlePerMinute: throttle,
    });
    setBusy(false);
    if (!result.ok) { toast(result.error, "err"); return; }
    toast("Blast masuk antrean & dicatat di log");
    setTab("history"); router.refresh();
  };

  const reminders = async () => {
    const result = await scheduleRemindersAction(workspace.id, body);
    if (!result.ok) { toast(result.error, "err"); return; }
    toast(`${result.data.scheduled} pengingat H-7/H-3/H-1 dijadwalkan`);
    router.refresh();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">WhatsApp & email blast</h1><p className="page-subtitle">Adapter mock lokal, antrean BullMQ + throttle, template variabel, dan log status pengiriman.</p></div>
        <Badge tone="primary">{channel === "WHATSAPP" ? "WhatsApp mock" : "Email mock (Mailhog)"}</Badge>
      </div>
      <div className="card">
        <Tabs tabs={[{ id: "compose", label: "Susun blast" }, { id: "history", label: `Riwayat (${blasts.length})` }, { id: "reminders", label: "Pengingat otomatis" }]} active={tab} onChange={setTab} />
        <div style={{ marginTop: 20 }}>
          {tab === "compose" ? (
            <div className="grid grid-2" style={{ alignItems: "start" }}>
              <div className="stack">
                <div className="grid grid-2">
                  <div className="field"><label className="label">Nama kampanye</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
                  <div className="field"><label className="label">Kanal</label><select className="select" value={channel} onChange={(e) => setChannel(e.target.value as "WHATSAPP" | "EMAIL")}><option value="WHATSAPP">WhatsApp</option><option value="EMAIL">Email</option></select></div>
                </div>
                <div className="field"><label className="label">Grup penerima (kosong = semua, kecuali opt-out/blacklist)</label><input className="input" value={groups.join(", ")} onChange={(e) => setGroups(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="Keluarga, VIP" /></div>
                <div className="field"><label className="label">Template pesan</label><textarea className="textarea" style={{ minHeight: 210 }} value={body} onChange={(e) => setBody(e.target.value)} /></div>
                <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                  {BLAST_VARIABLE_KEYS.map((key) => <button key={key} className="btn btn-sm mono" onClick={() => setBody(`${body}{{${key}}}`)}>{`{{${key}}}`}</button>)}
                </div>
                <div className="grid grid-2">
                  <div className="field"><label className="label">Jadwalkan (opsional)</label><input className="input" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></div>
                  <div className="field"><label className="label">Throttle / menit</label><input className="input" type="number" min={1} max={600} value={throttle} onChange={(e) => setThrottle(Number(e.target.value))} /></div>
                </div>
                <Button variant="primary" onClick={create} disabled={busy || body.length < 5}>{busy ? <span className="spinner" /> : <Send size={15} />} Kirim bertahap</Button>
              </div>
              <div className="card">
                <strong className="small">Pratinjau untuk tamu pertama</strong>
                <div className="notice" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, marginTop: 12 }}>
                  {body
                    .replaceAll("{{nama}}", "Bapak Budi Santoso")
                    .replaceAll("{{acara}}", workspace.title)
                    .replaceAll("{{link}}", `${typeof window === "undefined" ? "" : window.location.origin}/i/${workspace.slug}?to=TOKEN`)
                    .replaceAll("{{pic_nama}}", workspace.settings.pic.name)
                    .replaceAll("{{pic_hp}}", workspace.settings.pic.phone)
                    .replaceAll("{{grup}}", "Keluarga")
                    .replaceAll("{{pax}}", "2")
                    .replaceAll("{{tanggal}}", new Date(workspace.startsAt).toLocaleDateString("id-ID"))}
                </div>
                <div className="divider" />
                <div className="tiny muted">Nomor tujuan disimpan terenkripsi dan ditampilkan masked di log. Tamu dengan opt-out dilewati otomatis.</div>
              </div>
            </div>
          ) : null}

          {tab === "history" ? (
            blasts.length === 0 ? <EmptyState title="Belum ada blast" description="Susun kampanye pertama Anda. Semua pengiriman mock tercatat di NotificationLog." /> : (
              <div className="stack">
                {blasts.map((blast) => (
                  <div className="card" key={blast.id}>
                    <div className="row-between">
                      <div><strong>{blast.name}</strong><div className="tiny muted">{formatDateTime(blast.createdAt)} · {blast.channel} · {blast.total} penerima</div></div>
                      <div className="row"><Badge tone={blast.status === "COMPLETED" ? "success" : blast.status === "FAILED" ? "danger" : "warn"}>{blast.status}</Badge>
                        <Button size="sm" onClick={() => setDetail(blast)}><Eye size={13} /> Log</Button>
                        {blast.status === "PROCESSING" || blast.status === "SCHEDULED" ? <Button size="sm" variant="danger" onClick={async () => { const r = await cancelBlastAction(workspace.id, blast.id); if (r.ok) { toast("Dibatalkan"); router.refresh(); } }}><XCircle size={13} /></Button> : null}
                        {blast.failed > 0 ? <Button size="sm" onClick={async () => { const r = await retryBlastAction(workspace.id, blast.id); if (r.ok) { toast("Diulang"); router.refresh(); } }}><RotateCcw size={13} /></Button> : null}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 16, marginTop: 12 }}><span className="small muted">Terkirim <strong>{blast.sent}</strong></span><span className="small muted">Gagal <strong>{blast.failed}</strong></span>{blast.scheduledAt ? <span className="small muted"><Clock size={12} style={{ verticalAlign: -2 }} /> {formatDateTime(blast.scheduledAt)}</span> : null}</div>
                  </div>
                ))}
              </div>
            )
          ) : null}

          {tab === "reminders" ? (
            <div className="stack" style={{ maxWidth: 620 }}>
              <h3><BellRing size={18} style={{ verticalAlign: -3 }} /> Pengingat H-7 · H-3 · H-1</h3>
              <p className="small muted">Pengingat dijadwalkan relatif terhadap jadwal acara utama. Hanya tamu dengan status RSVP belum hadir/belum menjawab yang menerima, dengan tetap menghormati opt-out.</p>
              <div className="notice small">Template saat ini: <em>{body.slice(0, 120)}…</em></div>
              <Button variant="primary" onClick={reminders}><Clock size={15} /> Jadwalkan 3 pengingat</Button>
            </div>
          ) : null}
        </div>
      </div>

      {detail ? (
        <Modal title={`Log pengiriman · ${detail.name}`} onClose={() => setDetail(null)} wide>
          {messages[detail.id]?.length ? (
            <div className="table-wrap" style={{ border: 0 }}><table className="table"><thead><tr><th>Tujuan</th><th>Status</th><th>Pesan</th><th>Waktu</th></tr></thead><tbody>
              {messages[detail.id].map((row) => <tr key={row.id}><td className="mono small">{row.toMasked ?? "—"}</td><td><Badge tone={row.status === "SENT" ? "success" : row.status === "FAILED" ? "danger" : "warn"}>{row.status}</Badge><div className="tiny muted">{row.error}</div></td><td className="tiny" style={{ maxWidth: 300, whiteSpace: "pre-wrap" }}>{row.body}</td><td className="tiny muted">{row.sentAt ? formatDateTime(row.sentAt) : "—"}</td></tr>)}
            </tbody></table></div>
          ) : <EmptyState title="Belum ada pesan" description="Antrean sedang diproses worker." />}
        </Modal>
      ) : null}
    </div>
  );
}
