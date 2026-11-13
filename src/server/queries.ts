import { prisma } from "@/lib/db";
import { tenantClient } from "@/lib/tenant";
import { parseSections, parseSettings } from "@/lib/sections";
import { mergeThemeConfig } from "@/lib/themes";
import { parseRsvpForm } from "@/lib/rsvp";
import type { ActorContext } from "@/server/context";
import type { SectionConfig, EventSettings, ThemeConfig } from "@/lib/types";

export interface EventListItem {
  id: string; slug: string; title: string; type: string; status: string;
  startsAt: string; themeId: string; guestCount: number; rsvpCount: number;
  checkInCount: number; publishedAt: string | null;
}

export async function listEvents(tenantId: string): Promise<EventListItem[]> {
  const db = tenantClient(tenantId);
  const events = await db.event.findMany({ where: { tenantId, status: { not: "ARCHIVED" } }, orderBy: { createdAt: "desc" } });
  const ids = events.map((event) => event.id);
  const [guests, rsvps, checkIns] = await Promise.all([
    db.guest.groupBy({ by: ["eventId"], where: { eventId: { in: ids } }, _count: { _all: true } }),
    db.rsvp.groupBy({ by: ["eventId"], where: { eventId: { in: ids }, cancelledAt: null }, _count: { _all: true } }),
    db.checkIn.groupBy({ by: ["eventId"], where: { eventId: { in: ids } }, _count: { _all: true } }),
  ]);
  const count = (rows: { eventId: string; _count: { _all: number } }[], id: string) => rows.find((row) => row.eventId === id)?._count._all ?? 0;
  return events.map((event) => ({
    id: event.id, slug: event.slug, title: event.title, type: event.type, status: event.status,
    startsAt: event.startsAt.toISOString(), themeId: event.themeId,
    guestCount: count(guests, event.id), rsvpCount: count(rsvps, event.id), checkInCount: count(checkIns, event.id),
    publishedAt: event.publishedAt?.toISOString() ?? null,
  }));
}

export interface OwnerDashboard {
  eventCount: number; guestCount: number; rsvpCount: number; attendanceRate: number;
  checkInCount: number; blastCount: number; unreadNotifications: number;
  events: EventListItem[];
  recentRsvps: { guestName: string; eventTitle: string; status: string; submittedAt: string }[];
  notifications: { id: string; title: string; body: string; createdAt: string; readAt: string | null }[];
}

export async function getOwnerDashboard(tenantId: string): Promise<OwnerDashboard> {
  const db = tenantClient(tenantId);
  const [events, guests, rsvps, checkIns, blasts, notifications, recentRows] = await Promise.all([
    listEvents(tenantId),
    db.guest.count({ where: { tenantId } }),
    db.rsvp.count({ where: { tenantId, cancelledAt: null } }),
    db.checkIn.count({ where: { tenantId } }),
    db.blast.count({ where: { tenantId } }),
    db.notification.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.rsvp.findMany({ where: { tenantId }, orderBy: { submittedAt: "desc" }, take: 8 }),
  ]);
  const guestIds = recentRows.map((row) => row.guestId);
  const [guestRows, eventRows] = await Promise.all([
    db.guest.findMany({ where: { id: { in: guestIds } } }),
    db.event.findMany({ where: { id: { in: recentRows.map((row) => row.eventId) } } }),
  ]);
  const guestMap = new Map(guestRows.map((row) => [row.id, row.name]));
  const eventMap = new Map(eventRows.map((row) => [row.id, row.title]));
  return {
    eventCount: events.length, guestCount: guests, rsvpCount: rsvps,
    attendanceRate: guests > 0 ? Math.round((rsvps / guests) * 1000) / 10 : 0,
    checkInCount: checkIns, blastCount: blasts,
    unreadNotifications: notifications.filter((row) => row.readAt === null).length,
    events: events.slice(0, 6),
    recentRsvps: recentRows.map((row) => ({
      guestName: guestMap.get(row.guestId) ?? "Tamu", eventTitle: eventMap.get(row.eventId) ?? "Acara",
      status: row.status, submittedAt: row.submittedAt.toISOString(),
    })),
    notifications: notifications.map((row) => ({
      id: row.id, title: row.title, body: row.body,
      createdAt: row.createdAt.toISOString(), readAt: row.readAt?.toISOString() ?? null,
    })),
  };
}

