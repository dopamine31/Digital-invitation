"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireEvent, audit, assertQuota } from "@/server/context";
import { enqueue } from "@/lib/queue";
import { scheduleReminders } from "@/server/blast";
import { extractVariables, BLAST_VARIABLE_KEYS } from "@/lib/template-vars";
import { toInputJson } from "@/lib/db-json";
import { AppError, err, ok, type Result } from "@/lib/result";

const blastSchema = z.object({
  eventId: z.string(),
  name: z.string().min(2).max(120),
  templateBody: z.string().min(5).max(2000),
  channel: z.enum(["WHATSAPP", "EMAIL"]).default("WHATSAPP"),
  groups: z.array(z.string()).default([]),
  scheduledAt: z.string().nullable().default(null),
  throttlePerMinute: z.number().int().min(1).max(600).default(60),
});

export async function createBlastAction(input: z.infer<typeof blastSchema>): Promise<Result<{ blastId: string; queued: boolean }>> {
  const parsed = blastSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", parsed.error.issues[0]?.message ?? "Data blast tidak valid.");
  const unknownVars = extractVariables(parsed.data.templateBody).filter((key) => !BLAST_VARIABLE_KEYS.includes(key as never));
  if (unknownVars.length > 0) return err("VALIDATION", `Variabel tidak dikenal: ${unknownVars.join(", ")}`);
  try {
    const { actor, db } = await requireEvent(parsed.data.eventId, "blast.send");
    const period = new Date().toISOString().slice(0, 7);
    const usage = await db.quotaUsage.findFirst({ where: { tenantId: actor.tenantId, metric: "blasts", period } });
    await assertQuota(actor, "maxBlastsPerMonth", 1, usage?.used ?? 0);
    await db.quotaUsage.upsert({
      where: { tenantId_metric_period: { tenantId: actor.tenantId, metric: "blasts", period } },
      create: { tenantId: actor.tenantId, metric: "blasts", period, used: 1 },
      update: { used: { increment: 1 } },
    });
    const scheduledAt = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null;
    if (scheduledAt && Number.isNaN(scheduledAt.getTime())) return err("VALIDATION", "Jadwal tidak valid.");
    const blast = await db.blast.create({
      data: {
        tenantId: actor.tenantId, eventId: parsed.data.eventId,
        channel: parsed.data.channel, name: parsed.data.name,
        templateBody: parsed.data.templateBody,
        filters: toInputJson({ groups: parsed.data.groups }),
        scheduledAt, status: scheduledAt ? "SCHEDULED" : "PROCESSING",
        throttlePerMinute: parsed.data.throttlePerMinute,
        createdBy: actor.actorId,
      },
    });
    await enqueue(
      { kind: "blast.process", tenantId: actor.tenantId, blastId: blast.id },
      { delay: scheduledAt ? Math.max(0, scheduledAt.getTime() - Date.now()) : 0, jobId: `blast-${blast.id}` },
    );
    await audit(actor, "blast.create", "Blast", blast.id, undefined, { channel: parsed.data.channel, groups: parsed.data.groups });
    revalidatePath(`/app/events/${parsed.data.eventId}/blast`);
    return ok({ blastId: blast.id, queued: true });
  } catch (error: unknown) {
    if (error instanceof AppError) return err(error.code, error.message);
    return err("BLAST_FAILED", error instanceof Error ? error.message : "Gagal membuat blast.");
  }
}

export async function scheduleRemindersAction(eventId: string, templateBody: string): Promise<Result<{ scheduled: number }>> {
  try {
    const { actor } = await requireEvent(eventId, "blast.send");
    const scheduled = await scheduleReminders(actor.tenantId, eventId, templateBody.slice(0, 2000), actor.actorId);
    await audit(actor, "reminder.schedule", "Reminder", eventId, undefined, { scheduled });
    return ok({ scheduled });
  } catch (error: unknown) {
    return err("REMINDER_FAILED", error instanceof Error ? error.message : "Gagal menjadwalkan pengingat.");
  }
}

export async function cancelBlastAction(eventId: string, blastId: string): Promise<Result<{ cancelled: true }>> {
  try {
    const { actor, db } = await requireEvent(eventId, "blast.send");
    await db.blast.update({ where: { id: blastId, tenantId: actor.tenantId }, data: { status: "CANCELLED" } });
    await db.blastMessage.updateMany({ where: { blastId, tenantId: actor.tenantId, status: "QUEUED" }, data: { status: "FAILED", error: "Dibatalkan" } });
    await audit(actor, "blast.cancel", "Blast", blastId);
    return ok({ cancelled: true });
  } catch (error: unknown) {
    return err("BLAST_FAILED", error instanceof Error ? error.message : "Gagal membatalkan blast.");
  }
}

export async function retryBlastAction(eventId: string, blastId: string): Promise<Result<{ queued: true }>> {
  try {
    const { actor, db } = await requireEvent(eventId, "blast.send");
    await db.blastMessage.updateMany({ where: { blastId, tenantId: actor.tenantId, status: "FAILED" }, data: { status: "QUEUED", error: null } });
    await db.blast.update({ where: { id: blastId, tenantId: actor.tenantId }, data: { status: "PROCESSING" } });
    await enqueue({ kind: "blast.process", tenantId: actor.tenantId, blastId });
    return ok({ queued: true });
  } catch (error: unknown) {
    return err("BLAST_FAILED", error instanceof Error ? error.message : "Gagal mengulang blast.");
  }
}
