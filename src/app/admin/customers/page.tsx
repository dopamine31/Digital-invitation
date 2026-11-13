import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { Download } from "lucide-react";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requirePerm } from "@/lib/auth";
import { Empty, PageHeader, StatusBadge, TableWrap } from "@/components/ui";
import { dateID } from "@/lib/format";

export const metadata = { title: "Customer" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePerm("customers");
  const { q } = await searchParams;
  let rows = await db.select({ u: s.users, inv: sql<number>`(select count(*)::int from invitations i where i.user_id = ${s.users.id} and i.deleted_at is null)`, ord: sql<number>`(select count(*)::int from orders o where o.user_id = ${s.users.id})` }).from(s.users).where(eq(s.users.role, "customer"));
  if (q) rows = rows.filter((r) => `${r.u.name} ${r.u.email} ${r.u.phone}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="Customer" subtitle={`${rows.length} akun customer`} actions={<a className="btn btn-ghost" href="/api/admin/export?type=customers"><Download size={16} /> Export</a>} />
      <form className="mb-4 flex gap-2"><input name="q" defaultValue={q} className="input" placeholder="Cari nama / email / telepon" aria-label="Cari" /><button className="btn btn-primary">Cari</button></form>
      {rows.length === 0 ? <Empty title="Customer tidak ditemukan" /> : (
        <TableWrap><thead><tr><th className="th">Nama</th><th className="th">Kontak</th><th className="th">Undangan</th><th className="th">Pesanan</th><th className="th">Status</th><th className="th">Daftar</th></tr></thead>
          <tbody className="divide-y divide-stone-100">{rows.map(({ u, inv, ord }) => (<tr key={u.id} className="hover:bg-stone-50"><td className="td"><Link className="font-medium underline" href={`/admin/customers/${u.id}`}>{u.name}</Link></td><td className="td text-xs">{u.email}<br />{u.phone}</td><td className="td">{inv}</td><td className="td">{ord}</td><td className="td"><StatusBadge status={u.status} /></td><td className="td text-xs text-stone-500">{dateID(u.createdAt)}</td></tr>))}</tbody></TableWrap>)}
    </>
  );
}
