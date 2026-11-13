import { prisma } from "@/lib/db";
import { AppError } from "@/lib/result";

/**
 * Daftar model yang WAJIB memiliki tenantId. Model platform (Plan, Template,
 * Announcement, SystemSetting, ...) tidak termasuk dan diakses via `prisma`.
 */
export const TENANT_SCOPED_MODELS = new Set([
  "Membership", "Subscription", "Invoice", "Transaction", "CouponRedemption",
  "Referral", "Event", "EventVersion", "EventSchedule", "Guest", "RsvpForm",
  "Rsvp", "GuestVisit", "Wish", "GuestBookEntry", "CheckIn", "SeatingTable",
  "Blast", "BlastMessage", "Reminder", "Notification", "ApiKey", "Webhook",
  "WebhookDelivery", "MediaAsset", "Comment", "QuotaUsage",
]);

const READ_OPS = new Set([
  "findMany", "findFirst", "findFirstOrThrow", "count", "aggregate", "groupBy",
  "updateMany", "updateManyAndReturn", "deleteMany",
]);
const UNIQUE_OPS = new Set(["findUnique", "findUniqueOrThrow", "update", "delete"]);

type MutableArgs = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
  create?: Record<string, unknown>;
  [key: string]: unknown;
};

export class TenantIsolationError extends AppError {
  constructor(message = "Akses lintas tenant ditolak.") {
    super("TENANT_ISOLATION", message, 403);
    this.name = "TenantIsolationError";
  }
}

/**
 * Prisma Client yang terikat pada satu tenant. Semua operasi pada model
 * tenant-scoped secara otomatis disuntik `tenantId` pada `where` / `data`.
 * Query `findUnique`/`update`/`delete` ditolak jika pemanggil mencoba
 * memaksa tenant lain. Ini adalah policy check di layer query, bukan UI.
 */
export function tenantClient(tenantId: string) {
  if (!tenantId || typeof tenantId !== "string") throw new TenantIsolationError("tenantId tidak valid.");
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_SCOPED_MODELS.has(model)) return query(args);
          const mutable = (args ?? {}) as MutableArgs;
          const existingWhere = mutable.where ?? {};
          if (existingWhere.tenantId !== undefined && existingWhere.tenantId !== tenantId) {
            throw new TenantIsolationError(`Query ${model}.${operation} mencoba mengakses tenant lain.`);
          }
          if (operation === "create") {
            if (Array.isArray(mutable.data)) throw new TenantIsolationError("Gunakan createMany untuk batch.");
            return query({ ...mutable, data: { ...(mutable.data ?? {}), tenantId } } as typeof args);
          }
          if (operation === "createMany" || operation === "createManyAndReturn") {
            const rows = Array.isArray(mutable.data)
              ? mutable.data
              : [((mutable.data as Record<string, unknown>)?.data ?? mutable.data) as Record<string, unknown>];
            const scoped = rows.map((row) => ({ ...row, tenantId }));
            const next: MutableArgs = Array.isArray(mutable.data)
              ? { ...mutable, data: scoped }
              : { ...mutable, data: { ...(mutable.data as Record<string, unknown>), data: scoped } };
            return query(next as typeof args);
          }
          if (operation === "upsert") {
            return query({
              ...mutable,
              where: { ...existingWhere, tenantId },
              create: { ...(mutable.create ?? {}), tenantId },
            } as typeof args);
          }
          if (READ_OPS.has(operation) || UNIQUE_OPS.has(operation)) {
            return query({ ...mutable, where: { ...existingWhere, tenantId } } as typeof args);
          }
          return query(args);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof tenantClient>;

/** Validasi eksplisit untuk data yang datang dari input publik. */
export function assertSameTenant(expected: string, actual: string): void {
  if (expected !== actual) throw new TenantIsolationError("Referensi data lintas tenant terdeteksi.");
}
