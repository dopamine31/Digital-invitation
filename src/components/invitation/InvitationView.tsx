"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Music, Pause, Volume2 } from "lucide-react";
import type { Design, InvitationData, SectionItem, TemplateConfig } from "@/types";
import { INV_CSS, fontsHref, mergeConfig, themeVars } from "./theme";
import { Cover } from "./Cover";
import { renderSection, type Ctx, type Wish } from "./Sections";
import { isSafeUrl } from "@/lib/format";

export type InvitationViewProps = {
  invitationId: number; slug: string; title: string; data: InvitationData; baseConfig: TemplateConfig; design?: Design; sections: SectionItem[];
  guest?: { name: string; code?: string }; wishes?: Wish[]; embedded?: boolean; baseUrl?: string;
  removeBranding?: boolean; qr?: boolean; checkin?: boolean; music?: boolean; maxPhotos?: number; moderate?: boolean; rsvpEnabled?: boolean; brandName?: string;
};

export function InvitationView(p: InvitationViewProps) {
  const embedded = !!p.embedded;
  const cfg = mergeConfig(p.baseConfig, p.design);
  const [opened, setOpened] = useState(embedded);
  const [playing, setPlaying] = useState(false);
  const [vol, setVol] = useState(0.6);
  const [showVol, setShowVol] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const hasMusic = !!(p.music && p.data.musicUrl && isSafeUrl(p.data.musicUrl));

  useEffect(() => { if (audio.current) audio.current.volume = vol; }, [vol]);
  useEffect(() => { if (!embedded && !opened) document.documentElement.style.overflow = "hidden"; return () => { document.documentElement.style.overflow = ""; }; }, [embedded, opened]);
  useEffect(() => { setOpened(embedded); }, [embedded]);

  const open = useCallback(() => {
    setOpened(true);
    if (!embedded) {
      const key = `visit-${p.slug}-${p.guest?.code ?? ""}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        fetch(`/api/public/${p.slug}/visit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ g: p.guest?.code }) }).catch(() => undefined);
      }
    }
    if (hasMusic && audio.current) audio.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); // butuh interaksi pengguna: ini dipanggil dari klik tombol
    setTimeout(() => (root.current?.querySelector("#intro, section:nth-of-type(2)") as HTMLElement | null)?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [embedded, hasMusic, p.guest?.code, p.slug]);

  const toggle = () => {
    const a = audio.current; if (!a) return;
    if (a.paused) a.play().then(() => setPlaying(true)).catch(() => undefined); else { a.pause(); setPlaying(false); }
  };

  const ctx: Ctx = {
    invitationId: p.invitationId, slug: p.slug, title: p.title, data: p.data, cfg, guest: p.guest, embedded, baseUrl: p.baseUrl ?? "",
    removeBranding: !!p.removeBranding, qr: !!p.qr, checkin: !!p.checkin, maxPhotos: p.maxPhotos ?? 60, wishes: p.wishes ?? [], moderate: !!p.moderate,
    rsvpEnabled: p.rsvpEnabled !== false, brandName: p.brandName ?? "Digital Invitation Studio",
  };
  const items = p.sections.filter((s) => s.enabled);
  const coverOn = items.some((s) => s.key === "cover");
  const bgImage = p.design?.bgImage;

  return (
    <div ref={root} className="inv" data-anim={cfg.anim} data-btn={cfg.btn} style={{ ...themeVars(cfg, p.design?.fontScale ?? 1), ...(bgImage ? { backgroundImage: `linear-gradient(color-mix(in srgb,var(--bg) 88%,transparent),color-mix(in srgb,var(--bg) 88%,transparent)),url(${bgImage})`, backgroundSize: "cover", backgroundAttachment: embedded ? "scroll" : "fixed" } : {}) }}>
      <link rel="stylesheet" href={fontsHref(cfg)} precedence="default" />
      <style dangerouslySetInnerHTML={{ __html: INV_CSS }} />
      {coverOn && <Cover data={p.data} cfg={cfg} guest={p.guest} embedded={embedded} opened={opened} onOpen={open} />}
      {(opened || !coverOn) && items.filter((s) => s.key !== "cover").map((s) => renderSection(s, ctx))}
      {hasMusic && (
        <>
          <audio ref={audio} src={p.data.musicUrl} loop preload="none" />
          {opened && (
            <div className="pointer-events-none sticky bottom-4 z-40 flex h-0 justify-end pr-4">
              <div className="pointer-events-auto -translate-y-12 flex items-center gap-2">
                {showVol && <input type="range" min={0} max={1} step={0.05} value={vol} onChange={(e) => setVol(Number(e.target.value))} aria-label="Volume musik" className="!w-24 !min-h-0 !border-0 !bg-transparent !p-0" />}
                <button type="button" aria-label="Atur volume" onClick={() => setShowVol((v) => !v)} className="flex h-9 w-9 items-center justify-center rounded-full shadow-lg" style={{ background: "var(--surface)", color: "var(--accent)", border: "1px solid var(--accent)" }}><Volume2 size={16} /></button>
                <button type="button" aria-label={playing ? "Jeda musik" : "Putar musik"} onClick={toggle} className="flex h-11 w-11 items-center justify-center rounded-full shadow-lg" style={{ background: "var(--accent)", color: "var(--on-accent)", animation: playing ? "i-float 2.4s ease-in-out infinite" : undefined }}>
                  {playing ? <Pause size={18} /> : <Music size={18} />}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
