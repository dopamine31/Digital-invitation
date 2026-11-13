"use client";
import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, GripVertical, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { EventItem, GiftItem, Host, InvitationData, SectionItem, StoryItem } from "@/types";
import { SECTION_LABELS } from "@/types";
import { ASPECTS, Group, PhotoField, TextField, processImage } from "./fields";
import { FONT_CHOICES, type PanelProps } from "./types";
import { useToast } from "@/components/ActionForm";
import { randomCode } from "@/lib/format";

const lockMsg = (pkg: string) => `Tersedia pada paket ${pkg} ke atas. Konten tetap tersimpan, tetapi belum tampil sebelum paket di-upgrade.`;

function HostFields({ h, onChange, label }: { h: Host; onChange: (p: Partial<Host>) => void; label: string }) {
  return (
    <Group title={label}>
      <TextField label="Nama panggilan" value={h.name} onChange={(v) => onChange({ name: v })} max={40} />
      <TextField label="Nama lengkap" value={h.fullName} onChange={(v) => onChange({ fullName: v })} max={80} />
      <TextField label="Nama orang tua" value={h.parents} onChange={(v) => onChange({ parents: v })} />
      <TextField label="Deskripsi singkat" value={h.bio} multiline rows={2} onChange={(v) => onChange({ bio: v })} />
      <PhotoField label="Foto" value={h.photo} onChange={(v) => onChange({ photo: v })} aspect={1} />
    </Group>
  );
}

