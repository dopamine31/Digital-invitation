import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { getSession, hasPerm } from "@/lib/auth";
import { toCSV } from "@/lib/format";

export async function GET(req: Request) {
  const u = await getSession();
  const type = new URL(req.url).searchParams.get("type") ?? "payments";
  if (!u || !hasPerm(u, type === "customers" ? "customers" : "payments")) return new Response("Forbidden", { status: 403 });
  let csv = "";
  if (type === "customers") {
    const rows = await db.select().from(s.users).where(eq(s.users.role, "customer"));
    csv = toCSV([["ID", "Nama", "Email", "Telepon", "Status", "Terdaftar"], ...rows.map((r) => [r.id, r.name, r.email, r.phone, r.status, r.createdAt.toISOString()])]);
  } else {
    const rows = await db.select({ p: s.payments, o: s.orders, name: s.users.name }).from(s.payments).innerJoin(s.orders, eq(s.payments.orderId, s.orders.id)).innerJoin(s.users, eq(s.orders.userId, s.users.id)).orderBy(desc(s.payments.createdAt));
    csv = toCSV([["Referensi", "Pesanan", "Customer", "Metode", "Jumlah", "Status", "Tanggal"], ...rows.map(({ p, o, name }) => [p.reference, o.number, name, p.method, p.amount, p.status, p.createdAt.toISOString()])]);
  }
  return new Response("\uFEFF" + csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${type}.csv"` } });
}
