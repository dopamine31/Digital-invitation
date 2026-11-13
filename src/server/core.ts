import "server-only";
import { eq, asc, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { ensureSeed } from "@/lib/seed";
import { computeEnt, type Ent } from "@/lib/entitlements";
import { sendEmail } from "@/adapters/email";

export type Site = {
  name: string; tagline: string; whatsapp: string; email: string; address: string; instagram: string; facebook: string; tiktok: string; youtube: string;
  domain: string; brandColor: string; logo: string; favicon: string; font: string; seoTitle: string; seoDesc: string; ogImage: string; pwaName: string; pwaShort: string;
};
export type Content = {
  heroTitle: string; heroSubtitle: string; banner: string; faq: { q: string; a: string }[]; testimonials: { name: string; role: string; text: string }[];
  pages: { terms: string; privacy: string; help: string };
};
export type SystemSettings = {
  maintenance: boolean; maxUploadMB: number; maxPhotos: number; backup: string; emailProvider: string; storage: string; twoFactor: boolean; sessionDays: number;
  paymentProvider: string; bankName: string; bankNumber: string; bankHolder: string; notifyEmail: boolean; notifyPush: boolean;
};

export async function getSetting<T>(key: "site" | "content" | "system"): Promise<T> {
  await ensureSeed();
  const [r] = await db.select().from(s.settings).where(eq(s.settings.key, key)).limit(1);
  return (r?.value ?? {}) as T;
}
export const getSite = () => getSetting<Site>("site");
export const getContent = () => getSetting<Content>("content");
export const getSystem = () => getSetting<SystemSettings>("system");
export async function setSetting(key: string, value: Record<string, unknown>) {
  await db.insert(s.settings).values({ key, value }).onConflictDoUpdate({ target: s.settings.key, set: { value } });
}

export async function getPackages(includeInactive = false) {
  await ensureSeed();
  const rows = await db.select().from(s.packages).orderBy(asc(s.packages.sortOrder));
  return includeInactive ? rows : rows.filter((p) => p.active);
}
export async function getCategories() {
  await ensureSeed();
  return db.select().from(s.categories).orderBy(asc(s.categories.sortOrder));
}
export async function getTemplatesWithCat(onlyPublished = true) {
  await ensureSeed();
  const rows = await db.select({ t: s.templates, catName: s.categories.name, catSlug: s.categories.slug, catIcon: s.categories.icon })
    .from(s.templates).leftJoin(s.categories, eq(s.templates.categoryId, s.categories.id));
  return rows.filter((r) => !onlyPublished || r.t.status === "published").map((r) => ({ ...r.t, popularity: r.t.popularity ?? 0, style: r.t.style ?? "", description: r.t.description ?? "", featured: !!r.t.featured, isNew: !!r.t.isNew, catName: r.catName ?? "Lainnya", catSlug: r.catSlug ?? "lainnya", catIcon: r.catIcon ?? "✨" }));
}
export type TemplateRow = Awaited<ReturnType<typeof getTemplatesWithCat>>[number];

export async function getEntForInvitation(inv: { packageCode: string; addons: string[] }): Promise<Ent> {
  const all = await getPackages(true);
  const pkg = all.find((p) => p.code === inv.packageCode);
  const addons = all.filter((p) => p.isAddon && inv.addons.includes(p.code));
  return computeEnt(pkg?.entitlements, addons.map((a) => ({ code: a.code, entitlements: a.entitlements })));
}

export async function getOwnedInvitation(id: number, userId: number) {
  const [inv] = await db.select().from(s.invitations).where(and(eq(s.invitations.id, id), eq(s.invitations.userId, userId), isNull(s.invitations.deletedAt))).limit(1);
  return inv;
}

export async function logActivity(userId: number | null, action: string, entity = "", entityId?: number, detail = "") {
  await db.insert(s.activityLogs).values({ userId, action, entity, entityId, detail });
}

/** Notifikasi dalam aplikasi + adapter email (stub/log sampai dikonfigurasi). */
export async function notify(userId: number, type: string, title: string, body = "", link = "") {
  await db.insert(s.notifications).values({ userId, type, title, body, link });
  const [u] = await db.select({ email: s.users.email }).from(s.users).where(eq(s.users.id, userId)).limit(1);
  if (u) await sendEmail({ to: u.email, subject: title, text: body }).catch(() => undefined);
}

export function uniqueSlugCandidate(base: string) {
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}
