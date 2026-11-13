import { prisma } from "@/lib/db";
import { hashIdentifier, hashIp } from "@/lib/crypto";
import { toNullableJson } from "@/lib/db-json";

export interface AuditInput {
  tenantId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  before?: unknown;
  after?: unknown;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      tenantId: input.tenantId ?? null,
      actorId: input.actorId ?? null,
      actorEmail: input.actorEmail ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      ipHash: hashIp(input.ip ?? null),
      userAgentHash: input.userAgent ? hashIdentifier(input.userAgent) : null,
      before: toNullableJson(input.before),
      after: toNullableJson(input.after),
    },
  });
}
