import { loadInvitation } from "@/server/public";
import { rateLimit } from "@/lib/ratelimit";
import { sha256 } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await params;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await rateLimit(`public:${slug}:${sha256(ip)}`, 60, 60);
  if (!limit.allowed) return Response.json({ ok: false, error: "Rate limit" }, { status: 429 });
  const token = new URL(request.url).searchParams.get("to");
  const invitation = await loadInvitation(slug, token, null);
  if (!invitation) return Response.json({ ok: false, error: "Undangan tidak ditemukan." }, { status: 404 });
  return Response.json({
    ok: true,
    data: {
      title: invitation.event.title,
      startsAt: invitation.event.startsAt.toISOString(),
      timezone: invitation.event.timezone,
      guestName: invitation.guest?.name ?? null,
      pic: { name: invitation.settings.pic.name, phone: invitation.settings.pic.phone, showOnCover: invitation.settings.pic.showOnCover },
      sections: invitation.sections.filter((section) => section.visible).map((section) => section.type),
      schedules: invitation.schedules.map((item) => ({
        title: item.title, startsAt: item.startsAt.toISOString(), venueName: item.venueName, address: item.address,
      })),
      themeId: invitation.themeId,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
