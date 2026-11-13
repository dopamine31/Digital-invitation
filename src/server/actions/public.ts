"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { tenantClient } from "@/lib/tenant";
import { requireEvent, audit } from "@/server/context";
import { rateLimit } from "@/lib/ratelimit";
import { hashIp, normalizePhone, sha256 } from "@/lib/crypto";
import { toInputJson } from "@/lib/db-json";
import { err, ok, type Result } from "@/lib/result";
import { parseSettings } from "@/lib/sections";
import { whatsappLink } from "@/lib/format";
import { stripTags } from "@/lib/sanitize";
import { recordVisit } from "@/server/public";

const wishSchema = z.object({
  slug: z.string(), token: z.string().nullable(), name: z.string().min(2).max(120),
  message: z.string().min(2).max(1000), consent: z.boolean(), website: z.string().default(""),
});

export async function submitWishAction(input: z.infer<typeof wishSchema>): Promise<Result<{ id: string; moderated: boolean }>> {
  const parsed = wishSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", parsed.error.issues[0]?.message ?? "Ucapan tidak valid.");
  if (parsed.data.website.length > 0) return err("BOT_DETECTED", "Permintaan ditolak.");
  const head = await headers();
  const ip = head.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await rateLimit(`wish:${parsed.data.slug}:${sha256(ip)}`, 5, 120);
  if (!limit.allowed) return err("RATE_LIMIT", "Terlalu banyak ucapan. Coba lagi nanti.");
  try {
    const event = await prisma.event.findFirst({ where: { slug: parsed.data.slug, status: "PUBLISHED" } });
    if (!event) return err("NOT_FOUND", "Undangan tidak ditemukan.");
    const db = tenantClient(event.tenantId);
    const guest = parsed.data.token ? await db.guest.findFirst({ where: { token: parsed.data.token, eventId: event.id, tenantId: event.tenantId } }) : null;
    const settings = parseSettings(event.settings, event.title);
    const wish = await db.wish.create({
      data: {
        tenantId: event.tenantId, eventId: event.id, guestId: guest?.id ?? null,
        authorName: stripTags(parsed.data.name), message: stripTags(parsed.data.message),
        status: settings.wishesModerated ? "PENDING" : "APPROVED",
        ipHash: hashIp(ip),
      },
    });
    revalidatePath(`/i/${event.slug}`);
    return ok({ id: wish.id, moderated: settings.wishesModerated });
  } catch (error: unknown) {
    return err("WISH_FAILED", error instanceof Error ? error.message : "Gagal mengirim ucapan.");
  }
}

export async function moderateWishAction(eventId: string, wishId: string, status: "APPROVED" | "REJECTED", reply?: string): Promise<Result<{ ok: true }>> {
  try {
    const { actor, db } = await requireEvent(eventId, "moderation.manage");
    await db.wish.update({
      where: { id: wishId, tenantId: actor.tenantId },
      data: { status, reply: reply ? stripTags(reply).slice(0, 500) : null, moderatedAt: new Date(), moderatedBy: actor.actorId },
    });
    await audit(actor, "wish.moderate", "Wish", wishId, undefined, { status });
    return ok({ ok: true });
  } catch (error: unknown) {
    return err("WISH_FAILED", error instanceof Error ? error.message : "Gagal memoderasi ucapan.");
  }
}

export async function submitGuestBookAction(input: { slug: string; token: string | null; name: string; message: string; website?: string }): Promise<Result<{ id: string }>> {
  if (input.website) return err("BOT_DETECTED", "Permintaan ditolak.");
  const head = await headers();
  const ip = head.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await rateLimit(`guestbook:${input.slug}:${sha256(ip)}`, 5, 120);
  if (!limit.allowed) return err("RATE_LIMIT", "Terlalu banyak entri. Coba lagi nanti.");
  if (input.name.trim().length < 2) return err("VALIDATION", "Nama minimal 2 karakter.");
  try {
    const event = await prisma.event.findFirst({ where: { slug: input.slug, status: "PUBLISHED" } });
    if (!event) return err("NOT_FOUND", "Undangan tidak ditemukan.");
    const db = tenantClient(event.tenantId);
    const guest = input.token ? await db.guest.findFirst({ where: { token: input.token, eventId: event.id, tenantId: event.tenantId } }) : null;
    const entry = await db.guestBookEntry.create({
      data: {
        tenantId: event.tenantId, eventId: event.id, guestId: guest?.id ?? null,
        name: stripTags(input.name).slice(0, 120), message: stripTags(input.message).slice(0, 500),
      },
    });
    return ok({ id: entry.id });
  } catch (error: unknown) {
    return err("GUESTBOOK_FAILED", error instanceof Error ? error.message : "Gagal menandatangani buku tamu.");
  }
}

