import { prisma } from "@/lib/db";
import { tenantClient } from "@/lib/tenant";
import { parseSections, parseSettings } from "@/lib/sections";
import { mergeThemeConfig } from "@/lib/themes";
import { parseRsvpForm, defaultRsvpForm } from "@/lib/rsvp";
import { hashIp, sha256 } from "@/lib/crypto";
import { isLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/types";
import type { EventSettings, SectionConfig, ThemeConfig } from "@/lib/types";

export interface PublicInvitation {
  event: {
    id: string; tenantId: string; slug: string; title: string; startsAt: Date;
    endsAt: Date | null; timezone: string; status: string; indexable: boolean; themeId: string;
  };
  guest: { id: string; name: string; token: string; qrPayload: string; email: string | null; paxAllocated: number } | null;
  settings: EventSettings;
  sections: SectionConfig[];
  theme: ThemeConfig;
  themeId: string;
  schedules: { id: string; title: string; startsAt: Date; endsAt: Date | null; venueName: string; address: string; mapsUrl: string | null; timezone: string; note: string | null }[];
  wishes: { id: string; authorName: string; message: string; reply: string | null; createdAt: Date }[];
  guestBook: { id: string; name: string; message: string; createdAt: Date }[];
  rsvp: { status: string; pax: number; answers: Record<string, unknown>; sessionId: string | null; mealChoice: string | null } | null;
  rsvpFields: ReturnType<typeof defaultRsvpForm>["fields"];
  rsvpForm: ReturnType<typeof defaultRsvpForm>;
  locale: Locale;
  noindex: boolean;
  editTokenHash: string | null;
}

export async function loadInvitation(slug: string, token: string | null, language: string | null, editToken?: string | null): Promise<PublicInvitation | null> {
  const event = await prisma.event.findFirst({ where: { slug, status: "PUBLISHED" } });
  if (!event) return null;
  const db = tenantClient(event.tenantId);
  const [guest, scheduleRows, wishRows, guestBookRows, formRow] = await Promise.all([
    token ? db.guest.findFirst({ where: { token, eventId: event.id, tenantId: event.tenantId } }) : Promise.resolve(null),
    db.eventSchedule.findMany({ where: { eventId: event.id, tenantId: event.tenantId }, orderBy: { sortOrder: "asc" } }),
    db.wish.findMany({ where: { eventId: event.id, tenantId: event.tenantId, status: "APPROVED" }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.guestBookEntry.findMany({ where: { eventId: event.id, tenantId: event.tenantId }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.rsvpForm.findFirst({ where: { eventId: event.id, tenantId: event.tenantId } }),
  ]);
  const rsvp = guest
    ? await db.rsvp.findFirst({ where: { eventId: event.id, guestId: guest.id, tenantId: event.tenantId, cancelledAt: null } })
    : null;
  const settings = parseSettings(event.settings, event.title);
  const form = formRow
    ? parseRsvpForm({ fields: formRow.fields, settings: formRow.settings, locales: formRow.locales, deadlineAt: formRow.deadlineAt?.toISOString() ?? null, paxQuotaPerGuest: formRow.paxQuotaPerGuest, isClosed: formRow.isClosed, thankYouMessage: formRow.thankYouMessage, redirectUrl: formRow.redirectUrl })
    : defaultRsvpForm();
  const locale: Locale = isLocale(language) ? language : (settings.languages[0] ?? "id");
  return {
    event: {
      id: event.id, tenantId: event.tenantId, slug: event.slug, title: event.title,
      startsAt: event.startsAt, endsAt: event.endsAt, timezone: event.timezone,
      status: event.status, indexable: event.indexable, themeId: event.themeId,
    },
    guest: guest ? { id: guest.id, name: guest.name, token: guest.token, qrPayload: guest.qrPayload, email: guest.email, paxAllocated: guest.paxAllocated } : null,
    settings,
    sections: parseSections(event.sections),
    theme: mergeThemeConfig(event.themeId, event.themeConfig),
    themeId: event.themeId,
    schedules: scheduleRows.map((row) => ({
      id: row.id, title: row.title, startsAt: row.startsAt, endsAt: row.endsAt,
      venueName: row.venueName, address: row.address, mapsUrl: row.mapsUrl,
      timezone: row.timezone, note: row.note,
    })),
    wishes: wishRows.map((row) => ({ id: row.id, authorName: row.authorName, message: row.message, reply: row.reply, createdAt: row.createdAt })),
    guestBook: guestBookRows.map((row) => ({ id: row.id, name: row.name, message: row.message, createdAt: row.createdAt })),
    rsvp: rsvp ? { status: rsvp.status, pax: rsvp.pax, answers: (rsvp.answers ?? {}) as Record<string, unknown>, sessionId: rsvp.sessionId, mealChoice: rsvp.mealChoice } : null,
    rsvpFields: form.fields,
    rsvpForm: form,
    locale,
    noindex: settings.noindex || !event.indexable,
    editTokenHash: editToken ? sha256(editToken) : null,
  };
}

export interface VisitInput {
  tenantId: string;
  eventId: string;
  guestId: string | null;
  sectionKey: string;
  path: string;
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null };
  ip?: string | null;
  referrer?: string | null;
}

export async function recordVisit(input: VisitInput): Promise<void> {
  try {
    const db = tenantClient(input.tenantId);
    await db.guestVisit.create({
      data: {
        tenantId: input.tenantId, eventId: input.eventId, guestId: input.guestId,
        sectionKey: input.sectionKey.slice(0, 60), path: input.path.slice(0, 300),
        utmSource: input.utm?.source ?? null, utmMedium: input.utm?.medium ?? null,
        utmCampaign: input.utm?.campaign ?? null,
        ipHash: hashIp(input.ip),
        referrerHash: input.referrer ? hashIp(input.referrer) : null,
      },
    });
    if (input.guestId) {
      await db.guest.update({ where: { id: input.guestId, tenantId: input.tenantId }, data: { lastOpenedAt: new Date() } });
    }
  } catch (error: unknown) {
    // Analitik tidak boleh menggagalkan render undangan.
    const { logger } = await import("@/lib/logger");
    logger.warn("gagal mencatat kunjungan", { error: error instanceof Error ? error.message : "unknown" });
  }
}
