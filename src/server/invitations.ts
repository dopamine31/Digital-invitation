import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import * as s from "@/db/schema";
import { ensureSeed } from "@/lib/seed";
import { sectionAllowed, type Ent } from "@/lib/entitlements";
import type { InvitationData, SectionItem, TemplateConfig } from "@/types";
import { defaultSections } from "@/templates/defaults";
import { getEntForInvitation } from "./core";

export async function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function loadInvitationBySlug(slug: string) {
  await ensureSeed();
  const [row] = await db.select({ inv: s.invitations, tpl: s.templates }).from(s.invitations)
    .innerJoin(s.templates, eq(s.invitations.templateId, s.templates.id))
    .where(and(eq(s.invitations.slug, slug), isNull(s.invitations.deletedAt))).limit(1);
  return row;
}

export const isLive = (inv: { status: string; publishAt: Date | null; expireAt: Date | null }) =>
  inv.status === "published" && (!inv.publishAt || inv.publishAt <= new Date()) && (!inv.expireAt || inv.expireAt > new Date());

export function resolveSections(sections: SectionItem[] | undefined, ent: Ent): SectionItem[] {
  const list = sections && sections.length ? sections : defaultSections();
  return list.filter((x) => sectionAllowed(x.key, ent));
}

export async function approvedWishes(invitationId: number) {
  const rows = await db.select().from(s.wishes).where(and(eq(s.wishes.invitationId, invitationId), eq(s.wishes.approved, true))).orderBy(desc(s.wishes.createdAt)).limit(50);
  return rows.map((w) => ({ id: w.id, name: w.name, message: w.message, createdAt: w.createdAt.toISOString() }));
}

/** Menyusun props InvitationView dari data DB. Tidak pernah menyertakan password / data tamu lain. */
export async function buildViewProps(row: NonNullable<Awaited<ReturnType<typeof loadInvitationBySlug>>>, opts: { guest?: { name: string; code?: string }; embedded?: boolean; brandName: string }) {
  const { inv, tpl } = row;
  const ent = await getEntForInvitation({ packageCode: inv.packageCode, addons: inv.addons });
  return {
    invitationId: inv.id, slug: inv.slug, title: inv.title, data: inv.data as InvitationData, baseConfig: tpl.config as unknown as TemplateConfig,
    design: inv.design, sections: resolveSections(inv.sections, ent), guest: opts.guest, wishes: ent.guestbook ? await approvedWishes(inv.id) : [],
    embedded: opts.embedded, baseUrl: await getBaseUrl(), removeBranding: ent.removeBranding, qr: ent.qr, checkin: ent.checkin, music: ent.music,
    maxPhotos: ent.maxPhotos, moderate: !!inv.settings?.moderate, rsvpEnabled: inv.settings?.rsvpEnabled !== false, brandName: opts.brandName,
  };
}
