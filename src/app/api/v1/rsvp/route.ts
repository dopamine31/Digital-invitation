import { authenticateApiRequest, apiError } from "@/server/api-auth";
import { tenantClient } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { submitRsvpAction } from "@/server/actions/rsvp";
import { AppError } from "@/lib/result";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    const identity = await authenticateApiRequest(request, "", "rsvp.read");
    const url = new URL(request.url);
    const eventId = url.searchParams.get("eventId") ?? "";
    if (!eventId) throw new AppError("VALIDATION", "eventId wajib ada.");
    const event = await prisma.event.findFirst({ where: { id: eventId, tenantId: identity.tenantId } });
    if (!event) throw new AppError("NOT_FOUND", "Acara tidak ditemukan.", 404);
    const db = tenantClient(identity.tenantId);
    const rows = await db.rsvp.findMany({ where: { eventId, tenantId: identity.tenantId, cancelledAt: null }, take: 1000 });
    return Response.json({ ok: true, data: rows.map((row) => ({
      id: row.id, guestId: row.guestId, status: row.status, pax: row.pax,
      answers: row.answers, submittedAt: row.submittedAt,
    })) });
  } catch (error: unknown) { return apiError(error); }
}

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  try {
    const identity = await authenticateApiRequest(request, raw, "rsvp.write");
    const body = JSON.parse(raw) as Record<string, unknown>;
    const event = await prisma.event.findFirst({
      where: { id: String(body.eventId ?? ""), tenantId: identity.tenantId },
    });
    if (!event) throw new AppError("NOT_FOUND", "Acara tidak ditemukan.", 404);
    const result = await submitRsvpAction({
      slug: event.slug,
      token: String(body.token ?? ""),
      locale: body.locale === "en" ? "en" : "id",
      status: (["ATTENDING", "DECLINED", "MAYBE"].includes(String(body.status)) ? body.status : "ATTENDING") as "ATTENDING" | "DECLINED" | "MAYBE",
      pax: Number(body.pax ?? 1),
      answers: (body.answers ?? {}) as Record<string, unknown>,
      sessionId: body.sessionId ? String(body.sessionId) : null,
      mealChoice: body.mealChoice ? String(body.mealChoice) : null,
      attendanceNote: body.attendanceNote ? String(body.attendanceNote) : null,
      consent: true,
      website: "",
    });
    if (!result.ok) return Response.json({ ok: false, code: result.code, error: result.error }, { status: 400 });
    return Response.json({ ok: true, data: result.data });
  } catch (error: unknown) { return apiError(error); }
}
