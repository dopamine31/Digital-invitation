import type { JobPayload } from "@/lib/queue";
import { prisma } from "@/lib/db";
import { createWorker } from "@/lib/queue";
import { whatsappAdapter } from "@/adapters/whatsapp";
import { emailAdapter } from "@/adapters/email";
import { toInputJson } from "@/lib/db-json";
import { logger } from "@/lib/logger";
import { processBlast, sendBlastMessage, processReminder } from "@/server/blast";
import { deliverWebhook } from "@/server/webhooks";

function str(payload: JobPayload, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

export async function processJob(payload: JobPayload): Promise<void> {
  switch (payload.kind) {
    case "blast.process": {
      await processBlast(str(payload, "tenantId"), str(payload, "blastId"));
      return;
    }
    case "blast.message": {
      await sendBlastMessage(str(payload, "tenantId"), str(payload, "blastId"), str(payload, "messageId"));
      return;
    }
    case "reminder.process": {
      await processReminder(str(payload, "tenantId"), str(payload, "eventId"), str(payload, "reminderId"), str(payload, "createdBy"));
      return;
    }
    case "notification.send": {
      const channel = str(payload, "channel");
      const to = str(payload, "to");
      const body = str(payload, "body");
      const tenantId = str(payload, "tenantId") || null;
      const result = channel === "EMAIL"
        ? await emailAdapter().send({ to, subject: str(payload, "title"), html: `<p>${body.replace(/</g, "&lt;").replace(/\n/g, "<br/>")}</p>`, tenantId: tenantId ?? undefined })
        : await whatsappAdapter().send({ to, body, tenantId: tenantId ?? undefined, templateKey: str(payload, "eventType") });
      await prisma.notificationLog.create({
        data: {
          tenantId,
          channel,
          provider: result.provider,
          toMasked: str(payload, "toMasked"),
          templateKey: str(payload, "eventType"),
          payload: toInputJson({ title: str(payload, "title"), body: body.slice(0, 300) }),
          status: result.ok ? "SENT" : "FAILED",
          response: toInputJson(result.response),
        },
      });
      return;
    }
    case "webhook.deliver": {
      await deliverWebhook(str(payload, "deliveryId"));
      return;
    }
    default: {
      const exhaustive: never = payload.kind;
      throw new Error(`Job tidak dikenal: ${String(exhaustive)}`);
    }
  }
}

export function startWorker(): void {
  const worker = createWorker();
  if (!worker) {
    logger.warn("REDIS_URL kosong: worker tidak aktif, job diproses inline oleh aplikasi", {});
    return;
  }
  logger.info("BullMQ worker aktif", { queue: "rasa-jobs" });
  const shutdown = async () => {
    await worker.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => { void shutdown(); });
  process.on("SIGINT", () => { void shutdown(); });
}

/** Digunakan saat startup untuk mencoba ulang delivery yang tertunda. */
export async function retryPendingWebhooks(): Promise<void> {
  const pending = await prisma.webhookDelivery.findMany({
    where: { status: "RETRY", nextRetryAt: { lte: new Date() } }, take: 50,
  });
  for (const item of pending) {
    try { await deliverWebhook(item.id); } catch { /* backoff berikutnya */ }
  }
}

