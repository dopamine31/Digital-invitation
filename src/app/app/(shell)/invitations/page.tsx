import Link from "next/link";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireCustomer } from "@/lib/auth";
import { getEntForInvitation, getTemplatesWithCat } from "@/server/core";
import { getBaseUrl } from "@/server/invitations";
import { Empty, PageHeader } from "@/components/ui";
import { InvitationCard } from "@/components/InvitationCard";
import type { TemplateConfig } from "@/types";

export const metadata = { title: "Undangan Saya" };

export default async function InvitationsPage() {
  const u = await requireCustomer();
  const rows = await db.select({ inv: s.invitations, tpl: s.templates }).from(s.invitations).innerJoin(s.templates, eq(s.invitations.templateId, s.templates.id))
    .where(and(eq(s.invitations.userId, u.id), isNull(s.invitations.deletedAt))).orderBy(desc(s.invitations.updatedAt));
  const ids = rows.map((r) => r.inv.id);
  const gc = ids.length ? await db.select({ id: s.guests.invitationId, c: sql<number>`count(*)::int` }).from(s.guests).where(inArray(s.guests.invitationId, ids)).groupBy(s.guests.invitationId) : [];
  const rc = ids.length ? await db.select({ id: s.rsvps.invitationId, c: sql<number>`count(*)::int` }).from(s.rsvps).where(inArray(s.rsvps.invitationId, ids)).groupBy(s.rsvps.invitationId) : [];
  const baseUrl = await getBaseUrl();
  const templates = (await getTemplatesWithCat()).map((t) => ({ slug: t.slug, name: `${t.name}${t.tier !== "free" ? ` (${t.tier})` : ""}` }));
  const cards = await Promise.all(rows.map(async ({ inv, tpl }) => {
    const ent = await getEntForInvitation(inv);
    return { id: inv.id, slug: inv.slug, title: inv.title, status: inv.status, packageCode: inv.packageCode, templateName: tpl.name, cfg: tpl.config as unknown as TemplateConfig, views: inv.views, shares: inv.shares,
      guests: gc.find((x) => x.id === inv.id)?.c ?? 0, rsvps: rc.find((x) => x.id === inv.id)?.c ?? 0, expireAt: inv.expireAt?.toISOString() ?? null, qr: ent.qr, personalized: ent.personalized, checkin: ent.checkin };
  }));
  return (
    <>
      <PageHeader title="Undangan Saya" subtitle="Edit, terbitkan, bagikan, dan kelola tamu." actions={<Link href="/app/templates" className="btn btn-brand"><Plus size={16} /> Buat undangan</Link>} />
      {cards.length === 0 ? <Empty title="Belum ada undangan" text="Mulai dari memilih template." action={<Link href="/app/templates" className="btn btn-primary">Pilih template</Link>} /> : (
        <div className="grid gap-4 xl:grid-cols-2">{cards.map((c) => <InvitationCard key={c.id} inv={c} baseUrl={baseUrl} templates={templates} />)}</div>)}
    </>
  );
}
