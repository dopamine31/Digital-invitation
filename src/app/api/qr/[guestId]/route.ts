import { prisma } from "@/lib/db";
import { makeQrDataUrl } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ guestId: string }> }): Promise<Response> {
  const { guestId } = await params;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const guest = await prisma.guest.findFirst({ where: { id: guestId, token } });
  if (!guest) return Response.json({ ok: false, error: "Tamu tidak ditemukan." }, { status: 404 });
  const dataUrl = await makeQrDataUrl(guest.qrPayload, 420);
  const base64 = dataUrl.split(",")[1] ?? "";
  return new Response(Buffer.from(base64, "base64"), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" },
  });
}
