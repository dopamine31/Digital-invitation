import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { getSession } from "@/lib/auth";
import { toCSV } from "@/lib/format";
import { getEntForInvitation, getOwnedInvitation } from "@/server/core";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await getSession();
  if (!u || u.role !== "customer") return new Response("Unauthorized", { status: 401 });
  const inv = await getOwnedInvitation(Number((await ctx.params).id), u.id);
  if (!inv) return new Response("Not found", { status: 404 });
  const ent = await getEntForInvitation(inv);
  const type = new URL(req.url).searchParams.get("type") ?? "guests";
  let csv = "";
  if (type === "rsvp") {
    if (!ent.exportData) return new Response("Export laporan RSVP tersedia pada paket Exclusive.", { status: 403 });
    const rows = await db.select().from(s.rsvps).where(eq(s.rsvps.invitationId, inv.id)).orderBy(desc(s.rsvps.createdAt));
    csv = toCSV([["Nama", "Hadir", "Jumlah", "Pesan", "Waktu"], ...rows.map((r) => [r.name, r.attending ? "Ya" : "Tidak", r.count, r.message, r.createdAt.toISOString()])]);
  } else {
    if (!ent.personalized) return new Response("Fitur tamu personal tidak tersedia pada paket Anda.", { status: 403 });
    const base = new URL(req.url).origin;
    const rows = await db.select().from(s.guests).where(eq(s.guests.invitationId, inv.id));
    csv = toCSV([["Nama", "Telepon", "Kategori", "Kelompok", "Status Kehadiran", "Dibagikan", "Dibuka", "Check-in", "Link"],
      ...rows.map((g) => [g.name, g.phone, g.category, g.groupName, g.attendance, g.shared ? "Ya" : "Belum", g.opens, g.checkedInAt?.toISOString() ?? "", `${base}/i/${inv.slug}?to=${encodeURIComponent(g.name)}&g=${g.code}`])]);
  }
  return new Response("\uFEFF" + csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${inv.slug}-${type}.csv"` } });
}
