"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, MapPin, CalendarClock } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { toast } from "@/components/client-ui";
import { saveScheduleAction, deleteScheduleAction } from "@/server/actions/events";
import { formatDateTime } from "@/lib/format";
import type { EventWorkspace } from "@/server/queries";

interface Draft {
  scheduleId?: string; title: string; startsAt: string; endsAt: string;
  timezone: string; venueName: string; address: string; mapsUrl: string; note: string;
}

const empty = (tz: string, date: string): Draft => ({
  title: "Akad Nikah", startsAt: date, endsAt: "", timezone: tz,
  venueName: "", address: "", mapsUrl: "", note: "",
});

export function ScheduleManager({ workspace }: { workspace: EventWorkspace }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const date = new Date(workspace.startsAt).toISOString().slice(0, 16);
  const save = async () => {
    if (!draft) return;
    setBusy(true);
    const result = await saveScheduleAction({
      eventId: workspace.id, scheduleId: draft.scheduleId,
      title: draft.title, startsAt: new Date(draft.startsAt).toISOString(),
      endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
      timezone: draft.timezone, venueName: draft.venueName, address: draft.address,
      mapsUrl: draft.mapsUrl || null, note: draft.note || null, sortOrder: 0,
    });
    setBusy(false);
    if (!result.ok) { toast(result.error, "err"); return; }
    toast("Jadwal disimpan"); setDraft(null); router.refresh();
  };
  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Jadwal & lokasi</h1><p className="page-subtitle">Multi-sesi, timezone eksplisit, tautan peta, dan Add to Calendar untuk tamu.</p></div>
        <Button variant="primary" onClick={() => setDraft(empty(workspace.timezone, date))}><Plus size={15} /> Tambah sesi</Button>
      </div>
      {workspace.schedules.length === 0 ? <div className="card"><EmptyState title="Belum ada jadwal" description="Tambahkan sesi akad, resepsi, atau seminar." action={<Button variant="primary" onClick={() => setDraft(empty(workspace.timezone, date))}>Tambah sesi</Button>} /></div> : (
        <div className="grid grid-2">
          {workspace.schedules.map((schedule) => (
            <div className="card" key={schedule.id}>
              <div className="row-between"><strong>{schedule.title}</strong><div className="row">
                <Button size="sm" onClick={() => setDraft({ scheduleId: schedule.id, title: schedule.title, startsAt: new Date(schedule.startsAt).toISOString().slice(0, 16), endsAt: schedule.endsAt ? new Date(schedule.endsAt).toISOString().slice(0, 16) : "", timezone: schedule.timezone, venueName: schedule.venueName, address: schedule.address, mapsUrl: schedule.mapsUrl ?? "", note: schedule.note ?? "" })}>Edit</Button>
                <Button size="sm" variant="danger" onClick={async () => { const r = await deleteScheduleAction(workspace.id, schedule.id); if (r.ok) { toast("Dihapus"); router.refresh(); } else toast(r.error, "err"); }}><Trash2 size={13} /></Button>
              </div></div>
              <p className="small muted" style={{ marginTop: 8 }}><CalendarClock size={13} style={{ verticalAlign: -2 }} /> {formatDateTime(schedule.startsAt)} · {schedule.timezone}</p>
              <p className="small" style={{ marginTop: 6 }}><MapPin size={13} style={{ verticalAlign: -2 }} /> {schedule.venueName} — {schedule.address}</p>
              {schedule.mapsUrl ? <a href={schedule.mapsUrl} target="_blank" rel="noreferrer" className="tiny" style={{ color: "var(--ui-primary)" }}>Buka peta ↗</a> : null}
            </div>
          ))}
        </div>
      )}
      {draft ? (
        <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true">
          <h3>{draft.scheduleId ? "Edit sesi" : "Sesi baru"}</h3>
          <div className="stack" style={{ marginTop: 18 }}>
            <div className="field"><label className="label">Judul sesi</label><input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
            <div className="grid grid-2">
              <div className="field"><label className="label">Mulai</label><input className="input" type="datetime-local" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} /></div>
              <div className="field"><label className="label">Selesai</label><input className="input" type="datetime-local" value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} /></div>
              <div className="field"><label className="label">Nama lokasi</label><input className="input" value={draft.venueName} onChange={(e) => setDraft({ ...draft, venueName: e.target.value })} /></div>
              <div className="field"><label className="label">Zona waktu</label><input className="input" value={draft.timezone} onChange={(e) => setDraft({ ...draft, timezone: e.target.value })} /></div>
            </div>
            <div className="field"><label className="label">Alamat lengkap</label><input className="input" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></div>
            <div className="field"><label className="label">URL Google Maps (opsional)</label><input className="input" value={draft.mapsUrl} onChange={(e) => setDraft({ ...draft, mapsUrl: e.target.value })} /></div>
            <div className="field"><label className="label">Catatan</label><textarea className="textarea" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></div>
            <div className="row"><Button variant="primary" onClick={save} disabled={busy || draft.title.length < 2}><Save size={14} /> Simpan</Button><Button onClick={() => setDraft(null)}>Batal</Button></div>
          </div>
        </div></div>
      ) : null}
    </div>
  );
}
