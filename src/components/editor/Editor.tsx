"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Eye, Laptop, Maximize2, Redo2, Smartphone, Undo2, X, Loader2, Share2, Copy, QrCode, Rocket, EyeOff, Lock } from "lucide-react";
import type { InvitationData, TemplateConfig } from "@/types";
import { sectionAllowed, type Ent } from "@/lib/entitlements";
import { waLink } from "@/lib/format";
import { InvitationView } from "@/components/invitation/InvitationView";
import { QrImage, downloadQR } from "@/components/QrImage";
import { useToast } from "@/components/ActionForm";
import { setInvitationStatusAction } from "@/server/actions/customer";
import { TextField } from "./fields";
import { ContentPanel, DesignPanel, MediaPanel, SectionsPanel } from "./panels";
import type { EState, PanelProps } from "./types";

type Inv = { id: number; slug: string; title: string; status: string; packageCode: string; password: string; publishAt: string; expireAt: string; data: InvitationData; design: EState["design"]; sections: EState["sections"] };
type Props = { inv: Inv; baseCfg: TemplateConfig; templateName: string; templateOk: boolean; templateTier: string; ent: Ent; baseUrl: string; brandName: string; defaults: InvitationData };
type Tab = "content" | "media" | "design" | "sections" | "publish";
type Hist = { past: EState[]; present: EState; future: EState[] };