export async function requestLinkAction(input: { slug: string; name: string; phone: string }): Promise<Result<{ waUrl: string }>> {
  const parsed = z.object({ slug: z.string(), name: z.string().min(2).max(120), phone: z.string().min(8).max(25) }).safeParse(input);
  if (!parsed.success) return err("VALIDATION", "Nama dan nomor WhatsApp wajib diisi.");
  try {
    const event = await prisma.event.findFirst({ where: { slug: parsed.data.slug, status: "PUBLISHED" } });
    if (!event) return err("NOT_FOUND", "Undangan tidak ditemukan.");
    const settings = parseSettings(event.settings, event.title);
    const picPhone = normalizePhone(settings.pic.phone);
    const message = `Assalamu'alaikum ${settings.pic.name}, saya ${parsed.data.name} (${normalizePhone(parsed.data.phone)}). Mohon kirimkan link undangan ${event.title} untuk saya. Terima kasih.`;
    await prisma.notificationLog.create({
      data: {
        tenantId: event.tenantId, channel: "WHATSAPP", provider: "request-link",
        toMasked: `${picPhone.slice(0, 5)}****${picPhone.slice(-2)}`,
        templateKey: "guest.request_link",
        payload: toInputJson({ guestName: parsed.data.name, eventId: event.id }),
        status: "PENDING", response: toInputJson({}),
      },
    });
    return ok({ waUrl: whatsappLink(picPhone, message) });
  } catch (error: unknown) {
    return err("REQUEST_FAILED", error instanceof Error ? error.message : "Gagal meminta link.");
  }
}

export async function reportAbuseAction(input: { slug: string; reason: string; details: string; email?: string }): Promise<Result<{ ok: true }>> {
  const parsed = z.object({ slug: z.string(), reason: z.string().min(3).max(120), details: z.string().max(1000).default(""), email: z.string().email().optional() }).safeParse(input);
  if (!parsed.success) return err("VALIDATION", "Laporan tidak valid.");
  try {
    const event = await prisma.event.findFirst({ where: { slug: parsed.data.slug } });
    await prisma.reportAbuse.create({
      data: {
        tenantId: event?.tenantId ?? null, eventId: event?.id ?? null,
        reporterEmail: parsed.data.email ?? null,
        reason: stripTags(parsed.data.reason), details: stripTags(parsed.data.details),
      },
    });
    return ok({ ok: true });
  } catch (error: unknown) {
    return err("REPORT_FAILED", error instanceof Error ? error.message : "Gagal mengirim laporan.");
  }
}

export async function recordSectionViewAction(input: { slug: string; token: string | null; sectionKey: string }): Promise<Result<{ ok: true }>> {
  try {
    const event = await prisma.event.findFirst({ where: { slug: input.slug, status: "PUBLISHED" }, select: { id: true, tenantId: true, slug: true } });
    if (!event) return ok({ ok: true });
    const db = tenantClient(event.tenantId);
    const guest = input.token ? await db.guest.findFirst({ where: { token: input.token, eventId: event.id, tenantId: event.tenantId }, select: { id: true } }) : null;
    await recordVisit({
      tenantId: event.tenantId, eventId: event.id, guestId: guest?.id ?? null,
      sectionKey: input.sectionKey.slice(0, 60), path: `/i/${event.slug}`,
    });
    return ok({ ok: true });
  } catch {
    return ok({ ok: true });
  }
}
