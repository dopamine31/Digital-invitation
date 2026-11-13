import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { requireCustomer } from "@/lib/auth";
import { Thread } from "@/components/Thread";
import { ReplyForm } from "@/components/TicketForms";
import { replyTicketCustomerAction } from "@/server/actions/customer";
import { PageHeader, StatusBadge } from "@/components/ui";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireCustomer();
  const [t] = await db.select().from(tickets).where(and(eq(tickets.id, Number((await params).id)), eq(tickets.userId, u.id))).limit(1);
  if (!t) notFound();
  return (
    <>
      <Link href="/app/support" className="text-sm text-stone-500">← Semua tiket</Link>
      <PageHeader title={t.subject} actions={<StatusBadge status={t.status} />} />
      <div className="mx-auto max-w-2xl space-y-4"><Thread ticketId={t.id} />{t.status !== "selesai" ? <ReplyForm action={replyTicketCustomerAction} ticketId={t.id} /> : <p className="text-center text-sm text-stone-500">Tiket telah diselesaikan.</p>}</div>
    </>
  );
}
