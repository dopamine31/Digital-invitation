"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireEvent, requirePermission, audit, assertQuota } from "@/server/context";
import { tenantClient } from "@/lib/tenant";
import { toInputJson } from "@/lib/db-json";
import { AppError, err, ok, type Result } from "@/lib/result";
import { defaultSections, defaultEventSettings, parseSections, parseSettings, sectionsToJson, settingsToJson } from "@/lib/sections";
import { defaultThemeConfig, getTheme, mergeThemeConfig, themeToJson } from "@/lib/themes";
import { defaultRsvpForm, parseRsvpForm } from "@/lib/rsvp";
import { slugify } from "@/lib/format";
import { randomToken } from "@/lib/crypto";
import { sanitizeCss, sanitizeHeadMeta, sanitizeHtml } from "@/lib/sanitize";
import { parseFeatures } from "@/lib/billing";
import type { EventSettings, SectionConfig, ThemeConfig } from "@/lib/types";

const eventTypes = ["WEDDING", "KHITANAN", "AQIQAH", "BIRTHDAY", "CORPORATE", "SEMINAR", "SYUKURAN", "OTHER"] as const;

const createSchema = z.object({
  title: z.string().min(3).max(160),
  type: z.enum(eventTypes),
  themeId: z.string().min(2),
  startsAt: z.string().min(10),
  timezone: z.string().default("Asia/Jakarta"),
  venueName: z.string().max(160).default(""),
  address: z.string().max(300).default(""),
  picName: z.string().min(2).max(120),
  picPhone: z.string().min(8).max(25),
  showPicOnCover: z.boolean().default(true),
  brideName: z.string().max(120).default(""),
  groomName: z.string().max(120).default(""),
});

export async function createEventAction(input: z.infer<typeof createSchema>): Promise<Result<{ id: string; slug: string }>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", parsed.error.issues[0]?.message ?? "Data acara tidak valid.");
  try {
    const actor = await requirePermission("event.create");
    const tenantId = actor.tenantId;
    if (!tenantId) return err("FORBIDDEN", "Akun tidak memiliki tenant.");
    const db = tenantClient(tenantId);
    const eventCount = await db.event.count({ where: { tenantId, status: { not: "ARCHIVED" } } });
    await assertQuota(actor, "maxEvents", 1, eventCount);
    const data = parsed.data;
    const startsAt = new Date(data.startsAt);
    if (Number.isNaN(startsAt.getTime())) return err("VALIDATION", "Tanggal acara tidak valid.");
    let slug = slugify(data.title);
    if (!slug) slug = `acara-${randomToken(4).toLowerCase()}`;
    let uniqueSlug = slug;
    let suffix = 1;
    while (await db.event.findFirst({ where: { slug: uniqueSlug } })) {
      suffix += 1;
      uniqueSlug = `${slug}-${suffix}`;
    }
    const settings = defaultEventSettings(data.title);
    settings.pic.name = data.picName;
    settings.pic.phone = data.picPhone;
    settings.pic.showOnCover = data.showPicOnCover;
    settings.bride.name = data.brideName || settings.bride.name;
    settings.groom.name = data.groomName || settings.groom.name;
    const sections = defaultSections();
    const themeConfig = defaultThemeConfig(data.themeId);
    const event = await db.event.create({
      data: {
        tenantId, slug: uniqueSlug, title: data.title, type: data.type, status: "DRAFT",
        startsAt, timezone: data.timezone, themeId: data.themeId,
        themeConfig: toInputJson(themeToJson(themeConfig)),
        sections: toInputJson(sectionsToJson(sections)),
        settings: toInputJson(settingsToJson(settings)),
        meta: toInputJson({}),
        createdBy: actor.actorId,
        publishedAt: null,
      },
    });
    const form = defaultRsvpForm();
    await db.rsvpForm.create({
      data: {
        tenantId, eventId: event.id,
        fields: toInputJson(form.fields),
        settings: toInputJson(form.settings),
        locales: toInputJson(form.locales),
        deadlineAt: null,
        paxQuotaPerGuest: form.paxQuotaPerGuest,
        isClosed: false,
        thankYouMessage: form.thankYouMessage,
        redirectUrl: null,
      },
    });
    await db.eventSchedule.create({
      data: {
        tenantId, eventId: event.id, title: data.type === "WEDDING" ? "Akad & Resepsi" : "Acara Utama",
        startsAt, endsAt: new Date(startsAt.getTime() + 4 * 3600_000),
        timezone: data.timezone, venueName: data.venueName, address: data.address,
        sortOrder: 0,
      },
    });
    await db.eventVersion.create({
      data: { tenantId, eventId: event.id, version: 1, snapshot: toInputJson({ title: event.title, themeId: data.themeId, sections, settings }), note: "Dibuat dari wizard", createdBy: actor.actorId },
    });
    await audit(actor, "event.create", "Event", event.id, undefined, { title: data.title, themeId: data.themeId });
    revalidatePath("/app/events");
    return ok({ id: event.id, slug: uniqueSlug });
  } catch (error: unknown) {
    if (error instanceof AppError) return err(error.code, error.message);
    return err("EVENT_CREATE_FAILED", error instanceof Error ? error.message : "Gagal membuat acara.");
  }
}

