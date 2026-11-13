"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, Plus, Trash2, Ban, Link2, QrCode, Download, Check, Users, Filter } from "lucide-react";
import { Button, Badge, EmptyState } from "@/components/ui";
import { Modal, toast, CopyButton } from "@/components/client-ui";
import {
  importGuestsAction, addGuestAction, setGuestFlagAction, deleteGuestAction,
  bulkAssignGroupAction, listPersonalLinksAction, ensureQrForGuestsAction, type ImportRow,
} from "@/server/actions/guests";
import type { GuestRow } from "@/server/queries";

const KEYS = ["name", "phone", "email", "groupLabel", "paxAllocated", "notes"] as const;
type MapKey = (typeof KEYS)[number];
const ALIASES: Record<string, MapKey> = {
  nama: "name", name: "name", "nama tamu": "name", "nama_lengkap": "name", "full name": "name",
  hp: "phone", phone: "phone", wa: "phone", whatsapp: "phone", "no hp": "phone", "nomor hp": "phone", telephone: "phone",
  email: "email", surel: "email", "e-mail": "email",
  grup: "groupLabel", group: "groupLabel", kategori: "groupLabel", label: "groupLabel",
  pax: "paxAllocated", "jumlah tamu": "paxAllocated", kuota: "paxAllocated",
  catatan: "notes", notes: "notes", note: "notes",
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (char !== "\r") field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((item) => item.some((cell) => cell.trim()));
}

