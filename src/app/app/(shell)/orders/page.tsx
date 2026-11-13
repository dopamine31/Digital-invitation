import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { requireCustomer } from "@/lib/auth";
import { Empty, PageHeader, StatusBadge } from "@/components/ui";
import { dateID, idr } from "@/lib/format";

export const metadata = { title: "Pesanan & Transaksi" };

export default async function OrdersPage() {
  const u = await requireCustomer();
  const rows = await db.select().from(orders).where(eq(orders.userId, u.id)).orderBy(desc(orders.createdAt));
  return (
    <>
      <PageHeader title="Pesanan & Transaksi" subtitle="Riwayat pesanan, invoice, dan status pembayaran." />
      {rows.length === 0 ? <Empty title="Belum ada pesanan" action={<Link className="btn btn-primary" href="/app/templates">Pilih template</Link>} /> : (
        <div className="card divide-y divide-stone-100">{rows.map((o) => (
          <Link key={o.id} href={`/app/orders/${o.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-stone-50">
            <div className="min-w-0"><p className="font-medium">{o.number}</p><p className="text-xs text-stone-500">{dateID(o.createdAt)} · Paket {o.packageCode}</p></div>
            <div className="flex flex-none flex-col items-end gap-1"><span className="font-semibold">{idr(o.total)}</span><StatusBadge status={o.status} /></div>
          </Link>))}</div>)}
    </>
  );
}
