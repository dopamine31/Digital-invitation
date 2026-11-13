import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor, tenantIdOrThrow } from "@/server/context";
import { listEvents } from "@/server/queries";
import { Badge, EmptyState, Card } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { EventActions } from "@/components/dashboard/EventActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Acara" };

export default async function EventsPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const events = await listEvents(tenantIdOrThrow(actor));
  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Acara</h1><p className="page-subtitle">{events.length} acara aktif · kuota paket {actor.limits.maxEvents} acara.</p></div>
        <Link href="/app/events/new" className="btn btn-primary">+ Buat acara</Link>
      </div>
      {events.length === 0 ? <Card><EmptyState title="Belum ada acara" description="Wizard 4 langkah akan menyiapkan tema, section, dan form RSVP untuk Anda." action={<Link href="/app/events/new" className="btn btn-primary">Mulai wizard</Link>} /></Card> : (
        <div className="grid grid-3">
          {events.map((event) => (
            <Card key={event.id} className="card-hover">
              <div className="row-between"><Badge tone={event.status === "PUBLISHED" ? "success" : "warn"}>{event.status === "PUBLISHED" ? "Terbit" : "Draf"}</Badge><span className="tiny muted">{event.type}</span></div>
              <Link href={`/app/events/${event.id}`}><h3 style={{ marginTop: 14 }}>{event.title}</h3></Link>
              <p className="small muted" style={{ marginTop: 6 }}>{formatDateTime(event.startsAt)}</p>
              <div className="row" style={{ gap: 16, margin: "16px 0" }}>
                <span className="small"><strong>{event.guestCount}</strong> <span className="muted">tamu</span></span>
                <span className="small"><strong>{event.rsvpCount}</strong> <span className="muted">RSVP</span></span>
                <span className="small"><strong>{event.checkInCount}</strong> <span className="muted">hadir</span></span>
              </div>
              <div className="divider" />
              <div className="stack" style={{ gap: 8 }}>
                <div className="row">
                  <Link href={`/app/events/${event.id}/editor`} className="btn btn-sm btn-primary">Editor</Link>
                  <Link href={`/app/events/${event.id}/guests`} className="btn btn-sm">Tamu</Link>
                  <Link href={`/app/events/${event.id}/analytics`} className="btn btn-sm">Analitik</Link>
                </div>
                <EventActions id={event.id} slug={event.slug} status={event.status} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
