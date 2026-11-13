"use client";
import { useState } from "react";
import { Copy, Download, Pencil, QrCode, Send, Trash2, Upload, X } from "lucide-react";
import { ActionForm, Submit, useToast } from "@/components/ActionForm";
import { QrImage, downloadQR } from "@/components/QrImage";
import { Badge, Empty, StatusBadge } from "@/components/ui";
import { addGuestAction, deleteGuestAction, importGuestsAction, trackShareAction, updateGuestAction } from "@/server/actions/customer";
import { waLink } from "@/lib/format";

export type GuestRow = { id: number; name: string; phone: string; category: string; groupName: string; code: string; shared: boolean; opens: number; attendance: string; checkedIn: boolean };

export function GuestManager({ invId, slug, title, baseUrl, guests, allowed, max, canQr, canExport }: { invId: number; slug: string; title: string; baseUrl: string; guests: GuestRow[]; allowed: boolean; max: number; canQr: boolean; canExport: boolean }) {
  const [edit, setEdit] = useState<GuestRow | null>(null);
  const [qr, setQr] = useState<GuestRow | null>(null);
  const [q, setQ] = useState("");
  const [csv, setCsv] = useState("");
  const toast = useToast();
  const link = (g: GuestRow) => `${baseUrl}/i/${slug}?to=${encodeURIComponent(g.name)}&g=${g.code}`;
  const list = guests.filter((g) => `${g.name} ${g.category} ${g.groupName}`.toLowerCase().includes(q.toLowerCase()));
  if (!allowed) return <Empty title="Undangan personal tersedia di paket Premium" text="Buat link unik dengan nama tamu di cover, kirim via WhatsApp, dan lacak siapa yang sudah membuka." action={<a className="btn btn-brand" href={`/app/checkout?invitation=${invId}`}>Upgrade paket</a>} />;
  const hid = <input type="hidden" name="id" value={invId} />;
  const msg = (g: GuestRow) => `Kepada Yth. ${g.name},\n\nDengan hormat, kami mengundang Anda untuk hadir pada acara kami "${title}".\nBuka undangan digital:\n${link(g)}\n\nTerima kasih.`;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <ActionForm action={addGuestAction} resetOnSuccess className="card space-y-3 p-4">
          {hid}<p className="font-semibold">Tambah tamu <span className="text-xs font-normal text-stone-400">({guests.length}/{max})</span></p>
          <div className="grid gap-3 sm:grid-cols-2"><div><label className="label">Nama</label><input name="name" required className="input" maxLength={80} /></div><div><label className="label">No. WhatsApp</label><input name="phone" inputMode="tel" className="input" placeholder="08…" /></div>
            <div><label className="label">Kategori</label><select name="category" className="input">{["Umum", "Keluarga", "Teman", "Kerja", "VIP", "Tetangga"].map((c) => <option key={c}>{c}</option>)}</select></div><div><label className="label">Kelompok / keluarga</label><input name="group" className="input" /></div></div>
          <Submit className="btn btn-primary">Tambah tamu</Submit>
        </ActionForm>
        <ActionForm action={importGuestsAction} onDone={() => setCsv("")} className="card space-y-3 p-4">
          {hid}<p className="font-semibold">Import CSV</p>
          <p className="text-xs text-stone-500">Format kolom: <code>nama,telepon,kategori,kelompok</code>. Baris pertama boleh header.</p>
          <input type="hidden" name="csv" value={csv} />
          <div className="flex flex-wrap gap-2"><label className="btn btn-ghost btn-sm cursor-pointer"><Upload size={14} /> Pilih file CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; if (f.size > 300_000) return toast("File maksimal 300 KB.", "err"); setCsv(await f.text()); }} /></label>
            <button type="button" className="btn btn-soft btn-sm" onClick={() => setCsv("nama,telepon,kategori,kelompok\nBapak Contoh,081200000000,Keluarga,Keluarga Besar\nIbu Sample,081211111111,Teman,Teman Kantor")}>Isi contoh</button></div>
          <textarea className="input font-mono text-xs" rows={4} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="Tempel isi CSV di sini…" />
          <Submit className="btn btn-primary" disabled={!csv.trim()}>Impor tamu</Submit>
        </ActionForm>
      </div>

      <div className="flex flex-wrap items-center gap-2"><input type="search" className="input !w-auto min-w-[200px] flex-1" placeholder="Cari tamu…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari tamu" />
        {canExport ? <a href={`/api/invitations/${invId}/export?type=guests`} className="btn btn-ghost"><Download size={16} /> Export CSV</a> : null}</div>

      {list.length === 0 ? <Empty title="Belum ada tamu" text="Tambahkan tamu untuk membuat link personal." /> : (
        <div className="card divide-y divide-stone-100">
          {list.map((g) => (
            <div key={g.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><p className="truncate font-medium">{g.name}</p><p className="truncate text-xs text-stone-500">{g.category}{g.groupName ? ` · ${g.groupName}` : ""}{g.phone ? ` · ${g.phone}` : ""}</p>
                <div className="mt-1 flex flex-wrap gap-1">{g.shared ? <Badge tone="blue">Dibagikan</Badge> : <Badge>Belum dibagikan</Badge>}{g.opens > 0 && <Badge tone="violet">Dibuka {g.opens}×</Badge>}
                  {g.attendance !== "pending" ? <StatusBadge status={g.attendance} /> : <Badge tone="amber">Belum RSVP</Badge>}{g.checkedIn && <Badge tone="green">Check-in ✓</Badge>}</div></div>
              <div className="flex flex-wrap gap-1.5">
                <a target="_blank" rel="noopener noreferrer" href={waLink(g.phone, msg(g))} onClick={() => trackShareAction(g.id)} className="btn btn-brand btn-sm"><Send size={14} /> WhatsApp</a>
                <button type="button" className="btn btn-ghost btn-sm" aria-label="Salin link" onClick={() => { navigator.clipboard?.writeText(link(g)); toast("Link personal disalin."); }}><Copy size={14} /></button>
                {canQr && <button type="button" className="btn btn-ghost btn-sm" aria-label="QR tamu" onClick={() => setQr(g)}><QrCode size={14} /></button>}
                <button type="button" className="btn btn-ghost btn-sm" aria-label="Edit" onClick={() => setEdit(g)}><Pencil size={14} /></button>
                <ActionForm action={deleteGuestAction} confirm={`Hapus ${g.name}?`}>{hid}<input type="hidden" name="guestId" value={g.id} /><Submit className="btn btn-ghost btn-sm text-red-600"><Trash2 size={14} /></Submit></ActionForm>
              </div>
            </div>))}
        </div>)}

      {edit && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-3 sm:items-center" role="dialog" aria-modal onClick={() => setEdit(null)}>
          <div className="fade-up w-full max-w-md rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex justify-between"><p className="font-semibold">Edit tamu</p><button type="button" aria-label="Tutup" onClick={() => setEdit(null)}><X size={18} /></button></div>
            <ActionForm action={updateGuestAction} onDone={() => setEdit(null)} className="space-y-3">
              {hid}<input type="hidden" name="guestId" value={edit.id} />
              <div><label className="label">Nama</label><input name="name" defaultValue={edit.name} required className="input" /></div><div><label className="label">No. WhatsApp</label><input name="phone" defaultValue={edit.phone} className="input" /></div>
              <div className="grid grid-cols-2 gap-3"><div><label className="label">Kategori</label><input name="category" defaultValue={edit.category} className="input" /></div><div><label className="label">Kelompok</label><input name="group" defaultValue={edit.groupName} className="input" /></div></div>
              <Submit className="btn btn-primary w-full">Simpan</Submit>
            </ActionForm>
          </div>
        </div>)}
      {qr && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal onClick={() => setQr(null)}>
          <div className="fade-up w-full max-w-xs rounded-2xl bg-white p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold">QR {qr.name}</p><QrImage value={link(qr)} size={220} className="mx-auto my-3" />
            <p className="text-xs text-stone-500">Dipindai petugas saat check-in.</p>
            <button type="button" className="btn btn-primary mt-3 w-full" onClick={() => downloadQR(link(qr), `qr-${qr.name}`)}><Download size={16} /> Unduh PNG</button></div>
        </div>)}
    </div>
  );
}
