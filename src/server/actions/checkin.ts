"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireEvent, audit } from "@/server/context";
import { tenantClient } from "@/lib/tenant";
import { verifyGuestQr, encrypt, maskPhone, normalizePhone, randomToken, sha256, signGuestQr } from "@/lib/crypto";
import { toInputJson } from "@/lib/db-json";
import { AppError, err, ok, type Result } from "@/lib/result";
import { dispatchWebhookEvent } from "@/server/webhooks";
import { logger } from "@/lib/logger";

const qrSchema = z.object({
  eventId: z.string(),
  payload: z.string().min(10),
  station: z.string().max(60).default("loket-1"),
  deviceId: z.string().max(80).default("web"),
  offline: z.boolean().default(false),
});

export interface CheckInOutcome {
  guestId: string;
  guestName: string;
  groupLabel: string;
  tableNumber: string | null;
  seatNumber: string | null;
  at: string;
  duplicate: boolean;
}

async function performCheckIn(
  tenantId: string,
  eventId: string,
  guestId: string,
  station: string,
  deviceId: string,
  method: string,
  offline: boolean,
  actorId?: string,
): Promise<CheckInOutcome> {
  const db = tenantClient(tenantId);
  const guest = await db.guest.findFirst({ where: { id: guestId, eventId, tenantId } });
  if (!guest) throw new AppError("GUEST_NOT_FOUND", "Tamu tidak terdaftar pada acara ini.", 404);
  if (guest.blacklisted) throw new AppError("BLACKLISTED", "Tamu masuk daftar blacklist.", 403);
  const previous = await db.checkIn.findFirst({ where: { eventId, guestId, tenantId } });
  if (previous) {
    return { guestId, guestName: guest.name, groupLabel: guest.groupLabel, tableNumber: guest.tableNumber, seatNumber: guest.seatNumber, at: previous.at.toISOString(), duplicate: true };
  }
  try {
    await db.checkIn.create({
      data: {
        tenantId, eventId, guestId, station, deviceId, method,
        syncedFromOffline: offline, actorId: actorId ?? null,
      },
    });
  } catch (error: unknown) {
    const code = (error as { code?: string }).code;
    if (code === "P2002") {
      const existing = await db.checkIn.findFirst({ where: { eventId, guestId, tenantId } });
      if (existing) return { guestId, guestName: guest.name, groupLabel: guest.groupLabel, tableNumber: guest.tableNumber, seatNumber: guest.seatNumber, at: existing.at.toISOString(), duplicate: true };
    }
    throw error;
  }
  await dispatchWebhookEvent(tenantId, "guest.checked_in", {
    eventId, guestId, guestName: guest.name, station, deviceId, at: new Date().toISOString(),
  });
  return { guestId, guestName: guest.name, groupLabel: guest.groupLabel, tableNumber: guest.tableNumber, seatNumber: guest.seatNumber, at: new Date().toISOString(), duplicate: false };
}

export async function checkInByQrAction(input: z.infer<typeof qrSchema>): Promise<Result<CheckInOutcome>> {
  const parsed = qrSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", "Payload QR tidak valid.");
  try {
    const { actor } = await requireEvent(parsed.data.eventId, "checkin.write");
    const decoded = verifyGuestQr(parsed.data.payload);
    if (!decoded) return err("QR_INVALID", "QR tidak valid atau sudah diubah.");
    if (decoded.eventId !== parsed.data.eventId) return err("QR_MISMATCH", "QR ini untuk acara lain.");
    const outcome = await performCheckIn(
      actor.tenantId, parsed.data.eventId, decoded.guestId,
      parsed.data.station, parsed.data.deviceId, "QR", parsed.data.offline, actor.actorId,
    );
    await audit(actor, "checkin.scan", "CheckIn", outcome.guestId, undefined, { duplicate: outcome.duplicate, station: parsed.data.station });
    revalidatePath(`/app/events/${parsed.data.eventId}/checkin`);
    return ok(outcome);
  } catch (error: unknown) {
    if (error instanceof AppError) return err(error.code, error.message);
    logger.error("check-in QR gagal", { error: error instanceof Error ? error.message : "unknown" });
    return err("CHECKIN_FAILED", error instanceof Error ? error.message : "Gagal check-in.");
  }
}

