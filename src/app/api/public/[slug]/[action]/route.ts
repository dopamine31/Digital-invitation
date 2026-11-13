import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { sanitize } from "@/lib/format";
import { getEntForInvitation, notify } from "@/server/core";
import { isLive, loadInvitationBySlug } from "@/server/invitations";

const rsvpSchema = z.object({
  name: z.string().min(2).max(80), attending: z.boolean(), count: z.number().int().min(0).max(10), message: z.string().max(300).optional().default(""),
  guest: z.string().max(40).optional(), website: z.string().max(200).optional(),
});
const wishSchema = z.object({ name: z.string().min(2).max(80), message: z.string().min(2).max(300), website: z.string().max(200).optional() });

const err = (message: string, status = 400) => NextResponse.json({ message }, { status });

export async function POST(req: Request, ctx: { params: Promise<{ slug: string; action: string }> }) {
  const { slug, action } = await ctx.params;
  const row = await loadInvitationBySlug(slug);
  if (!row || !isLive(row.inv)) return err("Undangan tidak ditemukan.", 404);
  const { inv } = row;
  const ip = clientIp(req);
  const body = await req.json().catch(() => ({}));

  if (action === "visit") {
    if (!rateLimit(`visit:${ip}:${slug}`, 30, 60_000)) return NextResponse.json({ ok: true });
    await db.update(s.invitations).set({ views: sql`${s.invitations.views} + 1` }).where(eq(s.invitations.id, inv.id));
    const g = typeof body.g === "string" ? body.g.slice(0, 40) : "";
    if (g) await db.update(s.guests).set({ opens: sql`${s.guests.opens} + 1`, openedAt: new Date() }).where(and(eq(s.guests.code, g), eq(s.guests.invitationId, inv.id)));
    return NextResponse.json({ ok: true });
  }

  if (action === "rsvp") {
    if (!rateLimit(`rsvp:${ip}:${slug}`, 5, 10 * 60_000)) return err("Terlalu banyak percobaan. Coba lagi beberapa menit lagi.", 429);
    const p = rsvpSchema.safeParse(body);
    if (!p.success) return err("Data tidak valid. Periksa nama dan jumlah tamu.");
    if (p.data.website) return NextResponse.json({ message: "Terima kasih." }); // honeypot (bot)
    if (inv.settings?.rsvpEnabled === false) return err("RSVP dinonaktifkan.");
    const dl = (inv.data as { rsvpDeadline?: string }).rsvpDeadline;
    if (dl && new Date(dl + "T23:59:59+07:00").getTime() < Date.now()) return err("Batas konfirmasi telah berakhir.");
    let guestId: number | null = null;
    if (p.data.guest) {
      const [g] = await db.select().from(s.guests).where(and(eq(s.guests.code, p.data.guest), eq(s.guests.invitationId, inv.id))).limit(1);
      if (g) { guestId = g.id; await db.update(s.guests).set({ attendance: p.data.attending ? "hadir" : "tidak" }).where(eq(s.guests.id, g.id)); }
    }
    await db.insert(s.rsvps).values({ invitationId: inv.id, guestId, name: sanitize(p.data.name, 80), attending: p.data.attending, count: p.data.count, message: sanitize(p.data.message, 300) });
    await notify(inv.userId, "rsvp", "RSVP baru masuk", `${sanitize(p.data.name, 80)} ${p.data.attending ? `hadir (${p.data.count} orang)` : "tidak hadir"}.`, `/app/invitations/${inv.id}/rsvp`);
    return NextResponse.json({ message: p.data.attending ? "Terima kasih! Kehadiran Anda sudah tercatat." : "Terima kasih atas konfirmasinya." });
  }

  if (action === "wish") {
    const ent = await getEntForInvitation({ packageCode: inv.packageCode, addons: inv.addons });
    if (!ent.guestbook) return err("Fitur ucapan tidak tersedia.", 403);
    if (!rateLimit(`wish:${ip}:${slug}`, 4, 10 * 60_000)) return err("Terlalu banyak ucapan. Coba lagi nanti.", 429);
    const p = wishSchema.safeParse(body);
    if (!p.success) return err("Nama dan ucapan wajib diisi.");
    if (p.data.website) return NextResponse.json({ message: "Terima kasih." });
    const moderate = !!inv.settings?.moderate;
    const [w] = await db.insert(s.wishes).values({ invitationId: inv.id, name: sanitize(p.data.name, 80), message: sanitize(p.data.message, 300), approved: !moderate }).returning();
    await notify(inv.userId, "wish", "Ucapan baru", `${w.name} mengirim ucapan${moderate ? " (menunggu persetujuan)" : ""}.`, `/app/invitations/${inv.id}/rsvp`);
    return NextResponse.json({
      message: moderate ? "Ucapan terkirim dan menunggu persetujuan pemilik undangan." : "Ucapan Anda terkirim. Terima kasih!",
      wish: moderate ? null : { id: w.id, name: w.name, message: w.message, createdAt: w.createdAt.toISOString() },
    });
  }
  return err("Aksi tidak dikenal.", 404);
}
