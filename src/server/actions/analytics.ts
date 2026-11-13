"use server";

import { requireEvent } from "@/server/context";
import { err, ok, type Result } from "@/lib/result";
import { percent } from "@/lib/format";

export interface AnalyticsData {
  guests: number;
  visits: number;
  uniqueVisitors: number;
  opened: number;
  rsvpTotal: number;
  attending: number;
  declined: number;
  maybe: number;
  pending: number;
  rsvpRate: number;
  paxExpected: number;
  checkedIn: number;
  timeline: { date: string; visits: number; rsvps: number }[];
  answerBreakdown: { fieldId: string; label: string; counts: { value: string; count: number }[] }[];
  utmSources: { source: string; clicks: number }[];
  sectionHeatmap: { section: string; views: number }[];
}

export async function getAnalyticsAction(eventId: string): Promise<Result<AnalyticsData>> {
  try {
    const { actor, db } = await requireEvent(eventId, "analytics.read");
    const [guests, visits, rsvps, checkIns, formRow] = await Promise.all([
      db.guest.findMany({ where: { eventId, tenantId: actor.tenantId }, select: { id: true, lastOpenedAt: true } }),
      db.guestVisit.findMany({ where: { eventId, tenantId: actor.tenantId }, select: { guestId: true, ipHash: true, sectionKey: true, utmSource: true, createdAt: true } }),
      db.rsvp.findMany({ where: { eventId, tenantId: actor.tenantId, cancelledAt: null } }),
      db.checkIn.count({ where: { eventId, tenantId: actor.tenantId } }),
      db.rsvpForm.findFirst({ where: { eventId, tenantId: actor.tenantId } }),
    ]);
    const unique = new Set(visits.map((visit) => visit.guestId ?? visit.ipHash ?? "anon")).size;
    const byStatus = { ATTENDING: 0, DECLINED: 0, MAYBE: 0 };
    for (const row of rsvps) if (row.status in byStatus) byStatus[row.status as keyof typeof byStatus] += 1;
    const paxExpected = rsvps.filter((row) => row.status === "ATTENDING").reduce((sum, row) => sum + row.pax, 0);
    const timelineMap = new Map<string, { visits: number; rsvps: number }>();
    for (const visit of visits) {
      const key = visit.createdAt.toISOString().slice(0, 10);
      const entry = timelineMap.get(key) ?? { visits: 0, rsvps: 0 };
      entry.visits += 1;
      timelineMap.set(key, entry);
    }
    for (const rsvp of rsvps) {
      const key = rsvp.submittedAt.toISOString().slice(0, 10);
      const entry = timelineMap.get(key) ?? { visits: 0, rsvps: 0 };
      entry.rsvps += 1;
      timelineMap.set(key, entry);
    }
    const fields = Array.isArray(formRow?.fields) ? (formRow?.fields as { id: string; label?: { id?: string; en?: string }; type?: string }[]) : [];
    const answerBreakdown = fields
      .filter((field) => ["select", "radio", "multiselect", "checkbox"].includes(field.type ?? ""))
      .map((field) => {
        const counts = new Map<string, number>();
        for (const rsvp of rsvps) {
          const value = (rsvp.answers as Record<string, unknown> | null)?.[field.id];
          const key = Array.isArray(value) ? value.join(",") : value == null ? "(kosong)" : String(value);
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        return {
          fieldId: field.id, label: field.label?.id ?? field.id,
          counts: [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
        };
      });
    const utmMap = new Map<string, number>();
    const sectionMap = new Map<string, number>();
    for (const visit of visits) {
      utmMap.set(visit.utmSource ?? "direct", (utmMap.get(visit.utmSource ?? "direct") ?? 0) + 1);
      sectionMap.set(visit.sectionKey, (sectionMap.get(visit.sectionKey) ?? 0) + 1);
    }
    const rsvpGuestIds = new Set(rsvps.map((row) => row.guestId));
    return ok({
      guests: guests.length,
      visits: visits.length,
      uniqueVisitors: unique,
      opened: guests.filter((guest) => guest.lastOpenedAt !== null).length,
      rsvpTotal: rsvps.length,
      attending: byStatus.ATTENDING,
      declined: byStatus.DECLINED,
      maybe: byStatus.MAYBE,
      pending: guests.length - rsvpGuestIds.size,
      rsvpRate: percent(rsvps.length, guests.length),
      paxExpected,
      checkedIn: checkIns,
      timeline: [...timelineMap.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-30).map(([date, value]) => ({ date, ...value })),
      answerBreakdown,
      utmSources: [...utmMap.entries()].map(([source, clicks]) => ({ source, clicks })).sort((a, b) => b.clicks - a.clicks),
      sectionHeatmap: [...sectionMap.entries()].map(([section, views]) => ({ section, views })).sort((a, b) => b.views - a.views),
    });
  } catch (error: unknown) {
    return err("ANALYTICS_FAILED", error instanceof Error ? error.message : "Gagal memuat analitik.");
  }
}
