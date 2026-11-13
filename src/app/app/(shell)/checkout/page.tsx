import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { templates } from "@/db/schema";
import { requireCustomer } from "@/lib/auth";
import { getOwnedInvitation, getPackages } from "@/server/core";
import { CheckoutForm } from "@/components/CheckoutForm";
import { PageHeader } from "@/components/ui";
import { TIER_RANK } from "@/lib/entitlements";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ template?: string; invitation?: string }> }) {
  const u = await requireCustomer();
  const sp = await searchParams;
  const invId = Number(sp.invitation) || null;
  const inv = invId ? await getOwnedInvitation(invId, u.id) : null;
  if (invId && !inv) redirect("/app/invitations");
  const [tpl] = inv ? await db.select().from(templates).where(eq(templates.id, inv.templateId)).limit(1) : sp.template ? await db.select().from(templates).where(eq(templates.slug, sp.template)).limit(1) : [];
  if (!tpl) redirect("/app/templates");
  const all = await getPackages();
  const pkgs = all.filter((p) => !p.isAddon).map((p) => ({ code: p.code, name: p.name, price: p.price, promoPrice: p.promoPrice, description: p.description ?? "", features: p.features, highlight: !!p.highlight, allowed: (TIER_RANK[p.code] ?? 0) >= (TIER_RANK[tpl.tier] ?? 0) && (!inv || p.code !== "free") }));
  const addons = all.filter((p) => p.isAddon).map((a) => ({ code: a.code, name: a.name, price: a.price, description: a.description ?? "" }));
  const def = pkgs.find((p) => p.allowed && p.highlight)?.code ?? pkgs.find((p) => p.allowed)?.code ?? "free";
  const defaultPkg = pkgs.find((p) => p.code === tpl.tier && p.allowed)?.code ?? def;
  return (
    <>
      <PageHeader title="Checkout" subtitle={inv ? `Upgrade paket untuk “${inv.title}”` : `Mulai undangan baru dengan template ${tpl.name}`} />
      <CheckoutForm templateSlug={tpl.slug} templateName={tpl.name} templatePrice={tpl.price} invitationId={inv?.id ?? null} packages={pkgs} addons={addons} defaultPkg={defaultPkg} />
    </>
  );
}
