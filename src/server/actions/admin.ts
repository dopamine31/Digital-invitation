"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { tenantClient } from "@/lib/tenant";
import { requirePermission, requireActor, audit } from "@/server/context";
import { startImpersonation, stopImpersonation } from "@/lib/auth";
import { computeArr, computeMrr, trialToPaidRate, churnRate, limitsToJson, featuresToJson, parseLimits, parseFeatures } from "@/lib/billing";
import { encrypt, hashPassword, randomToken } from "@/lib/crypto";
import { toInputJson } from "@/lib/db-json";
import { AppError, err, ok, type Result } from "@/lib/result";
import { recordAudit } from "@/lib/audit";
import type { PlanFeatures, PlanLimits } from "@/lib/types";

export interface Kpis {
  mrr: number; arr: number; activeTenants: number; trialTenants: number; publishedEvents: number;
  rsvpTotal: number; churn: number; trialConversion: number; errorRate: number;
  storageMb: number; bandwidthMb: number; paidInvoices: number; revenue: number;
  planDistribution: { code: string; count: number }[];
  timeline: { date: string; rsvps: number }[];
}

export async function getKpisAction(): Promise<Result<Kpis>> {
  try {
    await requirePermission("kpi.read");
    const [plans, subs, tenants, events, rsvps, invoices, assets, visits, failedLogs, allLogs] = await Promise.all([
      prisma.plan.findMany(),
      prisma.subscription.findMany(),
      prisma.tenant.findMany(),
      prisma.event.count({ where: { status: "PUBLISHED" } }),
      prisma.rsvp.count(),
      prisma.invoice.findMany({ where: { status: "PAID" } }),
      prisma.mediaAsset.aggregate({ _sum: { sizeBytes: true } }),
      prisma.guestVisit.count(),
      prisma.notificationLog.count({ where: { status: "FAILED" } }),
      prisma.notificationLog.count(),
    ]);
    const mrr = computeMrr(
      subs.map((sub) => ({ planId: sub.planId, billingCycle: sub.billingCycle, status: sub.status })),
      plans.map((plan) => ({ id: plan.id, monthlyPrice: plan.monthlyPrice, yearlyPrice: plan.yearlyPrice })),
    );
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600_000);
    const churned = subs.filter((sub) => sub.cancelledAt && sub.cancelledAt >= thirtyDaysAgo).length;
    const trials = tenants.filter((tenant) => tenant.status === "TRIAL").length;
    const paid = tenants.filter((tenant) => tenant.status === "ACTIVE").length;
    const distribution = new Map<string, number>();
    for (const tenant of tenants) {
      const plan = plans.find((item) => item.id === tenant.planId);
      const code = plan?.code ?? "UNKNOWN";
      distribution.set(code, (distribution.get(code) ?? 0) + 1);
    }
    const rsvpRows = await prisma.rsvp.findMany({ select: { submittedAt: true }, orderBy: { submittedAt: "desc" }, take: 500 });
    const timelineMap = new Map<string, number>();
    for (const row of rsvpRows) {
      const key = row.submittedAt.toISOString().slice(0, 10);
      timelineMap.set(key, (timelineMap.get(key) ?? 0) + 1);
    }
    return ok({
      mrr, arr: computeArr(mrr),
      activeTenants: tenants.filter((tenant) => ["ACTIVE", "TRIAL", "GRACE"].includes(tenant.status)).length,
      trialTenants: trials, publishedEvents: events, rsvpTotal: rsvps,
      churn: churnRate(tenants.length, churned),
      trialConversion: trialToPaidRate(trials + paid, paid),
      errorRate: allLogs > 0 ? Math.round((failedLogs / allLogs) * 1000) / 10 : 0,
      storageMb: Math.round((assets._sum.sizeBytes ?? 0) / 1024 / 1024 * 10) / 10,
      bandwidthMb: Math.round(visits * 0.12 * 10) / 10,
      paidInvoices: invoices.length,
      revenue: invoices.reduce((sum, invoice) => sum + invoice.total, 0),
      planDistribution: [...distribution.entries()].map(([code, count]) => ({ code, count })),
      timeline: [...timelineMap.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-14).map(([date, count]) => ({ date, rsvps: count })),
    });
  } catch (error: unknown) {
    if (error instanceof AppError) return err(error.code, error.message);
    return err("KPI_FAILED", error instanceof Error ? error.message : "Gagal memuat KPI.");
  }
}

