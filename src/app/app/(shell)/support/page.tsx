import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { MessageCircle } from "lucide-react";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { requireCustomer } from "@/lib/auth";
import { getContent, getSite } from "@/server/core";
import { NewTicketForm } from "@/components/TicketForms";
import { createTicketAction } from "@/server/actions/customer";
import { Empty, PageHeader, StatusBadge } from "@/components/ui";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Bantuan" };

export default async function SupportPage() {
  const u = await requireCustomer();
  const [rows, site, c] = await Promise.all([db.select().from(tickets).where(eq(tickets.userId, u.id)).orderBy(desc(tickets.updatedAt)), getSite(), getContent()]);
  return (
    <>
      <PageHeader title="Bantuan" subtitle="Kirim tiket, hubungi kami, atau baca FAQ." actions={<a className="btn btn-ghost" href={`https://wa.me/${site.whatsapp}?text=${encodeURIComponent("Halo, saya butuh bantuan.")}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> WhatsApp</a>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-semibold">Tiket saya</h2>
          {rows.length === 0 ? <Empty title="Belum ada tiket" /> : <div className="card divide-y divide-stone-100">{rows.map((t) => (
            <Link key={t.id} href={`/app/support/${t.id}`} className="flex items-center justify-between gap-2 p-4 hover:bg-stone-50"><div className="min-w-0"><p className="truncate font-medium">{t.subject}</p><p className="text-xs text-stone-500">{timeAgo(t.updatedAt)}</p></div><StatusBadge status={t.status} /></Link>))}</div>}
          <h2 className="mb-3 mt-6 font-semibold">FAQ</h2>
          <div className="space-y-2">{c.faq.slice(0, 4).map((f) => <details key={f.q} className="card p-3"><summary className="cursor-pointer text-sm font-medium">{f.q}</summary><p className="mt-2 text-sm text-stone-600">{f.a}</p></details>)}</div>
        </div>
        <NewTicketForm action={createTicketAction} />
      </div>
    </>
  );
}
