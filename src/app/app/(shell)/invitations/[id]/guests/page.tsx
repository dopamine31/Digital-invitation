import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { guests } from "@/db/schema";
import { requireCustomer } from "@/lib/auth";
import { getEntForInvitation, getOwnedInvitation } from "@/server/core";
import { getBaseUrl } from "@/server/invitations";
import { GuestManager } from "@/components/GuestManager";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Kelola Tamu" };

export default async function GuestsPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireCustomer();
  const inv = await getOwnedInvitation(Number((await params).id), u.id);
  if (!inv) notFound();
  const [ent, baseUrl] = await Promise.all([getEntForInvitation(inv), getBaseUrl()]);
  const rows = await db.select().from(guests).where(eq(guests.invitationId, inv.id)).orderBy(asc(guests.name));
  return (
    <>
      <Link href="/app/invitations" className="text-sm text-stone-500">← Undangan saya</Link>
      <PageHeader title={`Tamu · ${inv.title}`} subtitle="Link personal, kirim WhatsApp, QR tamu, import & export." />
      <GuestManager invId={inv.id} slug={inv.slug} title={inv.title} baseUrl={baseUrl} allowed={ent.personalized} max={ent.maxGuests} canQr={ent.qr} canExport={ent.personalized}
        guests={rows.map((g) => ({ id: g.id, name: g.name, phone: g.phone ?? "", category: g.category ?? "", groupName: g.groupName ?? "", code: g.code, shared: !!g.shared, opens: g.opens, attendance: g.attendance, checkedIn: !!g.checkedInAt }))} />
    </>
  );
}