export function GuestManager({ eventId, slug, guests: initial }: { eventId: string; slug: string; guests: GuestRow[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [mapping, setMapping] = useState<{ headers: string[]; rows: string[][]; map: Partial<Record<MapKey, number>> } | null>(null);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [links, setLinks] = useState<{ name: string; url: string; groupLabel: string }[]>([]);
  const [newGuest, setNewGuest] = useState<ImportRow>({ name: "", phone: "", email: "", groupLabel: "Umum", paxAllocated: 1, notes: "" });

  const groups = useMemo(() => Array.from(new Set(initial.map((guest) => guest.groupLabel))).sort(), [initial]);
  const shown = initial.filter((guest) => (
    (!group || guest.groupLabel === group) &&
    (!search || guest.name.toLowerCase().includes(search.toLowerCase()) || (guest.phoneMasked ?? "").includes(search))
  ));
  const baseUrl = typeof window === "undefined" ? "" : window.location.origin;

  const readFile = async (file: File) => {
    let rows: string[][] = [];
    if (/\.(xlsx|xls|ods)$/i.test(file.name)) {
      const buffer = await file.arrayBuffer();
      const book = XLSX.read(buffer, { type: "array" });
      const sheet = book.Sheets[book.SheetNames[0] ?? ""];
      rows = sheet ? XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" }) : [];
    } else {
      rows = parseCsv(await file.text());
    }
    const headers = (rows[0] ?? []).map(String);
    const map: Partial<Record<MapKey, number>> = {};
    headers.forEach((header, index) => {
      const key = ALIASES[header.trim().toLowerCase()];
      if (key && map[key] === undefined) map[key] = index;
    });
    if (map.name === undefined && headers.length > 0) map.name = 0;
    setMapping({ headers, rows: rows.slice(1), map });
    setReport(null);
  };

  const doImport = async () => {
    if (!mapping) return;
    const rows: ImportRow[] = mapping.rows.map((cells) => ({
      name: String(cells[mapping.map.name ?? 0] ?? "").trim(),
      phone: mapping.map.phone === undefined ? undefined : String(cells[mapping.map.phone] ?? "").trim() || undefined,
      email: mapping.map.email === undefined ? undefined : String(cells[mapping.map.email] ?? "").trim() || undefined,
      groupLabel: mapping.map.groupLabel === undefined ? undefined : String(cells[mapping.map.groupLabel] ?? "").trim() || undefined,
      paxAllocated: mapping.map.paxAllocated === undefined ? undefined : Math.max(1, Number(cells[mapping.map.paxAllocated]) || 1),
      notes: mapping.map.notes === undefined ? undefined : String(cells[mapping.map.notes] ?? "").trim() || undefined,
    })).filter((row) => row.name.length > 0);
    if (rows.length === 0) { toast("Tidak ada baris valid", "err"); return; }
    setImporting(true);
    const result = await importGuestsAction(eventId, rows);
    setImporting(false);
    if (!result.ok) { toast(result.error, "err"); return; }
    setReport(`${result.data.created} tamu dibuat · ${result.data.duplicates} duplikat dilewati · ${result.data.skipped} baris tak valid`);
    setMapping(null);
    toast("Impor selesai");
    router.refresh();
  };

  const addOne = async () => {
    const result = await addGuestAction(eventId, newGuest);
    if (!result.ok) { toast(result.error, "err"); return; }
    toast("Tamu ditambahkan");
    setAddOpen(false); setNewGuest({ name: "", phone: "", email: "", groupLabel: "Umum", paxAllocated: 1, notes: "" });
    router.refresh();
  };

  const bulkAction = async (kind: "blacklisted" | "optOut" | "delete" | "group") => {
    if (selected.length === 0) return;
    const label = kind === "group" ? "Tetapkan grup" : kind === "delete" ? "Hapus" : "Ubah flag";
    const value = kind === "group" ? window.prompt("Nama grup:", "VIP") : null;
    if (kind === "group" && value === null) return;
    if (kind === "delete" && !window.confirm(`Hapus ${selected.length} tamu?`)) return;
    let okCount = 0;
    if (kind === "group") {
      const result = await bulkAssignGroupAction(eventId, selected, value ?? "Umum");
      if (result.ok) okCount = result.data.updated;
    } else {
      for (const id of selected) {
        const result = kind === "delete" ? await deleteGuestAction(eventId, id) : await setGuestFlagAction(eventId, id, kind, true);
        if (result.ok) okCount += 1;
      }
    }
    toast(`${label}: ${okCount} tamu diproses`);
    setSelected([]);
    router.refresh();
  };

  const showLinks = async () => {
    const [linksResult] = await Promise.all([listPersonalLinksAction(eventId), ensureQrForGuestsAction(eventId)]);
    if (!linksResult.ok) { toast(linksResult.error, "err"); return; }
    setLinks(linksResult.data.map((item) => ({ name: item.name, url: `${baseUrl}/i/${slug}?to=${item.token}`, groupLabel: item.groupLabel })));
    setLinksOpen(true);
  };

  const exportLinks = () => {
    const csv = ["nama,grup,link", ...links.map((item) => [item.name, item.groupLabel, item.url].map((value) => `"${value.replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `link-tamu-${slug}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Manajemen tamu</h1><p className="page-subtitle">{initial.length} tamu · Grup: {groups.join(", ") || "Umum"}</p></div>
        <div className="row">
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.ods" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); }} />
          <Button variant="primary" onClick={() => fileRef.current?.click()}><Upload size={15} /> Impor CSV / XLSX</Button>
          <Button onClick={() => setAddOpen(true)}><Plus size={15} /> Tambah tamu</Button>
        </div>
      </div>

      {report ? <div className="notice notice-success">{report}</div> : null}

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="card"><div className="stat-label">Total tamu</div><div className="stat-value">{initial.length}</div></div>
        <div className="card"><div className="stat-label">Belum RSVP</div><div className="stat-value">{initial.filter((g) => !g.rsvpStatus).length}</div></div>
        <div className="card"><div className="stat-label">Opt-out blast</div><div className="stat-value">{initial.filter((g) => g.optOut).length}</div></div>
        <div className="card"><div className="stat-label">Blacklist</div><div className="stat-value">{initial.filter((g) => g.blacklisted).length}</div></div>
      </div>

      <div className="card">
        <div className="row-between" style={{ marginBottom: 14 }}>
          <div className="row">
            <div className="field" style={{ width: 240, margin: 0 }}><input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama / token…" aria-label="Cari tamu" /></div>
            <select className="select" style={{ width: 160 }} value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Filter grup"><option value="">Semua grup</option>{groups.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          </div>
          <div className="row">
            <Button size="sm" onClick={showLinks}><Link2 size={14} /> Link & QR massal</Button>
            <Button size="sm" onClick={() => window.open(`/api/exports/${eventId}?type=guests&format=csv`, "_blank")}><Download size={14} /> Ekspor</Button>
          </div>
        </div>

        {selected.length > 0 ? (
          <div className="notice row" style={{ marginBottom: 12 }}>
            <span style={{ flex: 1 }}>{selected.length} tamu dipilih</span>
            <Button size="sm" onClick={() => bulkAction("group")}><Filter size={13} /> Grup</Button>
            <Button size="sm" onClick={() => bulkAction("optOut")}>Opt-out</Button>
            <Button size="sm" onClick={() => bulkAction("blacklisted")}><Ban size={13} /> Blacklist</Button>
            <Button size="sm" variant="danger" onClick={() => bulkAction("delete")}><Trash2 size={13} /> Hapus</Button>
          </div>
        ) : null}

        {shown.length === 0 ? <EmptyState title="Belum ada tamu" description="Impor CSV/XLSX dengan kolom nama, no HP, email, grup, pax." action={<Button variant="primary" onClick={() => fileRef.current?.click()}>Impor sekarang</Button>} /> : (
          <div className="table-wrap" style={{ border: 0 }}>
            <table className="table">
              <thead><tr>
                <th style={{ width: 34 }}><input type="checkbox" className="checkbox" checked={selected.length === shown.length} onChange={(e) => setSelected(e.target.checked ? shown.map((g) => g.id) : [])} aria-label="Pilih semua" /></th>
                <th>Nama</th><th>Kontak</th><th>Grup</th><th>Pax</th><th>RSVP</th><th>Check-in</th><th>Link personal</th>
              </tr></thead>
              <tbody>{shown.map((guest) => (
                <tr key={guest.id}>
                  <td><input type="checkbox" className="checkbox" checked={selected.includes(guest.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, guest.id] : selected.filter((id) => id !== guest.id))} aria-label={`Pilih ${guest.name}`} /></td>
                  <td><strong>{guest.name}</strong>{guest.walkIn ? <Badge tone="warn">walk-in</Badge> : null}{guest.blacklisted ? <Badge tone="danger">blacklist</Badge> : null}{guest.optOut ? <Badge>opt-out</Badge> : null}{guest.tableNumber ? <div className="tiny muted">Meja {guest.tableNumber}{guest.seatNumber ? ` · ${guest.seatNumber}` : ""}</div> : null}</td>
                  <td className="small mono">{guest.phoneMasked ?? "—"}<div className="tiny muted">{guest.email ?? ""}</div></td>
                  <td className="small">{guest.groupLabel}</td>
                  <td>{guest.paxAllocated} / {guest.paxConfirmed}</td>
                  <td><Badge tone={guest.rsvpStatus === "ATTENDING" ? "success" : guest.rsvpStatus ? "warn" : "default"}>{guest.rsvpStatus ?? "Belum"}</Badge></td>
                  <td>{guest.checkedIn ? <Badge tone="success"><Check size={11} /> Hadir</Badge> : <span className="tiny muted">—</span>}</td>
                  <td><div className="row" style={{ gap: 4 }}>
                    <CopyButton value={`${baseUrl}/i/${slug}?to=${guest.token}`} label="Link" />
                    <a className="btn btn-sm" href={`/api/qr/${guest.id}?token=${encodeURIComponent(guest.token)}`} target="_blank" rel="noreferrer" aria-label={`QR ${guest.name}`}><QrCode size={14} /></a>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      {mapping ? (
        <Modal title={`Petakan kolom · ${mapping.rows.length} baris`} onClose={() => setMapping(null)} wide>
          <div className="stack">
            <div className="notice"><FileSpreadsheet size={15} style={{ verticalAlign: -3 }} /> Deteksi header otomatis. Periksa pemetaan, lalu pratinjau 5 baris pertama sebelum mengimpor.</div>
            <div className="grid grid-3">
              {KEYS.map((key) => (
                <div className="field" key={key}><label className="label">{key}</label><select className="select" value={mapping.map[key] ?? ""} onChange={(e) => setMapping({ ...mapping, map: { ...mapping.map, [key]: e.target.value === "" ? undefined : Number(e.target.value) } })}><option value="">— abaikan —</option>{mapping.headers.map((header, index) => <option key={index} value={index}>{header}</option>)}</select></div>
              ))}
            </div>
            <div className="table-wrap"><table className="table"><thead><tr>{KEYS.map((key) => <th key={key}>{key}</th>)}</tr></thead><tbody>{mapping.rows.slice(0, 5).map((cells, index) => <tr key={index}>{KEYS.map((key) => <td key={key}>{mapping.map[key] === undefined ? "—" : cells[mapping.map[key]]}</td>)}</tr>)}</tbody></table></div>
            <div className="row-between"><span className="small muted">Duplikat nomor HP dalam satu acara dilewati otomatis.</span><Button variant="primary" onClick={doImport} disabled={importing || mapping.map.name === undefined}>{importing ? <span className="spinner" /> : <Users size={15} />} Impor {mapping.rows.length} baris</Button></div>
          </div>
        </Modal>
      ) : null}

      {addOpen ? (
        <Modal title="Tambah tamu" onClose={() => setAddOpen(false)}>
          <div className="stack">
            <div className="field"><label className="label">Nama</label><input className="input" value={newGuest.name} onChange={(e) => setNewGuest({ ...newGuest, name: e.target.value })} /></div>
            <div className="grid grid-2">
              <div className="field"><label className="label">No. HP</label><input className="input" value={newGuest.phone} onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })} /></div>
              <div className="field"><label className="label">Email</label><input className="input" value={newGuest.email} onChange={(e) => setNewGuest({ ...newGuest, email: e.target.value })} /></div>
              <div className="field"><label className="label">Grup</label><input className="input" value={newGuest.groupLabel} onChange={(e) => setNewGuest({ ...newGuest, groupLabel: e.target.value })} /></div>
              <div className="field"><label className="label">Kuota pax</label><input className="input" type="number" min={1} max={20} value={newGuest.paxAllocated} onChange={(e) => setNewGuest({ ...newGuest, paxAllocated: Number(e.target.value) })} /></div>
            </div>
            <div className="field"><label className="label">Catatan</label><input className="input" value={newGuest.notes} onChange={(e) => setNewGuest({ ...newGuest, notes: e.target.value })} /></div>
            <Button variant="primary" onClick={addOne} disabled={newGuest.name.length < 2}>Simpan tamu</Button>
          </div>
        </Modal>
      ) : null}

      {linksOpen ? (
        <Modal title={`${links.length} link personal & QR`} onClose={() => setLinksOpen(false)} wide>
          <div className="row-between" style={{ marginBottom: 12 }}><span className="small muted">QR untuk setiap tamu tersedia di kolom Link personal tabel.</span><Button size="sm" onClick={exportLinks}><Download size={14} /> Unduh CSV</Button></div>
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {links.map((item, index) => (
              <div className="row-between" key={`${item.name}-${index}`} style={{ borderBottom: "1px solid var(--ui-border)", padding: "9px 0" }}>
                <div><strong className="small">{item.name}</strong><div className="tiny muted mono">{item.url}</div></div>
                <CopyButton value={item.url} label="Salin" />
              </div>
            ))}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
