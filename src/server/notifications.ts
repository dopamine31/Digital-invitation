import { prisma } from "@/lib/db";
import { enqueue } from "@/lib/queue";
import { toInputJson } from "@/lib/db-json";
import { maskPhone } from "@/lib/crypto";
import { logger } from "@/lib/logger";

export interface NotificationTarget {
  channel: "WHATSAPP" | "EMAIL" | "IN_APP";
  to: string;
  toMasked: string;
  userId?: string | null;
}

export interface NotifyInput {
  tenantId: string;
  eventId?: string;
  eventType: string;
  title: string;
  body: string;
  targets: NotificationTarget[];
  payload?: Record<string, unknown>;
}

/**
 * Notifikasi internal (dashboard) + antrean pengiriman ke adapter.
 * Untuk RSVP, targetnya selalu owner/PIC acara (lihat notifyRsvpEvent).
 */
export async function notify(input: NotifyInput): Promise<void> {
  const inApp = input.targets.filter((target) => target.channel === "IN_APP");
  if (inApp.length > 0) {
    await prisma.notification.createMany({
      data: inApp.map((target) => ({
        tenantId: input.tenantId,
        userId: target.userId ?? null,
        channel: "IN_APP" as const,
        eventType: input.eventType,
        title: input.title,
        body: input.body,
        toMasked: target.toMasked,
        status: "SENT",
        payload: toInputJson(input.payload ?? {}),
      })),
    });
  }
  for (const target of input.targets.filter((item) => item.channel !== "IN_APP")) {
    await enqueue({
      kind: "notification.send",
      tenantId: input.tenantId,
      channel: target.channel,
      to: target.to,
      toMasked: target.toMasked,
      eventType: input.eventType,
      title: input.title,
      body: input.body,
    });
  }
}

/** Ambil owner/admin tenant + PIC sebagai target notifikasi RSVP / check-in. */
export async function eventNotificationTargets(tenantId: string, picPhone: string | null, picEmail?: string | null): Promise<NotificationTarget[]> {
  const memberships = await prisma.membership.findMany({
    where: { tenantId, role: { in: ["TENANT_ADMIN", "EVENT_OWNER"] } },
  });
  const users = await prisma.user.findMany({ where: { id: { in: memberships.map((m) => m.userId) } } });
  const targets: NotificationTarget[] = users.map((user) => ({
    channel: "IN_APP" as const,
    to: user.email,
    toMasked: user.email.replace(/^(.{2}).*(@.*)$/, "$1***$2"),
    userId: user.id,
  }));
  for (const user of users) {
    targets.push({ channel: "EMAIL", to: user.email, toMasked: user.email.replace(/^(.{2}).*(@.*)$/, "$1***$2"), userId: user.id });
  }
  if (picPhone) {
    targets.push({ channel: "WHATSAPP", to: picPhone, toMasked: maskPhone(picPhone) ?? "***" });
  }
  if (picEmail) {
    targets.push({ channel: "EMAIL", to: picEmail, toMasked: picEmail.replace(/^(.{2}).*(@.*)$/, "$1***$2") });
  }
  return targets;
}

export async function notifyRsvpEvent(input: {
  tenantId: string;
  eventId: string;
  eventTitle: string;
  guestName: string;
  status: string;
  pax: number;
  picPhone: string | null;
  isUpdate: boolean;
}): Promise<void> {
  const statusLabel: Record<string, string> = { ATTENDING: "HADIR", DECLINED: "TIDAK HADIR", MAYBE: "MUNGKIN HADIR" };
  const title = input.isUpdate ? "RSVP diperbarui" : "RSVP baru masuk";
  const body = `${input.guestName} → ${statusLabel[input.status] ?? input.status} (${input.pax} tamu) untuk ${input.eventTitle}.`;
  try {
    const targets = await eventNotificationTargets(input.tenantId, input.picPhone);
    await notify({
      tenantId: input.tenantId, eventId: input.eventId,
      eventType: input.isUpdate ? "rsvp.updated" : "rsvp.created",
      title, body, targets,
      payload: { guestName: input.guestName, pax: input.pax, status: input.status },
    });
  } catch (error: unknown) {
    logger.error("gagal mengantre notifikasi RSVP", { error: error instanceof Error ? error.message : "unknown", eventId: input.eventId });
  }
}
