import { requireActor, requireEvent } from "@/server/context";
import { createSignedUpload } from "@/lib/upload";
import { apiError } from "@/server/api-auth";
import { AppError } from "@/lib/result";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await requireActor();
    const body = (await request.json()) as { eventId?: string; fileName?: string; mime?: string; size?: number };
    if (!body.eventId || !body.fileName || !body.mime || !body.size) throw new AppError("VALIDATION", "Payload upload tidak lengkap.");
    await requireEvent(body.eventId, "asset.upload");
    const result = await createSignedUpload(actor.tenantId, body.fileName, body.mime, body.size);
    return Response.json({ ok: true, data: result });
  } catch (error: unknown) {
    return apiError(error);
  }
}
