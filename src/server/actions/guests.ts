"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireEvent, requirePermission, audit, assertQuota } from "@/server/context";
import { encrypt, maskPhone, normalizePhone, randomToken, sha256, signGuestQr } from "@/lib/crypto";
import { toInputJson } from "@/lib/db-json";
import { AppError, err, ok, type Result } from "@/lib/result";

export interface ImportRow {
  name: string;
  phone?: string;
  email?: string;
  groupLabel?: string;
  paxAllocated?: number;
  notes?: string;
  customFields?: Record<string, string>;
}

const importRowSchema = z.object({
  name: z.string().min(1).max(160),
  phone: z.string().max(25).optional(),
  email: z.string().max(160).optional(),
  groupLabel: z.string().max(80).optional(),
  paxAllocated: z.number().int().min(1).max(20).optional(),
  notes: z.string().max(500).optional(),
  customFields: z.record(z.string().max(500)).optional(),
});

export async function importGuestsAction(eventId: string, rows: ImportRow[]): Promise<Result<{ created: number; duplicates: number; skipped: number; warnings: string[] }>> {
  try {
    const { actor, db } = await requireEvent(eventId, "guest.import");
    if (rows.length > 5_000) return err("TOO_MANY_ROWS", "Maksimal 5.000 baris per impor.");
    const existing = await db.guest.findMany({
      where: { eventId, tenantId: actor.tenantId },
      select: { name: true, phoneHash: true, email: true },
    });
    const names = new Set(existing.map((row) => row.name.trim().toLowerCase()));
    const phones = new Set(existing.map((row) => row.phoneHash).filter((value): value is string => Boolean(value)));
    const emails = new Set(existing.map((row) => row.email?.toLowerCase()).filter((value): value is string => Boolean(value)));
    const currentCount = existing.length;
    const valid: ImportRow[] = [];
    const warnings: string[] = [];
    let duplicates = 0;
    let skipped = 0;
    for (const row of rows) {
      const parsed = importRowSchema.safeParse(row);
      if (!parsed.success) { skipped += 1; continue; }
      const clean = parsed.data;
      const phone = clean.phone ? normalizePhone(clean.phone) : null;
      const phoneHash = phone ? sha256(phone) : null;
      const email = clean.email?.trim().toLowerCase() || null;
      const nameKey = clean.name.trim().toLowerCase();
      if (names.has(nameKey) || (phoneHash && phones.has(phoneHash)) || (email && emails.has(email))) {
        duplicates += 1;
        continue;
      }
      names.add(nameKey);
      if (phoneHash) phones.add(phoneHash);
      if (email) emails.add(email);
      valid.push({ ...clean, phone: phone ?? undefined, email: email ?? undefined });
    }
    await assertQuota(actor, "maxGuestsPerEvent", valid.length, currentCount);
    if (valid.length > 0) {
      const data = await Promise.all(valid.map(async (row) => {
        let token = randomToken(9);
        while (await db.guest.findFirst({ where: { token } })) token = randomToken(9);
        const guestId = `g_${randomToken(12)}`;
        return {
          id: guestId,
          tenantId: actor.tenantId,
          eventId,
          name: row.name.trim(),
          phoneEncrypted: row.phone ? encrypt(row.phone) : null,
          phoneMasked: row.phone ? maskPhone(row.phone) : null,
          phoneHash: row.phone ? sha256(row.phone) : null,
          email: row.email ?? null,
          token,
          qrPayload: signGuestQr(eventId, guestId, randomToken(6)),
          groupLabel: row.groupLabel ?? "Umum",
          tags: toInputJson([]),
          paxAllocated: row.paxAllocated ?? 1,
          customFields: toInputJson(row.customFields ?? {}),
          notes: row.notes ?? null,
        };
      }));
      await db.guest.createMany({ data });
    }
    await audit(actor, "guest.import", "Guest", eventId, undefined, { created: valid.length, duplicates, skipped });
    revalidatePath(`/app/events/${eventId}/guests`);
    if (duplicates > 0) warnings.push(`${duplicates} baris duplikat dilewati (nama/nomor/email sama).`);
    if (skipped > 0) warnings.push(`${skipped} baris tidak valid dilewati.`);
    return ok({ created: valid.length, duplicates, skipped, warnings });
  } catch (error: unknown) {
    if (error instanceof AppError) return err(error.code, error.message);
    return err("IMPORT_FAILED", error instanceof Error ? error.message : "Gagal mengimpor tamu.");
  }
}

