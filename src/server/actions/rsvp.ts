"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { tenantClient } from "@/lib/tenant";
import { requireEvent, audit } from "@/server/context";
import { parseRsvpForm, validateRsvpSubmission, defaultRsvpForm } from "@/lib/rsvp";
import { randomToken, sha256, hashIp, verifyGuestQr } from "@/lib/crypto";
import { rateLimit } from "@/lib/ratelimit";
import { toInputJson } from "@/lib/db-json";
import { AppError, err, ok, type Result } from "@/lib/result";
import { notifyRsvpEvent } from "@/server/notifications";
import { dispatchWebhookEvent } from "@/server/webhooks";
import { parseSettings } from "@/lib/sections";
import type { RsvpField, RsvpFormConfig } from "@/lib/types";

const formSchema = z.object({
  eventId: z.string(),
  fields: z.array(z.object({
    id: z.string().min(1), type: z.string().min(1), required: z.boolean(),
    label: z.object({ id: z.string(), en: z.string() }),
    placeholder: z.object({ id: z.string(), en: z.string() }).optional(),
    options: z.array(z.object({ value: z.string(), label: z.object({ id: z.string(), en: z.string() }) })).optional(),
    showIf: z.object({ fieldId: z.string(), operator: z.enum(["equals", "notEquals", "contains", "in"]), value: z.union([z.string(), z.array(z.string())]) }).optional(),
    min: z.number().optional(), max: z.number().optional(), pattern: z.string().optional(), helpText: z.string().optional(),
  })).max(60),
  deadlineAt: z.string().nullable(),
  paxQuotaPerGuest: z.number().int().min(1).max(20),
  isClosed: z.boolean(),
  thankYouMessage: z.string().max(1000),
  redirectUrl: z.string().max(500).nullable(),
  settings: z.object({
    allowMaybe: z.boolean(), allowSessionChoice: z.boolean(),
    sessions: z.array(z.object({ id: z.string(), label: z.string(), time: z.string() })),
    mealChoices: z.array(z.string()), maxPax: z.number().int().min(1).max(20),
    requirePhone: z.boolean(), autoCloseAtDeadline: z.boolean(), locales: z.array(z.enum(["id", "en"])),
  }),
  locales: z.record(z.record(z.string())).default({}),
});

export async function saveRsvpFormAction(input: z.infer<typeof formSchema>): Promise<Result<{ savedAt: string }>> {
  const parsed = formSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", parsed.error.issues[0]?.message ?? "Form RSVP tidak valid.");
  try {
    const { actor, db } = await requireEvent(parsed.data.eventId, "rsvp.form");
    const form = parsed.data;
    const deadline = form.deadlineAt ? new Date(form.deadlineAt) : null;
    if (deadline && Number.isNaN(deadline.getTime())) return err("VALIDATION", "Deadline tidak valid.");
    await db.rsvpForm.upsert({
      where: { eventId: form.eventId, tenantId: actor.tenantId },
      create: {
        tenantId: actor.tenantId, eventId: form.eventId,
        fields: toInputJson(form.fields), settings: toInputJson(form.settings), locales: toInputJson(form.locales),
        deadlineAt: deadline, paxQuotaPerGuest: form.paxQuotaPerGuest, isClosed: form.isClosed,
        thankYouMessage: form.thankYouMessage, redirectUrl: form.redirectUrl,
      },
      update: {
        fields: toInputJson(form.fields), settings: toInputJson(form.settings), locales: toInputJson(form.locales),
        deadlineAt: deadline, paxQuotaPerGuest: form.paxQuotaPerGuest, isClosed: form.isClosed,
        thankYouMessage: form.thankYouMessage, redirectUrl: form.redirectUrl,
      },
    });
    await audit(actor, "rsvp.form.update", "RsvpForm", form.eventId, undefined, { fieldCount: form.fields.length });
    revalidatePath(`/i/${(await db.event.findFirst({ where: { id: form.eventId, tenantId: actor.tenantId } }))?.slug ?? ""}`);
    return ok({ savedAt: new Date().toISOString() });
  } catch (error: unknown) {
    if (error instanceof AppError) return err(error.code, error.message);
    return err("FORM_FAILED", error instanceof Error ? error.message : "Gagal menyimpan form.");
  }
}

const submitSchema = z.object({
  slug: z.string().min(1),
  token: z.string().min(4),
  locale: z.enum(["id", "en"]).default("id"),
  status: z.enum(["ATTENDING", "DECLINED", "MAYBE"]),
  pax: z.number().int().min(1).max(20),
  answers: z.record(z.unknown()).default({}),
  sessionId: z.string().nullable().optional(),
  mealChoice: z.string().nullable().optional(),
  attendanceNote: z.string().nullable().optional(),
  consent: z.boolean(),
  website: z.string().default(""),
  utm: z.object({ source: z.string().nullable(), medium: z.string().nullable(), campaign: z.string().nullable() }).optional(),
});

