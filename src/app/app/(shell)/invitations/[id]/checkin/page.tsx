import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { guests } from "@/db/schema";
import { requireCustomer } from "@/lib/auth";
import { getEntForInvitation, getOwnedInvitation } from "@/server/core";
import { CheckinClient } from "@/components/CheckinClient";
import { Empty, PageHeader, StatCard } from "@/components/ui";
import { dateID } from "@/lib/format";

export const metadata = { title: "Check-in Event" };

export default async function CheckinPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireCustomer();
  const inv = await getOwnedInvitation(Number((await params).id), u.id);
  if (!inv) notFound();
  const ent = await getEntForInvitation(inv);
  if (!ent.checkin) return (<><PageHeader title="Check-in Event" /><Empty title="Check-in tersedia di paket Premium" text="Scan QR tamu, cegah check-in ganda, dan lihat rekap kehadiran." action={<Link className="btn btn-brand" href={`/app/checkout?invitation=${inv.id}`}>Upgrade paket</Link>} /></>);
  const rows = await db.select().from(guests).where(eq(guests.invitationId, inv.id)).orderBy(desc(guests.checkedInAt));
  const done = rows.filter((g) => g.checkedInAt);
  return (
    <>
      <Link href="/app/invitations" className="text-sm text-stone-500">← Undangan saya</Link>
      <PageHeader title={`Check-in · ${inv.title}`} subtitle="Pindai QR tamu di pintu masuk. Check-in ganda otomatis ditolak." />
      <div className="mb-4 grid grid-cols-3 gap-3"><StatCard label="Sudah hadir" value={done.length} /><StatCard label="Total tamu" value={rows.length} /><StatCard label="Kehadiran" value={`${rows.length ? Math.round((done.length / rows.length) * 100) : 0}%`} /></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <CheckinClient invId={inv.id} />
        <div className="card p-4"><h2 className="mb-3 font-semibold">Rekap kehadiran</h2>
          {done.length === 0 ? <p className="text-sm text-stone-500">Belum ada tamu yang check-in.</p> : <ul className="divide-y divide-stone-100">{done.map((g) => (<li key={g.id} className="flex items-center justify-between py-2 text-sm"><span>{g.name}</span><span className="text-right text-xs text-stone-500">{dateID(g.checkedInAt, true)}<br />oleh {g.checkedInBy}</span></li>))}</ul>}</div>
      </div>
    </>
  );
}
