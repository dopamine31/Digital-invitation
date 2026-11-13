import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { enqueue } from "@/lib/queue";
import { webhookHeaders, type WebhookEvent } from "@/lib/webhook";
import { logger } from "@/lib/logger";
import { toInputJson } from "@/lib/db-json";

export async function dispatchWebhookEvent(
  tenantId: string,
  eventType: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<number> {
  const hooks = await prisma.webhook.findMany({ where: { tenantId, active: true } });
  const matching = hooks.filter((hook) => {
    const events = Array.isArray(hook.events) ? (hook.events as unknown[]).map(String) : [];
    return events.includes(eventType);
  });
  const body = JSON.stringify({ id: `evt_${Date.now().toString(36)}`, event: eventType, createdAt: new Date().toISOString(), data: payload });
  for (const hook of matching) {
    let secret = "";
    try { secret = decrypt(hook.secretEncrypted); } catch { secret = ""; }
    const signature = secret ? webhookHeaders(secret, body, eventType, hook.id)["X-Rasa-Signature"] ?? "" : "";
    const delivery = await prisma.webhookDelivery.create({
      data: {
        tenantId, webhookId: hook.id, eventType,
        payload: toInputJson(JSON.parse(body) as unknown),
        signature,
        status: "PENDING",
      },
    });
    await enqueue({ kind: "webhook.deliver", deliveryId: delivery.id });
  }
  return matching.length;
}

export async function deliverWebhook(deliveryId: string): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
  if (!delivery || delivery.status === "DELIVERED") return;
  const hook = await prisma.webhook.findFirst({ where: { id: delivery.webhookId, tenantId: delivery.tenantId } });
  if (!hook) {
    await prisma.webhookDelivery.update({ where: { id: deliveryId }, data: { status: "FAILED", lastError: "Webhook tidak ditemukan." } });
    return;
  }
  const body = JSON.stringify(delivery.payload);
  let secret = "";
  try { secret = decrypt(hook.secretEncrypted); } catch { secret = ""; }
  const headers = webhookHeaders(secret, body, delivery.eventType as WebhookEvent, delivery.id);
  try {
    const response = await fetch(hook.url, { method: "POST", headers, body, signal: AbortSignal.timeout(10_000) });
    const ok = response.ok;
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        attempts: { increment: 1 },
        status: ok ? "DELIVERED" : "RETRY",
        lastError: ok ? null : `HTTP ${response.status}`,
        deliveredAt: ok ? new Date() : null,
        nextRetryAt: ok ? null : new Date(Date.now() + 60_000),
      },
    });
  } catch (error: unknown) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        attempts: { increment: 1 }, status: "RETRY",
        lastError: error instanceof Error ? error.message.slice(0, 200) : "network error",
        nextRetryAt: new Date(Date.now() + 60_000),
      },
    });
    logger.warn("webhook delivery gagal", { deliveryId, error: error instanceof Error ? error.message : "unknown" });
    throw error;
  }
}