export interface RsvpResult {
  editToken: string;
  editUrl: string;
  status: string;
  pax: number;
  guestName: string;
  thankYouMessage: string;
  redirectUrl: string | null;
  eventTitle: string;
}

export async function submitRsvpAction(input: z.infer<typeof submitSchema>): Promise<Result<RsvpResult>> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", parsed.error.issues[0]?.message ?? "Data RSVP tidak valid.");
  const head = await headers();
  const ip = head.get("x-forwarded-for")?.split(",")[0]?.trim() ?? head.get("x-real-ip") ?? "unknown";
  const limit = await rateLimit(`rsvp:${parsed.data.slug}:${sha256(ip)}`, 8, 60);
  if (!limit.allowed) return err("RATE_LIMIT", "Terlalu banyak percobaan. Coba lagi dalam satu menit.");
  if (parsed.data.website.length > 0) return err("BOT_DETECTED", "Permintaan ditolak.");
  try {
    const event = await prisma.event.findFirst({ where: { slug: parsed.data.slug, status: "PUBLISHED" } });
    if (!event) return err("NOT_FOUND", "Undangan tidak ditemukan atau belum diterbitkan.");
    const db = tenantClient(event.tenantId);
    const guest = await db.guest.findFirst({ where: { token: parsed.data.token, eventId: event.id, tenantId: event.tenantId } });
    if (!guest) return err("GUEST_NOT_FOUND", "Link undangan tidak dikenali. Hubungi PIC untuk meminta link.");
    if (guest.blacklisted) return err("FORBIDDEN", "Link ini sudah tidak aktif.");
    const formRow = await db.rsvpForm.findFirst({ where: { eventId: event.id, tenantId: event.tenantId } });
    const form = formRow ? parseRsvpForm({ fields: formRow.fields, settings: formRow.settings, locales: formRow.locales, deadlineAt: formRow.deadlineAt?.toISOString() ?? null, paxQuotaPerGuest: formRow.paxQuotaPerGuest, isClosed: formRow.isClosed, thankYouMessage: formRow.thankYouMessage, redirectUrl: formRow.redirectUrl }) : defaultRsvpForm();
    if (!form.settings.allowMaybe && parsed.data.status === "MAYBE") return err("VALIDATION", "Pilihan 'mungkin' tidak tersedia.");
    const validation = validateRsvpSubmission(
      form,
      { ...parsed.data, consent: parsed.data.consent },
      guest.paxAllocated,
      new Date(),
      parsed.data.locale,
    );
    if (!validation.success) return err("VALIDATION", validation.errors.join(" "));
    const answers = validation.data.answers;
    const editToken = randomToken(20);
    const editTokenHash = sha256(editToken);
    const existing = await db.rsvp.findFirst({ where: { eventId: event.id, guestId: guest.id, tenantId: event.tenantId } });
    const isUpdate = Boolean(existing);
    const status = validation.data.status;
    const pax = status === "DECLINED" ? 0 : validation.data.pax;
    const common = {
      tenantId: event.tenantId, eventId: event.id, guestId: guest.id,
      status, pax, answers: toInputJson(answers),
      sessionId: parsed.data.sessionId ?? null,
      mealChoice: parsed.data.mealChoice ?? null,
      attendanceNote: parsed.data.attendanceNote ?? null,
      utmSource: parsed.data.utm?.source ?? null,
      utmMedium: parsed.data.utm?.medium ?? null,
      utmCampaign: parsed.data.utm?.campaign ?? null,
      ipHash: hashIp(ip),
      cancelledAt: null,
    };
    if (existing) {
      await db.rsvp.update({
        where: { id: existing.id, tenantId: event.tenantId },
        data: { ...common, editTokenHash },
      });
    } else {
      await db.rsvp.create({ data: { ...common, editTokenHash } });
    }
    await db.guest.update({ where: { id: guest.id, tenantId: event.tenantId }, data: { paxConfirmed: pax } });
    const settings = parseSettings(event.settings, event.title);
    await notifyRsvpEvent({
      tenantId: event.tenantId, eventId: event.id, eventTitle: event.title,
      guestName: guest.name, status, pax: pax || 1,
      picPhone: settings.pic.useForRsvpConfirmation && settings.pic.phone ? settings.pic.phone : null,
      isUpdate,
    });
    await dispatchWebhookEvent(event.tenantId, isUpdate ? "rsvp.updated" : "rsvp.created", {
      eventId: event.id, guestId: guest.id, guestName: guest.name, status, pax,
      answers, submittedAt: new Date().toISOString(),
    });
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    revalidatePath(`/i/${event.slug}`);
    return ok({
      editToken,
      editUrl: `${base}/i/${event.slug}?to=${guest.token}&edit=${editToken}`,
      status, pax, guestName: guest.name,
      thankYouMessage: form.thankYouMessage,
      redirectUrl: form.redirectUrl,
      eventTitle: event.title,
    });
  } catch (error: unknown) {
    return err("RSVP_FAILED", error instanceof Error ? error.message : "Gagal menyimpan RSVP.");
  }
}

