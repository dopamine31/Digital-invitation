import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ExternalLink } from "lucide-react";
import { db } from "@/db";
import { favorites } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getPackages, getTemplatesWithCat } from "@/server/core";
import { Badge } from "@/components/ui";
import { FavButton } from "@/components/FavButton";
import { TemplateThumb } from "@/components/TemplateThumb";
import { TIER_TONE } from "@/components/Catalog";
import { TIER_RANK } from "@/lib/entitlements";
import { idr } from "@/lib/format";
import type { TemplateConfig } from "@/types";

export async function TemplateDetail({ slug, backHref, userId }: { slug: string; backHref: string; userId?: number }) {
  const all = await getTemplatesWithCat();
  const t = all.find((x) => x.slug === slug);
  if (!t) notFound();
  const pkgs = (await getPackages()).filter((p) => !p.isAddon && p.code !== "custom" && TIER_RANK[p.code] >= TIER_RANK[t.tier]);
  const isFav = userId ? (await db.select().from(favorites).where(and(eq(favorites.userId, userId), eq(favorites.templateId, t.id)))).length > 0 : false;
  const cfg = t.config as unknown as TemplateConfig;
  const related = all.filter((x) => x.catSlug === t.catSlug && x.id !== t.id).slice(0, 4);
  const choose = userId ? `/app/checkout?template=${t.slug}` : `/login?next=${encodeURIComponent(`/app/checkout?template=${t.slug}`)}`;
  return (
    <div>
      <Link href={backHref} className="text-sm text-stone-500 hover:text-stone-900">← Semua template</Link>
      <div className="mt-4 grid gap-8 lg:grid-cols-[380px_1fr]">
        <div className="mx-auto w-full max-w-[340px]">
          <div className="rounded-[2.2rem] border-[8px] border-stone-900 bg-stone-900 shadow-2xl">
            <iframe src={`/preview/${t.slug}`} title={`Demo ${t.name}`} loading="lazy" className="h-[600px] w-full rounded-[1.6rem] bg-white" />
          </div>
          <Link href={`/preview/${t.slug}`} target="_blank" className="btn btn-ghost mt-4 w-full"><ExternalLink size={16} /> Demo layar penuh</Link>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2"><Badge tone={TIER_TONE[t.tier]}>{t.tier === "free" ? "Gratis" : t.tier}</Badge><Badge>{t.catIcon} {t.catName}</Badge>{t.isNew && <Badge tone="red">Baru</Badge>}{t.featured && <Badge tone="amber">Unggulan</Badge>}</div>
          <h1 className="font-display mt-3 text-3xl font-semibold sm:text-4xl">{t.name}</h1>
          <p className="mt-2 text-stone-600">{t.description}</p>
          <p className="mt-1 text-xs text-stone-400">Digunakan {t.popularity}× · Gaya {t.style}</p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={choose} className="btn btn-brand" data-testid="choose-template">Pilih template ini</Link>
            {userId ? <FavButton templateId={t.id} initial={isFav} className="border border-stone-200" /> : <Link href="/login" className="btn btn-ghost">Masuk untuk favorit</Link>}
          </div>

          <div className="card mt-6 p-4"><h2 className="text-sm font-semibold">Karakter desain</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
              {([["Cover", cfg.cover], ["Ornamen", cfg.orn], ["Galeri", cfg.gal], ["Animasi", cfg.anim], ["Tombol", cfg.btn], ["Acara", cfg.ev], ["Font judul", cfg.head], ["Font tulisan", cfg.script]] as const).map(([k, v]) => (<div key={k}><dt className="text-[11px] uppercase text-stone-400">{k}</dt><dd className="font-medium capitalize">{v}</dd></div>))}
            </dl>
            <div className="mt-3 flex gap-1.5">{Object.values(cfg.pal).map((c, i) => <span key={i} className="h-6 w-6 rounded-full border border-stone-200" style={{ background: c }} title={c} />)}</div>
          </div>
          <div className="card mt-4 p-4"><h2 className="text-sm font-semibold">Fitur</h2>
            <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{t.features.map((f) => <li key={f} className="flex items-center gap-2"><Check size={14} className="text-emerald-600" />{f}</li>)}</ul></div>
          <div className="mt-4"><h2 className="text-sm font-semibold">Paket yang tersedia</h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">{pkgs.map((p) => (<div key={p.code} className="card p-3"><div className="flex items-center justify-between"><span className="font-semibold">{p.name}</span><span className="text-sm font-semibold">{p.price === 0 ? "Gratis" : idr((p.promoPrice ?? p.price) + t.price)}</span></div><p className="mt-1 text-xs text-stone-500">{p.features.slice(0, 3).join(" · ")}</p></div>))}</div></div>
        </div>
      </div>
      {related.length > 0 && <div className="mt-12"><h2 className="font-display text-xl font-semibold">Template serupa</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">{related.map((r) => (<Link key={r.id} href={`${backHref}/${r.slug}`} className="card overflow-hidden"><TemplateThumb cfg={r.config as unknown as TemplateConfig} /><p className="p-2 text-xs font-semibold">{r.name}</p></Link>))}</div></div>}
    </div>
  );
}
