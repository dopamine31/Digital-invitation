"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Upload, Check } from "lucide-react";
import { THEMES, defaultThemeConfig, mergeThemeConfig, themeToJson } from "@/lib/themes";
import { toViewData } from "@/lib/view";
import { InvitationView } from "@/components/invitation/InvitationView";
import { Button, Badge } from "@/components/ui";
import { Tabs, toast } from "@/components/client-ui";
import { updateThemeAction, updateSettingsAction } from "@/server/actions/events";
import { createSignedUploadAction, registerMediaAssetAction } from "@/server/actions/guests";
import type { EventWorkspace } from "@/server/queries";
import type { EventSettings, ThemeConfig } from "@/lib/types";

const GOOGLE_FONTS = [
  { label: "Cormorant Garamond", value: "'Cormorant Garamond', Georgia, serif" },
  { label: "Playfair Display", value: "'Playfair Display', Georgia, serif" },
  { label: "Bodoni Moda", value: "'Bodoni Moda', Georgia, serif" },
  { label: "Italiana", value: "'Italiana', Georgia, serif" },
  { label: "Amiri", value: "'Amiri', Georgia, serif" },
  { label: "Cinzel", value: "'Cinzel', Georgia, serif" },
  { label: "Caveat", value: "'Caveat', cursive" },
  { label: "Manrope", value: "'Manrope', system-ui, sans-serif" },
  { label: "Inter", value: "'Inter', system-ui, sans-serif" },
  { label: "Montserrat", value: "'Montserrat', system-ui, sans-serif" },
  { label: "Space Grotesk", value: "'Space Grotesk', system-ui, sans-serif" },
];

