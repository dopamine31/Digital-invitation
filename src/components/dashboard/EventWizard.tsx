"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ArrowLeft, ArrowRight, Sparkles, Heart, Cake, Users, Baby, Building2, Mic, Gift } from "lucide-react";
import { THEMES } from "@/lib/themes";
import { Button } from "@/components/ui";
import { toast } from "@/components/client-ui";
import { createEventAction } from "@/server/actions/events";

const TYPES = [
  { value: "WEDDING", label: "Pernikahan", icon: Heart },
  { value: "KHITANAN", label: "Khitanan", icon: Sparkles },
  { value: "AQIQAH", label: "Aqiqah", icon: Baby },
  { value: "BIRTHDAY", label: "Ulang Tahun", icon: Cake },
  { value: "CORPORATE", label: "Gathering Korporat", icon: Building2 },
  { value: "SEMINAR", label: "Seminar", icon: Mic },
  { value: "SYUKURAN", label: "Syukuran", icon: Gift },
  { value: "OTHER", label: "Lainnya", icon: Users },
] as const;

type EventType = (typeof TYPES)[number]["value"];

const INPUT_DATE = new Date(Date.now() + 60 * 24 * 3600_000).toISOString().slice(0, 16);

export function EventWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    type: "WEDDING" as EventType, themeId: "elegant-ivory",
    title: "Pernikahan Andi & Siti", startsAt: INPUT_DATE,
    timezone: "Asia/Jakarta", venueName: "Grand Ballroom Hotel Majapahit",
    address: "Jl. Tunjungan No. 65, Surabaya", picName: "Rani Wulandari",
    picPhone: "081234567890", showPicOnCover: true,
    brideName: "Siti", groomName: "Andi",
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm({ ...form, [key]: value });

  const finish = async () => {
    setBusy(true); setError("");
    const result = await createEventAction(form);
    setBusy(false);
    if (!result.ok) { setError(result.error); toast(result.error, "err"); return; }
    toast("Acara dibuat. Selamat mengkustomisasi!");
    router.push(`/app/events/${result.data.id}/editor`);
    router.refresh();
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) 300px", alignItems: "start" }}>
      <div className="card">
        <div className="row" style={{ gap: 6, marginBottom: 26 }}>
          {["Jenis acara", "Pilih tema", "Data acara", "Selesai"].map((label, index) => (
            <div key={label} style={{ flex: 1 }}>
              <div className="row" style={{ gap: 6 }}><span className="badge" style={{ background: index <= step ? "var(--ui-primary)" : "var(--ui-surface-2)", color: index <= step ? "#fff" : "var(--ui-muted)" }}>{index < step ? <Check size={12} /> : index + 1}</span><span className="tiny muted">{label}</span></div>
              <div className="progress" style={{ marginTop: 8 }}><span style={{ width: index <= step ? "100%" : "0%" }} /></div>
            </div>
          ))}
        </div>

        {step === 0 ? (
          <div className="stack">
            <div><h3>Acara apa yang sedang Anda rencanakan?</h3><p className="small muted">Jenis acara menentukan section bawaan yang disiapkan.</p></div>
            <div className="grid grid-4">
              {TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button key={type.value} className="card card-hover center" style={{ borderColor: form.type === type.value ? "var(--ui-primary)" : undefined, cursor: "pointer" }} onClick={() => set("type", type.value)}>
                    <Icon size={22} color="var(--ui-primary)" />
                    <div className="small" style={{ marginTop: 10, fontWeight: 600 }}>{type.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="stack">
            <div><h3>Pilih kanvas awal</h3><p className="small muted">Delapan tema dengan struktur berbeda. Semua bisa diubah lagi di theme customizer.</p></div>
            <div className="grid grid-4">
              {THEMES.map((theme) => (
                <button key={theme.id} className="card card-hover" style={{ padding: 10, borderColor: form.themeId === theme.id ? "var(--ui-primary)" : undefined, cursor: "pointer" }} onClick={() => set("themeId", theme.id)}>
                  <div className="theme-swatch" style={{ height: 110, background: theme.background.type === "gradient" ? theme.background.value : theme.colors.background, fontFamily: theme.fonts.display }}>
                    <span style={{ color: theme.dark ? theme.colors.accent : theme.colors.primary, fontSize: 17 }}>Aa</span>
                  </div>
                  <div className="small" style={{ fontWeight: 650, marginTop: 8 }}>{theme.name}</div>
                  <div className="tiny muted">{theme.category}</div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="stack">
            <div><h3>Data acara & PIC</h3><p className="small muted">PIC akan tampil di sampul dan section kontak, lengkap dengan tombol WhatsApp.</p></div>
            <div className="grid grid-2">
              <div className="field"><label className="label" htmlFor="w-title">Judul undangan</label><input id="w-title" className="input" value={form.title} onChange={(e) => set("title", e.target.value)} /></div>
              <div className="field"><label className="label" htmlFor="w-date">Tanggal & waktu mulai</label><input id="w-date" className="input" type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></div>
              <div className="field"><label className="label" htmlFor="w-venue">Nama lokasi</label><input id="w-venue" className="input" value={form.venueName} onChange={(e) => set("venueName", e.target.value)} /></div>
              <div className="field"><label className="label" htmlFor="w-address">Alamat</label><input id="w-address" className="input" value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
              <div className="field"><label className="label" htmlFor="w-tz">Zona waktu</label><select id="w-tz" className="select" value={form.timezone} onChange={(e) => set("timezone", e.target.value)}><option value="Asia/Jakarta">WIB · Asia/Jakarta</option><option value="Asia/Makassar">WITA · Asia/Makassar</option><option value="Asia/Jayapura">WIT · Asia/Jayapura</option><option value="Asia/Singapore">Singapore</option></select></div>
              <div className="field"><label className="label" htmlFor="w-bride">Nama mempelai / tokoh 1</label><input id="w-bride" className="input" value={form.brideName} onChange={(e) => set("brideName", e.target.value)} /></div>
              <div className="field"><label className="label" htmlFor="w-groom">Nama mempelai / tokoh 2</label><input id="w-groom" className="input" value={form.groomName} onChange={(e) => set("groomName", e.target.value)} /></div>
            </div>
            <div className="divider" />
            <h3 style={{ fontFamily: "var(--ui-font-body)", fontSize: 15 }}>Person in Charge (PIC)</h3>
            <div className="grid grid-2">
              <div className="field"><label className="label" htmlFor="w-pic">Nama PIC</label><input id="w-pic" className="input" value={form.picName} onChange={(e) => set("picName", e.target.value)} /></div>
              <div className="field"><label className="label" htmlFor="w-picphone">No. HP / WhatsApp PIC</label><input id="w-picphone" className="input" value={form.picPhone} onChange={(e) => set("picPhone", e.target.value)} /></div>
            </div>
            <label className="row small" style={{ gap: 9 }}><input type="checkbox" className="checkbox" checked={form.showPicOnCover} onChange={(e) => set("showPicOnCover", e.target.checked)} /> Tampilkan nama & nomor PIC di cover/sampul undangan</label>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="center stack" style={{ padding: "20px 0" }}>
            <div style={{ fontSize: 46 }}>✦</div>
            <h3>Siap untuk diterbitkan</h3>
            <p className="muted">Kami akan menyiapkan section bawaan, form RSVP, jadwal acara, dan versi pertama draf Anda.</p>
            <div className="notice" style={{ textAlign: "left" }}>
              <strong>{form.title}</strong><br />
              <span className="small muted">{THEMES.find((theme) => theme.id === form.themeId)?.name} · {TYPES.find((type) => type.value === form.type)?.label} · PIC {form.picName} ({form.picPhone})</span>
            </div>
          </div>
        ) : null}

        {error ? <div className="notice notice-error">{error}</div> : null}
        <div className="row-between" style={{ marginTop: 24 }}>
          <Button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}><ArrowLeft size={15} /> Kembali</Button>
          {step < 3 ? <Button variant="primary" onClick={() => setStep(step + 1)}>Lanjutkan <ArrowRight size={15} /></Button> : <Button variant="primary" onClick={finish} disabled={busy}>{busy ? <span className="spinner" /> : <Sparkles size={15} />} Buat acara</Button>}
        </div>
      </div>

      <div className="card" style={{ position: "sticky", top: 90 }}>
        <div className="tiny muted">PRATINJAU PILIHAN</div>
        <div className="theme-swatch" style={{ margin: "12px 0", background: THEMES.find((t) => t.id === form.themeId)?.background.type === "gradient" ? THEMES.find((t) => t.id === form.themeId)?.background.value : THEMES.find((t) => t.id === form.themeId)?.colors.background, fontFamily: THEMES.find((t) => t.id === form.themeId)?.fonts.display }}>
          <span style={{ color: THEMES.find((t) => t.id === form.themeId)?.colors.primary }}>{form.brideName} &amp; {form.groomName}</span>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <div className="row-between small"><span className="muted">Tema</span><strong>{THEMES.find((t) => t.id === form.themeId)?.name}</strong></div>
          <div className="row-between small"><span className="muted">Jenis</span><strong>{TYPES.find((t) => t.value === form.type)?.label}</strong></div>
          <div className="row-between small"><span className="muted">PIC di cover</span><strong>{form.showPicOnCover ? "Ya" : "Tidak"}</strong></div>
        </div>
      </div>
    </div>
  );
}