const guestSchema = z.object({
  name: z.string().min(1).max(160),
  phone: z.string().max(25).optional(),
  email: z.string().max(160).optional(),
  groupLabel: z.string().max(80).optional(),
  paxAllocated: z.number().int().min(1).max(20).optional(),
  notes: z.string().max(500).optional(),
  seatNumber: z.string().max(20).optional(),
  tableNumber: z.string().max(20).optional(),
});

export async function addGuestAction(eventId: string, input: z.infer<typeof guestSchema>, guestId?: string): Promise<Result<{ id: string; token: string }>> {
  const parsed = guestSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", parsed.error.issues[0]?.message ?? "Data tamu tidak valid.");
  try {
    const { actor, db } = await requireEvent(eventId, "guest.write");
    const data = parsed.data;
    const phone = data.phone ? normalizePhone(data.phone) : null;
    const values = {
      tenantId: actor.tenantId, eventId, name: data.name.trim(),
      phoneEncrypted: phone ? encrypt(phone) : null,
      phoneMasked: phone ? maskPhone(phone) : null,
      phoneHash: phone ? sha256(phone) : null,
      email: data.email?.trim().toLowerCase() || null,
      groupLabel: data.groupLabel ?? "Umum",
      paxAllocated: data.paxAllocated ?? 1,
      notes: data.notes ?? null,
      seatNumber: data.seatNumber ?? null,
      tableNumber: data.tableNumber ?? null,
    };
    if (guestId) {
      await db.guest.update({ where: { id: guestId, tenantId: actor.tenantId }, data: values });
      await audit(actor, "guest.update", "Guest", guestId, undefined, { name: values.name });
      const updated = await db.guest.findFirst({ where: { id: guestId, tenantId: actor.tenantId } });
      return ok({ id: guestId, token: updated?.token ?? "" });
    }
    const count = await db.guest.count({ where: { eventId, tenantId: actor.tenantId } });
    await assertQuota(actor, "maxGuestsPerEvent", 1, count);
    let token = randomToken(9);
    while (await db.guest.findFirst({ where: { token } })) token = randomToken(9);
    const id = `g_${randomToken(12)}`;
    await db.guest.create({
      data: {
        ...values, id, token,
        qrPayload: signGuestQr(eventId, id, randomToken(6)),
        tags: toInputJson([]), customFields: toInputJson({}),
      },
    });
    await audit(actor, "guest.create", "Guest", id, undefined, { name: values.name });
    revalidatePath(`/app/events/${eventId}/guests`);
    return ok({ id, token });
  } catch (error: unknown) {
    if (error instanceof AppError) return err(error.code, error.message);
    return err("GUEST_FAILED", error instanceof Error ? error.message : "Gagal menyimpan tamu.");
  }
}

export async function setGuestFlagAction(eventId: string, guestId: string, flag: "blacklisted" | "optOut", value: boolean): Promise<Result<{ ok: true }>> {
  try {
    const { actor, db } = await requireEvent(eventId, flag === "blacklisted" ? "guest.blacklist" : "guest.write");
    await db.guest.update({ where: { id: guestId, tenantId: actor.tenantId }, data: { [flag]: value } });
    await audit(actor, `guest.${flag}`, "Guest", guestId, undefined, { value });
    revalidatePath(`/app/events/${eventId}/guests`);
    return ok({ ok: true });
  } catch (error: unknown) {
    return err("GUEST_FAILED", error instanceof Error ? error.message : "Gagal mengubah tamu.");
  }
}

export async function deleteGuestAction(eventId: string, guestId: string): Promise<Result<{ deleted: true }>> {
  try {
    const { actor, db } = await requireEvent(eventId, "guest.write");
    await db.guest.delete({ where: { id: guestId, tenantId: actor.tenantId } });
    await audit(actor, "guest.delete", "Guest", guestId);
    revalidatePath(`/app/events/${eventId}/guests`);
    return ok({ deleted: true });
  } catch (error: unknown) {
    return err("GUEST_FAILED", error instanceof Error ? error.message : "Gagal menghapus tamu.");
  }
}

const session = z.object({
  eventId: z.string(),
  guestId: z.string(),
  sessionId: z.string().max(80).nullable(),
  mealChoice: z.string().max(120).nullable(),
});