export function ContentPanel({ s, up, ent }: PanelProps) {
  const d = s.data;
  const set = (patch: Partial<InvitationData>, key?: string) => up((x) => ({ ...x, data: { ...x.data, ...patch } }), key);
  const setHost = (k: "host1" | "host2", p: Partial<Host>) => set({ [k]: { ...d[k], ...p } } as Partial<InvitationData>, `${k}${Object.keys(p)[0]}`);
  const setEv = (i: number, p: Partial<EventItem>) => set({ events: d.events.map((e, j) => (j === i ? { ...e, ...p } : e)) }, `ev${i}${Object.keys(p)[0]}`);
  const setSt = (i: number, p: Partial<StoryItem>) => set({ story: d.story.map((e, j) => (j === i ? { ...e, ...p } : e)) }, `st${i}${Object.keys(p)[0]}`);
  const setGift = (i: number, p: Partial<GiftItem>) => set({ gifts: d.gifts.map((e, j) => (j === i ? { ...e, ...p } : e)) }, `gf${i}${Object.keys(p)[0]}`);
  return (
    <div className="space-y-3">
      <Group title="Dasar acara" open>
        <TextField label="Judul / kepala undangan" value={d.heading} onChange={(v) => set({ heading: v }, "heading")} max={60} />
        <TextField label="Teks pembuka" value={d.opening} multiline onChange={(v) => set({ opening: v }, "opening")} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Tanggal & jam utama" type="datetime-local" value={d.date} onChange={(v) => set({ date: v }, "date")} />
          <TextField label="Batas RSVP" type="date" value={d.rsvpDeadline} onChange={(v) => set({ rsvpDeadline: v }, "rsvp")} />
        </div>
      </Group>
      <HostFields h={d.host1} label={d.host2.name || d.eventType === "wedding" ? "Mempelai / Pemilik 1" : "Pemilik acara"} onChange={(p) => setHost("host1", p)} />
      <HostFields h={d.host2} label="Mempelai / Pemilik 2 (opsional)" onChange={(p) => setHost("host2", p)} />
      <Group title={`Detail acara (${d.events.length})`}>
        {d.events.map((e, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-stone-200 p-3">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-stone-500">Acara {i + 1}</span><button type="button" className="text-red-600" aria-label="Hapus acara" onClick={() => set({ events: d.events.filter((_, j) => j !== i) })}><Trash2 size={15} /></button></div>
            <TextField label="Nama acara" value={e.name} onChange={(v) => setEv(i, { name: v })} />
            <div className="grid grid-cols-3 gap-2"><TextField label="Tanggal" type="date" value={e.date} onChange={(v) => setEv(i, { date: v })} /><TextField label="Mulai" type="time" value={e.time} onChange={(v) => setEv(i, { time: v })} /><TextField label="Selesai" type="time" value={e.endTime} onChange={(v) => setEv(i, { endTime: v })} /></div>
            <TextField label="Tempat" value={e.place} onChange={(v) => setEv(i, { place: v })} />
            <TextField label="Alamat" value={e.address} onChange={(v) => setEv(i, { address: v })} />
            <TextField label="Link Google Maps" value={e.mapUrl} onChange={(v) => setEv(i, { mapUrl: v })} placeholder="https://maps.google.com/..." />
            <TextField label="Catatan" value={e.note} onChange={(v) => setEv(i, { note: v })} />
          </div>))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ events: [...d.events, { name: "Acara baru", date: d.date.slice(0, 10), time: "09:00", endTime: "12:00", place: d.locationName, address: d.address, mapUrl: d.mapUrl, note: "" }] })}><Plus size={14} /> Tambah acara</button>
      </Group>
      <Group title={`Cerita / timeline (${d.story.length})`}>
        {d.story.map((e, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-stone-200 p-3">
            <div className="flex justify-between"><span className="text-xs font-semibold text-stone-500">Peristiwa {i + 1}</span><button type="button" className="text-red-600" aria-label="Hapus" onClick={() => set({ story: d.story.filter((_, j) => j !== i) })}><Trash2 size={15} /></button></div>
            <div className="grid grid-cols-2 gap-2"><TextField label="Tanggal / tahun" value={e.date} onChange={(v) => setSt(i, { date: v })} /><TextField label="Judul" value={e.title} onChange={(v) => setSt(i, { title: v })} /></div>
            <TextField label="Cerita" value={e.text} multiline rows={2} onChange={(v) => setSt(i, { text: v })} />
            <PhotoField label="Foto" value={e.photo} aspect={16 / 9} onChange={(v) => setSt(i, { photo: v })} />
          </div>))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ story: [...d.story, { date: "", title: "Judul", text: "", photo: "" }] })}><Plus size={14} /> Tambah peristiwa</button>
      </Group>
      <Group title="Lokasi & peta">
        <TextField label="Nama lokasi" value={d.locationName} onChange={(v) => set({ locationName: v }, "loc")} />
        <TextField label="Alamat" value={d.address} onChange={(v) => set({ address: v }, "addr")} />
        <TextField label="Link navigasi (Google Maps)" value={d.mapUrl} onChange={(v) => set({ mapUrl: v }, "mapurl")} />
        <TextField label="URL embed peta (opsional)" value={d.mapEmbed} onChange={(v) => set({ mapEmbed: v }, "mapembed")} placeholder="https://www.google.com/maps?q=...&output=embed" />
        <TextField label="Petunjuk arah" value={d.directions} multiline rows={2} onChange={(v) => set({ directions: v }, "dir")} />
      </Group>
      <Group title="Hadiah digital" locked={!ent.gift} lockText={lockMsg("Premium")}>
        {d.gifts.map((g, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-stone-200 p-3">
            <div className="flex justify-between"><select aria-label="Jenis" className="input !min-h-[36px] !w-auto" value={g.type} onChange={(e) => setGift(i, { type: e.target.value as GiftItem["type"] })}><option value="bank">Bank</option><option value="ewallet">E-Wallet</option><option value="qris">QRIS</option></select>
              <button type="button" className="text-red-600" aria-label="Hapus" onClick={() => set({ gifts: d.gifts.filter((_, j) => j !== i) })}><Trash2 size={15} /></button></div>
            <div className="grid grid-cols-2 gap-2"><TextField label="Bank / e-wallet" value={g.provider} onChange={(v) => setGift(i, { provider: v })} /><TextField label="Nomor" value={g.number} onChange={(v) => setGift(i, { number: v })} /></div>
            <TextField label="Atas nama" value={g.holder} onChange={(v) => setGift(i, { holder: v })} />
            {g.type === "qris" && <PhotoField label="Gambar QRIS" value={g.qr} aspect={1} maxSide={700} onChange={(v) => setGift(i, { qr: v })} />}
          </div>))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ gifts: [...d.gifts, { type: "bank", provider: "", number: "", holder: "", qr: "" }] })}><Plus size={14} /> Tambah rekening</button>
        <TextField label="Alamat kirim kado (opsional)" value={d.giftAddress} multiline rows={2} onChange={(v) => set({ giftAddress: v }, "gaddr")} />
      </Group>
      <Group title="Video" locked={!ent.video} lockText={lockMsg("Exclusive")}>
        <TextField label="Link YouTube / file video (mp4)" value={d.videoUrl} onChange={(v) => set({ videoUrl: v }, "vid")} placeholder="https://youtu.be/..." />
        <PhotoField label="Poster video" value={d.videoPoster} aspect={16 / 9} onChange={(v) => set({ videoPoster: v })} />
      </Group>
      <Group title="Live streaming" locked={!ent.live} lockText={lockMsg("Exclusive")}>
        <TextField label="Link live streaming" value={d.streamUrl} onChange={(v) => set({ streamUrl: v }, "stream")} />
        <div className="grid grid-cols-2 gap-2"><TextField label="Platform" value={d.streamPlatform} onChange={(v) => set({ streamPlatform: v }, "sp")} /><TextField label="Jadwal" value={d.streamSchedule} onChange={(v) => set({ streamSchedule: v }, "ss")} placeholder="Sabtu, 08.00 WIB" /></div>
      </Group>
      <MusicGroup {...{ s, up, ent } as PanelProps} />
      <Group title="Penutup & footer">
        <TextField label="Kalimat penutup" value={d.closing} multiline onChange={(v) => set({ closing: v }, "closing")} />
        <TextField label="Nama keluarga" value={d.family} onChange={(v) => set({ family: v }, "family")} />
        <TextField label="Teks footer" value={d.footerText} onChange={(v) => set({ footerText: v }, "footer")} />
      </Group>
    </div>
  );
}