export interface EventWorkspace {
  id: string; tenantId: string; slug: string; title: string; type: string; status: string;
  startsAt: string; timezone: string; themeId: string; coverImageUrl: string | null;
  indexable: boolean;
  theme: ThemeConfig; sections: SectionConfig[]; settings: EventSettings;
  schedules: { id: string; title: string; startsAt: string; endsAt: string | null; venueName: string; address: string; mapsUrl: string | null; timezone: string; note: string | null; sortOrder: number }[];
  versions: { version: number; note: string; createdAt: string }[];
  rsvpForm: ReturnType<typeof parseRsvpForm>;
  stats: { guests: number; rsvps: number; attending: number; checkedIn: number; wishesPending: number };
}

export async function getEventWorkspace(tenantId: string, eventId: string): Promise<EventWorkspace | null> {
  const db = tenantClient(tenantId);
  const event = await db.event.findFirst({ where: { id: eventId, tenantId } });
  if (!event) return null;
  const [schedules, versions, formRow, guests, rsvps, checkIns, wishes] = await Promise.all([
    db.eventSchedule.findMany({ where: { eventId, tenantId }, orderBy: { sortOrder: "asc" } }),
    db.eventVersion.findMany({ where: { eventId, tenantId }, orderBy: { version: "desc" }, take: 20 }),
    db.rsvpForm.findFirst({ where: { eventId, tenantId } }),
    db.guest.count({ where: { eventId, tenantId } }),
    db.rsvp.count({ where: { eventId, tenantId, cancelledAt: null } }),
    db.checkIn.count({ where: { eventId, tenantId } }),
    db.wish.count({ where: { eventId, tenantId, status: "PENDING" } }),
  ]);
  const attendingRows = await db.rsvp.findMany({ where: { eventId, tenantId, status: "ATTENDING", cancelledAt: null }, select: { pax: true } });
  return {
    id: event.id, tenantId, slug: event.slug, title: event.title, type: event.type, status: event.status,
    startsAt: event.startsAt.toISOString(), timezone: event.timezone, themeId: event.themeId,
    coverImageUrl: event.coverImageUrl, indexable: event.indexable,
    theme: mergeThemeConfig(event.themeId, event.themeConfig),
    sections: parseSections(event.sections),
    settings: parseSettings(event.settings, event.title),
    schedules: schedules.map((row) => ({
      id: row.id, title: row.title, startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt?.toISOString() ?? null, venueName: row.venueName, address: row.address,
      mapsUrl: row.mapsUrl, timezone: row.timezone, note: row.note, sortOrder: row.sortOrder,
    })),
    versions: versions.map((row) => ({ version: row.version, note: row.note, createdAt: row.createdAt.toISOString() })),
    rsvpForm: formRow ? parseRsvpForm({
      fields: formRow.fields, settings: formRow.settings, locales: formRow.locales,
      deadlineAt: formRow.deadlineAt?.toISOString() ?? null, paxQuotaPerGuest: formRow.paxQuotaPerGuest,
      isClosed: formRow.isClosed, thankYouMessage: formRow.thankYouMessage, redirectUrl: formRow.redirectUrl,
    }) : parseRsvpForm(null),
    stats: {
      guests, rsvps, attending: attendingRows.reduce((sum, row) => sum + row.pax, 0),
      checkedIn: checkIns, wishesPending: wishes,
    },
  };
}

