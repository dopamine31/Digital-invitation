import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requirePerm } from "@/lib/auth";
import { Thread } from "@/components/Thread";
import { ReplyForm } from "@/components/TicketForms";
import { replyTicketStaffAction } from "@/server/actions/admin";
import { PageHeader, StatusBadge } from "@/components/ui";

export default async function AdminTicket({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("support");
  const [row] = await db.select({ t: s.tickets, name: s.users.name, email: s.users.email }).from(s.tickets).innerJoin(s.users, eq(s.tickets.userId, s.users.id)).where(eq(s.tickets.id, Number((await params).id))).limit(1);
  if (!row) notFound();
  return (
    <>
      <Link href="/admin/support" className="text-sm text-stone-500">← Semua tiket</Link>
      <PageHeader title={row.t.subject} subtitle={`${row.name} · ${row.email}`} actions={<StatusBadge status={row.t.status} />} />
      <div className="mx-auto max-w-2xl space-y-4"><Thread ticketId={row.t.id} /><ReplyForm action={replyTicketStaffAction} ticketId={row.t.id} withStatus /></div>
    </>
  );
}
