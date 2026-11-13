import { AppError } from "@/lib/result";

export type Role =
  | "SUPER_ADMIN" | "TENANT_ADMIN" | "EVENT_OWNER" | "CO_HOST"
  | "EDITOR" | "CHECKIN_STAFF" | "VIEWER" | "GUEST";

export type Permission =
  | "tenant.read" | "tenant.update" | "tenant.billing" | "tenant.suspend"
  | "event.create" | "event.read" | "event.update" | "event.delete"
  | "event.publish" | "event.duplicate" | "event.version" | "event.archive"
  | "theme.update" | "section.update" | "asset.upload" | "custom.code"
  | "guest.read" | "guest.write" | "guest.import" | "guest.export" | "guest.blacklist"
  | "rsvp.form" | "rsvp.read" | "rsvp.export"
  | "blast.create" | "blast.send" | "blast.read"
  | "checkin.write" | "checkin.read"
  | "analytics.read" | "analytics.export"
  | "team.manage" | "comment.write" | "comment.read"
  | "apikey.manage" | "webhook.manage"
  | "billing.read" | "billing.manage" | "invoice.read"
  | "moderation.manage" | "template.manage" | "plan.manage" | "coupon.manage"
  | "announcement.manage" | "featureflag.manage" | "system.manage"
  | "audit.read" | "impersonate" | "gdpr.manage" | "kpi.read";

const OWNER_PERMISSIONS: Permission[] = [
  "tenant.read", "tenant.update", "tenant.billing",
  "event.create", "event.read", "event.update", "event.delete", "event.publish",
  "event.duplicate", "event.version", "event.archive",
  "theme.update", "section.update", "asset.upload", "custom.code",
  "guest.read", "guest.write", "guest.import", "guest.export", "guest.blacklist",
  "rsvp.form", "rsvp.read", "rsvp.export",
  "blast.create", "blast.send", "blast.read",
  "checkin.write", "checkin.read",
  "analytics.read", "analytics.export",
  "team.manage", "comment.write", "comment.read",
  "apikey.manage", "webhook.manage",
  "billing.read", "billing.manage", "invoice.read",
];

const ALL_PERMISSIONS: Permission[] = [
  ...new Set<Permission>([
    ...OWNER_PERMISSIONS,
    "tenant.suspend", "moderation.manage", "template.manage", "plan.manage",
    "coupon.manage", "announcement.manage", "featureflag.manage", "system.manage",
    "audit.read", "impersonate", "gdpr.manage", "kpi.read",
  ]),
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  TENANT_ADMIN: OWNER_PERMISSIONS,
  EVENT_OWNER: OWNER_PERMISSIONS,
  CO_HOST: [
    "event.read", "event.update", "event.publish", "theme.update", "section.update",
    "asset.upload", "guest.read", "guest.write", "guest.import", "guest.export",
    "rsvp.form", "rsvp.read", "blast.read", "blast.create", "blast.send",
    "checkin.read", "checkin.write", "analytics.read", "comment.read", "comment.write",
    "billing.read", "invoice.read",
  ],
  EDITOR: [
    "event.read", "event.update", "theme.update", "section.update", "asset.upload",
    "guest.read", "rsvp.read", "comment.read", "comment.write",
  ],
  CHECKIN_STAFF: ["event.read", "guest.read", "checkin.read", "checkin.write", "rsvp.read"],
  VIEWER: ["event.read", "guest.read", "rsvp.read", "analytics.read", "comment.read"],
  GUEST: [],
};

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  TENANT_ADMIN: "Admin Tenant / Reseller",
  EVENT_OWNER: "Owner Acara",
  CO_HOST: "Co-Host",
  EDITOR: "Editor",
  CHECKIN_STAFF: "Panitia / Check-in",
  VIEWER: "Viewer",
  GUEST: "Tamu",
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Role tertinggi menang. Super Admin selalu lolos. */
export function effectiveRole(roles: readonly Role[], platformRole?: string): Role {
  if (platformRole === "SUPER_ADMIN" || roles.includes("SUPER_ADMIN")) return "SUPER_ADMIN";
  const order: Role[] = ["TENANT_ADMIN", "EVENT_OWNER", "CO_HOST", "EDITOR", "CHECKIN_STAFF", "VIEWER", "GUEST"];
  return order.find((role) => roles.includes(role)) ?? "VIEWER";
}

export function assertPermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new AppError("FORBIDDEN", `Peran ${ROLE_LABELS[role]} tidak memiliki izin ${permission}.`, 403);
  }
}

/** Ownership check: peran dengan scope acara hanya boleh menyentuh acara yang diberikan. */
export interface EventScopedActor {
  role: Role;
  eventIds: readonly string[];
  tenantId: string;
}

export function canAccessEvent(actor: EventScopedActor, event: { id: string; tenantId: string }): boolean {
  if (actor.tenantId !== event.tenantId) return false;
  if (actor.role === "SUPER_ADMIN") return true;
  if (["TENANT_ADMIN", "EVENT_OWNER"].includes(actor.role)) return true;
  return actor.eventIds.includes(event.id);
}

export function assertEventAccess(actor: EventScopedActor, event: { id: string; tenantId: string }, permission: Permission): void {
  assertPermission(actor.role, permission);
  if (!canAccessEvent(actor, event)) {
    throw new AppError("FORBIDDEN", "Anda tidak memiliki akses ke acara ini.", 403);
  }
}
