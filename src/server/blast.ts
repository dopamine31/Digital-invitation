import { prisma } from "@/lib/db";
import { tenantClient } from "@/lib/tenant";
import { enqueue } from "@/lib/queue";
import { decrypt, maskPhone } from "@/lib/crypto";
import { renderTemplate, type BlastVariables } from "@/lib/template-vars";
import { whatsappAdapter } from "@/adapters/whatsapp";
import { emailAdapter } from "@/adapters/email";
import { toInputJson } from "@/lib/db-json";
import { logger } from "@/lib/logger";
import { absoluteUrl, formatDate } from "@/lib/format";
import { parseSettings } from "@/lib/sections";

export interface ProcessBlastResult { total: number; queued: number }

export async function processBlast(tenantId: string, blastId: string): Promise<ProcessBlastResult> {
  const db = tenantClient(tenantId);
  const blast = await db.blast.findFirst({ where: { id: blastId, tenantId } });
  if (!blast || ["COMPLETED", "CANCELLED"].includes(blast.status)) return { total: 0, queued: 0 };
  const event = await db.event.findFirst({ where: { id: blast.eventId, tenantId } });
  if (!event) throw new Error("Acara untuk blast tidak ditemukan.");
  const filters = (blast.filters ?? {}) as Record<string, unknown>;
  const groups = Array.isArray(filters.groups) ? (filters.groups as unknown[]).map(String) : [];
  const guests = await db.guest.findMany({
    where: {
      eventId: blast.eventId, tenantId,
      blacklisted: false, optOut: false,
      ...(groups.length > 0 ? { groupLabel: { in: groups } } : {}),
    },
    orderBy: { name: "asc" },
  });
  const settings = parseSettings(event.settings, event.title);
  const existing = await db.blastMessage.findMany({ where: { blastId, tenantId }, select: { guestId: true } });
  const already = new Set(existing.map((row) => row.guestId));
  const pending = guests.filter((guest) => !already.has(guest.id));
  if (pending.length > 0) {
    await db.blastMessage.createMany({
      data: pending.map((guest) => {
        const variables: BlastVariables = {
          nama: guest.name,
          link: absoluteUrl(`/i/${event.slug}?to=${guest.token}`),
          acara: event.title,
          pic_nama: settings.pic.name,
          pic_hp: settings.pic.phone,
          tanggal: formatDate(event.startsAt, "dd MMMM yyyy", "id"),
          grup: guest.groupLabel,
          pax: String(guest.paxAllocated),
        };
        return {
          tenantId, blastId, guestId: guest.id,
          toMasked: maskPhone(guest.phoneEncrypted ? decrypt(guest.phoneEncrypted) : guest.phoneMasked) ?? guest.email ?? "***",
          body: renderTemplate(blast.templateBody, variables),
          status: "QUEUED" as const,
        };
      }),
    });
  }
  await db.blast.update({
    where: { id: blastId, tenantId },
    data: { status: "PROCESSING", total: guests.length, startedAt: blast.startedAt ?? new Date() },
  });
  const messages = await db.blastMessage.findMany({
    where: { blastId, tenantId, status: "QUEUED" }, orderBy: { createdAt: "asc" },
  });
  const perMinute = Math.max(1, blast.throttlePerMinute);
  const spacingMs = Math.max(0, Math.round(60_000 / perMinute));
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (!message) continue;
    await enqueue(
      { kind: "blast.message", tenantId, blastId, messageId: message.id },
      { delay: index * spacingMs, jobId: `blastmsg-${message.id}` },
    );
  }
  return { total: guests.length, queued: messages.length };
}

