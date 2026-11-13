import { authenticateApiRequest, apiError } from "@/server/api-auth";
import { listEvents } from "@/server/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const identity = await authenticateApiRequest(request, "", "events.read");
    const events = await listEvents(identity.tenantId);
    return Response.json({ ok: true, data: events, meta: { count: events.length } });
  } catch (error: unknown) { return apiError(error); }
}
