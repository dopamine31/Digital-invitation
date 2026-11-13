import { authenticateApiRequest, apiError } from "@/server/api-auth";
import { tenantClient } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { verifyGuestQr } from "@/lib/crypto";
import { dispatchWebhookEvent } from "@/server/webhooks";
import { AppError } from "@/lib/result";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  try {
    const identity = await authenticateApiRequest(request, raw, "checkin.write");
    const body = JSON.parse(raw) as { payload?: string; eventId?: string; station?: string; deviceId?: string };
    if (!body.payload || !body.eventId) throw new AppError("VALIDATION", "payload & eventId wajib ada.");
    const decoded = verifyGuestQr(body.payload);
    if (!decoded || decoded.eventId !== body.eventId) throw new AppError("QR_INVALID", "QR tidak valid.");
    const event = await prisma.event.findFirst({ where: { id: body.eventId, tenantId: identity.tenantId } });
    if (!event) throw new AppError("NOT_FOUND", "Acara tidak ditemukan.", 404);
    const db = tenantClient(identity.tenantId);
    const guest = await db.guest.findFirst({ where: { id: decoded.guestId, eventId: body.eventId, tenantId: identity.tenantId } });
    if (!guest) throw new AppError("NOT_FOUND", "Tamu tidak ditemukan.", 404);
    const existing = await db.checkIn.findFirst({ where: { eventId: body.eventId, guestId: decoded.guestId, tenantId: identity.tenantId } });
    if (existing) return Response.json({ ok: true, duplicate: true, data: { guestId: guest.id, at: existing.at } });
    await db.checkIn.create({
      data: {
        tenantId: identity.tenantId, eventId: body.eventId, guestId: guest.id,
        station: body.station ?? "api", deviceId: body.deviceId ?? "api", method: "QR",
      },
    });
    await dispatchWebhookEvent(identity.tenantId, "guest.checked_in", { eventId: body.eventId, guestId: guest.id, source: "api" });
    return Response.json({ ok: true, duplicate: false, data: { guestId: guest.id, name: guest.name, at: new Date() } });
  } catch (error: unknown) { return apiError(error); }
}
