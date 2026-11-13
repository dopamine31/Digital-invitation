import { ImageResponse } from "next/og";
import { loadInvitation } from "@/server/public";
import { getTheme } from "@/lib/themes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await params;
  const token = new URL(request.url).searchParams.get("to");
  const invitation = await loadInvitation(slug, token, null);
  const theme = getTheme(invitation?.event.themeId ?? "elegant-ivory");
  const guestName = invitation?.guest?.name ?? "Bapak/Ibu/Saudara/i";
  const title = invitation?.event.title ?? "Undangan Digital";
  const couple = invitation ? `${invitation.settings.bride.name} & ${invitation.settings.groom.name}` : "Rasa Undangan";
  const date = invitation ? new Date(invitation.event.startsAt).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";
  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", textAlign: "center",
        background: theme.background.type === "gradient" ? theme.colors.background : theme.colors.background,
        color: theme.colors.text, fontFamily: "Georgia, serif", position: "relative",
        border: `18px solid ${theme.colors.border}`,
      }}>
        <div style={{ display: "flex", fontSize: 18, letterSpacing: 8, color: theme.colors.primary, textTransform: "uppercase" }}>Undangan</div>
        <div style={{ display: "flex", fontSize: 74, marginTop: 18, lineHeight: 1 }}>{couple}</div>
        <div style={{ display: "flex", fontSize: 26, marginTop: 26, color: theme.colors.muted }}>Kepada Yth.</div>
        <div style={{ display: "flex", fontSize: 48, marginTop: 8, color: theme.colors.primary }}>{guestName}</div>
        <div style={{ display: "flex", fontSize: 22, marginTop: 30, color: theme.colors.muted }}>{date}</div>
        {invitation?.settings.pic.showOnCover ? (
          <div style={{ display: "flex", fontSize: 18, marginTop: 22, color: theme.colors.muted }}>PIC {invitation.settings.pic.name} · {invitation.settings.pic.phone}</div>
        ) : null}
        <div style={{ position: "absolute", bottom: 26, display: "flex", fontSize: 16, letterSpacing: 3, color: theme.colors.primary }}>{title.toUpperCase()}</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