export async function checkInManualAction(eventId: string, guestId: string, station = "loket-1"): Promise<Result<CheckInOutcome>> {
  try {
    const { actor } = await requireEvent(eventId, "checkin.write");
    const outcome = await performCheckIn(actor.tenantId, eventId, guestId, station, "manual", "MANUAL", false, actor.actorId);
    await audit(actor, "checkin.manual", "CheckIn", guestId, undefined, { duplicate: outcome.duplicate });
    revalidatePath(`/app/events/${eventId}/checkin`);
    return ok(outcome);
  } catch (error: unknown) {
    if (error instanceof AppError) return err(error.code, error.message);
    return err("CHECKIN_FAILED", error instanceof Error ? error.message : "Gagal check-in.");
  }
}

export async function searchGuestsForCheckInAction(eventId: string, query: string): Promise<Result<{ id: string; name: string; groupLabel: string; checkedIn: boolean; tableNumber: string | null }[]>> {
  try {
    const { actor, db } = await requireEvent(eventId, "checkin.read");
    const term = query.trim().slice(0, 80);
    if (term.length < 2) return ok([]);
    const guests = await db.guest.findMany({
      where: {
        eventId, tenantId: actor.tenantId,
        OR: [{ name: { contains: term, mode: "insensitive" } }, { token: { contains: term } }],
      },
      take: 20, orderBy: { name: "asc" },
    });
    const checkIns = await db.checkIn.findMany({
      where: { eventId, tenantId: actor.tenantId, guestId: { in: guests.map((guest) => guest.id) } },
      select: { guestId: true },
    });
    const done = new Set(checkIns.map((item) => item.guestId));
    return ok(guests.map((guest) => ({
      id: guest.id, name: guest.name, groupLabel: guest.groupLabel,
      checkedIn: done.has(guest.id), tableNumber: guest.tableNumber,
    })));
  } catch (error: unknown) {
    return err("SEARCH_FAILED", error instanceof Error ? error.message : "Gagal mencari tamu.");
  }
}

const walkInSchema = z.object({ eventId: z.string(), name: z.string().min(2).max(160), phone: z.string().max(25).optional(), pax: z.number().int().min(1).max(10).default(1) });

export async function createWalkInAction(input: z.infer<typeof walkInSchema>): Promise<Result<CheckInOutcome>> {
  const parsed = walkInSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", "Data walk-in tidak valid.");
  try {
    const { actor, db } = await requireEvent(parsed.data.eventId, "checkin.write");
    const phone = parsed.data.phone ? normalizePhone(parsed.data.phone) : null;
    let token = randomToken(9);
    while (await db.guest.findFirst({ where: { token } })) token = randomToken(9);
    const id = `g_${randomToken(12)}`;
    await db.guest.create({
      data: {
        id, tenantId: actor.tenantId, eventId: parsed.data.eventId,
        name: parsed.data.name.trim(), phoneEncrypted: phone ? encrypt(phone) : null,
        phoneMasked: phone ? maskPhone(phone) : null, phoneHash: phone ? sha256(phone) : null,
        token, qrPayload: signGuestQr(parsed.data.eventId, id, randomToken(6)),
        groupLabel: "Walk-in", paxAllocated: parsed.data.pax, paxConfirmed: parsed.data.pax,
        walkIn: true, tags: toInputJson([]), customFields: toInputJson({}),
      },
    });
    const outcome = await performCheckIn(actor.tenantId, parsed.data.eventId, id, "walk-in", "manual", "WALK_IN", false, actor.actorId);
    await audit(actor, "checkin.walkin", "Guest", id, undefined, { name: parsed.data.name });
    return ok(outcome);
  } catch (error: unknown) {
    if (error instanceof AppError) return err(error.code, error.message);
    return err("WALKIN_FAILED", error instanceof Error ? error.message : "Gagal mendaftarkan walk-in.");
  }
}

