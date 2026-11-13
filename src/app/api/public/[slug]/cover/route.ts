import { loadInvitationBySlug } from "@/server/invitations";

// Menyajikan foto cover (data URL) sebagai gambar nyata agar bisa dipakai sebagai Open Graph image (WhatsApp/Facebook).
export async function GET(_: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const row = await loadInvitationBySlug(slug);
  const src = (row?.inv.data as { coverPhoto?: string } | undefined)?.coverPhoto ?? "";
  const m = src.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!row || row.inv.status !== "published" || !m) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), { headers: { "content-type": m[1], "cache-control": "public, max-age=300" } });
}
