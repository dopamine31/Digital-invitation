import { prisma } from "@/lib/db";
import { paymentAdapter } from "@/adapters/payment";
import { markInvoicePaid } from "@/server/actions/billing";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => { headers[key] = value; });
  const verified = paymentAdapter().verifyWebhook(headers, raw);
  if (!verified.ok) return Response.json({ ok: false, error: verified.error }, { status: 401 });
  const event = verified.data;
  const invoice = await prisma.invoice.findFirst({
    where: { OR: [{ id: event.invoiceId }, { number: event.invoiceId }] },
  });
  if (!invoice) return Response.json({ ok: false, error: "Invoice tidak ditemukan" }, { status: 404 });
  if (invoice.status === "PAID") return Response.json({ ok: true, idempotent: true });
  if (event.status !== "PAID") return Response.json({ ok: true, status: event.status });
  try {
    await markInvoicePaid(invoice.tenantId, invoice.id, invoice.planId, invoice.total, event.provider, event.reference);
    return Response.json({ ok: true });
  } catch (error: unknown) {
    logger.error("webhook pembayaran gagal diproses", { error: error instanceof Error ? error.message : "unknown" });
    return Response.json({ ok: false, error: "Gagal memproses" }, { status: 500 });
  }
}
