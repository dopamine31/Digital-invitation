"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { tenantClient } from "@/lib/tenant";
import { requirePermission, requireActor, audit, tenantIdOrThrow } from "@/server/context";
import { encrypt, randomToken, sha256 } from "@/lib/crypto";
import { WEBHOOK_EVENTS } from "@/lib/webhook";
import { dispatchWebhookEvent } from "@/server/webhooks";
import { toInputJson } from "@/lib/db-json";
import { err, ok, type Result } from "@/lib/result";

export async function createApiKeyAction(name: string, scopes: string[]): Promise<Result<{ key: string; prefix: string; secret: string }>> {
  const parsed = z.object({ name: z.string().min(2).max(80), scopes: z.array(z.string()).max(20) }).safeParse({ name, scopes });
  if (!parsed.success) return err("VALIDATION", "Nama API key tidak valid.");
  try {
    const actor = await requirePermission("apikey.manage");
    const tenantId = tenantIdOrThrow(actor);
    const prefix = `rk_${randomToken(4)}`;
    const secret = randomToken(28);
    const key = `${prefix}_${secret}`;
    const hmacSecret = randomToken(24);
    await tenantClient(tenantId).apiKey.create({
      data: { tenantId, name: parsed.data.name, prefix, keyHash: sha256(key), secretEncrypted: encrypt(hmacSecret), scopes: toInputJson(parsed.data.scopes), createdBy: actor.actorId },
    });
    await audit(actor, "apikey.create", "ApiKey", prefix, undefined, { name: parsed.data.name });
    revalidatePath("/app/integrations");
    return ok({ key, prefix, secret: hmacSecret });
  } catch (error: unknown) {
    return err("APIKEY_FAILED", error instanceof Error ? error.message : "Gagal membuat API key.");
  }
}

export async function listApiKeysAction(): Promise<Result<{ id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null }[]>> {
  try {
    const actor = await requirePermission("apikey.manage");
    const rows = await tenantClient(actor.tenantId).apiKey.findMany({ where: { tenantId: actor.tenantId }, orderBy: { createdAt: "desc" } });
    return ok(rows.map((row) => ({
      id: row.id, name: row.name, prefix: row.prefix, createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null, revokedAt: row.revokedAt?.toISOString() ?? null,
    })));
  } catch (error: unknown) {
    return err("APIKEY_FAILED", error instanceof Error ? error.message : "Gagal memuat API key.");
  }
}

export async function revokeApiKeyAction(id: string): Promise<Result<{ ok: true }>> {
  try {
    const actor = await requirePermission("apikey.manage");
    await tenantClient(actor.tenantId).apiKey.update({ where: { id, tenantId: actor.tenantId }, data: { revokedAt: new Date() } });
    await audit(actor, "apikey.revoke", "ApiKey", id);
    return ok({ ok: true });
  } catch (error: unknown) {
    return err("APIKEY_FAILED", error instanceof Error ? error.message : "Gagal mencabut API key.");
  }
}

const hookSchema = z.object({
  id: z.string().optional(), url: z.string().url().max(500),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1), description: z.string().max(200).default(""),
});

export async function saveWebhookAction(input: z.infer<typeof hookSchema>): Promise<Result<{ id: string; secret: string | null }>> {
  const parsed = hookSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", "URL atau event webhook tidak valid.");
  try {
    const actor = await requirePermission("webhook.manage");
    const db = tenantClient(actor.tenantId);
    const data = parsed.data;
    if (data.id) {
      await db.webhook.update({
        where: { id: data.id, tenantId: actor.tenantId },
        data: { url: data.url, events: toInputJson(data.events), description: data.description },
      });
      await audit(actor, "webhook.update", "Webhook", data.id, undefined, { url: data.url });
      return ok({ id: data.id, secret: null });
    }
    const secret = `whsec_${randomToken(24)}`;
    const row = await db.webhook.create({
      data: {
        tenantId: actor.tenantId, url: data.url, events: toInputJson(data.events),
        description: data.description, secretEncrypted: encrypt(secret),
      },
    });
    await audit(actor, "webhook.create", "Webhook", row.id, undefined, { url: data.url });
    revalidatePath("/app/integrations");
    return ok({ id: row.id, secret });
  } catch (error: unknown) {
    return err("WEBHOOK_FAILED", error instanceof Error ? error.message : "Gagal menyimpan webhook.");
  }
}

export async function listWebhooksAction(): Promise<Result<{ id: string; url: string; events: string[]; active: boolean; description: string; deliveries: number }[]>> {
  try {
    const actor = await requirePermission("webhook.manage");
    const db = tenantClient(actor.tenantId);
    const hooks = await db.webhook.findMany({ where: { tenantId: actor.tenantId }, orderBy: { createdAt: "desc" } });
    const deliveries = await db.webhookDelivery.groupBy({ by: ["webhookId"], _count: { _all: true } });
    const counts = new Map(deliveries.map((row) => [row.webhookId, row._count._all]));
    return ok(hooks.map((hook) => ({
      id: hook.id, url: hook.url,
      events: Array.isArray(hook.events) ? (hook.events as unknown[]).map(String) : [],
      active: hook.active, description: hook.description, deliveries: counts.get(hook.id) ?? 0,
    })));
  } catch (error: unknown) {
    return err("WEBHOOK_FAILED", error instanceof Error ? error.message : "Gagal memuat webhook.");
  }
}

export async function deleteWebhookAction(id: string): Promise<Result<{ deleted: true }>> {
  try {
    const actor = await requirePermission("webhook.manage");
    await tenantClient(actor.tenantId).webhook.delete({ where: { id, tenantId: actor.tenantId } });
    await audit(actor, "webhook.delete", "Webhook", id);
    return ok({ deleted: true });
  } catch (error: unknown) {
    return err("WEBHOOK_FAILED", error instanceof Error ? error.message : "Gagal menghapus webhook.");
  }
}

export async function testWebhookAction(): Promise<Result<{ queued: number }>> {
  try {
    const actor = await requirePermission("webhook.manage");
    const queued = await dispatchWebhookEvent(actor.tenantId, "rsvp.created", { test: true, event: "ping", at: new Date().toISOString() });
    return ok({ queued });
  } catch (error: unknown) {
    return err("WEBHOOK_FAILED", error instanceof Error ? error.message : "Gagal mengirim tes webhook.");
  }
}

export async function getIntegrationStatusAction(): Promise<Result<{ apiKeys: number; webhooks: number; deliveries: number }>> {
  try {
    const actor = await requireActor();
    const db = tenantClient(actor.tenantId);
    const [apiKeys, webhooks, deliveries] = await Promise.all([
      db.apiKey.count({ where: { tenantId: actor.tenantId, revokedAt: null } }),
      db.webhook.count({ where: { tenantId: actor.tenantId, active: true } }),
      db.webhookDelivery.count({ where: { tenantId: actor.tenantId } }),
    ]);
    return ok({ apiKeys, webhooks, deliveries });
  } catch (error: unknown) {
    return err("INTEGRATION_FAILED", error instanceof Error ? error.message : "Gagal memuat status.");
  }
}