export async function listTenantsAction(): Promise<Result<{
  id: string; name: string; slug: string; status: string; planCode: string;
  createdAt: string; eventCount: number; guestCount: number; userEmail: string | null;
}[]>> {
  try {
    await requirePermission("tenant.read");
    const [tenants, plans, users] = await Promise.all([
      prisma.tenant.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.plan.findMany(), prisma.user.findMany({ where: { platformRole: "USER" } }),
    ]);
    const [events, guests] = await Promise.all([
      prisma.event.groupBy({ by: ["tenantId"], _count: { _all: true } }),
      prisma.guest.groupBy({ by: ["tenantId"], _count: { _all: true } }),
    ]);
    const eventCount = new Map(events.map((row) => [row.tenantId, row._count._all]));
    const guestCount = new Map(guests.map((row) => [row.tenantId, row._count._all]));
    return ok(tenants.map((tenant) => ({
      id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status,
      planCode: plans.find((plan) => plan.id === tenant.planId)?.code ?? "-",
      createdAt: tenant.createdAt.toISOString(),
      eventCount: eventCount.get(tenant.id) ?? 0,
      guestCount: guestCount.get(tenant.id) ?? 0,
      userEmail: users.find((user) => user.tenantId === tenant.id)?.email ?? null,
    })));
  } catch (error: unknown) {
    return err("TENANT_FAILED", error instanceof Error ? error.message : "Gagal memuat tenant.");
  }
}

export async function setTenantStatusAction(tenantId: string, status: "ACTIVE" | "SUSPENDED" | "BANNED", reason = ""): Promise<Result<{ ok: true }>> {
  try {
    const actor = await requirePermission("tenant.suspend");
    const before = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!before) return err("NOT_FOUND", "Tenant tidak ditemukan.");
    await prisma.tenant.update({ where: { id: tenantId }, data: { status, suspendedReason: reason.slice(0, 300) || null } });
    await recordAudit({ tenantId, actorId: actor.actorId, actorEmail: actor.actorEmail, action: "tenant.status", entity: "Tenant", entityId: tenantId, before: { status: before.status }, after: { status, reason } });
    revalidatePath("/admin/tenants");
    return ok({ ok: true });
  } catch (error: unknown) {
    return err("TENANT_FAILED", error instanceof Error ? error.message : "Gagal mengubah status tenant.");
  }
}

export async function changeTenantPlanAction(tenantId: string, planId: string): Promise<Result<{ ok: true }>> {
  try {
    const actor = await requirePermission("plan.manage");
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return err("NOT_FOUND", "Paket tidak ditemukan.");
    const before = await prisma.tenant.findUnique({ where: { id: tenantId } });
    await prisma.tenant.update({ where: { id: tenantId }, data: { planId, status: "ACTIVE" } });
    const db = tenantClient(tenantId);
    const active = await db.subscription.findFirst({ where: { tenantId, status: { in: ["TRIALING", "ACTIVE", "GRACE"] } } });
    if (active) await db.subscription.update({ where: { id: active.id, tenantId }, data: { planId, status: "ACTIVE" } });
    await recordAudit({ tenantId, actorId: actor.actorId, actorEmail: actor.actorEmail, action: "tenant.plan", entity: "Tenant", entityId: tenantId, before: { planId: before?.planId }, after: { planId, planCode: plan.code } });
    revalidatePath("/admin/tenants");
    return ok({ ok: true });
  } catch (error: unknown) {
    return err("TENANT_FAILED", error instanceof Error ? error.message : "Gagal mengubah paket.");
  }
}

export async function resetQuotaAction(tenantId: string): Promise<Result<{ deleted: number }>> {
  try {
    const actor = await requirePermission("system.manage");
    const db = tenantClient(tenantId);
    const result = await db.quotaUsage.deleteMany({ where: { tenantId } });
    await recordAudit({ tenantId, actorId: actor.actorId, actorEmail: actor.actorEmail, action: "tenant.quota_reset", entity: "QuotaUsage", entityId: tenantId });
    return ok({ deleted: result.count });
  } catch (error: unknown) {
    return err("QUOTA_FAILED", error instanceof Error ? error.message : "Gagal mereset kuota.");
  }
}

