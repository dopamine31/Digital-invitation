import Link from "next/link";
import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { db } from "@/db";
import { favorites } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCategories, getPackages, getTemplatesWithCat, type TemplateRow } from "@/server/core";
import { TemplateThumb } from "@/components/TemplateThumb";
import { CatalogFilters } from "@/components/CatalogFilters";
import { FavButton } from "@/components/FavButton";
import { Badge, Empty } from "@/components/ui";
import { idr } from "@/lib/format";
import type { TemplateConfig } from "@/types";

export const TIER_TONE: Record<string, string> = { free: "green", basic: "blue", premium: "violet", exclusive: "amber" };

export async function priceMap() {
  const pk = await getPackages();
  return (t: { tier: string; price: number }) => {
    const p = pk.find((x) => x.code === t.tier);
    return (p ? (p.promoPrice ?? p.price) : 0) + t.price;
  };
}

export function TemplateCard({ t, href, price, fav, userId }: { t: TemplateRow; href: string; price: number; fav?: boolean; userId?: number }) {
  return (
    <Link href={href} className="group card relative overflow-hidden transition hover:-translate-y-1 hover:shadow-lg">
      <div className="relative">
        <TemplateThumb cfg={t.config as unknown as TemplateConfig} label={t.catName === "Wedding" ? "The Wedding" : t.catName} />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <Badge tone={TIER_TONE[t.tier]}>{t.tier === "free" ? "Gratis" : t.tier}</Badge>
          {t.isNew && <Badge tone="red">Baru</Badge>}
        </div>
        {userId && <div className="absolute right-2 top-2"><FavButton templateId={t.id} initial={!!fav} /></div>}
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-semibold">{t.name}</p>
        <div className="mt-0.5 flex items-center justify-between text-xs text-stone-500"><span className="truncate">{t.catName} · {t.style}</span><span className="flex-none font-semibold text-stone-900">{price === 0 ? "Gratis" : idr(price)}</span></div>
      </div>
    </Link>
  );
}

export async function CatalogView({ base, sp, userId }: { base: string; sp: Record<string, string | undefined>; userId?: number }) {
  const [all, cats, price] = await Promise.all([getTemplatesWithCat(), getCategories(), priceMap()]);
  const favs = userId ? (await db.select().from(favorites).where(eq(favorites.userId, userId))).map((f) => f.templateId) : [];
  const q = (sp.q ?? "").toLowerCase().trim();
  let list = all.filter((t) => {
    if (q && !`${t.name} ${t.style} ${t.catName} ${t.tags.join(" ")}`.toLowerCase().includes(q)) return false;
    if (sp.cat && t.catSlug !== sp.cat) return false;
    if (sp.price && t.tier !== sp.price) return false;
    if (sp.tone && (sp.tone === "dark") !== !!(t.config as unknown as TemplateConfig).dark) return false;
    if (sp.style && t.style !== sp.style) return false;
    if (sp.show === "featured" && !t.featured) return false;
    if (sp.show === "fav" && !favs.includes(t.id)) return false;
    return true;
  });
  const sort = sp.sort ?? "popular";
  list = [...list].sort((a, b) => sort === "new" ? b.createdAt.getTime() - a.createdAt.getTime() : sort === "price" ? price(a) - price(b) : sort === "recommended" ? Number(b.featured) - Number(a.featured) || b.popularity - a.popularity : b.popularity - a.popularity);
  const styles = Array.from(new Set(all.map((t) => t.style))).filter(Boolean).sort().map((s) => ({ value: s, label: s }));
  const usedCats = cats.filter((c) => all.some((t) => t.catSlug === c.slug));
  return (
    <div>
      <Suspense><CatalogFilters categories={usedCats.map((c) => ({ value: c.slug, label: `${c.icon} ${c.name}` }))} styles={styles} /></Suspense>
      <p className="mb-3 text-xs text-stone-500">{list.length} template ditemukan</p>
      {list.length === 0 ? <Empty title="Template tidak ditemukan" text="Coba ubah kata kunci atau reset filter." action={<Link className="btn btn-ghost btn-sm" href={base}>Reset filter</Link>} /> : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {list.map((t) => <TemplateCard key={t.id} t={t} href={`${base}/${t.slug}`} price={price(t)} fav={favs.includes(t.id)} userId={userId} />)}
        </div>
      )}
      <p className="mt-8 flex items-center justify-center gap-2 text-xs text-stone-400"><Sparkles size={14} /> {all.length} template dengan cover, tipografi, animasi, galeri, dan ornamen berbeda</p>
    </div>
  );
}
