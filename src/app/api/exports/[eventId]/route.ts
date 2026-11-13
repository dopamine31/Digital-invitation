import { getActor } from "@/server/context";
import { requireEvent } from "@/server/context";
import { buildReport, type ReportType } from "@/server/reports";
import { toCsv, toXlsx, toPdf, csvResponse, binaryResponse } from "@/lib/exporters";
import { AppError } from "@/lib/result";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: ReportType[] = ["guests", "rsvp", "checkin", "analytics", "wishes"];
const FORMATS = ["csv", "xlsx", "pdf"];

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }): Promise<Response> {
  try {
    const actor = await getActor();
    if (!actor) return Response.json({ ok: false, error: "Masuk terlebih dahulu." }, { status: 401 });
    const { eventId } = await params;
    await requireEvent(eventId, "analytics.export");
    const url = new URL(request.url);
    const type = (url.searchParams.get("type") ?? "guests") as ReportType;
    const format = url.searchParams.get("format") ?? "csv";
    if (!TYPES.includes(type) || !FORMATS.includes(format)) return Response.json({ ok: false, error: "Format tidak didukung." }, { status: 400 });
    const report = await buildReport(actor.tenantId, eventId, type);
    const filename = `rasa-${type}-${eventId.slice(-6)}.${format}`;
    if (format === "csv") return csvResponse(toCsv(report.sheets[0] ?? { name: "Laporan", columns: [], rows: [] }), filename);
    if (format === "xlsx") return binaryResponse(await toXlsx(report.sheets), filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return binaryResponse(await toPdf(report.title, report.sheets[0] ?? { name: "Laporan", columns: [], rows: [] }), filename, "application/pdf");
  } catch (error: unknown) {
    if (error instanceof AppError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    logger.error("export gagal", { error: error instanceof Error ? error.message : "unknown" });
    return Response.json({ ok: false, error: "Gagal mengekspor laporan." }, { status: 500 });
  }
}