export async function impersonateTenantAction(tenantId: string): Promise<Result<{ redirectTo: string }>> {
  try {
    const actor = await requirePermission("impersonate");
    const user = await prisma.user.findFirst({ where: { tenantId, status: "ACTIVE" }, orderBy: { createdAt: "asc" } });
    if (!user) return err("NOT_FOUND", "Pengguna tenant tidak ditemukan.");
    await startImpersonation(user.id, actor.actorId);
    await recordAudit({ tenantId, actorId: actor.actorId, actorEmail: actor.actorEmail, action: "admin.impersonate_start", entity: "User", entityId: user.id, after: { targetEmail: user.email } });
    return ok({ redirectTo: "/app" });
  } catch (error: unknown) {
    return err("IMPERSONATE_FAILED", error instanceof Error ? error.message : "Gagal impersonate.");
  }
}

export async function stopImpersonationAction(): Promise<Result<{ redirectTo: string }>> {
  const actor = await requireActor();
  await recordAudit({ tenantId: actor.tenantId || null, actorId: actor.actorId, actorEmail: actor.actorEmail, action: "admin.impersonate_stop", entity: "Session" });
  await stopImpersonation();
  return ok({ redirectTo: "/admin" });
}

const planSchema = z.object({
  id: z.string().optional(), code: z.string().min(2).max(40), name: z.string().min(2).max(80),
  description: z.string().max(300).default(""), monthlyPrice: z.number().int().min(0),
  yearlyPrice: z.number().int().min(0), trialDays: z.number().int().min(0).max(90),
  limits: z.object({
    maxEvents: z.number().int().min(0), maxGuestsPerEvent: z.number().int().min(0),
    maxStorageMb: z.number().int().min(0), maxBlastsPerMonth: z.number().int().min(0), seats: z.number().int().min(0),
  }),
  features: z.record(z.boolean()), sortOrder: z.number().int().default(0), isActive: z.boolean().default(true),
});

export async function savePlanAction(input: z.infer<typeof planSchema>): Promise<Result<{ id: string }>> {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", parsed.error.issues[0]?.message ?? "Data paket tidak valid.");
  try {
    const actor = await requirePermission("plan.manage");
    const data = parsed.data;
    const limits: PlanLimits = data.limits;
    const features: PlanFeatures = { ...parseFeatures(null), ...(data.features as Partial<PlanFeatures>) };
    const values = {
      code: data.code.toUpperCase(), name: data.name, description: data.description,
      monthlyPrice: data.monthlyPrice, yearlyPrice: data.yearlyPrice, trialDays: data.trialDays,
      limits: toInputJson(limitsToJson(limits)), features: toInputJson(featuresToJson(features)),
      sortOrder: data.sortOrder, isActive: data.isActive,
    };
    const saved = data.id
      ? await prisma.plan.update({ where: { id: data.id }, data: values })
      : await prisma.plan.create({ data: values });
    await audit(actor, "plan.save", "Plan", saved.id, undefined, { code: data.code, monthlyPrice: data.monthlyPrice });
    revalidatePath("/admin/plans");
    return ok({ id: saved.id });
  } catch (error: unknown) {
    return err("PLAN_FAILED", error instanceof Error ? error.message : "Gagal menyimpan paket.");
  }
}

const couponSchema = z.object({
  code: z.string().min(3).max(40), type: z.enum(["PERCENT", "FIXED"]), value: z.number().int().min(0),
  maxRedemptions: z.number().int().min(0).default(0), validUntil: z.string().nullable().default(null),
  active: z.boolean().default(true),
});

export async function saveCouponAction(input: z.infer<typeof couponSchema>): Promise<Result<{ code: string }>> {
  const parsed = couponSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", "Data kupon tidak valid.");
  try {
    const actor = await requirePermission("coupon.manage");
    const data = parsed.data;
    const code = data.code.toUpperCase();
    const validUntil = data.validUntil ? new Date(data.validUntil) : null;
    await prisma.coupon.upsert({
      where: { code },
      create: { code, type: data.type, value: data.value, maxRedemptions: data.maxRedemptions, validUntil, active: data.active, createdBy: actor.actorId },
      update: { type: data.type, value: data.value, maxRedemptions: data.maxRedemptions, validUntil, active: data.active },
    });
    await audit(actor, "coupon.save", "Coupon", code, undefined, { type: data.type, value: data.value });
    return ok({ code });
  } catch (error: unknown) {
    return err("COUPON_FAILED", error instanceof Error ? error.message : "Gagal menyimpan kupon.");
  }
}