export async function updateRsvpAction(editToken: string, input: Omit<z.infer<typeof submitSchema>, "token" | "slug" | "website"> & { slug: string; token: string; website?: string }): Promise<Result<RsvpResult>> {
  const rsvp = await prisma.rsvp.findFirst({ where: { editTokenHash: sha256(editToken), cancelledAt: null } });
  if (!rsvp) return err("EDIT_INVALID", "Link perubahan tidak valid.");
  return submitRsvpAction({ ...input, website: input.website ?? "", token: input.token });
}

export async function cancelRsvpAction(editToken: string): Promise<Result<{ cancelled: true }>> {
  try {
    const rsvp = await prisma.rsvp.findFirst({ where: { editTokenHash: sha256(editToken), cancelledAt: null } });
    if (!rsvp) return err("EDIT_INVALID", "Link perubahan tidak valid.");
    const event = await prisma.event.findFirst({ where: { id: rsvp.eventId } });
    if (!event) return err("NOT_FOUND", "Acara tidak ditemukan.");
    const db = tenantClient(event.tenantId);
    await db.rsvp.update({
      where: { id: rsvp.id, tenantId: event.tenantId },
      data: { cancelledAt: new Date(), status: "DECLINED", pax: 0 },
    });
    await db.guest.update({ where: { id: rsvp.guestId, tenantId: event.tenantId }, data: { paxConfirmed: 0 } });
    await dispatchWebhookEvent(event.tenantId, "rsvp.updated", { eventId: event.id, guestId: rsvp.guestId, status: "CANCELLED" });
    return ok({ cancelled: true });
  } catch (error: unknown) {
    return err("CANCEL_FAILED", error instanceof Error ? error.message : "Gagal membatalkan RSVP.");
  }
}

export async function getPublicRsvpAction(slug: string, token: string): Promise<Result<{
  fields: RsvpField[]; form: RsvpFormConfig; guest: { name: string; email: string | null; paxAllocated: number };
  existing: { status: string; pax: number; answers: Record<string, unknown>; sessionId: string | null; mealChoice: string | null } | null;
}>> {
  try {
    const event = await prisma.event.findFirst({ where: { slug, status: "PUBLISHED" } });
    if (!event) return err("NOT_FOUND", "Undangan tidak ditemukan.");
    const db = tenantClient(event.tenantId);
    const guest = await db.guest.findFirst({ where: { token, eventId: event.id, tenantId: event.tenantId } });
    if (!guest) return err("GUEST_NOT_FOUND", "Tamu tidak ditemukan.");
    const row = await db.rsvpForm.findFirst({ where: { eventId: event.id, tenantId: event.tenantId } });
    const form = row ? parseRsvpForm({ fields: row.fields, settings: row.settings, locales: row.locales, deadlineAt: row.deadlineAt?.toISOString() ?? null, paxQuotaPerGuest: row.paxQuotaPerGuest, isClosed: row.isClosed, thankYouMessage: row.thankYouMessage, redirectUrl: row.redirectUrl }) : defaultRsvpForm();
    const rsvp = await db.rsvp.findFirst({ where: { eventId: event.id, guestId: guest.id, tenantId: event.tenantId, cancelledAt: null } });
    return ok({
      fields: form.fields,
      form,
      guest: { name: guest.name, email: guest.email, paxAllocated: guest.paxAllocated },
      existing: rsvp ? {
        status: rsvp.status, pax: rsvp.pax,
        answers: (rsvp.answers ?? {}) as Record<string, unknown>,
        sessionId: rsvp.sessionId, mealChoice: rsvp.mealChoice,
      } : null,
    });
  } catch (error: unknown) {
    return err("RSVP_LOAD_FAILED", error instanceof Error ? error.message : "Gagal memuat RSVP.");
  }
}

export async function checkQrForRsvpAction(payload: string): Promise<Result<{ guestName: string }>> {
  const decoded = verifyGuestQr(payload);
  if (!decoded) return err("QR_INVALID", "QR tidak valid.");
  const guest = await prisma.guest.findFirst({ where: { id: decoded.guestId, eventId: decoded.eventId } });
  if (!guest) return err("NOT_FOUND", "Tamu tidak ditemukan.");
  return ok({ guestName: guest.name });
}
