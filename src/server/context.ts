import { prisma } from "@/lib/db";
import { getSession, type SessionContext } from "@/lib/auth";
import { tenantClient, type TenantDb } from "@/lib/tenant";
import { assertEventAccess, assertPermission, effectiveRole, type Permission, type Role } from "@/lib/rbac";
import { parseFeatures, parseLimits, checkQuota } from "@/lib/billing";
import { AppError } from "@/lib/result";
import { recordAudit } from "@/lib/audit";
import type { Locale, PlanFeatures, PlanLimits } from "@/lib/types";

export interface ActorContext {
  session: SessionContext;
  user: SessionContext["user"];
  actorId: string;
  actorEmail: string;
  tenantId: string;
  tenant: { id: string; name: string; slug: string; status: string; planId: string; branding: unknown } | null;
  role: Role;
  roles: Role[];
  eventIds: string[];
  planCode: string;
  limits: PlanLimits;
  features: PlanFeatures;
  locale: Locale;
  impersonating: boolean;
}

export async function getActor(): Promise<ActorContext | null> {
  const session = await getSession();
  if (!session) return null;
  let tenant: ActorContext["tenant"] = null;
  let planCode = "STARTER";
  let limits = parseLimits(null);
  let features = parseFeatures(null);
  if (session.tenantId) {
    const row = await prisma.tenant.findUnique({ where: { id: session.tenantId } });
    if (row) {
      tenant = { id: row.id, name: row.name, slug: row.slug, status: row.status, planId: row.planId, branding: row.branding };
      const plan = await prisma.plan.findUnique({ where: { id: row.planId } });
      if (plan) {
        planCode = plan.code;
        limits = parseLimits(plan.limits);
        features = parseFeatures(plan.features);
      }
    }
  }
  return {
    session,
    user: session.user,
    actorId: session.actor.id,
    actorEmail: session.actor.email,
    tenantId: session.tenantId ?? "",
    tenant,
    role: effectiveRole(session.roles, session.user.platformRole),
    roles: session.roles,
    eventIds: session.eventIds,
    planCode,
    limits,
    features,
    locale: session.user.locale,
    impersonating: session.impersonating,
  };
}

export async function requireActor(): Promise<ActorContext> {
  const actor = await getActor();
  if (!actor) throw new AppError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  return actor;
}

export async function requirePermission(permission: Permission): Promise<ActorContext> {
  const actor = await requireActor();
  assertPermission(actor.role, permission);
  return actor;
}

export interface EventContext {
  actor: ActorContext;
  db: TenantDb;
  event: {
    id: string; tenantId: string; slug: string; title: string; status: string;
    startsAt: Date; themeId: string; themeConfig: unknown; sections: unknown; settings: unknown; meta: unknown;
  };
}

/** Satu-satunya jalan mengakses acara: cek permission + ownership + tenant scope. */
export async function requireEvent(eventId: string, permission: Permission): Promise<EventContext> {
  const actor = await requireActor();
  if (!actor.tenantId) throw new AppError("FORBIDDEN", "Akun platform tidak memiliki tenant.", 403);
  const db = tenantClient(actor.tenantId);
  const event = await db.event.findFirst({ where: { id: eventId } });
  if (!event) throw new AppError("NOT_FOUND", "Acara tidak ditemukan.", 404);
  assertEventAccess(
    { role: actor.role, eventIds: actor.eventIds, tenantId: actor.tenantId },
    { id: event.id, tenantId: event.tenantId },
    permission,
  );
  return {
    actor, db,
    event: {
      id: event.id, tenantId: event.tenantId, slug: event.slug, title: event.title,
      status: event.status, startsAt: event.startsAt, themeId: event.themeId,
      themeConfig: event.themeConfig, sections: event.sections, settings: event.settings, meta: event.meta,
    },
  };
}

export async function assertQuota(
  actor: ActorContext,
  metric: keyof PlanLimits,
  requested: number,
  current: number,
): Promise<void> {
  const result = checkQuota({ metric, current, requested, limits: actor.limits });
  if (!result.allowed) {
    throw new AppError("QUOTA_EXCEEDED", `Kuota paket ${actor.planCode} tercapai (${result.limit}). Upgrade paket untuk melanjutkan.`, 402);
  }
}

export async function audit(
  actor: ActorContext,
  action: string,
  entity: string,
  entityId?: string,
  before?: unknown,
  after?: unknown,
): Promise<void> {
  await recordAudit({
    tenantId: actor.tenantId || null,
    actorId: actor.actorId,
    actorEmail: actor.actorEmail,
    action, entity, entityId,
    ip: actor.session.ip,
    userAgent: actor.session.userAgent,
    before, after,
  });
}

export function tenantIdOrThrow(actor: ActorContext): string {
  if (!actor.tenantId) throw new AppError("FORBIDDEN", "Aksi ini membutuhkan tenant.", 403);
  return actor.tenantId;
}