const MUSIC_LIBRARY = [
  { label: "Tanpa musik", value: "" },
  { label: "Klasik instrumental (demo)", value: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3" },
];

const TABS = [
  { id: "colors", label: "Warna" }, { id: "fonts", label: "Tipografi" }, { id: "background", label: "Latar" },
  { id: "music", label: "Musik" }, { id: "motion", label: "Animasi" }, { id: "pic", label: "PIC Sampul" },
  { id: "advanced", label: "Kode & Meta" },
];

export function ThemeCustomizer({ workspace }: { workspace: EventWorkspace }) {
  const router = useRouter();
  const [tab, setTab] = useState("colors");
  const [themeId, setThemeId] = useState(workspace.themeId);
  const [config, setConfig] = useState<ThemeConfig>(workspace.theme);
  const [settings, setSettings] = useState<EventSettings>(workspace.settings);
  const [busy, setBusy] = useState(false);
  const [fontFile, setFontFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const patchConfig = (patch: Partial<ThemeConfig>) => setConfig((current) => ({ ...current, ...patch }));
  const patchSettings = (patch: Partial<EventSettings>) => setSettings((current) => ({ ...current, ...patch }));
  const patchPic = (patch: Partial<EventSettings["pic"]>) => setSettings((current) => ({ ...current, pic: { ...current.pic, ...patch } }));

  const preview = useMemo(() => toViewData({
    event: { id: workspace.id, slug: workspace.slug, title: workspace.title, startsAt: workspace.startsAt, endsAt: null, timezone: workspace.timezone, themeId },
    guest: { id: "preview", name: "Bapak Budi Santoso", token: "preview", qrPayload: "", paxAllocated: 2 },
    settings, sections: workspace.sections, theme: mergeThemeConfig(themeId, themeToJson(config)),
    schedules: workspace.schedules, wishes: [], guestBook: [], rsvpForm: workspace.rsvpForm,
    rsvp: null, locale: "id", preview: true,
  }), [config, settings, themeId, workspace]);

  const save = async () => {
    setBusy(true);
    const themeResult = await updateThemeAction(workspace.id, themeId, config);
    const settingsResult = await updateSettingsAction(workspace.id, settings);
    setBusy(false);
    if (!themeResult.ok || !settingsResult.ok) {
      toast(settingsResult.ok ? "Gagal menyimpan tema" : settingsResult.error, "err");
      return;
    }
    toast("Tema & pengaturan PIC tersimpan");
    router.refresh();
  };

  const uploadFont = async () => {
    if (!fontFile) return;
    const signed = await createSignedUploadAction({ eventId: workspace.id, fileName: fontFile.name, mime: fontFile.type || "font/woff2", size: fontFile.size });
    if (!signed.ok) { toast(signed.error, "err"); return; }
    const uploaded = await fetch(signed.data.uploadUrl, { method: "PUT", body: fontFile, headers: { "Content-Type": fontFile.type || "font/woff2" } });
    if (!uploaded.ok) { toast("Gagal mengunggah font", "err"); return; }
    await registerMediaAssetAction({ eventId: workspace.id, key: signed.data.key, originalName: fontFile.name, mime: fontFile.type || "font/woff2", size: fontFile.size });
    patchConfig({ fonts: { ...config.fonts, displayUrl: signed.data.publicUrl, display: `'FontSendiri', serif` }, customCss: `${config.customCss}\n@font-face { font-family: 'FontSendiri'; src: url('${signed.data.publicUrl}'); font-display: swap; }` });
    toast("Font sendiri terpasang");
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Kustomisasi tema</h1><p className="page-subtitle">Warna, font, latar, musik, animasi, dan PIC — tanpa menyentuh kode.</p></div>
        <Button variant="primary" onClick={save} disabled={busy}>{busy ? <span className="spinner" /> : <Save size={15} />} Simpan semua</Button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) 360px", alignItems: "start" }}>
        <div className="stack">
          <div className="card">
            <div className="row-between" style={{ marginBottom: 12 }}><strong className="small">Pilih struktur tema</strong><Badge tone="primary">{THEMES.find((t) => t.id === themeId)?.name}</Badge></div>
            <div className="grid grid-4">
              {THEMES.map((theme) => (
                <button key={theme.id} className="card card-hover" style={{ padding: 8, borderColor: themeId === theme.id ? "var(--ui-primary)" : undefined, cursor: "pointer" }} onClick={() => { setThemeId(theme.id); setConfig(defaultThemeConfig(theme.id)); }}>
                  <div className="theme-swatch" style={{ height: 72, background: theme.background.type === "gradient" ? theme.background.value : theme.colors.background, fontFamily: theme.fonts.display }}>
                    <span style={{ color: theme.dark ? theme.colors.accent : theme.colors.primary, fontSize: 18 }}>Aa</span>
                  </div>
                  <div className="tiny" style={{ marginTop: 7, fontWeight: 650 }}>{theme.name}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <Tabs tabs={TABS} active={tab} onChange={setTab} />
            <div style={{ marginTop: 20 }}>
              {tab === "colors" ? (
                <div className="grid grid-2">
                  {(["primary", "secondary", "accent", "background", "surface", "text", "muted", "border"] as const).map((key) => (
                    <div className="color-row" key={key}>
                      <input type="color" value={config.colors[key]} onChange={(e) => patchConfig({ colors: { ...config.colors, [key]: e.target.value } })} aria-label={`Warna ${key}`} />
                      <div className="field" style={{ flex: 1 }}><span className="tiny muted">{key}</span><input className="input mono" value={config.colors[key]} onChange={(e) => patchConfig({ colors: { ...config.colors, [key]: e.target.value } })} /></div>
                    </div>
                  ))}
                  <div className="field"><label className="label">Radius (px)</label><input className="input" type="number" min={0} max={60} value={config.radius} onChange={(e) => patchConfig({ radius: Number(e.target.value) })} /></div>
                  <div className="field"><label className="label">Spasi antar section</label><input className="input" type="number" step={.05} min={.5} max={3} value={config.spacing} onChange={(e) => patchConfig({ spacing: Number(e.target.value) })} /></div>
                  <div className="field"><label className="label">Ketebalan border (px)</label><input className="input" type="number" min={0} max={8} value={config.borderWidth} onChange={(e) => patchConfig({ borderWidth: Number(e.target.value) })} /></div>
                </div>
              ) : null}

              {tab === "fonts" ? (
                <div className="stack">
                  <div className="grid grid-2">
                    <div className="field"><label className="label">Font display / judul</label><select className="select" value={config.fonts.display} onChange={(e) => patchConfig({ fonts: { ...config.fonts, display: e.target.value } })}>{GOOGLE_FONTS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}</select></div>
                    <div className="field"><label className="label">Font body / isi</label><select className="select" value={config.fonts.body} onChange={(e) => patchConfig({ fonts: { ...config.fonts, body: e.target.value } })}>{GOOGLE_FONTS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}</select></div>
                  </div>
                  <div className="notice"><div style={{ fontFamily: config.fonts.display, fontSize: 30 }}>Andi &amp; Siti</div><div style={{ fontFamily: config.fonts.body, fontSize: 13, marginTop: 6 }}>Pratinjau tipografi undangan Anda.</div></div>
                  <div className="divider" />
                  <strong className="small">Unggah font sendiri (.woff2/.ttf)</strong>
                  <div className="row"><input ref={fileRef} className="input" type="file" accept=".woff2,.ttf,.otf" onChange={(e) => setFontFile(e.target.files?.[0] ?? null)} /><Button size="sm" onClick={uploadFont} disabled={!fontFile}><Upload size={14} /> Unggah</Button></div>
                  {config.fonts.displayUrl ? <div className="tiny muted mono">{config.fonts.displayUrl}</div> : null}
                </div>
              ) : null}

              {tab === "background" ? (
                <div className="stack">
                  <div className="field"><label className="label">Jenis latar</label><select className="select" value={config.background.type} onChange={(e) => patchConfig({ background: { ...config.background, type: e.target.value as ThemeConfig["background"]["type"] } })}><option value="solid">Warna solid</option><option value="gradient">Gradient</option><option value="pattern">Pattern (botanical / batik / kraft)</option><option value="image">Unggah gambar</option></select></div>
                  <div className="field"><label className="label">Nilai latar (warna / CSS gradient / nama pattern / URL gambar)</label><input className="input mono" value={config.background.value} onChange={(e) => patchConfig({ background: { ...config.background, value: e.target.value } })} /></div>
                  <div className="field"><label className="label">Opasitas overlay / pattern: {config.background.overlayOpacity}</label><input type="range" min={0} max={.6} step={.02} value={config.background.overlayOpacity} onChange={(e) => patchConfig({ background: { ...config.background, overlayOpacity: Number(e.target.value) } })} /></div>
                  <div className="notice tiny">Pattern tersedia: <code>botanical</code>, <code>batik</code>, <code>kraft</code>. Untuk gambar, unggah lewat menu Editor → Inspector atau gunakan signed URL.</div>
                </div>
              ) : null}

              {tab === "music" ? (
                <div className="stack">
                  <label className="row small" style={{ gap: 8 }}><input type="checkbox" className="checkbox" checked={config.music.enabled} onChange={(e) => patchConfig({ music: { ...config.music, enabled: e.target.checked } })} /> Aktifkan musik latar (tidak autoplay paksa)</label>
                  <div className="field"><label className="label">Pustaka musik</label><select className="select" value={config.music.url} onChange={(e) => patchConfig({ music: { ...config.music, url: e.target.value } })}>{MUSIC_LIBRARY.map((item) => <option key={item.label} value={item.value}>{item.label}</option>)}</select></div>
                  <div className="field"><label className="label">URL audio sendiri</label><input className="input mono" value={config.music.url} onChange={(e) => patchConfig({ music: { ...config.music, url: e.target.value } })} /></div>
                  <div className="grid grid-2">
                    <div className="field"><label className="label">Volume ({config.music.volume})</label><input type="range" min={0} max={1} step={.05} value={config.music.volume} onChange={(e) => patchConfig({ music: { ...config.music, volume: Number(e.target.value) } })} /></div>
                    <div className="field"><label className="label">Fade in (detik)</label><input className="input" type="number" min={0} max={10} value={config.music.fadeIn} onChange={(e) => patchConfig({ music: { ...config.music, fadeIn: Number(e.target.value) } })} /></div>
                    <div className="field"><label className="label">Fade out (detik)</label><input className="input" type="number" min={0} max={10} value={config.music.fadeOut} onChange={(e) => patchConfig({ music: { ...config.music, fadeOut: Number(e.target.value) } })} /></div>
                    <div className="field"><label className="label">Trim mulai (detik)</label><input className="input" type="number" min={0} value={config.music.trimStart} onChange={(e) => patchConfig({ music: { ...config.music, trimStart: Number(e.target.value) } })} /></div>
                  </div>
                </div>
              ) : null}

              {tab === "motion" ? (
                <div className="stack">
                  {([["enabled", "Aktifkan semua animasi"], ["reveal", "Scroll reveal section"], ["parallax", "Parallax ringan pada cover"], ["coverOpening", "Animasi 'tap to open'"]] as const).map(([key, label]) => (
                    <label key={key} className="row small" style={{ gap: 8 }}><input type="checkbox" className="checkbox" checked={config.animation[key]} onChange={(e) => patchConfig({ animation: { ...config.animation, [key]: e.target.checked } })} /> {label}</label>
                  ))}
                  <div className="notice tiny">Preferensi <code>prefers-reduced-motion</code> selalu dihormati: semua animasi otomatis dimatikan bagi pengguna yang memintanya.</div>
                </div>
              ) : null}

              {tab === "pic" ? (
                <div className="stack">
                  <div className="notice"><strong>Person in Charge</strong> tampil di cover/sampul dan section kontak. Nomor dapat dijadikan tujuan notifikasi RSVP.</div>
                  <div className="grid grid-2">
                    <div className="field"><label className="label" htmlFor="pic-name">Nama PIC</label><input id="pic-name" className="input" value={settings.pic.name} onChange={(e) => patchPic({ name: e.target.value })} /></div>
                    <div className="field"><label className="label">No. HP / WhatsApp</label><input className="input" value={settings.pic.phone} onChange={(e) => patchPic({ phone: e.target.value })} /></div>
                    <div className="field"><label className="label">Label</label><input className="input" value={settings.pic.label} onChange={(e) => patchPic({ label: e.target.value })} /></div>
                    <div className="field"><label className="label">Jabatan / peran</label><input className="input" value={settings.pic.role} onChange={(e) => patchPic({ role: e.target.value })} /></div>
                    <div className="field"><label className="label">Posisi di cover</label><select className="select" value={settings.pic.coverPosition} onChange={(e) => patchPic({ coverPosition: e.target.value as EventSettings["pic"]["coverPosition"] })}><option value="top">Atas</option><option value="bottom">Bawah</option><option value="side">Samping</option></select></div>
                    <div className="field"><label className="label">Format nomor</label><select className="select" value={settings.pic.format} onChange={(e) => patchPic({ format: e.target.value as EventSettings["pic"]["format"] })}><option value="whatsapp">WhatsApp (wa.me)</option><option value="national">Nasional (08xx)</option><option value="international">Internasional (+62)</option></select></div>
                  </div>
                  <label className="row small" style={{ gap: 8 }}><input type="checkbox" className="checkbox" checked={settings.pic.showOnCover} onChange={(e) => patchPic({ showOnCover: e.target.checked })} /> Tampilkan nama & nomor PIC di cover</label>
                  <label className="row small" style={{ gap: 8 }}><input type="checkbox" className="checkbox" checked={settings.pic.showInContact} onChange={(e) => patchPic({ showInContact: e.target.checked })} /> Tampilkan di section kontak</label>
                  <label className="row small" style={{ gap: 8 }}><input type="checkbox" className="checkbox" checked={settings.pic.useForRsvpConfirmation} onChange={(e) => patchPic({ useForRsvpConfirmation: e.target.checked })} /> Jadikan nomor PIC tujuan konfirmasi RSVP / notifikasi</label>
                  <div className="field"><label className="label">{"Pesan prefilled tombol \"Hubungi PIC\""}</label><textarea className="textarea" value={settings.pic.prefillMessage} onChange={(e) => patchPic({ prefillMessage: e.target.value })} /><div className="field-hint">Variabel: {'{acara}'}</div></div>
                </div>
              ) : null}

              {tab === "advanced" ? (
                <div className="stack">
                  <div className="field"><label className="label">Custom CSS (disanitasi)</label><textarea className="textarea mono" value={config.customCss} onChange={(e) => patchConfig({ customCss: e.target.value })} placeholder=".inv-title { letter-spacing: .08em; }" /></div>
                  <div className="field"><label className="label">Custom HTML snippet (disanitasi)</label><textarea className="textarea mono" value={config.customHtml} onChange={(e) => patchConfig({ customHtml: e.target.value })} /></div>
                  <div className="field"><label className="label">Custom &lt;head&gt; meta / pixel (hanya tag meta)</label><textarea className="textarea mono" value={config.customHead} onChange={(e) => patchConfig({ customHead: e.target.value })} placeholder={'<meta name="description" content="..." />'} /></div>
                  <div className="field"><label className="label">Meta title</label><input className="input" value={settings.metaTitle} onChange={(e) => patchSettings({ metaTitle: e.target.value })} /></div>
                  <div className="field"><label className="label">Meta description</label><textarea className="textarea" value={settings.metaDescription} onChange={(e) => patchSettings({ metaDescription: e.target.value })} /></div>
                  <label className="row small" style={{ gap: 8 }}><input type="checkbox" className="checkbox" checked={settings.noindex} onChange={(e) => patchSettings({ noindex: e.target.checked })} /> noindex (privasi default)</label>
                  <label className="row small" style={{ gap: 8 }}><input type="checkbox" className="checkbox" checked={settings.footer.showBranding} onChange={(e) => patchSettings({ footer: { ...settings.footer, showBranding: e.target.checked } })} /> Tampilkan branding platform di footer</label>
                  <div className="notice tiny">`@import`, `url()`, `expression()`, `position:fixed`, dan tag script dibuang otomatis oleh sanitizer. Fitur ini mengikuti flag paket <code>customCss</code>.</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="card" style={{ position: "sticky", top: 90 }}>
          <div className="row-between" style={{ marginBottom: 12 }}><strong className="small">Pratinjau langsung</strong><Badge tone="success"><Check size={11} /> Live</Badge></div>
          <div style={{ height: 520, overflowY: "auto", borderRadius: 12, border: "1px solid var(--ui-border)" }}>
            <InvitationView data={preview} preview />
          </div>
          <div className="tiny muted" style={{ marginTop: 10 }}>Perubahan tampil seketika; klik &quot;Simpan semua&quot; untuk menyimpannya ke database.</div>
        </div>
      </div>
    </div>
  );
}