const templateSchema = z.object({
  id: z.string().optional(), code: z.string().min(2), name: z.string().min(2),
  category: z.string().default("Umum"), tags: z.array(z.string()).default([]),
  themeId: z.string(), status: z.enum(["DRAFT", "PUBLISHED", "UNPUBLISHED"]), featured: z.boolean().default(false),
  config: z.unknown().default({}),
});

export async function saveTemplateAction(input: z.infer<typeof templateSchema>): Promise<Result<{ id: string }>> {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", "Data template tidak valid.");
  try {
    const actor = await requirePermission("template.manage");
    const data = parsed.data;
    const values = {
      code: data.code, name: data.name, category: data.category, tags: toInputJson(data.tags),
      themeId: data.themeId, config: toInputJson(data.config), status: data.status,
      featured: data.featured, createdBy: actor.actorId,
    };
    const saved = data.id
      ? await prisma.template.update({ where: { id: data.id }, data: values })
      : await prisma.template.create({ data: values });
    await audit(actor, "template.save", "Template", saved.id, undefined, { code: data.code, status: data.status });
    revalidatePath("/admin/templates");
    return ok({ id: saved.id });
  } catch (error: unknown) {
    return err("TEMPLATE_FAILED", error instanceof Error ? error.message : "Gagal menyimpan template.");
  }
}

export async function resolveReportAction(reportId: string, status: "RESOLVED" | "DISMISSED"): Promise<Result<{ ok: true }>> {
  try {
    const actor = await requirePermission("moderation.manage");
    await prisma.reportAbuse.update({ where: { id: reportId }, data: { status, resolvedAt: new Date() } });
    await audit(actor, "moderation.report", "ReportAbuse", reportId, undefined, { status });
    return ok({ ok: true });
  } catch (error: unknown) {
    return err("MODERATION_FAILED", error instanceof Error ? error.message : "Gagal memproses laporan.");
  }
}

export async function saveAnnouncementAction(input: { title: string; body: string; audience: string[] }): Promise<Result<{ id: string }>> {
  const parsed = z.object({ title: z.string().min(3).max(160), body: z.string().min(3).max(2000), audience: z.array(z.string()).default([]) }).safeParse(input);
  if (!parsed.success) return err("VALIDATION", "Pengumuman tidak valid.");
  try {
    const actor = await requirePermission("announcement.manage");
    const row = await prisma.announcement.create({
      data: { title: parsed.data.title, body: parsed.data.body, audience: toInputJson(parsed.data.audience), createdBy: actor.actorId },
    });
    await audit(actor, "announcement.create", "Announcement", row.id);
    return ok({ id: row.id });
  } catch (error: unknown) {
    return err("ANNOUNCEMENT_FAILED", error instanceof Error ? error.message : "Gagal menyimpan pengumuman.");
  }
}

export async function setFeatureFlagAction(key: string, enabled: boolean, overrides: Record<string, boolean>): Promise<Result<{ ok: true }>> {
  try {
    const actor = await requirePermission("featureflag.manage");
    await prisma.featureFlag.upsert({
      where: { key },
      create: { key, enabledGlobally: enabled, tenantOverrides: toInputJson(overrides), description: "" },
      update: { enabledGlobally: enabled, tenantOverrides: toInputJson(overrides) },
    });
    await audit(actor, "flag.update", "FeatureFlag", key, undefined, { enabled });
    return ok({ ok: true });
  } catch (error: unknown) {
    return err("FLAG_FAILED", error instanceof Error ? error.message : "Gagal mengubah flag.");
  }
}

export async function setSystemSettingAction(key: string, value: unknown): Promise<Result<{ ok: true }>> {
  try {
    const actor = await requirePermission("system.manage");
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: toInputJson(value), updatedBy: actor.actorId },
      update: { value: toInputJson(value), updatedBy: actor.actorId },
    });
    await audit(actor, "system.setting", "SystemSetting", key, undefined, { value });
    return ok({ ok: true });
  } catch (error: unknown) {
    return err("SETTING_FAILED", error instanceof Error ? error.message : "Gagal menyimpan pengaturan.");
  }
}

