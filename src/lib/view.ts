import type { EventSettings, Locale, RsvpFormConfig, SectionConfig, ThemeConfig } from "@/lib/types";
import { getTheme } from "@/lib/themes";

export interface ViewSchedule {
  title: string; startsAt: string; endsAt: string | null; venueName: string;
  address: string; mapsUrl: string | null; timezone: string; note: string | null;
}

export interface ViewWish { authorName: string; message: string; reply: string | null }
export interface ViewGuestBook { name: string; message: string }

/** Payload serializable untuk renderer undangan (server page & editor preview). */
export interface InvitationViewData {
  event: {
    id: string; slug: string; title: string; startsAt: string; endsAt: string | null;
    timezone: string; themeId: string;
  };
  guest: { id: string; name: string; token: string; qrPayload: string; paxAllocated: number } | null;
  settings: EventSettings;
  sections: SectionConfig[];
  theme: ThemeConfig;
  schedules: ViewSchedule[];
  wishes: ViewWish[];
  guestBook: ViewGuestBook[];
  rsvpForm: RsvpFormConfig;
  rsvp: { status: string; pax: number; answers: Record<string, unknown>; sessionId: string | null; mealChoice: string | null } | null;
  locale: Locale;
  editToken: string | null;
  preview: boolean;
}

export interface ViewSource {
  event: { id: string; slug: string; title: string; startsAt: Date | string; endsAt: Date | string | null; timezone: string; themeId: string };
  guest: { id: string; name: string; token: string; qrPayload: string; paxAllocated: number } | null;
  settings: EventSettings;
  sections: SectionConfig[];
  theme: ThemeConfig;
  schedules: { title: string; startsAt: Date | string; endsAt: Date | string | null; venueName: string; address: string; mapsUrl: string | null; timezone: string; note: string | null }[];
  wishes: { authorName: string; message: string; reply: string | null }[];
  guestBook: { name: string; message: string }[];
  rsvpForm: RsvpFormConfig;
  rsvp: { status: string; pax: number; answers: Record<string, unknown>; sessionId: string | null; mealChoice: string | null } | null;
  locale: Locale;
  editToken?: string | null;
  preview?: boolean;
}

const iso = (value: Date | string | null): string | null => value ? (typeof value === "string" ? value : value.toISOString()) : null;

export function toViewData(source: ViewSource): InvitationViewData {
  return {
    event: {
      id: source.event.id, slug: source.event.slug, title: source.event.title,
      startsAt: iso(source.event.startsAt) ?? new Date().toISOString(),
      endsAt: iso(source.event.endsAt), timezone: source.event.timezone, themeId: source.event.themeId,
    },
    guest: source.guest,
    settings: source.settings,
    sections: source.sections,
    theme: source.theme,
    schedules: source.schedules.map((item) => ({
      title: item.title, startsAt: iso(item.startsAt) ?? new Date().toISOString(),
      endsAt: iso(item.endsAt), venueName: item.venueName, address: item.address,
      mapsUrl: item.mapsUrl, timezone: item.timezone, note: item.note,
    })),
    wishes: source.wishes.map((item) => ({ authorName: item.authorName, message: item.message, reply: item.reply })),
    guestBook: source.guestBook.map((item) => ({ name: item.name, message: item.message })),
    rsvpForm: source.rsvpForm,
    rsvp: source.rsvp,
    locale: source.locale,
    editToken: source.editToken ?? null,
    preview: source.preview ?? false,
  };
}

export function viewThemeLayout(themeId: string): string {
  return getTheme(themeId).layout;
}