const draftSchema = z.object({
  eventId: z.string().min(1),
  themeId: z.string().optional(),
  themeConfig: z.unknown().optional(),
  sections: z.array(z.unknown()).optional(),
  settings: z.unknown().optional(),
  title: z.string().min(3).max(160).optional(),
  indexable: z.boolean().optional(),
  coverImageUrl: z.string().max(600).nullable().optional(),
});

export async function saveEventDraftAction(input: z.infer<typeof draftSchema>): Promise<Result<{ savedAt: string }>> {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", "Payload editor tidak valid.");
  try {
    const { actor, db, event } = await requireEvent(parsed.data.eventId, "event.update");
    const data = parsed.data;
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (data.title !== undefined) update.title = data.title;
    if (data.indexable !== undefined) update.indexable = data.indexable;
    if (data.coverImageUrl !== undefined) update.coverImageUrl = data.coverImageUrl;
    if (data.themeId !== undefined) {
      const theme = getTheme(data.themeId);
      update.themeId = theme.id;
    }
    if (data.themeConfig !== undefined) {
      const config = mergeThemeConfig(data.themeId ?? event.themeId, data.themeConfig);
      config.customCss = sanitizeCss(config.customCss);
      config.customHtml = sanitizeHtml(config.customHtml);
      config.customHead = sanitizeHeadMeta(config.customHead);
      if ((config.customCss || config.customHtml || config.customHead) && !parseFeatures(actor.features).customCss) {
        return err("FEATURE_LOCKED", "Custom CSS/HTML membutuhkan paket dengan fitur tersebut.");
      }
      update.themeConfig = toInputJson(themeToJson(config));
    }
    if (data.sections !== undefined) {
      const sections = parseSections(data.sections) as SectionConfig[];
      update.sections = toInputJson(sectionsToJson(sections));
    }
    if (data.settings !== undefined) {
      const settings = parseSettings(data.settings, event.title);
      update.settings = toInputJson(settingsToJson(settings));
    }
    await db.event.update({ where: { id: event.id, tenantId: actor.tenantId }, data: update });
    revalidatePath(`/i/${event.slug}`);
    return ok({ savedAt: new Date().toISOString() });
  } catch (error: unknown) {
    if (error instanceof AppError) return err(error.code, error.message);
    return err("SAVE_FAILED", error instanceof Error ? error.message : "Gagal menyimpan.");
  }
}