export async function getAuditLogsAction(limit = 100): Promise<Result<{ id: string; action: string; entity: string; actorEmail: string | null; createdAt: string; tenantId: string | null }[]>> {
  try {
    await requirePermission("audit.read");
    const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: Math.min(500, Math.max(1, limit)) });
    return ok(rows.map((row) => ({
      id: row.id, action: row.action, entity: row.entity, actorEmail: row.actorEmail,
      createdAt: row.createdAt.toISOString(), tenantId: row.tenantId,
    })));
  } catch (error: unknown) {
    return err("AUDIT_FAILED", error instanceof Error ? error.message : "Gagal memuat audit.");
  }
}

export async function gdprExportAction(tenantId: string): Promise<Result<{ json: string }>> {
  try {
    const actor = await requirePermission("gdpr.manage");
    const db = tenantClient(tenantId);
    const [tenant, users, guests, rsvps, wishes, events] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      prisma.user.findMany({ where: { tenantId }, select: { id: true, email: true, name: true, createdAt: true } }),
      db.guest.findMany({ where: { tenantId }, take: 10_000 }),
      db.rsvp.findMany({ where: { tenantId }, take: 10_000 }),
      db.wish.findMany({ where: { tenantId }, take: 10_000 }),
      db.event.findMany({ where: { tenantId } }),
    ]);
    await recordAudit({ tenantId, actorId: actor.actorId, actorEmail: actor.actorEmail, action: "gdpr.export", entity: "Tenant", entityId: tenantId });
    return ok({
      json: JSON.stringify({
        exportedAt: new Date().toISOString(),
        tenant: tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug } : null,
        users, events: events.map((event) => ({ id: event.id, title: event.title })),
        guests: guests.map((guest) => ({ id: guest.id, name: guest.name, phoneMasked: guest.phoneMasked, email: guest.email })),
        rsvps: rsvps.map((rsvp) => ({ id: rsvp.id, status: rsvp.status, pax: rsvp.pax, submittedAt: rsvp.submittedAt })),
        wishes: wishes.map((wish) => ({ id: wish.id, authorName: wish.authorName, message: wish.message })),
      }, null, 2),
    });
  } catch (error: unknown) {
    return err("GDPR_FAILED", error instanceof Error ? error.message : "Gagal mengekspor data.");
  }
}

export async function gdprDeleteAction(tenantId: string, confirmName: string): Promise<Result<{ deleted: true }>> {
  try {
    const actor = await requirePermission("gdpr.manage");
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return err("NOT_FOUND", "Tenant tidak ditemukan.");
    if (confirmName.trim() !== tenant.name) return err("CONFIRM_FAILED", "Nama tenant tidak cocok.");
    const db = tenantClient(tenantId);
    const models = [
      db.guestVisit.deleteMany({ where: { tenantId } }), db.checkIn.deleteMany({ where: { tenantId } }),
      db.blastMessage.deleteMany({ where: { tenantId } }), db.rsvp.deleteMany({ where: { tenantId } }),
      db.wish.deleteMany({ where: { tenantId } }), db.guestBookEntry.deleteMany({ where: { tenantId } }),
      db.guest.deleteMany({ where: { tenantId } }), db.notification.deleteMany({ where: { tenantId } }),
      db.eventVersion.deleteMany({ where: { tenantId } }), db.eventSchedule.deleteMany({ where: { tenantId } }),
      db.rsvpForm.deleteMany({ where: { tenantId } }), db.event.deleteMany({ where: { tenantId } }),
      db.mediaAsset.deleteMany({ where: { tenantId } }), db.apiKey.deleteMany({ where: { tenantId } }),
      db.webhookDelivery.deleteMany({ where: { tenantId } }), db.webhook.deleteMany({ where: { tenantId } }),
      db.comment.deleteMany({ where: { tenantId } }), db.quotaUsage.deleteMany({ where: { tenantId } }),
      db.membership.deleteMany({ where: { tenantId } }),
    ];
    await Promise.all(models);
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await recordAudit({ actorId: actor.actorId, actorEmail: actor.actorEmail, action: "gdpr.delete", entity: "Tenant", entityId: tenantId, before: { name: tenant.name } });
    return ok({ deleted: true });
  } catch (error: unknown) {
    return err("GDPR_FAILED", error instanceof Error ? error.message : "Gagal menghapus data.");
  }
}