function MusicGroup({ s, up, ent }: PanelProps) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const d = s.data;
  return (
    <Group title="Musik latar" locked={!ent.music} lockText={lockMsg("Basic")}>
      <TextField label="URL audio (.mp3)" value={d.musicUrl.startsWith("data:") ? "(file diunggah)" : d.musicUrl} onChange={(v) => up((x) => ({ ...x, data: { ...x.data, musicUrl: v } }), "music")} placeholder="https://.../lagu.mp3" />
      <TextField label="Judul lagu" value={d.musicTitle} onChange={(v) => up((x) => ({ ...x, data: { ...x.data, musicTitle: v } }), "mt")} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => ref.current?.click()}>Unggah audio (maks 2 MB)</button>
        {d.musicUrl && <button type="button" className="btn btn-soft btn-sm" onClick={() => up((x) => ({ ...x, data: { ...x.data, musicUrl: "" } }))}>Hapus</button>}
      </div>
      <input ref={ref} type="file" accept="audio/mpeg,audio/mp3" className="hidden" onChange={(e) => {
        const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
        if (f.size > 2 * 1024 * 1024) return toast("Ukuran audio maksimal 2 MB.", "err");
        const r = new FileReader(); r.onload = () => up((x) => ({ ...x, data: { ...x.data, musicUrl: String(r.result), musicTitle: x.data.musicTitle || f.name } })); r.readAsDataURL(f);
      }} />
      <p className="text-[11px] text-stone-500">Pastikan Anda memiliki hak penggunaan lagu. Musik hanya diputar setelah tamu menekan “Buka Undangan”.</p>
    </Group>
  );
}

