import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Bell } from "lucide-react";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ActionForm, Submit } from "@/components/ActionForm";
import { markNotificationsReadAction } from "@/server/actions/customer";
import { Empty, PageHeader } from "@/components/ui";
import { timeAgo } from "@/lib/format";

export async function NotificationList() {
  const u = await requireUser();
  const rows = await db.select().from(notifications).where(eq(notifications.userId, u.id)).orderBy(desc(notifications.createdAt)).limit(100);
  return (
    <>
      <PageHeader title="Notifikasi" actions={<ActionForm action={markNotificationsReadAction}><input type="hidden" name="id" value="0" /><Submit className="btn btn-ghost btn-sm">Tandai semua dibaca</Submit></ActionForm>} />
      {rows.length === 0 ? <Empty title="Tidak ada notifikasi" /> : (
        <div className="card divide-y divide-stone-100">{rows.map((n) => (
          <div key={n.id} className={`flex items-start gap-3 p-4 ${n.read ? "" : "bg-amber-50/60"}`}>
            <span className="mt-0.5 rounded-full bg-stone-100 p-2"><Bell size={14} /></span>
            <div className="min-w-0 flex-1"><p className={`text-sm ${n.read ? "" : "font-semibold"}`}>{n.title}</p><p className="text-xs text-stone-500">{n.body}</p><p className="mt-1 text-[11px] text-stone-400">{timeAgo(n.createdAt)}</p></div>
            {n.link && <Link href={n.link} className="btn btn-ghost btn-sm">Buka</Link>}
          </div>))}</div>)}
    </>
  );
}