export async function createTenantUserAction(input: { tenantId: string; email: string; name: string; password: string; role: "TENANT_ADMIN" | "EVENT_OWNER" | "EDITOR" | "CHECKIN_STAFF" }): Promise<Result<{ id: string }>> {
  const parsed = z.object({
    tenantId: z.string(), email: z.string().email(), name: z.string().min(2),
    password: z.string().min(8), role: z.enum(["TENANT_ADMIN", "EVENT_OWNER", "EDITOR", "CHECKIN_STAFF"]),
  }).safeParse(input);
  if (!parsed.success) return err("VALIDATION", "Data pengguna tidak valid.");
  try {
    const actor = await requirePermission("tenant.update");
    const data = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (existing) return err("EMAIL_TAKEN", "Email sudah terdaftar.");
    const user = await prisma.user.create({
      data: {
        tenantId: data.tenantId, email: data.email.toLowerCase(), name: data.name,
        passwordHash: await hashPassword(data.password), platformRole: "USER", status: "ACTIVE",
      },
    });
    await prisma.membership.create({ data: { tenantId: data.tenantId, userId: user.id, role: data.role } });
    await audit(actor, "user.create", "User", user.id, undefined, { tenantId: data.tenantId, role: data.role });
    return ok({ id: user.id });
  } catch (error: unknown) {
    return err("USER_FAILED", error instanceof Error ? error.message : "Gagal membuat pengguna.");
  }
}

export async function setUserStatusAction(userId: string, status: "ACTIVE" | "SUSPENDED"): Promise<Result<{ ok: true }>> {
  try {
    const actor = await requirePermission("tenant.update");
    await prisma.user.update({ where: { id: userId }, data: { status } });
    await audit(actor, "user.status", "User", userId, undefined, { status });
    return ok({ ok: true });
  } catch (error: unknown) {
    return err("USER_FAILED", error instanceof Error ? error.message : "Gagal mengubah status pengguna.");
  }
}

export async function createPayoutAction(referralId: string, amount: number, note: string): Promise<Result<{ id: string }>> {
  try {
    const actor = await requirePermission("system.manage");
    const payout = await prisma.payout.create({ data: { referralId, amount: Math.max(0, amount), note: note.slice(0, 300) } });
    await prisma.referral.update({ where: { id: referralId }, data: { totalEarned: { increment: Math.max(0, amount) } } });
    await audit(actor, "payout.create", "Payout", payout.id, undefined, { amount });
    return ok({ id: payout.id });
  } catch (error: unknown) {
    return err("PAYOUT_FAILED", error instanceof Error ? error.message : "Gagal membuat payout.");
  }
}

export async function backupSettingsAction(): Promise<Result<{ json: string }>> {
  try {
    await requirePermission("system.manage");
    const [settings, flags, plans, templates] = await Promise.all([
      prisma.systemSetting.findMany(), prisma.featureFlag.findMany(), prisma.plan.findMany(), prisma.template.findMany(),
    ]);
    return ok({ json: JSON.stringify({ exportedAt: new Date().toISOString(), settings, flags, plans, templates }, null, 2) });
  } catch (error: unknown) {
    return err("BACKUP_FAILED", error instanceof Error ? error.message : "Gagal membuat backup.");
  }
}

export async function rotateSecretAction(): Promise<Result<{ secret: string }>> {
  try {
    await requirePermission("system.manage");
    return ok({ secret: encrypt(randomToken(24)) });
  } catch (error: unknown) {
    return err("SECRET_FAILED", error instanceof Error ? error.message : "Gagal memutar secret.");
  }
}

export async function listPlansWithLimitsAction(): Promise<Result<{ id: string; code: string; name: string; limits: PlanLimits; features: PlanFeatures }[]>> {
  try {
    await requirePermission("plan.manage");
    const plans = await prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });
    return ok(plans.map((plan) => ({
      id: plan.id, code: plan.code, name: plan.name,
      limits: parseLimits(plan.limits), features: parseFeatures(plan.features),
    })));
  } catch (error: unknown) {
    return err("PLAN_FAILED", error instanceof Error ? error.message : "Gagal memuat paket.");
  }
}