export async function offlineSyncAction(eventId: string, items: { payload: string; station: string; deviceId: string; at: string }[]): Promise<Result<{ synced: number; duplicates: number; failed: number }>> {
  try {
    const { actor } = await requireEvent(eventId, "checkin.write");
    let synced = 0, duplicates = 0, failed = 0;
    for (const item of items.slice(0, 500)) {
      const decoded = verifyGuestQr(item.payload);
      if (!decoded || decoded.eventId !== eventId) { failed += 1; continue; }
      try {
        const outcome = await performCheckIn(actor.tenantId, eventId, decoded.guestId, item.station, item.deviceId, "QR", true, actor.actorId);
        if (outcome.duplicate) duplicates += 1; else synced += 1;
      } catch { failed += 1; }
    }
    await audit(actor, "checkin.offline_sync", "CheckIn", eventId, undefined, { synced, duplicates, failed });
    return ok({ synced, duplicates, failed });
  } catch (error: unknown) {
    return err("SYNC_FAILED", error instanceof Error ? error.message : "Gagal sinkronisasi offline.");
  }
}

export async function getCheckinStatsAction(eventId: string): Promise<Result<{
  invited: number; attending: number; checkedIn: number; paxExpected: number; paxPresent: number; recent: { name: string; at: string; station: string }[];
}>> {
  try {
    const { actor, db } = await requireEvent(eventId, "checkin.read");
    const [invited, rsvps, checkIns, recentRows] = await Promise.all([
      db.guest.count({ where: { eventId, tenantId: actor.tenantId } }),
      db.rsvp.findMany({ where: { eventId, tenantId: actor.tenantId, cancelledAt: null }, select: { status: true, pax: true } }),
      db.checkIn.findMany({ where: { eventId, tenantId: actor.tenantId }, orderBy: { at: "desc" }, take: 20 }),
      db.checkIn.findMany({ where: { eventId, tenantId: actor.tenantId }, orderBy: { at: "desc" }, take: 8 }),
    ]);
    const attending = rsvps.filter((row) => row.status === "ATTENDING").length;
    const paxExpected = rsvps.filter((row) => row.status === "ATTENDING").reduce((sum, row) => sum + row.pax, 0);
    const guestIds = checkIns.map((row) => row.guestId);
    const guests = await db.guest.findMany({ where: { id: { in: guestIds }, tenantId: actor.tenantId }, select: { id: true, name: true, paxConfirmed: true } });
    const byId = new Map(guests.map((guest) => [guest.id, guest]));
    return ok({
      invited, attending, checkedIn: checkIns.length, paxExpected,
      paxPresent: guests.reduce((sum, guest) => sum + Math.max(1, guest.paxConfirmed), 0),
      recent: recentRows.map((row) => ({ name: byId.get(row.guestId)?.name ?? "Tamu", at: row.at.toISOString(), station: row.station })),
    });
  } catch (error: unknown) {
    return err("STATS_FAILED", error instanceof Error ? error.message : "Gagal memuat statistik.");
  }
}

export async function assignSeatingAction(eventId: string, guestId: string, tableNumber: string, seatNumber: string): Promise<Result<{ ok: true }>> {
  try {
    const { actor, db } = await requireEvent(eventId, "guest.write");
    await db.guest.update({
      where: { id: guestId, tenantId: actor.tenantId },
      data: { tableNumber: tableNumber.slice(0, 20), seatNumber: seatNumber.slice(0, 20) },
    });
    return ok({ ok: true });
  } catch (error: unknown) {
    return err("SEATING_FAILED", error instanceof Error ? error.message : "Gagal mengatur tempat duduk.");
  }
}

export async function saveSeatingTableAction(eventId: string, name: string, capacity: number): Promise<Result<{ id: string }>> {
  try {
    const { actor, db } = await requireEvent(eventId, "guest.write");
    const row = await db.seatingTable.create({
      data: { tenantId: actor.tenantId, eventId, name: name.slice(0, 40), capacity: Math.max(1, Math.min(50, capacity)), shape: "ROUND", position: toInputJson({ x: 0, y: 0 }) },
    });
    return ok({ id: row.id });
  } catch (error: unknown) {
    return err("SEATING_FAILED", error instanceof Error ? error.message : "Gagal menyimpan meja.");
  }
}