export interface GuestRow {
  id: string; name: string; phoneMasked: string | null; email: string | null; groupLabel: string;
  paxAllocated: number; paxConfirmed: number; token: string; qrPayload: string;
  blacklisted: boolean; optOut: boolean; walkIn: boolean; tableNumber: string | null;
  seatNumber: string | null; lastOpenedAt: string | null;
  rsvpStatus: string | null; checkedIn: boolean;
}

export async function listGuests(tenantId: string, eventId: string, search = "", group = ""): Promise<GuestRow[]> {
  const db = tenantClient(tenantId);
  const guests = await db.guest.findMany({
    where: {
      eventId, tenantId,
      ...(group ? { groupLabel: group } : {}),
      ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { token: { contains: search } }] } : {}),
    },
    orderBy: { name: "asc" }, take: 2_000,
  });
  const [rsvps, checkIns] = await Promise.all([
    db.rsvp.findMany({ where: { eventId, tenantId, cancelledAt: null } }),
    db.checkIn.findMany({ where: { eventId, tenantId }, select: { guestId: true } }),
  ]);
  const rsvpMap = new Map(rsvps.map((row) => [row.guestId, row.status]));
  const checked = new Set(checkIns.map((row) => row.guestId));
  return guests.map((guest) => ({
    id: guest.id, name: guest.name, phoneMasked: guest.phoneMasked, email: guest.email,
    groupLabel: guest.groupLabel, paxAllocated: guest.paxAllocated, paxConfirmed: guest.paxConfirmed,
    token: guest.token, qrPayload: guest.qrPayload, blacklisted: guest.blacklisted,
    optOut: guest.optOut, walkIn: guest.walkIn, tableNumber: guest.tableNumber,
    seatNumber: guest.seatNumber, lastOpenedAt: guest.lastOpenedAt?.toISOString() ?? null,
    rsvpStatus: rsvpMap.get(guest.id) ?? null, checkedIn: checked.has(guest.id),
  }));
}

export interface RsvpRow {
  id: string; guestName: string; groupLabel: string; status: string; pax: number;
  sessionId: string | null; mealChoice: string | null; answers: Record<string, unknown>;
  submittedAt: string; utmSource: string | null;
}

export async function listRsvps(tenantId: string, eventId: string): Promise<RsvpRow[]> {
  const db = tenantClient(tenantId);
  const rows = await db.rsvp.findMany({ where: { eventId, tenantId, cancelledAt: null }, orderBy: { submittedAt: "desc" }, take: 2_000 });
  const guests = await db.guest.findMany({ where: { id: { in: rows.map((row) => row.guestId) }, tenantId } });
  const byId = new Map(guests.map((guest) => [guest.id, guest]));
  return rows.map((row) => ({
    id: row.id, guestName: byId.get(row.guestId)?.name ?? "Tamu",
    groupLabel: byId.get(row.guestId)?.groupLabel ?? "", status: row.status, pax: row.pax,
    sessionId: row.sessionId, mealChoice: row.mealChoice,
    answers: (row.answers ?? {}) as Record<string, unknown>,
    submittedAt: row.submittedAt.toISOString(), utmSource: row.utmSource,
  }));
}

export async function listBlasts(tenantId: string, eventId: string): Promise<{
  id: string; name: string; channel: string; status: string; total: number; sent: number; failed: number;
  scheduledAt: string | null; createdAt: string; templateBody: string;
}[]> {
  const db = tenantClient(tenantId);
  const rows = await db.blast.findMany({ where: { eventId, tenantId }, orderBy: { createdAt: "desc" }, take: 100 });
  return rows.map((row) => ({
    id: row.id, name: row.name, channel: row.channel, status: row.status,
    total: row.total, sent: row.sent, failed: row.failed,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(), templateBody: row.templateBody,
  }));
}

export async function listBlastMessages(tenantId: string, blastId: string): Promise<{
  id: string; toMasked: string | null; status: string; body: string; sentAt: string | null; error: string | null;
}[]> {
  const db = tenantClient(tenantId);
  const rows = await db.blastMessage.findMany({ where: { blastId, tenantId }, orderBy: { createdAt: "asc" }, take: 500 });
  return rows.map((row) => ({
    id: row.id, toMasked: row.toMasked, status: row.status, body: row.body,
    sentAt: row.sentAt?.toISOString() ?? null, error: row.error,
  }));
}