export async function createVersionAction(eventId: string, note: string): Promise<Result<{ version: number }>> {
  try {
    const { actor, db, event } = await requireEvent(eventId, "event.version");
    const last = await db.eventVersion.findFirst({ where: { eventId, tenantId: actor.tenantId }, orderBy: { version: "desc" } });
    const version = (last?.version ?? 0) + 1;
    const schedules = await db.eventSchedule.findMany({ where: { eventId, tenantId: actor.tenantId } });
    await db.eventVersion.create({
      data: {
        tenantId: actor.tenantId, eventId, version, note: note.slice(0, 200), createdBy: actor.actorId,
        snapshot: toInputJson({ title: event.title, themeId: event.themeId, themeConfig: event.themeConfig, sections: event.sections, settings: event.settings, meta: event.meta, schedules }),
      },
    });
    await audit(actor, "event.version", "EventVersion", eventId, undefined, { version });
    return ok({ version });
  } catch (error: unknown) {
    return err("VERSION_FAILED", error instanceof Error ? error.message : "Gagal membuat versi.");
  }
}

export async function rollbackVersionAction(eventId: string, version: number): Promise<Result<{ version: number }>> {
  try {
    const { actor, db, event } = await requireEvent(eventId, "event.version");
    const snapshot = await db.eventVersion.findFirst({ where: { eventId, tenantId: actor.tenantId, version } });
    if (!snapshot) return err("NOT_FOUND", "Versi tidak ditemukan.");
    const data = snapshot.snapshot as Record<string, unknown>;
    await db.event.update({
      where: { id: eventId, tenantId: actor.tenantId },
      data: {
        title: typeof data.title === "string" ? data.title : event.title,
        themeId: typeof data.themeId === "string" ? data.themeId : event.themeId,
        themeConfig: data.themeConfig ? toInputJson(data.themeConfig) : toInputJson({}),
        sections: data.sections ? toInputJson(data.sections) : toInputJson([]),
        settings: data.settings ? toInputJson(data.settings) : toInputJson({}),
        meta: data.meta ? toInputJson(data.meta) : toInputJson({}),
      },
    });
    await audit(actor, "event.rollback", "Event", eventId, { version: "current" }, { version });
    revalidatePath(`/app/events/${eventId}/editor`);
    revalidatePath(`/i/${event.slug}`);
    return ok({ version });
  } catch (error: unknown) {
    return err("ROLLBACK_FAILED", error instanceof Error ? error.message : "Gagal memulihkan versi.");
  }
}

