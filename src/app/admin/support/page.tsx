import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requirePerm } from "@/lib/auth";
import { Badge, Empty, PageHeader, StatusBadge, TableWrap } from "@/components/ui";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Tiket Bantuan" };

export default async function AdminSupport() {
  await requirePerm("support");
  const rows = await db.select({ t: s.tickets, name: s.users.name }).from(s.tickets).innerJoin(s.users, eq(s.tickets.userId, s.users.id)).orderBy(desc(s.tickets.updatedAt));
  return (
    <>
      <PageHeader title="Tiket Bantuan" subtitle={`${rows.filter((r) => r.t.status === "open").length} tiket menunggu balasan`} />
      {rows.length === 0 ? <Empty title="Belum ada tiket" /> : (
        <TableWrap><thead><tr><th className="th">Subjek</th><th className="th">Customer</th><th className="th">Prioritas</th><th className="th">Status</th><th className="th">Update</th></tr></thead>
          <tbody className="divide-y divide-stone-100">{rows.map(({ t, name }) => (<tr key={t.id} className="hover:bg-stone-50"><td className="td"><Link className="font-medium underline" href={`/admin/support/${t.id}`}>{t.subject}</Link></td><td className="td">{name}</td><td className="td">{t.priority === "high" ? <Badge tone="red">Prioritas</Badge> : <Badge>Normal</Badge>}</td><td className="td"><StatusBadge status={t.status} /></td><td className="td text-xs text-stone-500">{timeAgo(t.updatedAt)}</td></tr>))}</tbody></TableWrap>)}
    </>
  );
}
