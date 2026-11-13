"use client";
import { useEffect, useRef, type ReactNode } from "react";
import type { InvitationData, TemplateConfig } from "@/types";
import { dateLongID } from "@/lib/format";
import { Orn } from "./Ornaments";

export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { el.classList.add("in"); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add("in"); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`rv ${className}`} style={{ animationDelay: `${delay}ms` }}>{children}</div>;
}

export function Photo({ src, className = "", style, alt = "" }: { src?: string; className?: string; style?: React.CSSProperties; alt?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt={alt} loading="lazy" decoding="async" className={`object-cover ${className}`} style={style} />;
  return <div aria-hidden className={className} style={{ background: "linear-gradient(135deg,var(--accent2),var(--accent))", opacity: 0.4, ...style }} />;
}

type Props = { data: InvitationData; cfg: TemplateConfig; guest?: { name: string }; embedded: boolean; opened: boolean; onOpen: () => void };

export function Cover({ data: d, cfg, guest, embedded, opened, onOpen }: Props) {
  const h = embedded ? "min-h-[660px]" : "min-h-[100svh]";
  const two = !!d.host2.name;
  const date = dateLongID(d.date);
  const bg = d.coverPhoto;
  const kind = cfg.cover;

  const guestBlock = (
    <div className="mt-6">
      <p className="mut text-xs uppercase tracking-[.2em]">Kepada Yth.</p>
      <p className="hd mt-1 text-lg font-semibold">{guest?.name || "Tamu Undangan"}</p>
      <p className="mut text-xs">Mohon maaf apabila ada kesalahan penulisan nama / gelar</p>
    </div>
  );
  const btn = (
    <button type="button" onClick={onOpen} className="ib mt-6" data-testid="open-invitation">
      {opened ? "Lihat Undangan ↓" : "✉ Buka Undangan"}
    </button>
  );
  const heading = <p className="text-[11px] uppercase tracking-[.35em] mut">{d.heading}</p>;
  const Names = ({ cls = "" }: { cls?: string }) => (
    <h1 className={`sc leading-[1.05] ${cls}`} style={{ color: "var(--text)" }}>
      {d.host1.name}{two && <><span className="acc mx-2">&amp;</span>{d.host2.name}</>}
    </h1>
  );
  const dateEl = <p className="mt-3 text-sm tracking-[.12em] uppercase mut">{date}</p>;

  if (kind === "split") {
    return (
      <section id="cover" className={`relative flex ${h} flex-col`}>
        <Photo src={bg} className="h-[52%] min-h-[320px] w-full flex-none" alt="Cover" />
        <div className="card relative -mt-10 flex-1 rounded-b-none px-6 pb-12 pt-10 text-center" style={{ borderRadius: "var(--rad) var(--rad) 0 0" }}>
          <Orn kind={cfg.orn} className="absolute right-0 top-0 w-16 opacity-60" />
          {heading}<Names cls="mt-3 text-5xl" />{dateEl}{guestBlock}{btn}
        </div>
      </section>
    );
  }
  if (kind === "frame") {
    return (
      <section id="cover" className={`relative flex ${h} items-center justify-center p-5`}>
        <div className="relative flex w-full max-w-sm flex-col items-center px-6 py-14 text-center" style={{ border: "1px solid var(--accent)", outline: "1px solid var(--accent)", outlineOffset: 6, borderRadius: "var(--rad)" }}>
          <Orn kind={cfg.orn} className="absolute -left-1 -top-1 w-24" />
          <Orn kind={cfg.orn} flip className="absolute -bottom-1 -right-1 w-24" />
          {heading}
          <Photo src={bg} className="my-5 h-40 w-32" style={{ borderRadius: "999px 999px 8px 8px" }} alt="Cover" />
          <Names cls="text-5xl" />{dateEl}{guestBlock}{btn}
        </div>
      </section>
    );
  }
  if (kind === "arch") {
    return (
      <section id="cover" className={`relative flex ${h} flex-col items-center justify-center px-6 py-14 text-center`}>
        <Orn kind={cfg.orn} className="absolute left-0 top-0 w-28" /><Orn kind={cfg.orn} flip className="absolute bottom-0 right-0 w-28" />
        {heading}
        <div className="mt-5 p-2" style={{ border: "1px solid var(--accent)", borderRadius: "999px 999px 0 0" }}>
          <Photo src={bg} className="h-64 w-48" style={{ borderRadius: "999px 999px 0 0" }} alt="Cover" />
        </div>
        <Names cls="mt-5 text-5xl" />{dateEl}{guestBlock}{btn}
      </section>
    );
  }
  if (kind === "stack") {
    return (
      <section id="cover" className={`relative flex ${h} flex-col items-center justify-center px-6 py-14 text-center`}>
        <Orn kind={cfg.orn} className="absolute right-0 top-0 w-28" />
        <Photo src={bg} className="h-44 w-44 rounded-full" style={{ boxShadow: "0 0 0 6px var(--bg), 0 0 0 7px var(--accent)" }} alt="Cover" />
        <div className="mt-6">{heading}
          <h1 className="sc mt-2 text-6xl leading-[0.95]">{d.host1.name}{two && <><br /><span className="acc text-4xl">&amp;</span><br />{d.host2.name}</>}</h1>
        </div>
        {dateEl}{guestBlock}{btn}
      </section>
    );
  }
  if (kind === "type") {
    return (
      <section id="cover" className={`relative flex ${h} flex-col justify-between px-7 py-10`}>
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[.3em] mut"><span>{d.heading}</span><span>{d.date.slice(0, 4)}</span></div>
        <div>
          <h1 className="hd font-semibold uppercase leading-[0.88]" style={{ fontSize: "clamp(2.8rem,15vw,4.6rem)" }}>
            {d.host1.name}{two && <><br /><span className="acc">&amp;</span> {d.host2.name}</>}
          </h1>
          <div className="my-5 h-px w-full" style={{ background: "var(--accent)" }} />
          <div className="flex items-end gap-4">
            <Photo src={bg} className="h-28 w-24 flex-none" style={{ borderRadius: "var(--rad)" }} alt="Cover" />
            <div className="text-left"><p className="text-sm uppercase tracking-[.15em]">{date}</p>{guestBlock}</div>
          </div>
        </div>
        <div className="text-left">{btn}</div>
      </section>
    );
  }
  if (kind === "full") {
    return (
      <section id="cover" className={`relative flex ${h} flex-col justify-end overflow-hidden text-center`}>
        <Photo src={bg} className="absolute inset-0 h-full w-full" alt="Cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top,var(--bg) 8%,color-mix(in srgb,var(--bg) 40%,transparent) 55%,transparent)" }} />
        <div className="relative px-6 pb-12 pt-40">
          {heading}<Names cls="mt-3 text-5xl" />{dateEl}{guestBlock}{btn}
        </div>
      </section>
    );
  }
  if (kind === "circle") {
    return (
      <section id="cover" className={`relative flex ${h} flex-col items-center justify-center px-6 py-14 text-center`}>
        <div className="relative flex h-60 w-60 items-center justify-center">
          <div className="spin absolute inset-0 rounded-full" style={{ border: "1.5px dashed var(--accent)", animation: "i-spin 40s linear infinite" }} />
          <Photo src={bg} className="h-48 w-48 rounded-full" alt="Cover" />
        </div>
        <div className="mt-6">{heading}<Names cls="mt-2 text-5xl" /></div>{dateEl}{guestBlock}{btn}
      </section>
    );
  }
  // center
  return (
    <section id="cover" className={`relative flex ${h} flex-col items-center justify-center overflow-hidden px-6 py-14 text-center`}>
      <Photo src={bg} className="absolute inset-0 h-full w-full" alt="Cover" />
      <div className="absolute inset-0" style={{ background: "color-mix(in srgb,var(--bg) 78%,transparent)" }} />
      <Orn kind={cfg.orn} className="absolute left-0 top-0 w-32" /><Orn kind={cfg.orn} flip className="absolute bottom-0 right-0 w-32" />
      <div className="relative">{heading}<Names cls="mt-3 text-6xl" />{dateEl}{guestBlock}{btn}</div>
    </section>
  );
}