export async function publishEventAction(eventId: string): Promise<Result<{ slug: string }>> {
  try {
    const { actor, db, event } = await requireEvent(eventId, "event.publish");
    await db.event.update({ where: { id: eventId, tenantId: actor.tenantId }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    await audit(actor, "event.publish", "Event", eventId);
    revalidatePath(`/i/${event.slug}`);
    return ok({ slug: event.slug });
  } catch (error: unknown) {
    return err("PUBLISH_FAILED", error instanceof Error ? error.message : "Gagal menerbitkan.");
  }
}

export async function setEventStatusAction(eventId: string, status: "DRAFT" | "ARCHIVED"): Promise<Result<{ status: string }>> {
  try {
    const { actor, db, event } = await requireEvent(eventId, "event.update");
    await db.event.update({ where: { id: eventId, tenantId: actor.tenantId }, data: { status } });
    await audit(actor, "event.status", "Event", eventId, { status: event.status }, { status });
    revalidatePath(`/i/${event.slug}`);
    return ok({ status });
  } catch (error: unknown) {
    return err("STATUS_FAILED", error instanceof Error ? error.message : "Gagal mengubah status.");
  }
}

export async function duplicateEventAction(eventId: string): Promise<Result<{ id: string }>> {
  try {
    const actor = await requirePermission("event.duplicate");
    const tenantId = actor.tenantId;
    if (!tenantId) return err("FORBIDDEN", "Tenant tidak ditemukan.");
    const db = tenantClient(tenantId);
    const source = await db.event.findFirst({ where: { id: eventId, tenantId } });
    if (!source) return err("NOT_FOUND", "Acara tidak ditemukan.");
    const count = await db.event.count({ where: { tenantId, status: { not: "ARCHIVED" } } });
    await assertQuota(actor, "maxEvents", 1, count);
    let slug = `${source.slug}-salinan`;
    let suffix = 1;
    while (await db.event.findFirst({ where: { slug } })) { suffix += 1; slug = `${source.slug}-salinan-${suffix}`; }
    const copy = await db.event.create({
      data: {
        tenantId, slug, title: `${source.title} (Salinan)`, type: source.type, status: "DRAFT",
        startsAt: source.startsAt, endsAt: source.endsAt, timezone: source.timezone,
        themeId: source.themeId, themeConfig: toInputJson(source.themeConfig),
        sections: toInputJson(source.sections), settings: toInputJson(source.settings),
        meta: toInputJson(source.meta), coverImageUrl: source.coverImageUrl,
        createdBy: actor.actorId,
      },
    });
    const form = await db.rsvpForm.findFirst({ where: { eventId, tenantId } });
    if (form) {
      await db.rsvpForm.create({
        data: {
          tenantId, eventId: copy.id, fields: toInputJson(form.fields), settings: toInputJson(form.settings),
          locales: toInputJson(form.locales), deadlineAt: form.deadlineAt,
          paxQuotaPerGuest: form.paxQuotaPerGuest, isClosed: form.isClosed,
          thankYouMessage: form.thankYouMessage, redirectUrl: form.redirectUrl,
        },
      });
    }
    const schedules = await db.eventSchedule.findMany({ where: { eventId, tenantId } });
    if (schedules.length > 0) {
      await db.eventSchedule.createMany({
        data: schedules.map((item) => ({
          tenantId, eventId: copy.id, title: item.title, startsAt: item.startsAt, endsAt: item.endsAt,
          timezone: item.timezone, venueName: item.venueName, address: item.address,
          mapsUrl: item.mapsUrl, latitude: item.latitude, longitude: item.longitude,
          note: item.note, sortOrder: item.sortOrder,
        })),
      });
    }
    await audit(actor, "event.duplicate", "Event", copy.id, { sourceId: eventId });
    revalidatePath("/app/events");
    return ok({ id: copy.id });
  } catch (error: unknown) {
    return err("DUPLICATE_FAILED", error instanceof Error ? error.message : "Gagal menduplikasi.");
  }
}

export async function deleteEventAction(eventId: string): Promise<Result<{ deleted: true }>> {
  try {
    const { actor, db, event } = await requireEvent(eventId, "event.delete");
    await db.event.update({ where: { id: eventId, tenantId: actor.tenantId }, data: { status: "ARCHIVED" } });
    await audit(actor, "event.archive", "Event", eventId, { status: event.status }, { status: "ARCHIVED" });
    revalidatePath("/app/events");
    return ok({ deleted: true });
  } catch (error: unknown) {
    return err("DELETE_FAILED", error instanceof Error ? error.message : "Gagal menghapus acara.");
  }
}

const scheduleSchema = z.object({
  eventId: z.string(), scheduleId: z.string().optional(), title: z.string().min(2).max(120),
  startsAt: z.string(), endsAt: z.string().nullable().optional(), timezone: z.string().default("Asia/Jakarta"),
  venueName: z.string().max(160).default(""), address: z.string().max(300).default(""),
  mapsUrl: z.string().max(500).nullable().optional(), note: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).max(100).default(0),
});

export async function saveScheduleAction(input: z.infer<typeof scheduleSchema>): Promise<Result<{ id: string }>> {
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", "Data jadwal tidak valid.");
  try {
    const { actor, db } = await requireEvent(parsed.data.eventId, "event.update");
    const data = parsed.data;
    const startsAt = new Date(data.startsAt);
    if (Number.isNaN(startsAt.getTime())) return err("VALIDATION", "Waktu mulai tidak valid.");
    const values = {
      tenantId: actor.tenantId, eventId: data.eventId, title: data.title, startsAt,
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
      timezone: data.timezone, venueName: data.venueName, address: data.address,
      mapsUrl: data.mapsUrl ?? null, note: data.note ?? null, sortOrder: data.sortOrder,
    };
    if (data.scheduleId) {
      await db.eventSchedule.update({ where: { id: data.scheduleId, tenantId: actor.tenantId }, data: values });
      return ok({ id: data.scheduleId });
    }
    const created = await db.eventSchedule.create({ data: values });
    return ok({ id: created.id });
  } catch (error: unknown) {
    return err("SCHEDULE_FAILED", error instanceof Error ? error.message : "Gagal menyimpan jadwal.");
  }
}

export async function deleteScheduleAction(eventId: string, scheduleId: string): Promise<Result<{ deleted: true }>> {
  try {
    const { actor, db } = await requireEvent(eventId, "event.update");
    await db.eventSchedule.delete({ where: { id: scheduleId, tenantId: actor.tenantId } });
    return ok({ deleted: true });
  } catch (error: unknown) {
    return err("SCHEDULE_FAILED", error instanceof Error ? error.message : "Gagal menghapus jadwal.");
  }
}

export async function updateThemeAction(eventId: string, themeId: string, config: ThemeConfig): Promise<Result<{ savedAt: string }>> {
  try {
    await requireEvent(eventId, "theme.update");
    return saveEventDraftAction({ eventId, themeId, themeConfig: config });
  } catch (error: unknown) {
    return err("THEME_FAILED", error instanceof Error ? error.message : "Gagal menyimpan tema.");
  }
}

export async function updateSettingsAction(eventId: string, settings: EventSettings): Promise<Result<{ savedAt: string }>> {
  try {
    await requireEvent(eventId, "event.update");
    return saveEventDraftAction({ eventId, settings });
  } catch (error: unknown) {
    return err("SETTINGS_FAILED", error instanceof Error ? error.message : "Gagal menyimpan pengaturan.");
  }
}

export async function updateSectionsAction(eventId: string, sections: SectionConfig[]): Promise<Result<{ savedAt: string }>> {
  try {
    await requireEvent(eventId, "section.update");
    return saveEventDraftAction({ eventId, sections });
  } catch (error: unknown) {
    return err("SECTION_FAILED", error instanceof Error ? error.message : "Gagal menyimpan section.");
  }
}

export async function listEventVersionsAction(eventId: string): Promise<Result<{ version: number; note: string; createdAt: string }[]>> {
  try {
    const { actor, db } = await requireEvent(eventId, "event.read");
    const rows = await db.eventVersion.findMany({ where: { eventId, tenantId: actor.tenantId }, orderBy: { version: "desc" }, take: 30 });
    return ok(rows.map((row) => ({ version: row.version, note: row.note, createdAt: row.createdAt.toISOString() })));
  } catch (error: unknown) {
    return err("VERSION_FAILED", error instanceof Error ? error.message : "Gagal memuat versi.");
  }
}

export async function getRsvpFormAction(eventId: string): Promise<Result<ReturnType<typeof parseRsvpForm>>> {
  try {
    const { actor, db } = await requireEvent(eventId, "rsvp.read");
    const form = await db.rsvpForm.findFirst({ where: { eventId, tenantId: actor.tenantId } });
    if (!form) return ok(defaultRsvpForm());
    return ok(parseRsvpForm({
      fields: form.fields, settings: form.settings, locales: form.locales,
      deadlineAt: form.deadlineAt?.toISOString() ?? null,
      paxQuotaPerGuest: form.paxQuotaPerGuest, isClosed: form.isClosed,
      thankYouMessage: form.thankYouMessage, redirectUrl: form.redirectUrl,
    }));
  } catch (error: unknown) {
    return err("FORM_FAILED", error instanceof Error ? error.message : "Gagal memuat form.");
  }
}
