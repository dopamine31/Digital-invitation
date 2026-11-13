import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requirePerm } from "@/lib/auth";
import { PageHeader, TableWrap } from "@/components/ui";
import { dateID } from "@/lib/format";

export const metadata = { title: "Audit Log" };

export default async function LogsPage() {
  await requirePerm("logs");
  const rows = await db.select({ l: s.activityLogs, name: s.users.name, role: s.users.role }).from(s.activityLogs).leftJoin(s.users, eq(s.activityLogs.userId, s.users.id)).orderBy(desc(s.activityLogs.createdAt)).limit(200);
  return (
    <>
      <PageHeader title="Audit Log" subtitle="200 aktivitas terakhir dari seluruh pengguna." />
      <TableWrap><thead><tr><th className="th">Waktu</th><th className="th">Pengguna</th><th className="th">Aksi</th><th className="th">Objek</th><th className="th">Detail</th></tr></thead>
        <tbody className="divide-y divide-stone-100">{rows.map(({ l, name, role }) => (<tr key={l.id}><td className="td whitespace-nowrap text-xs text-stone-500">{dateID(l.createdAt, true)}</td><td className="td">{name ?? "Sistem"} <span className="text-[10px] text-stone-400">{role}</span></td><td className="td font-medium">{l.action}</td><td className="td text-xs">{l.entity}{l.entityId ? ` #${l.entityId}` : ""}</td><td className="td max-w-[260px] truncate text-xs text-stone-500">{l.detail}</td></tr>))}</tbody></TableWrap>
    </>
  );
}
