"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarPlus, Copy, MapPin, Navigation, Play, Radio, ChevronLeft, ChevronRight, X, ArrowUp, Check } from "lucide-react";
import type { InvitationData, SectionItem, TemplateConfig } from "@/types";
import { buildICS, dateLongID, googleCalendarUrl, youtubeEmbed, isSafeUrl } from "@/lib/format";
import { Divider, Orn } from "./Ornaments";
import { Photo, Reveal } from "./Cover";
import { QrImage } from "@/components/QrImage";

export type Wish = { id: number; name: string; message: string; createdAt: string };
export type Ctx = {
  invitationId: number; slug: string; title: string; data: InvitationData; cfg: TemplateConfig;
  guest?: { name: string; code?: string }; embedded: boolean; baseUrl: string;
  removeBranding: boolean; qr: boolean; checkin: boolean; maxPhotos: number; wishes: Wish[]; moderate: boolean; rsvpEnabled: boolean; brandName: string;
};

const Wrap = ({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) => (
  <section id={id} className={`relative px-6 py-14 text-center ${className}`}><div className="mx-auto max-w-md">{children}</div></section>
);
const Title = ({ eyebrow, title }: { eyebrow?: string; title: string }) => (
  <Reveal>
    {eyebrow && <p className="mut text-[11px] uppercase tracking-[.3em]">{eyebrow}</p>}
    <h2 className="sc acc mt-1 text-4xl">{title}</h2>
  </Reveal>
);

/* ---------------- Intro ---------------- */
function Intro({ ctx }: { ctx: Ctx }) {
  const { data: d, cfg } = ctx;
  const hosts = [d.host1, d.host2].filter((h) => h.name);
  return (
    <Wrap id="intro">
      <Orn kind={cfg.orn} className="absolute right-0 top-0 w-20 opacity-50" />
      <Reveal><p className="mx-auto max-w-sm text-sm leading-relaxed mut">{d.opening}</p></Reveal>
      <Divider kind={cfg.orn} />
      <div className="space-y-8">
        {hosts.map((h, i) => (
          <Reveal key={i} delay={i * 120}>
            {h.photo && <Photo src={h.photo} className="mx-auto mb-4 h-36 w-36 rounded-full" style={{ boxShadow: "0 0 0 4px var(--bg), 0 0 0 5px var(--accent)" }} alt={h.name} />}
            <h3 className="sc text-4xl">{h.fullName || h.name}</h3>
            {h.parents && <p className="mut mt-2 text-sm">{h.parents}</p>}
            {h.bio && <p className="mt-2 text-sm">{h.bio}</p>}
            {i === 0 && hosts.length > 1 && <p className="sc acc mt-6 text-5xl">&amp;</p>}
          </Reveal>
        ))}
      </div>
    </Wrap>
  );
}

/* ---------------- Countdown ---------------- */
function Countdown({ ctx }: { ctx: Ctx }) {
  const target = useMemo(() => new Date(ctx.data.date.length === 10 ? ctx.data.date + "T08:00:00+07:00" : ctx.data.date + ":00+07:00").getTime(), [ctx.data.date]);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const diff = now === null ? 0 : target - now;
  const over = now !== null && diff <= 0;
  const p = Math.max(0, diff);
  const units = [["Hari", Math.floor(p / 86400000)], ["Jam", Math.floor((p / 3600000) % 24)], ["Menit", Math.floor((p / 60000) % 60)], ["Detik", Math.floor((p / 1000) % 60)]] as const;
  return (
    <Wrap id="countdown" className="">
      <Title eyebrow="Menuju Hari Bahagia" title="Hitung Mundur" />
      <Reveal className="mt-6" delay={100}>
        {over ? (
          <div className="card px-4 py-6"><p className="hd text-xl">Acara sedang / telah berlangsung 🎉</p><p className="mut mt-1 text-sm">Terima kasih atas doa dan kehadiran Anda.</p></div>
        ) : (
          <div className="grid grid-cols-4 gap-2" data-testid="countdown">
            {units.map(([l, v]) => (
              <div key={l} className="card py-4">
                <div className="hd text-2xl font-semibold tabular-nums sm:text-3xl">{now === null ? "--" : String(v).padStart(2, "0")}</div>
                <div className="mut text-[10px] uppercase tracking-widest">{l}</div>
              </div>
            ))}
          </div>
        )}
      </Reveal>
    </Wrap>
  );
}

/* ---------------- Events ---------------- */
function Events({ ctx }: { ctx: Ctx }) {
  const { data: d, cfg } = ctx;
  const items = d.events;
  const Map = ({ url }: { url: string }) => url && isSafeUrl(url) ? <a href={url} target="_blank" rel="noopener noreferrer" className="ib sm mt-3"><MapPin size={14} /> Lihat Lokasi</a> : null;
  const kind = cfg.ev;
  return (
    <Wrap id="events">
      <Title eyebrow="Save The Date" title="Detail Acara" />
      <div className={`mt-8 ${kind === "timeline" ? "relative space-y-8 pl-6 text-left" : "space-y-4"}`}>
        {kind === "timeline" && <div className="absolute bottom-2 left-1.5 top-2 w-px" style={{ background: "var(--accent)" }} />}
        {items.map((e, i) => (
          <Reveal key={i} delay={i * 120}>
            {kind === "timeline" ? (
              <div className="relative">
                <span className="absolute -left-[22px] top-1.5 h-3 w-3 rounded-full" style={{ background: "var(--accent)", boxShadow: "0 0 0 4px var(--bg)" }} />
                <h3 className="sc acc text-3xl">{e.name}</h3>
                <p className="text-sm font-semibold">{dateLongID(e.date)}</p>
                <p className="mut text-sm">{e.time}{e.endTime ? ` – ${e.endTime}` : ""} WIB</p>
                <p className="mt-1 text-sm">{e.place}</p><p className="mut text-xs">{e.address}</p>
                {e.note && <p className="mut mt-1 text-xs italic">{e.note}</p>}<Map url={e.mapUrl} />
              </div>
            ) : kind === "split" ? (
              <div className="card grid grid-cols-[84px_1fr] overflow-hidden text-left">
                <div className="flex flex-col items-center justify-center px-2 py-4" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
                  <span className="hd text-3xl font-semibold">{e.date.slice(8, 10)}</span>
                  <span className="text-[10px] uppercase tracking-widest">{new Intl.DateTimeFormat("id-ID", { month: "short" }).format(new Date(e.date + "T00:00:00"))}</span>
                </div>
                <div className="p-4"><h3 className="hd text-lg font-semibold">{e.name}</h3>
                  <p className="mut text-sm">{e.time}{e.endTime ? ` – ${e.endTime}` : ""} WIB</p><p className="text-sm">{e.place}</p><p className="mut text-xs">{e.address}</p><Map url={e.mapUrl} /></div>
              </div>
            ) : kind === "ticket" ? (
              <div className="card relative px-5 py-6" style={{ borderStyle: "dashed" }}>
                <span className="absolute -left-2 top-1/2 h-4 w-4 rounded-full" style={{ background: "var(--bg)", border: "1px solid color-mix(in srgb,var(--accent) 40%,transparent)" }} />
                <span className="absolute -right-2 top-1/2 h-4 w-4 rounded-full" style={{ background: "var(--bg)", border: "1px solid color-mix(in srgb,var(--accent) 40%,transparent)" }} />
                <p className="mut text-[10px] uppercase tracking-[.3em]">Tiket Undangan</p>
                <h3 className="hd acc mt-1 text-2xl">{e.name}</h3>
                <p className="mt-2 text-sm font-semibold">{dateLongID(e.date)}</p><p className="mut text-sm">{e.time}{e.endTime ? ` – ${e.endTime}` : ""} WIB</p>
                <p className="mt-2 text-sm">{e.place}</p><p className="mut text-xs">{e.address}</p><Map url={e.mapUrl} />
              </div>
            ) : (
              <div className="card px-5 py-7">
                <h3 className="sc acc text-4xl">{e.name}</h3><Divider kind={cfg.orn} />
                <p className="font-semibold">{dateLongID(e.date)}</p><p className="mut text-sm">{e.time}{e.endTime ? ` – ${e.endTime}` : ""} WIB</p>
                <p className="mt-3 text-sm">{e.place}</p><p className="mut text-xs">{e.address}</p>
                {e.note && <p className="mut mt-2 text-xs italic">{e.note}</p>}<Map url={e.mapUrl} />
              </div>
            )}
          </Reveal>
        ))}
        {items.length === 0 && <p className="mut text-sm">Detail acara belum diisi.</p>}
      </div>
    </Wrap>
  );
}

/* ---------------- Calendar ---------------- */
function CalendarSec({ ctx }: { ctx: Ctx }) {
  const { data: d } = ctx;
  const ev = d.events[0];
  const start = ev ? `${ev.date}T${ev.time || "08:00"}` : d.date;
  const end = ev?.endTime ? `${ev.date}T${ev.endTime}:00` : undefined;
  const info = { title: `${d.heading}: ${d.host1.name}${d.host2.name ? " & " + d.host2.name : ""}`, start, end, location: `${ev?.place ?? d.locationName}, ${ev?.address ?? d.address}`, description: d.opening };
  const dl = () => {
    const blob = new Blob([buildICS(info)], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "undangan.ics"; a.click(); URL.revokeObjectURL(a.href);
  };
  const dt = new Date(d.date.slice(0, 10) + "T00:00:00");
  return (
    <Wrap id="calendar">
      <Title eyebrow="Simpan Tanggal" title="Kalender" />
      <Reveal className="mt-6">
        <div className="card mx-auto max-w-[260px] overflow-hidden">
          <div className="py-2 text-xs font-semibold uppercase tracking-[.3em]" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>{new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(dt)}</div>
          <div className="hd py-4 text-6xl font-semibold">{dt.getDate()}</div>
          <div className="mut pb-4 text-sm uppercase tracking-widest">{new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(dt)}</div>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <a href={googleCalendarUrl(info)} target="_blank" rel="noopener noreferrer" className="ib sm"><CalendarPlus size={15} /> Google Calendar</a>
          <button type="button" onClick={dl} className="ib sm"><CalendarPlus size={15} /> File .ics</button>
        </div>
      </Reveal>
    </Wrap>
  );
}

/* ---------------- Story ---------------- */
function Story({ ctx }: { ctx: Ctx }) {
  if (!ctx.data.story.length) return null;
  return (
    <Wrap id="story">
      <Title eyebrow="Perjalanan Kami" title="Cerita Kami" />
      <div className="relative mt-8 space-y-8 text-left">
        <div className="absolute bottom-0 left-[7px] top-0 w-px" style={{ background: "color-mix(in srgb,var(--accent) 50%,transparent)" }} />
        {ctx.data.story.map((s, i) => (
          <Reveal key={i} delay={i * 100} className="relative pl-8">
            <span className="absolute left-0 top-1 h-[15px] w-[15px] rounded-full" style={{ background: "var(--accent)", boxShadow: "0 0 0 4px var(--bg)" }} />
            <p className="acc text-xs font-semibold uppercase tracking-widest">{s.date}</p>
            <h3 className="hd text-xl">{s.title}</h3><p className="mut mt-1 text-sm">{s.text}</p>
            {s.photo && <Photo src={s.photo} className="mt-3 h-40 w-full" style={{ borderRadius: "var(--rad)" }} />}
          </Reveal>
        ))}
      </div>
    </Wrap>
  );
}

/* ---------------- Gallery ---------------- */
function Gallery({ ctx }: { ctx: Ctx }) {
  const photos = ctx.data.gallery.slice(0, ctx.maxPhotos);
  const [idx, setIdx] = useState<number | null>(null);
  const [auto, setAuto] = useState(0);
  const kind = ctx.cfg.gal;
  useEffect(() => {
    if (idx === null) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setIdx(null); if (e.key === "ArrowRight") setIdx((i) => (i! + 1) % photos.length); if (e.key === "ArrowLeft") setIdx((i) => (i! - 1 + photos.length) % photos.length); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [idx, photos.length]);
  useEffect(() => {
    if (kind !== "slider" || photos.length < 2) return;
    const t = setInterval(() => setAuto((a) => a + 1), 3500); return () => clearInterval(t);
  }, [kind, photos.length]);
  if (!photos.length) return null;
  const img = (i: number, cls = "", st?: React.CSSProperties) => (
    <button key={i} type="button" onClick={() => setIdx(i)} aria-label={`Foto ${i + 1}`} className={`block overflow-hidden ${cls}`} style={{ borderRadius: "var(--rad)", ...st }}>
      <Photo src={photos[i]} className="h-full w-full transition-transform duration-500 hover:scale-105" alt={`Galeri ${i + 1}`} />
    </button>
  );
  let body: ReactNode;
  if (kind === "masonry") body = <div className="columns-2 gap-2">{photos.map((_, i) => <div key={i} className="mb-2 break-inside-avoid">{img(i, "w-full", { aspectRatio: i % 3 === 0 ? "3/4" : i % 3 === 1 ? "1/1" : "4/5" })}</div>)}</div>;
  else if (kind === "polaroid") body = <div className="grid grid-cols-2 gap-4 px-1">{photos.map((_, i) => <div key={i} className="bg-white p-2 pb-6 shadow-lg" style={{ transform: `rotate(${i % 2 ? 3 : -3}deg)` }}>{img(i, "aspect-square w-full", { borderRadius: 0 })}</div>)}</div>;
  else if (kind === "film") body = <div className="hscroll rounded-md bg-black p-3">{photos.map((_, i) => <div key={i} className="!flex-[0_0_62%]">{img(i, "aspect-[3/4] w-full", { borderRadius: 2 })}</div>)}</div>;
  else if (kind === "slider") {
    const cur = auto % photos.length;
    body = <div className="relative overflow-hidden" style={{ borderRadius: "var(--rad)" }}><div className="flex transition-transform duration-700" style={{ transform: `translateX(-${cur * 100}%)` }}>{photos.map((_, i) => <div key={i} className="w-full flex-none">{img(i, "aspect-[4/5] w-full", { borderRadius: 0 })}</div>)}</div>
      <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">{photos.map((_, i) => <span key={i} className="h-1.5 rounded-full transition-all" style={{ width: i === cur ? 18 : 6, background: "#fff", opacity: i === cur ? 1 : 0.5 }} />)}</div></div>;
  } else if (kind === "mosaic") body = <div className="grid grid-cols-3 gap-1.5">{photos.map((_, i) => img(i, i % 5 === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"))}</div>;
  else body = <div className="grid grid-cols-2 gap-2">{photos.map((_, i) => img(i, "aspect-square w-full"))}</div>;
  return (
    <Wrap id="gallery">
      <Title eyebrow="Momen Berharga" title="Galeri" />
      <Reveal className="mt-8">{body}</Reveal>
      {idx !== null && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal onClick={() => setIdx(null)}>
          <button type="button" aria-label="Tutup" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white" onClick={() => setIdx(null)}><X /></button>
          {photos.length > 1 && <>
            <button type="button" aria-label="Sebelumnya" className="absolute left-2 rounded-full bg-white/10 p-2 text-white" onClick={(e) => { e.stopPropagation(); setIdx((idx - 1 + photos.length) % photos.length); }}><ChevronLeft /></button>
            <button type="button" aria-label="Berikutnya" className="absolute right-2 rounded-full bg-white/10 p-2 text-white" onClick={(e) => { e.stopPropagation(); setIdx((idx + 1) % photos.length); }}><ChevronRight /></button></>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[idx]} alt="" className="max-h-[85vh] max-w-full rounded object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </Wrap>
  );
}

/* ---------------- Video ---------------- */
function Video({ ctx }: { ctx: Ctx }) {
  const { videoUrl, videoPoster } = ctx.data;
  const [play, setPlay] = useState(false);
  if (!videoUrl || !isSafeUrl(videoUrl)) return null;
  const yt = youtubeEmbed(videoUrl);
  return (
    <Wrap id="video">
      <Title eyebrow="Cuplikan" title="Video" />
      <Reveal className="mt-6">
        <div className="relative aspect-video overflow-hidden" style={{ borderRadius: "var(--rad)", background: "#000" }}>
          {play ? (yt ? <iframe src={`${yt}?autoplay=1&rel=0`} title="Video acara" className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" /> : <video src={videoUrl} poster={videoPoster || undefined} controls autoPlay playsInline className="h-full w-full" />)
            : (<button type="button" onClick={() => setPlay(true)} className="group relative h-full w-full" aria-label="Putar video">
              <Photo src={videoPoster} className="h-full w-full" />
              <span className="absolute inset-0 flex items-center justify-center"><span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-black transition group-hover:scale-110"><Play fill="currentColor" /></span></span></button>)}
        </div>
      </Reveal>
    </Wrap>
  );
}

/* ---------------- Location ---------------- */
function Location({ ctx }: { ctx: Ctx }) {
  const d = ctx.data;
  const embedOk = /^https:\/\/(www\.)?google\.[a-z.]+\/maps|^https:\/\/maps\.google\./.test(d.mapEmbed || "");
  return (
    <Wrap id="location">
      <Title eyebrow="Lokasi Acara" title="Peta & Petunjuk" />
      <Reveal className="mt-6">
        <div className="card overflow-hidden">
          {embedOk && <iframe src={d.mapEmbed} title="Peta lokasi" loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-56 w-full border-0" />}
          <div className="p-5"><h3 className="hd text-lg font-semibold">{d.locationName}</h3><p className="mut text-sm">{d.address}</p>
            {d.directions && <p className="mt-3 text-sm italic">{d.directions}</p>}
            {d.mapUrl && isSafeUrl(d.mapUrl) && <a href={d.mapUrl} target="_blank" rel="noopener noreferrer" className="ib mt-4"><Navigation size={16} /> Buka Navigasi</a>}</div>
        </div>
      </Reveal>
    </Wrap>
  );
}

/* ---------------- Live ---------------- */
function Live({ ctx }: { ctx: Ctx }) {
  const d = ctx.data;
  if (!d.streamUrl || !isSafeUrl(d.streamUrl)) return null;
  return (
    <Wrap id="live">
      <Title eyebrow="Tidak Bisa Hadir?" title="Live Streaming" />
      <Reveal className="mt-6"><div className="card p-6">
        <Radio className="acc mx-auto mb-2" /><p className="text-sm">Saksikan acara secara langsung melalui <b>{d.streamPlatform || "streaming"}</b>.</p>
        {d.streamSchedule && <p className="mut mt-1 text-sm">Jadwal: {d.streamSchedule}</p>}
        <a href={d.streamUrl} target="_blank" rel="noopener noreferrer" className="ib mt-4"><Play size={16} /> Buka Live Streaming</a>
      </div></Reveal>
    </Wrap>
  );
}

/* ---------------- RSVP ---------------- */
function Rsvp({ ctx }: { ctx: Ctx }) {
  const { data: d, guest } = ctx;
  const [name, setName] = useState(guest?.name ?? "");
  const [attending, setAttending] = useState<"yes" | "no">("yes");
  const [count, setCount] = useState(1);
  const [message, setMessage] = useState("");
  const [hp, setHp] = useState("");
  const [state, setState] = useState<{ type: "idle" | "ok" | "err"; text: string }>({ type: "idle", text: "" });
  const [busy, setBusy] = useState(false);
  const closed = d.rsvpDeadline && new Date(d.rsvpDeadline + "T23:59:59+07:00").getTime() < Date.now();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (ctx.embedded) { setState({ type: "ok", text: "Mode pratinjau: RSVP tidak dikirim." }); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/public/${ctx.slug}/rsvp`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, attending: attending === "yes", count: attending === "yes" ? count : 0, message, guest: guest?.code, website: hp }) });
      const j = await r.json();
      setState({ type: r.ok ? "ok" : "err", text: j.message || (r.ok ? "Terima kasih, RSVP Anda tercatat." : "Gagal mengirim.") });
    } catch { setState({ type: "err", text: "Koneksi bermasalah. Coba lagi." }); }
    setBusy(false);
  }
  return (
    <Wrap id="rsvp">
      <Title eyebrow="Konfirmasi Kehadiran" title="RSVP" />
      {d.rsvpDeadline && <p className="mut mt-2 text-xs">Mohon konfirmasi sebelum {dateLongID(d.rsvpDeadline)}</p>}
      <Reveal className="mt-6">
        {!ctx.rsvpEnabled ? <div className="card p-5 text-sm">RSVP dinonaktifkan oleh pemilik undangan.</div>
          : closed ? <div className="card p-5 text-sm">Batas konfirmasi telah berakhir.</div>
            : state.type === "ok" ? <div className="card p-6"><Check className="acc mx-auto mb-2" /><p className="text-sm" role="status">{state.text}</p></div>
              : (
                <form onSubmit={submit} className="card space-y-3 p-5" data-testid="rsvp-form">
                  <div><label htmlFor="rn">Nama</label><input id="rn" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama Anda" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    {([["yes", "Hadir"], ["no", "Tidak Hadir"]] as const).map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setAttending(v)} aria-pressed={attending === v} className={`ib sm ${attending === v ? "" : "!bg-transparent !text-[color:var(--text)] opacity-70"}`}>{l}</button>))}
                  </div>
                  {attending === "yes" && <div><label htmlFor="rc">Jumlah Tamu</label><select id="rc" value={count} onChange={(e) => setCount(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n} orang</option>)}</select></div>}
                  <div><label htmlFor="rm">Pesan (opsional)</label><textarea id="rm" rows={3} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
                  <input type="text" name="website" value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="!absolute !left-[-9999px] !h-0 !w-0 !min-h-0 !p-0 !opacity-0" />
                  {state.type === "err" && <p className="text-sm text-red-500" role="alert">{state.text}</p>}
                  <button type="submit" disabled={busy} className="ib w-full">{busy ? "Mengirim…" : "Kirim RSVP"}</button>
                </form>)}
      </Reveal>
    </Wrap>
  );
}

/* ---------------- Wishes ---------------- */
function Wishes({ ctx }: { ctx: Ctx }) {
  const [list, setList] = useState(ctx.wishes);
  const [name, setName] = useState(ctx.guest?.name ?? "");
  const [msg, setMsg] = useState("");
  const [hp, setHp] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setList(ctx.wishes), [ctx.wishes]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (ctx.embedded) { setNote("Mode pratinjau: ucapan tidak dikirim."); return; }
    setBusy(true); setNote("");
    try {
      const r = await fetch(`/api/public/${ctx.slug}/wish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, message: msg, website: hp }) });
      const j = await r.json();
      setNote(j.message || "");
      if (r.ok) { setMsg(""); if (j.wish) setList((l) => [j.wish, ...l]); }
    } catch { setNote("Koneksi bermasalah."); }
    setBusy(false);
  }
  return (
    <Wrap id="wishes">
      <Title eyebrow="Doa & Harapan" title="Ucapan" />
      <Reveal className="mt-6">
        <form onSubmit={submit} className="card space-y-3 p-5 text-left" data-testid="wish-form">
          <div><label htmlFor="wn">Nama</label><input id="wn" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label htmlFor="wm">Ucapan</label><textarea id="wm" required rows={3} maxLength={300} value={msg} onChange={(e) => setMsg(e.target.value)} /></div>
          <input type="text" value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="!absolute !left-[-9999px] !h-0 !w-0 !min-h-0 !p-0 !opacity-0" />
          {note && <p className="mut text-sm" role="status">{note}</p>}
          <button type="submit" disabled={busy} className="ib w-full">{busy ? "Mengirim…" : "Kirim Ucapan"}</button>
        </form>
        <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1 text-left">
          {list.length === 0 && <p className="mut text-center text-sm">Jadilah yang pertama memberi ucapan.</p>}
          {list.map((w) => (<div key={w.id} className="card p-4"><p className="hd text-sm font-semibold">{w.name}</p><p className="mt-1 whitespace-pre-line text-sm">{w.message}</p></div>))}
        </div>
      </Reveal>
    </Wrap>
  );
}

/* ---------------- Gift ---------------- */
function Gift({ ctx }: { ctx: Ctx }) {
  const gifts = ctx.data.gifts.filter((g) => g.number || g.qr);
  const [copied, setCopied] = useState("");
  const copy = async (v: string) => {
    try { await navigator.clipboard.writeText(v); } catch { const t = document.createElement("textarea"); t.value = v; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
    setCopied(v); setTimeout(() => setCopied(""), 1800);
  };
  if (!gifts.length && !ctx.data.giftAddress) return null;
  return (
    <Wrap id="gift">
      <Title eyebrow="Tanda Kasih" title="Hadiah Digital" />
      <Reveal className="mt-4"><p className="mut text-sm">Doa restu Anda adalah hadiah terindah. Namun jika ingin memberi tanda kasih, dapat melalui:</p></Reveal>
      <div className="mt-5 space-y-3">
        {gifts.map((g, i) => (
          <Reveal key={i} delay={i * 100}><div className="card p-5">
            <p className="acc text-xs font-semibold uppercase tracking-[.25em]">{g.type === "bank" ? "Transfer Bank" : g.type === "ewallet" ? "E-Wallet" : "QRIS"} · {g.provider}</p>
            {g.type === "qris" && g.qr ? <Photo src={g.qr} className="mx-auto my-3 h-44 w-44 !opacity-100" style={{ borderRadius: 8 }} alt="QRIS" /> : null}
            {g.number && <p className="hd mt-2 text-2xl tracking-wider">{g.number}</p>}
            <p className="mut text-sm">a.n. {g.holder}</p>
            {g.number && <button type="button" onClick={() => copy(g.number)} className="ib sm mt-3">{copied === g.number ? <><Check size={14} /> Tersalin</> : <><Copy size={14} /> Salin Nomor</>}</button>}
          </div></Reveal>))}
        {ctx.data.giftAddress && <Reveal><div className="card p-5"><p className="acc text-xs font-semibold uppercase tracking-[.25em]">Kirim Kado</p><p className="mt-2 text-sm">{ctx.data.giftAddress}</p></div></Reveal>}
      </div>
    </Wrap>
  );
}

/* ---------------- Closing & Footer ---------------- */
function Closing({ ctx }: { ctx: Ctx }) {
  const { data: d, cfg, guest } = ctx;
  const personalUrl = guest?.code ? `${ctx.baseUrl}/i/${ctx.slug}?to=${encodeURIComponent(guest.name)}&g=${guest.code}` : "";
  return (
    <Wrap id="closing">
      <Orn kind={cfg.orn} className="absolute bottom-0 left-0 w-24 opacity-50" />
      <Reveal>
        <p className="text-sm leading-relaxed mut">{d.closing}</p><Divider kind={cfg.orn} />
        <p className="mut text-xs uppercase tracking-[.3em]">Kami yang berbahagia</p>
        <h2 className="sc mt-2 text-5xl">{d.host1.name}{d.host2.name && <><span className="acc mx-2">&amp;</span>{d.host2.name}</>}</h2>
        <p className="mut mt-3 text-sm">{d.family}</p>
      </Reveal>
      {personalUrl && ctx.checkin && (
        <Reveal className="mt-8"><div className="card mx-auto max-w-[240px] p-4"><p className="mut mb-2 text-[10px] uppercase tracking-[.25em]">QR Tiket {guest?.name}</p><QrImage value={personalUrl} size={150} className="mx-auto rounded" /><p className="mut mt-2 text-[11px]">Tunjukkan saat check-in</p></div></Reveal>)}
    </Wrap>
  );
}

function Footer({ ctx }: { ctx: Ctx }) {
  return (
    <footer id="footer" className="px-6 pb-24 pt-6 text-center">
      {ctx.qr && !ctx.embedded && <div className="mx-auto mb-4 w-fit rounded-lg bg-white p-2"><QrImage value={`${ctx.baseUrl}/i/${ctx.slug}`} size={90} /></div>}
      {ctx.data.footerText && <p className="mut text-xs">{ctx.data.footerText}</p>}
      {!ctx.removeBranding && <p className="mut mt-1 text-xs">Dibuat dengan ❤ oleh <b>{ctx.brandName}</b></p>}
      <button type="button" className="ib sm mt-4" onClick={() => document.getElementById("cover")?.scrollIntoView({ behavior: "smooth" })}><ArrowUp size={14} /> Kembali ke atas</button>
    </footer>
  );
}

function Custom({ item }: { item: SectionItem }) {
  if (!item.custom) return null;
  return <Wrap id={item.key.replace(":", "-")}><Title title={item.custom.title} /><Reveal className="mt-4"><p className="whitespace-pre-line text-sm leading-relaxed">{item.custom.body}</p></Reveal></Wrap>;
}

export function renderSection(item: SectionItem, ctx: Ctx): ReactNode {
  if (item.key.startsWith("custom:")) return <Custom key={item.key} item={item} />;
  switch (item.key) {
    case "intro": return <Intro key={item.key} ctx={ctx} />;
    case "countdown": return <Countdown key={item.key} ctx={ctx} />;
    case "events": return <Events key={item.key} ctx={ctx} />;
    case "calendar": return <CalendarSec key={item.key} ctx={ctx} />;
    case "story": return <Story key={item.key} ctx={ctx} />;
    case "gallery": return <Gallery key={item.key} ctx={ctx} />;
    case "video": return <Video key={item.key} ctx={ctx} />;
    case "location": return <Location key={item.key} ctx={ctx} />;
    case "live": return <Live key={item.key} ctx={ctx} />;
    case "rsvp": return <Rsvp key={item.key} ctx={ctx} />;
    case "wishes": return <Wishes key={item.key} ctx={ctx} />;
    case "gift": return <Gift key={item.key} ctx={ctx} />;
    case "closing": return <Closing key={item.key} ctx={ctx} />;
    case "footer": return <Footer key={item.key} ctx={ctx} />;
    default: return null;
  }
}
