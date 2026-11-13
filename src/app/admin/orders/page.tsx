import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requirePerm } from "@/lib/auth";
import { Empty, ORDER_STATUSES, PageHeader, STATUS_LABEL, StatusBadge, TableWrap } from "@/components/ui";
import { dateID, idr } from "@/lib/format";

export const metadata = { title: "Manajemen Pesanan" };

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string; mine?: string; q?: string }> }) {
  const u = await requirePerm("orders");
  const sp = await searchParams;
  let rows = await db.select({ o: s.orders, name: s.users.name, email: s.users.email }).from(s.orders).innerJoin(s.users, eq(s.orders.userId, s.users.id)).orderBy(desc(s.orders.createdAt)).limit(300);
  if (sp.status) rows = rows.filter((r) => r.o.status === sp.status);
  if (sp.mine || u.role === "staff") rows = rows.filter((r) => r.o.assignedTo === u.id || (u.role === "staff" && !r.o.assignedTo));
  if (sp.q) rows = rows.filter((r) => `${r.o.number} ${r.name} ${r.email}`.toLowerCase().includes(sp.q!.toLowerCase()));
  const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(s.orders);
  return (
    <>
      <PageHeader title="Pesanan" subtitle={`${rows.length} dari ${c} pesanan`} />
      <form className="mb-4 flex flex-wrap gap-2" action="/admin/orders">
        <input name="q" defaultValue={sp.q} className="input !w-auto min-w-[200px] flex-1" placeholder="Cari nomor / nama / email" aria-label="Cari" />
        <select name="status" defaultValue={sp.status ?? ""} className="input !w-auto" aria-label="Status"><option value="">Semua status</option>{ORDER_STATUSES.map((x) => <option key={x} value={x}>{STATUS_LABEL[x]}</option>)}</select>
        <button className="btn btn-primary">Filter</button>{u.role === "owner" && <Link className="btn btn-ghost" href="/admin/orders?mine=1">Ditugaskan ke saya</Link>}
      </form>
      {rows.length === 0 ? <Empty title="Tidak ada pesanan" /> : (
        <TableWrap><thead><tr><th className="th">Nomor</th><th className="th">Customer</th><th className="th">Paket</th><th className="th">Total</th><th className="th">Status</th><th className="th">Tanggal</th></tr></thead>
          <tbody className="divide-y divide-stone-100">{rows.map(({ o, name }) => (<tr key={o.id} className="hover:bg-stone-50"><td className="td"><Link className="font-medium underline" href={`/admin/orders/${o.id}`}>{o.number}</Link>{o.isCustomDesign && <span className="ml-1 text-[10px]">🎨</span>}</td><td className="td">{name}</td><td className="td capitalize">{o.packageCode}</td><td className="td">{idr(o.total)}</td><td className="td"><StatusBadge status={o.status} /></td><td className="td whitespace-nowrap text-xs text-stone-500">{dateID(o.createdAt)}</td></tr>))}</tbody></TableWrap>)}
    </>
  );
}
