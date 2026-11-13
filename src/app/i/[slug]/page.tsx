import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { loadInvitation, recordVisit } from "@/server/public";
import { toViewData } from "@/lib/view";
import { InvitationView } from "@/components/invitation/InvitationView";
import { parseSettings } from "@/lib/sections";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

function single(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const query = await searchParams;
  const token = single(query.to);
  const invitation = await loadInvitation(slug, token, single(query.lang));
  if (!invitation) return { title: "Undangan tidak ditemukan", robots: { index: false, follow: false } };
  const settings = parseSettings(invitation.settings, invitation.event.title);
  const guestName = invitation.guest?.name ?? "Bapak/Ibu/Saudara/i";
  const title = `${invitation.event.title} — Untuk ${guestName}`;
  const description = settings.metaDescription;
  const ogImage = `/api/og/${encodeURIComponent(slug)}${token ? `?to=${encodeURIComponent(token)}` : ""}`;
  return {
    title,
    description,
    robots: invitation.noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title, description, type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: `Undangan ${invitation.event.title} untuk ${guestName}` }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
    alternates: { canonical: `/i/${slug}` },
  };
}

export default async function InvitationPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const token = single(query.to);
  const editToken = single(query.edit);
  const lang = single(query.lang);
  const invitation = await loadInvitation(slug, token, lang, editToken);
  if (!invitation) notFound();
  const head = await headers();
  const ip = head.get("x-forwarded-for")?.split(",")[0]?.trim() ?? head.get("x-real-ip") ?? null;
  void recordVisit({
    tenantId: invitation.event.tenantId,
    eventId: invitation.event.id,
    guestId: invitation.guest?.id ?? null,
    sectionKey: "cover",
    path: `/i/${slug}`,
    ip,
    referrer: head.get("referer"),
    utm: {
      source: single(query.utm_source), medium: single(query.utm_medium), campaign: single(query.utm_campaign),
    },
  });
  return (
    <main>
      <InvitationView data={toViewData({
        event: invitation.event,
        guest: invitation.guest,
        settings: invitation.settings,
        sections: invitation.sections,
        theme: invitation.theme,
        schedules: invitation.schedules,
        wishes: invitation.wishes,
        guestBook: invitation.guestBook,
        rsvpForm: invitation.rsvpForm,
        rsvp: invitation.rsvp,
        locale: invitation.locale,
        editToken,
      })} />
    </main>
  );
}