export async function listWishes(tenantId: string, eventId: string): Promise<{
  id: string; authorName: string; message: string; status: string; reply: string | null; createdAt: string;
}[]> {
  const db = tenantClient(tenantId);
  const rows = await db.wish.findMany({ where: { eventId, tenantId }, orderBy: { createdAt: "desc" }, take: 200 });
  return rows.map((row) => ({
    id: row.id, authorName: row.authorName, message: row.message, status: row.status,
    reply: row.reply, createdAt: row.createdAt.toISOString(),
  }));
}

export async function listNotificationLogs(tenantId: string, take = 100): Promise<{
  id: string; channel: string; provider: string; toMasked: string | null; status: string; createdAt: string;
}[]> {
  const rows = await prisma.notificationLog.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take });
  return rows.map((row) => ({
    id: row.id, channel: row.channel, provider: row.provider,
    toMasked: row.toMasked, status: row.status, createdAt: row.createdAt.toISOString(),
  }));
}

export interface BillingData {
  plan: { id: string; code: string; name: string; monthlyPrice: number; yearlyPrice: number } | null;
  plans: { id: string; code: string; name: string; monthlyPrice: number; yearlyPrice: number; limits: unknown; features: unknown }[];
  subscription: { status: string; billingCycle: string; currentPeriodEnd: string; graceUntil: string | null } | null;
  invoices: { id: string; number: string; total: number; status: string; issuedAt: string; paidAt: string | null }[];
  transactions: { id: string; amount: number; provider: string; status: string; createdAt: string }[];
  quota: { events: number; guests: number; blasts: number };
  referralCode: string | null;
}

export async function getBillingData(tenantId: string, _actor: ActorContext): Promise<BillingData> {
  const db = tenantClient(tenantId);
  const [tenant, plans, subscription, invoices, transactions, events, guests, referral] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.subscription.findFirst({ where: { tenantId, status: { not: "CANCELLED" } }, orderBy: { createdAt: "desc" } }),
    db.invoice.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.transaction.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.event.count({ where: { tenantId, status: { not: "ARCHIVED" } } }),
    db.guest.count({ where: { tenantId } }),
    prisma.referral.findFirst({ where: { tenantId } }),
  ]);
  return {
    plan: plans.find((plan) => plan.id === tenant?.planId) ?? null,
    plans: plans.map((plan) => ({
      id: plan.id, code: plan.code, name: plan.name, monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice, limits: plan.limits, features: plan.features,
    })),
    subscription: subscription ? {
      status: subscription.status, billingCycle: subscription.billingCycle,
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      graceUntil: subscription.graceUntil?.toISOString() ?? null,
    } : null,
    invoices: invoices.map((row) => ({
      id: row.id, number: row.number, total: row.total, status: row.status,
      issuedAt: row.issuedAt.toISOString(), paidAt: row.paidAt?.toISOString() ?? null,
    })),
    transactions: transactions.map((row) => ({
      id: row.id, amount: row.amount, provider: row.provider, status: row.status, createdAt: row.createdAt.toISOString(),
    })),
    quota: {
      events: events, guests,
      blasts: (await db.quotaUsage.findFirst({ where: { tenantId, metric: "blasts", period: new Date().toISOString().slice(0, 7) } }))?.used ?? 0,
    },
    referralCode: referral?.code ?? null,
  };
}


export async function getPublicTemplates(): Promise<{
  id: string; code: string; name: string; category: string; themeId: string; featured: boolean;
}[]> {
  const rows = await prisma.template.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ featured: "desc" }, { createdAt: "desc" }], take: 24 });
  return rows.map((row) => ({ id: row.id, code: row.code, name: row.name, category: row.category, themeId: row.themeId, featured: row.featured }));
}