export function Editor({ inv, baseCfg, templateName, templateOk, templateTier, ent, baseUrl, brandName, defaults }: Props) {
  const router = useRouter();
  const toast = useToast();
  const initial: EState = { title: inv.title, slug: inv.slug, password: inv.password, publishAt: inv.publishAt, expireAt: inv.expireAt, data: inv.data, design: inv.design, sections: inv.sections };
  const [h, setH] = useState<Hist>({ past: [], present: initial, future: [] });
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [tab, setTab] = useState<Tab>("content");
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [full, setFull] = useState(false);
  const [status, setStatus] = useState(inv.status);
  const [save, setSave] = useState<{ state: "saved" | "saving" | "dirty" | "error"; at?: string; msg?: string }>({ state: "saved" });
  const last = useRef<{ key?: string; t: number }>({ t: 0 });
  const first = useRef(true);
  const s = h.present;

  const up = useCallback((fn: (x: EState) => EState, key?: string) => {
    setH((cur) => {
      const next = fn(cur.present);
      const now = Date.now();
      const coalesce = key && last.current.key === key && now - last.current.t < 900;
      last.current = { key, t: now };
      return { past: coalesce ? cur.past : [...cur.past.slice(-49), cur.present], present: next, future: [] };
    });
  }, []);
  const undo = () => setH((c) => (c.past.length ? { past: c.past.slice(0, -1), present: c.past[c.past.length - 1], future: [c.present, ...c.future] } : c));
  const redo = () => setH((c) => (c.future.length ? { past: [...c.past, c.present], present: c.future[0], future: c.future.slice(1) } : c));

  const persist = useCallback(async (state: EState) => {
    setSave({ state: "saving" });
    try {
      const r = await fetch(`/api/invitations/${inv.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...state, publishAt: state.publishAt || null, expireAt: state.expireAt || null }) });
      const j = await r.json();
      if (!r.ok || !j.ok) { setSave({ state: "error", msg: j.message }); return false; }
      setSave({ state: "saved", at: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) });
      return true;
    } catch { setSave({ state: "error", msg: "Koneksi bermasalah" }); return false; }
  }, [inv.id]);

  // Autosave (debounce 1.5 dtk)
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSave((x) => ({ ...x, state: "dirty" }));
    const t = setTimeout(() => persist(s), 1500);
    return () => clearTimeout(t);
  }, [s, persist]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (save.state === "dirty" || save.state === "saving") e.preventDefault(); };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [save.state]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);

  const panelProps: PanelProps = { s, up, ent, baseCfg, defaults, maxPhotos: ent.maxPhotos };
  const advanced = mode === "advanced";
  const tabs: { k: Tab; l: string; adv?: boolean }[] = [{ k: "content", l: "Konten" }, { k: "media", l: "Media" }, { k: "design", l: "Desain", adv: true }, { k: "sections", l: "Section", adv: true }, { k: "publish", l: "Terbit" }];
  const visibleTabs = tabs.filter((t) => !t.adv || advanced);
  const curTab = visibleTabs.some((t) => t.k === tab) ? tab : "content";

  const sections = useMemo(() => s.sections.filter((x) => sectionAllowed(x.key, ent)), [s.sections, ent]);
  const preview = (
    <InvitationView invitationId={inv.id} slug={s.slug} title={s.title} data={s.data} baseConfig={baseCfg} design={s.design} sections={sections} embedded
      baseUrl={baseUrl} removeBranding={ent.removeBranding} qr={ent.qr} checkin={ent.checkin} music={ent.music} maxPhotos={ent.maxPhotos} brandName={brandName} guest={{ name: "Nama Tamu" }} />
  );

  async function setPublish(to: "published" | "draft" | "archived") {
    const okSaved = await persist(s);
    if (!okSaved) return toast("Simpan gagal. Perbaiki dulu sebelum mengubah status.", "err");
    const fd = new FormData(); fd.set("id", String(inv.id)); fd.set("status", to);
    const r = await setInvitationStatusAction(fd);
    toast(r.message, r.ok ? "ok" : "err");
    if (r.ok) { setStatus(to); router.refresh(); }
  }

  const link = `${baseUrl}/i/${s.slug}`;
  const ModeToggle = (
    <div className="flex rounded-lg bg-stone-100 p-0.5 text-xs font-medium" role="group" aria-label="Mode editor">
      <button type="button" className={`rounded-md px-2.5 py-1.5 ${!advanced ? "bg-white shadow" : "text-stone-500"}`} onClick={() => setMode("simple")}>Simple</button>
      <button type="button" className={`rounded-md px-2.5 py-1.5 ${advanced ? "bg-white shadow" : "text-stone-500"}`} onClick={() => (ent.advancedEditor ? setMode("advanced") : toast("Advanced Editor tersedia pada paket Basic ke atas.", "err"))}>Advanced {!ent.advancedEditor && <Lock size={10} className="inline" />}</button>
    </div>
  );
  const SaveBadge = (
    <span className="flex items-center gap-1 text-[11px] text-stone-500" aria-live="polite">
      {save.state === "saving" && <><Loader2 size={12} className="animate-spin" /> Menyimpan…</>}
      {save.state === "saved" && <><Check size={12} className="text-emerald-600" /> {save.at ? `Tersimpan ${save.at}` : "Tersimpan"}</>}
      {save.state === "dirty" && "Perubahan belum disimpan…"}
      {save.state === "error" && <span className="text-red-600">Gagal: {save.msg}</span>}
    </span>
  );

  return (
    <div className="flex h-[100dvh] flex-col bg-stone-100">
      <header className="flex h-14 flex-none items-center gap-2 border-b border-stone-200 bg-white px-3">
        <Link href="/app/invitations" aria-label="Kembali" className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-stone-100"><ArrowLeft size={18} /></Link>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{s.title || "Undangan"}</p><div className="flex items-center gap-2">{SaveBadge}<span className="hidden text-[11px] text-stone-400 sm:inline">· {templateName}</span></div></div>
        <button type="button" aria-label="Undo" title="Undo" disabled={!h.past.length} onClick={undo} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-stone-100 disabled:opacity-30"><Undo2 size={17} /></button>
        <button type="button" aria-label="Redo" title="Redo" disabled={!h.future.length} onClick={redo} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-stone-100 disabled:opacity-30"><Redo2 size={17} /></button>
        <div className="hidden sm:block">{ModeToggle}</div>
        <button type="button" className="btn btn-ghost btn-sm hidden sm:inline-flex" onClick={async () => { const r = await persist(s); toast(r ? "Draft disimpan." : "Gagal menyimpan.", r ? "ok" : "err"); }}>Simpan draft</button>
        <button type="button" className="btn btn-brand btn-sm" onClick={() => setPublish(status === "published" ? "draft" : "published")}><Rocket size={14} />{status === "published" ? "Unpublish" : "Publish"}</button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Panel pengaturan */}
        <section className={`min-h-0 w-full flex-none flex-col border-r border-stone-200 bg-stone-50 lg:flex lg:w-[420px] ${mobileView === "edit" ? "flex" : "hidden"}`}>
          <div className="flex-none border-b border-stone-200 bg-white p-2 sm:hidden">{ModeToggle}</div>
          <nav className="hidden flex-none gap-1 overflow-x-auto border-b border-stone-200 bg-white p-2 lg:flex" aria-label="Tab editor">
            {visibleTabs.map((t) => <button key={t.k} type="button" onClick={() => setTab(t.k)} className={`rounded-lg px-3 py-2 text-sm font-medium ${curTab === t.k ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}>{t.l}</button>)}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-24 lg:pb-6">
            {!templateOk && <p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Template <b>{templateName}</b> membutuhkan paket <b>{templateTier}</b>. Anda tetap bisa mengedit; untuk menerbitkan, <Link className="underline" href={`/app/checkout?invitation=${inv.id}`}>upgrade paket</Link>.</p>}
            {curTab === "content" && <ContentPanel {...panelProps} />}
            {curTab === "media" && <MediaPanel {...panelProps} />}
            {curTab === "design" && <DesignPanel {...panelProps} />}
            {curTab === "sections" && <SectionsPanel {...panelProps} />}
            {curTab === "publish" && (
              <div className="space-y-3">
                <div className="card space-y-3 p-4">
                  <TextField label="Nama undangan (internal)" value={s.title} onChange={(v) => up((x) => ({ ...x, title: v }), "title")} max={100} />
                  <label className="block"><span className="label">Alamat link</span><div className="flex items-center overflow-hidden rounded-xl border border-stone-300 bg-white"><span className="hidden px-2 text-xs text-stone-400 sm:block">/i/</span><input className="min-h-[44px] w-full px-2 text-base outline-none sm:text-sm" value={s.slug} onChange={(e) => up((x) => ({ ...x, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 60) }), "slug")} /></div></label>
                  <p className="break-all text-xs text-stone-500">{link}</p>
                </div>
                <div className="card space-y-3 p-4">
                  <p className="text-sm font-semibold">Akses & jadwal</p>
                  <fieldset disabled={!ent.passwordProtect} className="disabled:opacity-50"><TextField label={`Password undangan privat ${ent.passwordProtect ? "" : "🔒 Exclusive"}`} value={s.password} onChange={(v) => up((x) => ({ ...x, password: v }), "pw")} max={60} placeholder="Kosongkan untuk publik" /></fieldset>
                  <fieldset disabled={!ent.schedule} className="grid grid-cols-1 gap-3 disabled:opacity-50 sm:grid-cols-2">
                    <TextField label={`Jadwal terbit ${ent.schedule ? "" : "🔒"}`} type="datetime-local" value={s.publishAt} onChange={(v) => up((x) => ({ ...x, publishAt: v }))} />
                    <TextField label={`Kedaluwarsa ${ent.schedule ? "" : "🔒"}`} type="datetime-local" value={s.expireAt} onChange={(v) => up((x) => ({ ...x, expireAt: v }))} />
                  </fieldset>
                </div>
                <div className="card space-y-3 p-4">
                  <p className="text-sm font-semibold">Bagikan</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(link); toast("Link disalin."); }}><Copy size={14} /> Salin link</button>
                    <a className="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href={waLink("", `Assalamu'alaikum, kami mengundang Anda ke acara kami:\n${link}`).replace("wa.me/?", "wa.me/?")}><Share2 size={14} /> WhatsApp</a>
                    <Link className="btn btn-ghost btn-sm" target="_blank" href={`/i/${s.slug}`}><Eye size={14} /> Buka halaman</Link>
                    {ent.qr ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadQR(link, `qr-${s.slug}`)}><QrCode size={14} /> QR HD</button> : <span className="text-xs text-stone-400">QR Code: paket Premium 🔒</span>}
                  </div>
                  {ent.qr && <QrImage value={link} size={120} />}
                  {status === "published" && <button type="button" className="btn btn-soft btn-sm" onClick={() => setPublish("archived")}><EyeOff size={14} /> Arsipkan undangan</button>}
                  <p className="text-[11px] text-stone-400">Status: <b>{status === "published" ? "Terbit" : status === "archived" ? "Diarsipkan" : "Draft"}</b></p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Preview */}
        <section className={`min-h-0 flex-1 flex-col items-center bg-stone-200/60 lg:flex ${mobileView === "preview" ? "flex" : "hidden"}`}>
          <div className="hidden w-full flex-none items-center justify-between gap-2 px-4 py-2 lg:flex">
            <span className="text-xs font-medium text-stone-500">Live preview</span>
            <div className="flex gap-1">
              <button type="button" aria-label="Preview mobile" onClick={() => setDevice("mobile")} className={`flex h-9 w-9 items-center justify-center rounded-lg ${device === "mobile" ? "bg-white shadow" : "text-stone-500"}`}><Smartphone size={16} /></button>
              <button type="button" aria-label="Preview desktop" onClick={() => setDevice("desktop")} className={`flex h-9 w-9 items-center justify-center rounded-lg ${device === "desktop" ? "bg-white shadow" : "text-stone-500"}`}><Laptop size={16} /></button>
              <button type="button" aria-label="Layar penuh" onClick={() => setFull(true)} className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 hover:bg-white"><Maximize2 size={16} /></button>
            </div>
          </div>
          <div className={`min-h-0 flex-1 overflow-hidden pb-16 lg:pb-4 ${device === "mobile" ? "w-full lg:w-[390px] lg:flex-none lg:rounded-[2rem] lg:border-[8px] lg:border-stone-900 lg:bg-stone-900 lg:shadow-2xl" : "w-full px-4"}`} data-testid="preview-frame">
            <div className="h-full overflow-y-auto overflow-x-hidden bg-white lg:rounded-[1.5rem]" style={{ contain: "paint" }}>{device === "desktop" ? <div className="mx-auto max-w-[480px]">{preview}</div> : preview}</div>
          </div>
        </section>
      </div>

      {/* Navigasi bawah (mobile) */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white lg:hidden" aria-label="Navigasi editor">
        {mobileView === "edit" ? (
          <div className="flex items-center">
            <div className="flex flex-1 overflow-x-auto">{visibleTabs.map((t) => <button key={t.k} type="button" onClick={() => setTab(t.k)} className={`min-h-[52px] flex-1 whitespace-nowrap px-3 text-xs font-semibold ${curTab === t.k ? "text-stone-900 shadow-[inset_0_2px_0_#1c1917]" : "text-stone-400"}`}>{t.l}</button>)}</div>
            <button type="button" className="btn btn-brand btn-sm m-2 flex-none" onClick={() => setMobileView("preview")}><Eye size={14} /> Preview</button>
          </div>
        ) : (
          <div className="flex items-center justify-between p-2"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setMobileView("edit")}><ArrowLeft size={14} /> Kembali edit</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setFull(true)}><Maximize2 size={14} /> Layar penuh</button></div>
        )}
      </nav>

      {full && (
        <div className="fixed inset-0 z-[100] bg-black/80" role="dialog" aria-modal aria-label="Preview layar penuh">
          <button type="button" aria-label="Tutup preview" onClick={() => setFull(false)} className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-lg"><X /></button>
          <div className="mx-auto h-full max-w-[480px] overflow-y-auto overflow-x-hidden bg-white">{preview}</div>
        </div>
      )}
    </div>
  );
}
