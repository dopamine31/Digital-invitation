import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { TIER_RANK } from "@/lib/entitlements";
import { logActivity, notify } from "@/server/core";

export function genOrderNumber() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `INV-${d}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/** Dipanggil setelah pembayaran terverifikasi: menaikkan paket undangan + memberi masa aktif + memperbarui status pesanan. */
export async function applyPaidOrder(orderId: number, actorId: number | null) {
  const [o] = await db.select().from(s.orders).where(eq(s.orders.id, orderId)).limit(1);
  if (!o) return;
  const [pkg] = await db.select().from(s.packages).where(eq(s.packages.code, o.packageCode)).limit(1);
  if (o.invitationId) {
    const [inv] = await db.select().from(s.invitations).where(eq(s.invitations.id, o.invitationId)).limit(1);
    if (inv) {
      const newCode = (TIER_RANK[o.packageCode] ?? 0) >= (TIER_RANK[inv.packageCode] ?? 0) ? o.packageCode : inv.packageCode;
      const addons = Array.from(new Set([...(inv.addons ?? []), ...(o.addons ?? [])]));
      const days = pkg?.durationDays ?? 30;
      await db.update(s.invitations).set({ packageCode: newCode, addons, expireAt: new Date(Date.now() + days * 86400_000), updatedAt: new Date() }).where(eq(s.invitations.id, inv.id));
    }
  }
  await db.update(s.payments).set({ status: "berhasil", verifiedBy: actorId }).where(eq(s.payments.orderId, o.id));
  const next = o.isCustomDesign ? "dalam_pengerjaan" : "dibayar";
  await db.update(s.orders).set({ status: next, updatedAt: new Date() }).where(eq(s.orders.id, o.id));
  await notify(o.userId, "payment", "Pembayaran diterima", `Pesanan ${o.number} telah lunas. ${o.isCustomDesign ? "Tim desain mulai mengerjakan." : "Anda bisa menerbitkan undangan."}`, o.invitationId ? `/app/invitations/${o.invitationId}/edit` : "/app/orders");
  await logActivity(actorId, "Pembayaran terverifikasi", "order", o.id, o.number);
}

export async function bumpVoucher(code: string | null | undefined) {
  if (code) await db.update(s.vouchers).set({ used: sql`${s.vouchers.used} + 1` }).where(eq(s.vouchers.code, code));
}
