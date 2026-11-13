import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Download } from "lucide-react";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requirePerm } from "@/lib/auth";
import { Empty, PageHeader, StatCard, StatusBadge, TableWrap } from "@/components/ui";
import { getSystem } from "@/server/core";
import { dateID, idr } from "@/lib/format";

export const metadata = { title: "Pembayaran" };

export default async function PaymentsPage() {
  await requirePerm("payments");
  const [rows, sys] = await Promise.all([db.select({ p: s.payments, o: s.orders, name: s.users.name }).from(s.payments).innerJoin(s.orders, eq(s.payments.orderId, s.orders.id)).innerJoin(s.users, eq(s.orders.userId, s.users.id)).orderBy(desc(s.payments.createdAt)).limit(300), getSystem()]);
  const ok = rows.filter((r) => r.p.status === "berhasil");
  return (
    <>
      <PageHeader title="Pembayaran" subtitle="Transaksi, verifikasi manual, refund, dan rekap pendapatan." actions={<a className="btn btn-ghost" href="/api/admin/export?type=payments"><Download size={16} /> Export CSV</a>} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Pendapatan terverifikasi" value={idr(ok.reduce((a, r) => a + r.p.amount, 0))} /><StatCard label="Menunggu verifikasi" value={rows.filter((r) => r.p.status === "menunggu_verifikasi").length} />
        <StatCard label="Refund" value={rows.filter((r) => r.p.status === "refund").length} /><StatCard label="Gateway" value={<span className="capitalize">{sys.paymentProvider}</span>} hint={sys.paymentProvider === "demo" ? "Mode demo — bukan uang sungguhan" : "Perlu kredensial & webhook"} />
      </div>
      {rows.length === 0 ? <Empty title="Belum ada transaksi" /> : (
        <TableWrap><thead><tr><th className="th">Referensi</th><th className="th">Pesanan</th><th className="th">Customer</th><th className="th">Metode</th><th className="th">Jumlah</th><th className="th">Status</th><th className="th">Tanggal</th></tr></thead>
          <tbody className="divide-y divide-stone-100">{rows.map(({ p, o, name }) => (<tr key={p.id}><td className="td font-mono text-xs">{p.reference}</td><td className="td"><Link className="underline" href={`/admin/orders/${o.id}`}>{o.number}</Link></td><td className="td">{name}</td><td className="td capitalize">{p.method}</td><td className="td">{idr(p.amount)}</td><td className="td"><StatusBadge status={p.status} /></td><td className="td text-xs text-stone-500">{dateID(p.createdAt)}</td></tr>))}</tbody></TableWrap>)}
    </>
  );
}