export async function sendBlastMessage(tenantId: string, blastId: string, messageId: string): Promise<void> {
  const db = tenantClient(tenantId);
  const message = await db.blastMessage.findFirst({ where: { id: messageId, tenantId } });
  if (!message || message.status !== "QUEUED") return;
  const blast = await db.blast.findFirst({ where: { id: blastId, tenantId } });
  const guest = await db.guest.findFirst({ where: { id: message.guestId, tenantId } });
  if (!blast || !guest) return;
  const recipientPhone = guest.phoneEncrypted ? decrypt(guest.phoneEncrypted) : guest.phoneMasked ?? "";
  const recipientEmail = guest.email ?? "";
  const result = blast.channel === "EMAIL"
    ? await emailAdapter().send({ to: recipientEmail, subject: `Undangan: ${blast.name}`, html: `<p>${message.body.replace(/\n/g, "<br/>")}</p>`, tenantId })
    : await whatsappAdapter().send({ to: recipientPhone, body: message.body, tenantId, templateKey: blast.name });
  await db.blastMessage.update({
    where: { id: messageId, tenantId },
    data: {
      status: result.ok ? "SENT" : "FAILED",
      error: result.error ?? null,
      providerMessageId: result.messageId,
      sentAt: result.ok ? new Date() : null,
    },
  });
  await db.blast.update({
    where: { id: blastId, tenantId },
    data: result.ok ? { sent: { increment: 1 } } : { failed: { increment: 1 } },
  });
  await prisma.notificationLog.create({
    data: {
      tenantId, channel: blast.channel, provider: result.provider,
      toMasked: message.toMasked, templateKey: blast.name,
      payload: toInputJson({ body: message.body.slice(0, 300) }),
      status: result.ok ? "SENT" : "FAILED",
      response: toInputJson(result.response),
    },
  });
  const remaining = await db.blastMessage.count({ where: { blastId, tenantId, status: "QUEUED" } });
  if (remaining === 0) {
    await db.blast.update({ where: { id: blastId, tenantId }, data: { status: "COMPLETED", finishedAt: new Date() } });
    logger.info("blast selesai", { tenantId, blastId });
  }
}

export async function scheduleReminders(tenantId: string, eventId: string, templateBody: string, createdBy: string): Promise<number> {
  const db = tenantClient(tenantId);
  const event = await db.event.findFirst({ where: { id: eventId, tenantId } });
  if (!event) throw new Error("Acara tidak ditemukan.");
  const offsets = [7, 3, 1];
  let count = 0;
  for (const offsetDays of offsets) {
    const scheduledFor = new Date(event.startsAt.getTime() - offsetDays * 24 * 3600_000);
    if (scheduledFor <= new Date()) continue;
    const existing = await db.reminder.findFirst({ where: { eventId, tenantId, offsetDays, status: "SCHEDULED" } });
    if (existing) continue;
    const reminder = await db.reminder.create({
      data: {
        tenantId, eventId, offsetDays, channel: "WHATSAPP",
        templateBody, scheduledFor, status: "SCHEDULED",
      },
    });
    const jobId = await enqueue(
      { kind: "reminder.process", tenantId, eventId, reminderId: reminder.id, createdBy },
      { delay: scheduledFor.getTime() - Date.now(), jobId: `reminder-${reminder.id}` },
    );
    await db.reminder.update({ where: { id: reminder.id, tenantId }, data: { jobId } });
    count += 1;
  }
  return count;
}

export async function processReminder(tenantId: string, eventId: string, reminderId: string, createdBy: string): Promise<void> {
  const db = tenantClient(tenantId);
  const reminder = await db.reminder.findFirst({ where: { id: reminderId, tenantId } });
  if (!reminder || reminder.status !== "SCHEDULED") return;
  const blast = await db.blast.create({
    data: {
      tenantId, eventId, channel: reminder.channel,
      name: `Pengingat H-${reminder.offsetDays}`,
      templateBody: reminder.templateBody,
      status: "SCHEDULED",
      throttlePerMinute: 60,
      createdBy,
    },
  });
  await db.reminder.update({ where: { id: reminderId, tenantId }, data: { status: "PROCESSED", blastId: blast.id } });
  await processBlast(tenantId, blast.id);
}
