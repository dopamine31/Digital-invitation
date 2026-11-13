import type { TemplateConfig } from "@/types";
import { Orn } from "@/components/invitation/Ornaments";
import { fontsHref } from "@/components/invitation/theme";

/** Thumbnail ringan (tanpa gambar): dibangun dari konfigurasi template sehingga selalu sinkron dengan desain aslinya. */
export function TemplateThumb({ cfg, label = "The Wedding", className = "" }: { cfg: TemplateConfig; label?: string; className?: string }) {
  const p = cfg.pal;
  const photo = `linear-gradient(135deg,${p.accent2},${p.accent})`;
  const href = fontsHref({ ...cfg, body: "" }, "AndiSt&SAVETHDEWOF");
  const names = (cls: string, stacked = false) => (
    <div className={cls} style={{ fontFamily: `'${cfg.script}', cursive`, color: p.text, lineHeight: 1 }}>
      {stacked ? <>Andi<br /><span style={{ color: p.accent, fontSize: "0.6em" }}>&amp;</span><br />Siti</> : <>Andi <span style={{ color: p.accent }}>&amp;</span> Siti</>}
    </div>
  );
  const cap = <div className="text-[7px] uppercase tracking-[.3em]" style={{ fontFamily: `'${cfg.head}', serif`, color: p.muted }}>{label}</div>;
  let body: React.ReactNode;
  switch (cfg.cover) {
    case "split": body = (<div className="flex h-full flex-col"><div className="h-[55%]" style={{ background: photo, opacity: 0.55 }} /><div className="-mt-4 flex-1 px-3 pt-4 text-center" style={{ background: p.surface, borderRadius: `${Math.min(cfg.rad, 16)}px ${Math.min(cfg.rad, 16)}px 0 0` }}>{cap}{names("mt-1 text-[26px]")}</div></div>); break;
    case "frame": body = (<div className="flex h-full items-center justify-center p-3"><div className="relative flex h-full w-full flex-col items-center justify-center text-center" style={{ border: `1px solid ${p.accent}`, outline: `1px solid ${p.accent}`, outlineOffset: 3 }}><Orn kind={cfg.orn} className="absolute left-0 top-0 w-10" />{cap}<div className="my-2 h-14 w-11" style={{ background: photo, opacity: 0.6, borderRadius: "99px 99px 3px 3px" }} />{names("text-[24px]")}</div></div>); break;
    case "arch": body = (<div className="flex h-full flex-col items-center justify-center text-center"><Orn kind={cfg.orn} className="absolute left-0 top-0 w-12" />{cap}<div className="my-2 h-20 w-14" style={{ background: photo, opacity: 0.6, borderRadius: "99px 99px 0 0", boxShadow: `0 0 0 3px ${p.bg}, 0 0 0 4px ${p.accent}` }} />{names("text-[26px]")}</div>); break;
    case "stack": body = (<div className="flex h-full flex-col items-center justify-center text-center"><div className="mb-2 h-16 w-16 rounded-full" style={{ background: photo, opacity: 0.6, boxShadow: `0 0 0 3px ${p.bg}, 0 0 0 4px ${p.accent}` }} />{names("text-[30px]", true)}</div>); break;
    case "type": body = (<div className="flex h-full flex-col justify-between p-3"><div className="text-[7px] uppercase tracking-[.25em]" style={{ color: p.muted }}>{label}</div><div><div className="text-[34px] font-semibold uppercase leading-[.9]" style={{ fontFamily: `'${cfg.head}', serif`, color: p.text }}>Andi<br /><span style={{ color: p.accent }}>&amp;</span> Siti</div><div className="my-2 h-px" style={{ background: p.accent }} /><div className="h-9 w-8" style={{ background: photo, opacity: 0.6, borderRadius: cfg.rad / 3 }} /></div></div>); break;
    case "full": body = (<div className="relative flex h-full flex-col justify-end text-center"><div className="absolute inset-0" style={{ background: photo, opacity: 0.5 }} /><div className="absolute inset-0" style={{ background: `linear-gradient(to top,${p.bg} 10%,transparent 70%)` }} /><div className="relative pb-6">{cap}{names("mt-1 text-[28px]")}</div></div>); break;
    case "circle": body = (<div className="flex h-full flex-col items-center justify-center text-center"><div className="mb-2 flex h-[76px] w-[76px] items-center justify-center rounded-full" style={{ border: `1px dashed ${p.accent}` }}><div className="h-14 w-14 rounded-full" style={{ background: photo, opacity: 0.6 }} /></div>{cap}{names("mt-1 text-[26px]")}</div>); break;
    default: body = (<div className="relative flex h-full flex-col items-center justify-center text-center"><div className="absolute inset-0" style={{ background: photo, opacity: 0.18 }} /><Orn kind={cfg.orn} className="absolute left-0 top-0 w-14" /><Orn kind={cfg.orn} flip className="absolute bottom-0 right-0 w-14" /><div className="relative">{cap}{names("mt-2 text-[32px]")}</div></div>);
  }
  return (
    <div className={`relative aspect-[3/4] w-full overflow-hidden ${className}`} style={{ background: p.bg, color: p.text }}>
      <link rel="stylesheet" href={href} precedence="default" />
      {body}
    </div>
  );
}