export async function setGuestRsvpDetailsAction(input: z.infer<typeof session>): Promise<Result<{ ok: true }>> {
  const parsed = session.safeParse(input);
  if (!parsed.success) return err("VALIDATION", "Data tidak valid.");
  try {
    const { actor, db } = await requireEvent(parsed.data.eventId, "rsvp.read");
    await db.rsvp.updateMany({
      where: { eventId: parsed.data.eventId, guestId: parsed.data.guestId, tenantId: actor.tenantId },
      data: { sessionId: parsed.data.sessionId, mealChoice: parsed.data.mealChoice },
    });
    return ok({ ok: true });
  } catch (error: unknown) {
    return err("RSVP_FAILED", error instanceof Error ? error.message : "Gagal menyimpan.");
  }
}

export async function bulkAssignGroupAction(eventId: string, guestIds: string[], groupLabel: string): Promise<Result<{ updated: number }>> {
  try {
    const { actor, db } = await requireEvent(eventId, "guest.write");
    if (guestIds.length > 2_000) return err("TOO_MANY", "Maksimal 2.000 tamu sekali aksi.");
    await db.guest.updateMany({
      where: { eventId, tenantId: actor.tenantId, id: { in: guestIds } },
      data: { groupLabel: groupLabel.slice(0, 80) },
    });
    await audit(actor, "guest.group", "Guest", eventId, undefined, { groupLabel, count: guestIds.length });
    return ok({ updated: guestIds.length });
  } catch (error: unknown) {
    return err("GUEST_FAILED", error instanceof Error ? error.message : "Gagal mengubah grup.");
  }
}

export async function listPersonalLinksAction(eventId: string): Promise<Result<{ name: string; token: string; url: string; groupLabel: string }[]>> {
  try {
    const { actor, db, event } = await requireEvent(eventId, "guest.read");
    const guests = await db.guest.findMany({ where: { eventId, tenantId: actor.tenantId }, orderBy: { name: "asc" }, take: 5_000 });
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return ok(guests.map((guest) => ({
      name: guest.name, token: guest.token, groupLabel: guest.groupLabel,
      url: `${base}/i/${event.slug}?to=${guest.token}`,
    })));
  } catch (error: unknown) {
    return err("LINKS_FAILED", error instanceof Error ? error.message : "Gagal memuat link.");
  }
}

export async function ensureQrForGuestsAction(eventId: string): Promise<Result<{ updated: number }>> {
  try {
    const { actor, db } = await requireEvent(eventId, "guest.write");
    const guests = await db.guest.findMany({ where: { eventId, tenantId: actor.tenantId }, select: { id: true, qrPayload: true } });
    let updated = 0;
    for (const guest of guests) {
      if (guest.qrPayload) continue;
      await db.guest.update({ where: { id: guest.id, tenantId: actor.tenantId }, data: { qrPayload: signGuestQr(eventId, guest.id, randomToken(6)) } });
      updated += 1;
    }
    return ok({ updated });
  } catch (error: unknown) {
    return err("QR_FAILED", error instanceof Error ? error.message : "Gagal membuat QR.");
  }
}

export async function createSignedUploadAction(input: { eventId: string; fileName: string; mime: string; size: number }): Promise<Result<{ key: string; uploadUrl: string; publicUrl: string }>> {
  try {
    const actor = await requirePermission("asset.upload");
    await requireEvent(input.eventId, "event.read");
    const { createSignedUpload } = await import("@/lib/upload");
    const result = await createSignedUpload(actor.tenantId, input.fileName, input.mime, input.size);
    return ok({ key: result.key, uploadUrl: result.uploadUrl, publicUrl: result.publicUrl });
  } catch (error: unknown) {
    return err("UPLOAD_FAILED", error instanceof Error ? error.message : "Gagal membuat signed URL.");
  }
}

export async function registerMediaAssetAction(input: { eventId: string; key: string; originalName: string; mime: string; size: number }): Promise<Result<{ key: string }>> {
  try {
    const { actor, db } = await requireEvent(input.eventId, "asset.upload");
    await db.mediaAsset.create({
      data: {
        tenantId: actor.tenantId, key: input.key, originalName: input.originalName.slice(0, 200),
        mime: input.mime, sizeBytes: input.size, uploadedBy: actor.actorId,
      },
    });
    return ok({ key: input.key });
  } catch (error: unknown) {
    return err("UPLOAD_FAILED", error instanceof Error ? error.message : "Gagal mencatat berkas.");
  }
}

