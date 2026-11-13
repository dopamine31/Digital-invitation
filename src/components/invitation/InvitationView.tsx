"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Music2, VolumeX } from "lucide-react";
import { getTheme, themeCssVariables } from "@/lib/themes";
import { t } from "@/lib/i18n";
import { sanitizeCss, sanitizeHeadMeta } from "@/lib/sanitize";
import { Cover } from "@/components/invitation/Cover";
import { InvitationSections } from "@/components/invitation/Sections";
import { RsvpWizard } from "@/components/invitation/RsvpWizard";
import type { InvitationViewData } from "@/lib/view";
import type { Locale } from "@/lib/types";

export function InvitationView({ data, preview = false }: { data: InvitationViewData; preview?: boolean }) {
  const theme = getTheme(data.event.themeId);
  const [open, setOpen] = useState(preview || !data.theme.animation.coverOpening);
  const [locale, setLocale] = useState<Locale>(data.locale);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const variables = useMemo(() => themeCssVariables(data.theme), [data.theme]);
  const pattern = data.theme.background.type === "pattern" ? data.theme.background.value : undefined;

  useEffect(() => {
    if (!data.theme.animation.parallax || preview) return;
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [data.theme.animation.parallax, preview]);

  useEffect(() => {
    if (!preview && data.theme.customHead) {
      // Meta kustom sudah disanitasi; disuntik sebagai elemen inert, bukan script.
      const container = document.createElement("div");
      container.hidden = true;
      container.setAttribute("data-head-meta", "sanitized");
      container.innerHTML = sanitizeHeadMeta(data.theme.customHead);
      document.head.appendChild(container);
      return () => { container.remove(); };
    }
    return undefined;
  }, [preview, data.theme.customHead]);

  const toggleMusic = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); return; }
    try {
      audio.volume = data.theme.music.volume;
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const rsvpNode = <RsvpWizard data={{ ...data, locale }} locale={locale} />;
  const style = variables as React.CSSProperties;

  return (
    <div className="inv-shell" data-pattern={pattern} data-theme={theme.dark ? "dark" : "light"} style={style}>
      {data.theme.customCss ? <style dangerouslySetInnerHTML={{ __html: sanitizeCss(data.theme.customCss) }} /> : null}
      {!open ? (
        <>
          <Cover data={{ ...data, locale }} locale={locale} onOpen={() => setOpen(true)} onLocaleChange={setLocale} />
        </>
      ) : (
        <>
          <section className="inv-cover" data-layout={theme.layout} style={{ minHeight: "62svh", transform: data.theme.animation.parallax && !preview ? `translateY(${Math.min(80, scrollY * .18)}px)` : undefined }}>
            <Cover data={{ ...data, locale }} locale={locale} onOpen={() => undefined} onLocaleChange={setLocale} compact />
          </section>
          <InvitationSections data={{ ...data, locale }} locale={locale} onRsvp={() => {
            const node = document.querySelector('[data-section-key="rsvp"]');
            node?.scrollIntoView({ behavior: "smooth" });
          }} rsvpNode={rsvpNode} />
        </>
      )}

      {data.theme.music.enabled && data.theme.music.url ? (
        <>
          <audio ref={audioRef} src={data.theme.music.url} loop preload="none" onEnded={() => setPlaying(false)} data-trim-start={data.theme.music.trimStart} data-trim-end={data.theme.music.trimEnd} />
          <button className="inv-music" onClick={toggleMusic} aria-label={playing ? t(locale, "cover.musicOff") : t(locale, "cover.musicOn")} title={playing ? t(locale, "cover.musicOff") : t(locale, "cover.musicOn")}>
            {playing ? <Music2 size={19} /> : <VolumeX size={19} />}
          </button>
        </>
      ) : null}

      {!preview ? (
        <div className="inv-lang" aria-label={t(locale, "common.language")}>
          {(["id", "en"] as Locale[]).map((item) => <button key={item} data-active={locale === item} onClick={() => setLocale(item)}>{item.toUpperCase()}</button>)}
        </div>
      ) : null}
    </div>
  );
}
