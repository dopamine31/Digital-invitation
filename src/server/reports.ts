import { tenantClient } from "@/lib/tenant";
import { decrypt } from "@/lib/crypto";
import { parseRsvpForm } from "@/lib/rsvp";
import type { ReportSheet } from "@/lib/exporters";

export type ReportType = "guests" | "rsvp" | "checkin" | "analytics" | "wishes" | "audit";

export interface ReportResult { sheets: ReportSheet[]; title: string }

export async function buildReport(tenantId: string, eventId: string, type: ReportType): Promise<ReportResult> {
  const db = tenantClient(tenantId);
  const event = await db.event.findFirst({ where: { id: eventId, tenantId } });
  if (!event) throw new Error("Acara tidak ditemukan.");
  if (type === "guests") {
    const guests = await db.guest.findMany({ where: { eventId, tenantId }, orderBy: { name: "asc" } });
    const rsvps = await db.rsvp.findMany({ where: { eventId, tenantId, cancelledAt: null } });
    const byGuest = new Map(rsvps.map((row) => [row.guestId, row]));
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return {
      title: `Daftar Tamu · ${event.title}`,
      sheets: [{
        name: "Tamu",
        columns: [
          { key: "name", label: "Nama" }, { key: "phone", label: "No. HP" }, { key: "email", label: "Email" },
          { key: "group", label: "Grup" }, { key: "pax", label: "Kuota Pax" }, { key: "status", label: "RSVP" },
          { key: "confirmed", label: "Pax Hadir" }, { key: "table", label: "Meja" }, { key: "seat", label: "Kursi" },
          { key: "link", label: "Link Personal" }, { key: "qr", label: "QR Payload" },
        ],
        rows: guests.map((guest) => ({
          name: guest.name,
          phone: guest.phoneEncrypted ? decrypt(guest.phoneEncrypted) : "",
          email: guest.email ?? "", group: guest.groupLabel, pax: guest.paxAllocated,
          status: byGuest.get(guest.id)?.status ?? "BELUM RSVP",
          confirmed: byGuest.get(guest.id)?.pax ?? 0,
          table: guest.tableNumber ?? "", seat: guest.seatNumber ?? "",
          link: `${base}/i/${event.slug}?to=${guest.token}`,
          qr: guest.qrPayload,
        })),
      }],
    };
  }
  if (type === "rsvp") {
    const formRow = await db.rsvpForm.findFirst({ where: { eventId, tenantId } });
    const form = formRow ? parseRsvpForm({ fields: formRow.fields }) : null;
    const rsvps = await db.rsvp.findMany({ where: { eventId, tenantId }, orderBy: { submittedAt: "desc" } });
    const guestIds = rsvps.map((row) => row.guestId);
    const guests = await db.guest.findMany({ where: { id: { in: guestIds }, tenantId } });
    const byId = new Map(guests.map((guest) => [guest.id, guest]));
    const answerColumns = (form?.fields ?? []).map((field) => ({ key: `a_${field.id}`, label: field.label.id }));
    return {
      title: `Laporan RSVP · ${event.title}`,
      sheets: [{
        name: "RSVP",
        columns: [
          { key: "name", label: "Nama Tamu" }, { key: "group", label: "Grup" },
          { key: "status", label: "Status" }, { key: "pax", label: "Jumlah Tamu" },
          { key: "session", label: "Sesi" }, { key: "meal", label: "Menu" },
          { key: "note", label: "Catatan" }, { key: "submitted", label: "Waktu Submit" },
          ...answerColumns,
        ],
        rows: rsvps.map((row) => {
          const answers = (row.answers ?? {}) as Record<string, unknown>;
          const extra: Record<string, unknown> = {};
          for (const column of answerColumns) extra[column.key] = answers[column.key.slice(2)] ?? "";
          return {
            name: byId.get(row.guestId)?.name ?? "Tamu", group: byId.get(row.guestId)?.groupLabel ?? "",
            status: row.status, pax: row.pax, session: row.sessionId ?? "", meal: row.mealChoice ?? "",
            note: row.attendanceNote ?? "", submitted: row.submittedAt,
            ...extra,
          };
        }),
      }],
    };
  }
  if (type === "checkin") {
    const checkins = await db.checkIn.findMany({ where: { eventId, tenantId }, orderBy: { at: "desc" } });
    const guests = await db.guest.findMany({ where: { id: { in: checkins.map((row) => row.guestId) }, tenantId } });
    const byId = new Map(guests.map((guest) => [guest.id, guest]));
    return {
      title: `Log Check-in · ${event.title}`,
      sheets: [{
        name: "Check-in",
        columns: [
          { key: "name", label: "Nama" }, { key: "group", label: "Grup" }, { key: "table", label: "Meja" },
          { key: "station", label: "Loket" }, { key: "device", label: "Perangkat" },
          { key: "method", label: "Metode" }, { key: "offline", label: "Dari Offline" }, { key: "at", label: "Waktu" },
        ],
        rows: checkins.map((row) => ({
          name: byId.get(row.guestId)?.name ?? "Tamu", group: byId.get(row.guestId)?.groupLabel ?? "",
          table: byId.get(row.guestId)?.tableNumber ?? "", station: row.station, device: row.deviceId,
          method: row.method, offline: row.syncedFromOffline ? "Ya" : "Tidak", at: row.at,
        })),
      }],
    };
  }
  if (type === "wishes") {
    const wishes = await db.wish.findMany({ where: { eventId, tenantId }, orderBy: { createdAt: "desc" } });
    return {
      title: `Ucapan · ${event.title}`,
      sheets: [{
        name: "Ucapan",
        columns: [
          { key: "name", label: "Nama" }, { key: "message", label: "Ucapan" }, { key: "status", label: "Status" },
          { key: "reply", label: "Balasan" }, { key: "at", label: "Waktu" },
        ],
        rows: wishes.map((row) => ({ name: row.authorName, message: row.message, status: row.status, reply: row.reply ?? "", at: row.createdAt })),
      }],
    };
  }
  // analytics: ringkasan + heatmap section + sumber UTM
  const [visits, rsvps, guests] = await Promise.all([
    db.guestVisit.findMany({ where: { eventId, tenantId } }),
    db.rsvp.findMany({ where: { eventId, tenantId, cancelledAt: null } }),
    db.guest.findMany({ where: { eventId, tenantId } }),
  ]);
  const sections = new Map<string, number>();
  for (const visit of visits) sections.set(visit.sectionKey, (sections.get(visit.sectionKey) ?? 0) + 1);
  const sources = new Map<string, number>();
  for (const visit of visits) sources.set(visit.utmSource ?? "direct", (sources.get(visit.utmSource ?? "direct") ?? 0) + 1);
  const byStatus = new Map<string, number>();
  for (const row of rsvps) byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);
  return {
    title: `Analitik · ${event.title}`,
    sheets: [
      {
        name: "Ringkasan",
        columns: [{ key: "metric", label: "Metrik" }, { key: "value", label: "Nilai" }],
        rows: [
          { metric: "Total tamu", value: guests.length },
          { metric: "Pembukaan undangan", value: visits.length },
          { metric: "Pengunjung unik", value: new Set(visits.map((v) => v.guestId ?? v.ipHash)).size },
          { metric: "RSVP diterima", value: rsvps.length },
          { metric: "RSVP hadir", value: byStatus.get("ATTENDING") ?? 0 },
          { metric: "RSVP tidak hadir", value: byStatus.get("DECLINED") ?? 0 },
          { metric: "RSVP mungkin", value: byStatus.get("MAYBE") ?? 0 },
        ],
      },
      {
        name: "Section",
        columns: [{ key: "section", label: "Section" }, { key: "views", label: "Dilihat" }],
        rows: [...sections.entries()].map(([section, views]) => ({ section, views })).sort((a, b) => Number(b.views) - Number(a.views)),
      },
      {
        name: "Sumber",
        columns: [{ key: "source", label: "Sumber / UTM" }, { key: "clicks", label: "Klik" }],
        rows: [...sources.entries()].map(([source, clicks]) => ({ source, clicks })).sort((a, b) => Number(b.clicks) - Number(a.clicks)),
      },
    ],
  };
}