export function MediaPanel({ s, up, maxPhotos }: PanelProps) {
  const d = s.data;
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [aspect, setAspect] = useState<number | null>(4 / 5);
  const [busy, setBusy] = useState(false);
  const setG = (g: string[]) => up((x) => ({ ...x, data: { ...x.data, gallery: g } }));
  const add = async (files: FileList | null) => {
    if (!files) return;
    setBusy(true);
    const out: string[] = [];
    for (const f of Array.from(files)) {
      if (d.gallery.length + out.length >= maxPhotos) { toast(`Batas ${maxPhotos} foto pada paket Anda.`, "err"); break; }
      try { out.push(await processImage(f, aspect, 1200, 0.76)); } catch (e) { toast((e as Error).message, "err"); }
    }
    if (out.length) setG([...d.gallery, ...out]);
    setBusy(false);
  };
  return (
    <div className="space-y-3">
      <Group title="Foto cover" open>
        <PhotoField label="Foto utama (cover)" value={d.coverPhoto} aspect={3 / 4} maxSide={1200} onChange={(v) => up((x) => ({ ...x, data: { ...x.data, coverPhoto: v } }))} />
        <p className="text-[11px] text-stone-500">Foto otomatis di-crop ke rasio 3:4 dan dikompres agar cepat dibuka di HP.</p>
      </Group>
      <Group title={`Galeri foto (${d.gallery.length}/${maxPhotos})`} open>
        <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-stone-500">Crop:</span>
          {ASPECTS.map((a) => <button key={a.label} type="button" onClick={() => setAspect(a.value)} className={`btn btn-sm ${aspect === a.value ? "btn-primary" : "btn-ghost"}`}>{a.label}</button>)}</div>
        <div className="grid grid-cols-3 gap-2">
          {d.gallery.map((g, i) => (
            <div key={i} className="relative overflow-hidden rounded-lg border border-stone-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g} alt={`Foto ${i + 1}`} className="aspect-square w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 p-1 text-white">
                <button type="button" aria-label="Naik" disabled={i === 0} onClick={() => { const n = [...d.gallery]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setG(n); }} className="p-1 disabled:opacity-30"><ArrowUp size={14} /></button>
                <button type="button" aria-label="Turun" disabled={i === d.gallery.length - 1} onClick={() => { const n = [...d.gallery]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; setG(n); }} className="p-1 disabled:opacity-30"><ArrowDown size={14} /></button>
                <button type="button" aria-label="Hapus" onClick={() => setG(d.gallery.filter((_, j) => j !== i))} className="p-1 text-red-300"><Trash2 size={14} /></button>
              </div>
            </div>))}
        </div>
        <button type="button" disabled={busy || d.gallery.length >= maxPhotos} onClick={() => ref.current?.click()} className="btn btn-ghost btn-sm">{busy ? "Memproses…" : "+ Tambah foto"}</button>
        <input ref={ref} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </Group>
    </div>
  );
}

const SEL = {
  cover: ["center", "split", "frame", "arch", "stack", "type", "full", "circle"], orn: ["floral", "leaf", "geo", "islamic", "batik", "wave", "marble", "line", "dots", "gold", "stars", "none"],
  gal: ["grid", "masonry", "polaroid", "slider", "film", "mosaic"], anim: ["fade", "rise", "zoom", "blur", "slide", "flip"], btn: ["pill", "square", "outline", "underline", "soft"], ev: ["cards", "timeline", "split", "ticket"],
} as const;
const LAB: Record<string, string> = { cover: "Layout cover", orn: "Ornamen", gal: "Gaya galeri", anim: "Animasi", btn: "Tombol", ev: "Detail acara" };
const PAL: [keyof import("@/types").Palette, string][] = [["bg", "Latar"], ["surface", "Kartu"], ["text", "Teks"], ["muted", "Teks redup"], ["accent", "Aksen"], ["accent2", "Aksen 2"]];

