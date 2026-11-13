import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, templates } from "@/db/schema";
import { requireCustomer } from "@/lib/auth";
import { getEntForInvitation, getOwnedInvitation, getSite } from "@/server/core";
import { getBaseUrl } from "@/server/invitations";
import { Editor } from "@/components/editor/Editor";
import { tierOk } from "@/lib/entitlements";
import { defaultInvitationData, defaultSections } from "@/templates/defaults";
import type { InvitationData, TemplateConfig } from "@/types";

export const metadata = { title: "Editor Undangan" };

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireCustomer();
  const inv = await getOwnedInvitation(Number((await params).id), u.id);
  if (!inv) notFound();
  const [tpl] = await db.select().from(templates).where(eq(templates.id, inv.templateId)).limit(1);
  const [cat] = await db.select().from(categories).where(eq(categories.id, tpl.categoryId ?? 0)).limit(1);
  const [ent, site, baseUrl] = await Promise.all([getEntForInvitation(inv), getSite(), getBaseUrl()]);
  return (
    <Editor
      inv={{ id: inv.id, slug: inv.slug, title: inv.title, status: inv.status, packageCode: inv.packageCode, password: inv.password ?? "", publishAt: inv.publishAt ? inv.publishAt.toISOString().slice(0, 16) : "", expireAt: inv.expireAt ? inv.expireAt.toISOString().slice(0, 16) : "", data: inv.data as InvitationData, design: inv.design, sections: inv.sections.length ? inv.sections : defaultSections() }}
      baseCfg={tpl.config as unknown as TemplateConfig} templateName={tpl.name} templateOk={tierOk(tpl.tier, inv.packageCode)} templateTier={tpl.tier} ent={ent} baseUrl={baseUrl} brandName={site.name}
      defaults={defaultInvitationData((inv.data as InvitationData).eventType || cat?.slug || "wedding")}
    />
  );
}
