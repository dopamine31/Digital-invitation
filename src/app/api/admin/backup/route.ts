import { requirePermission } from "@/server/context";
import { backupSettingsAction } from "@/server/actions/admin";
import { apiError } from "@/server/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await requirePermission("system.manage");
    const result = await backupSettingsAction();
    if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: 400 });
    return new Response(result.data.json, {
      headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="rasa-backup-${Date.now()}.json"` },
    });
  } catch (error: unknown) { return apiError(error); }
}