export function DesignPanel({ s, up, baseCfg }: PanelProps) {
  const des = s.design;
  const cur = { ...baseCfg, ...Object.fromEntries(Object.entries(des).filter(([k, v]) => v && !["pal", "fontScale", "bgImage", "css"].includes(k))), pal: { ...baseCfg.pal, ...(des.pal ?? {}) } } as typeof baseCfg;
  const set = (p: Record<string, unknown>, key?: string) => up((x) => ({ ...x, design: { ...x.design, ...p } }), key);
  const toast = useToast();
  const bgRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-3">
      <Group title="Warna" open>
        <div className="grid grid-cols-2 gap-3">
          {PAL.map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 rounded-lg border border-stone-200 p-2"><input type="color" aria-label={l} className="h-9 w-9 flex-none cursor-pointer rounded border-0 bg-transparent p-0" value={cur.pal[k]} onChange={(e) => set({ pal: { ...des.pal, [k]: e.target.value } }, `pal${k}`)} /><span className="text-xs">{l}<br /><span className="text-stone-400">{cur.pal[k]}</span></span></label>))}
        </div>
      </Group>
      <Group title="Tipografi" open>
        {([["head", "Font judul"], ["script", "Font nama / aksen"], ["body", "Font isi"]] as const).map(([k, l]) => (
          <label key={k} className="block"><span className="label">{l}</span><select className="input" value={cur[k]} onChange={(e) => set({ [k]: e.target.value })}>
            {Array.from(new Set([baseCfg[k], ...FONT_CHOICES])).map((f) => <option key={f} value={f}>{f}</option>)}</select></label>))}
        <label className="block"><span className="label">Ukuran tulisan: {Math.round((des.fontScale ?? 1) * 100)}%</span><input type="range" min={0.85} max={1.3} step={0.05} className="w-full" value={des.fontScale ?? 1} onChange={(e) => set({ fontScale: Number(e.target.value) }, "fs")} /></label>
      </Group>
      <Group title="Layout & efek" open>
        {(Object.keys(SEL) as (keyof typeof SEL)[]).map((k) => (
          <label key={k} className="block"><span className="label">{LAB[k]}</span><select className="input capitalize" value={cur[k]} onChange={(e) => set({ [k]: e.target.value })}>{SEL[k].map((o) => <option key={o} value={o}>{o}</option>)}</select></label>))}
        <label className="block"><span className="label">Sudut membulat: {cur.rad}px</span><input type="range" min={0} max={32} className="w-full" value={cur.rad} onChange={(e) => set({ rad: Number(e.target.value) }, "rad")} /></label>
      </Group>
      <Group title="Background kustom">
        <div className="flex gap-2"><button type="button" className="btn btn-ghost btn-sm" onClick={() => bgRef.current?.click()}>Unggah gambar latar</button>{des.bgImage && <button type="button" className="btn btn-soft btn-sm" onClick={() => set({ bgImage: "" })}>Hapus</button>}</div>
        <input ref={bgRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { set({ bgImage: await processImage(f, null, 900, 0.6) }); } catch (er) { toast((er as Error).message, "err"); } }} />
      </Group>
      <button type="button" className="btn btn-ghost w-full" onClick={() => up((x) => ({ ...x, design: {} }))}><RotateCcw size={14} /> Reset desain ke bawaan template</button>
    </div>
  );
}

const RESET_KEYS: Record<string, (keyof InvitationData)[]> = {
  cover: ["heading", "coverPhoto"], intro: ["opening", "host1", "host2"], countdown: ["date"], events: ["events"], story: ["story"], gallery: ["gallery"], video: ["videoUrl", "videoPoster"],
  location: ["locationName", "address", "mapUrl", "mapEmbed", "directions"], gift: ["gifts", "giftAddress"], live: ["streamUrl", "streamPlatform", "streamSchedule"], closing: ["closing", "family"], footer: ["footerText"], rsvp: ["rsvpDeadline"],
};

export function SectionsPanel({ s, up, ent, defaults }: PanelProps) {
  const [drag, setDrag] = useState<number | null>(null);
  const move = (from: number, to: number) => up((x) => { const a = [...x.sections]; const [m] = a.splice(from, 1); a.splice(to, 0, m); return { ...x, sections: a }; });
  const toggle = (i: number) => up((x) => ({ ...x, sections: x.sections.map((m, j) => (j === i ? { ...m, enabled: !m.enabled } : m)) }));
  const reset = (key: string) => up((x) => { const patch: Record<string, unknown> = {}; for (const k of RESET_KEYS[key] ?? []) patch[k] = defaults[k]; return { ...x, data: { ...x.data, ...patch } }; });
  const label = (m: SectionItem) => (m.custom ? `✦ ${m.custom.title || "Custom"}` : SECTION_LABELS[m.key] ?? m.key);
  return (
    <div className="space-y-3">
      <p className="text-xs text-stone-500">Seret ikon ⠿ atau gunakan tombol panah untuk mengatur urutan. Ikon mata untuk menampilkan / menyembunyikan section.</p>
      <ul className="space-y-1.5">
        {s.sections.map((m, i) => (
          <li key={m.key} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag !== null && drag !== i) move(drag, i); setDrag(null); }}
            className={`flex items-center gap-1 rounded-xl border bg-white p-1.5 ${m.enabled ? "border-stone-200" : "border-dashed border-stone-300 opacity-60"}`}>
            <GripVertical size={16} className="flex-none cursor-grab text-stone-400" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{label(m)}</span>
            <button type="button" aria-label="Naik" disabled={i === 0} onClick={() => move(i, i - 1)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-stone-100 disabled:opacity-30"><ArrowUp size={15} /></button>
            <button type="button" aria-label="Turun" disabled={i === s.sections.length - 1} onClick={() => move(i, i + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-stone-100 disabled:opacity-30"><ArrowDown size={15} /></button>
            <button type="button" aria-label={m.enabled ? "Sembunyikan" : "Tampilkan"} onClick={() => toggle(i)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-stone-100">{m.enabled ? <Eye size={15} /> : <EyeOff size={15} />}</button>
            {m.custom ? (<>
              <button type="button" aria-label="Duplikasi" onClick={() => up((x) => { const a = [...x.sections]; a.splice(i + 1, 0, { ...m, key: `custom:${randomCode(6)}` }); return { ...x, sections: a }; })} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-stone-100"><Copy size={15} /></button>
              <button type="button" aria-label="Hapus" onClick={() => up((x) => ({ ...x, sections: x.sections.filter((_, j) => j !== i) }))} className="flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"><Trash2 size={15} /></button></>)
              : RESET_KEYS[m.key] && <button type="button" aria-label="Reset isi section" title="Reset isi section" onClick={() => reset(m.key)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-stone-100"><RotateCcw size={15} /></button>}
          </li>))}
      </ul>
      {s.sections.filter((m) => m.custom).map((m) => {
        const i = s.sections.indexOf(m);
        return (
          <div key={m.key} className="space-y-2 rounded-xl border border-stone-200 bg-white p-3">
            <TextField label="Judul custom section" value={m.custom!.title} onChange={(v) => up((x) => ({ ...x, sections: x.sections.map((q, j) => (j === i ? { ...q, custom: { ...q.custom!, title: v } } : q)) }), `cs${i}t`)} max={60} />
            <TextField label="Isi" value={m.custom!.body} multiline onChange={(v) => up((x) => ({ ...x, sections: x.sections.map((q, j) => (j === i ? { ...q, custom: { ...q.custom!, body: v } } : q)) }), `cs${i}b`)} />
          </div>);
      })}
      <button type="button" disabled={!ent.customSection} className="btn btn-ghost btn-sm" onClick={() => up((x) => { const a = [...x.sections]; a.splice(a.length - 1, 0, { key: `custom:${randomCode(6)}`, enabled: true, custom: { title: "Informasi Tambahan", body: "Tulis informasi khusus di sini." } }); return { ...x, sections: a }; })}><Plus size={14} /> Tambah custom section {!ent.customSection && "🔒 Exclusive"}</button>
    </div>
  );
}
