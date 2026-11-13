import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getActor, tenantIdOrThrow } from "@/server/context";
import { getEventWorkspace } from "@/server/queries";
import { StatCard, Card, SectionHeading, Badge, ProgressBar, EmptyState } from "@/components/ui";
import { EventActions } from "@/components/dashboard/EventActions";
import { CopyButton } from "@/components/client-ui";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EventOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const { id } = await params;
  const event = await getEventWorkspace(tenantIdOrThrow(actor), id);
  if (!event) notFound();
  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/i/${event.slug}`;
  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Ringkasan acara</h1><p className="page-subtitle">{formatDateTime(event.startsAt)} · {event.timezone}</p></div>
        <EventActions id={event.id} slug={event.slug} status={event.status} />
      </div>
      <div className="grid grid-4" style={{ marginBottom: 22 }}>
        <StatCard label="Tamu terdaftar" value={event.stats.guests} hint={`Kuota ${actor.limits.maxGuestsPerEvent}`} />
        <StatCard label="RSVP masuk" value={event.stats.rsvps} />
        <StatCard label="Pax hadir" value={event.stats.attending} />
        <StatCard label="Check-in" value={event.stats.checkedIn} />
      </div>
      <div className="grid grid-2">
        <Card>
          <SectionHeading title="Link undangan" description="Bagikan tautan ini; tambahkan ?to={token} untuk personalisasi per tamu." />
          <div className="row"><input className="input mono" readOnly value={publicUrl} aria-label="Link undangan" /><CopyButton value={publicUrl} /></div>
          <div className="divider" />
          <ProgressBar value={event.stats.guests} max={Math.max(1, actor.limits.maxGuestsPerEvent)} label="Kuota tamu terpakai" />
          <div className="divider" />
          <div className="stack" style={{ gap: 8 }}>
            <div className="row-between small"><span className="muted">Tema</span><Badge tone="primary">{event.themeId}</Badge></div>
            <div className="row-between small"><span className="muted">Section aktif</span><strong>{event.sections.filter((s) => s.visible).length}</strong></div>
            <div className="row-between small"><span className="muted">Versi tersimpan</span><strong>{event.versions.length}</strong></div>
            <div className="row-between small"><span className="muted">Ucapan menunggu moderasi</span><strong>{event.stats.wishesPending}</strong></div>
          </div>
        </Card>
        <Card>
          <SectionHeading title="Langkah berikutnya" description="Alur kerja yang disarankan." />
          <div className="stack">
            {[
              ["Kustomisasi tema & PIC", `/app/events/${event.id}/theme`, "Ubah warna, font, latar, musik, dan tampilkan PIC di sampul."],
              ["Atur section & form RSVP", `/app/events/${event.id}/editor`, "Urutkan section, lalu tambah pertanyaan khusus dengan conditional logic."],
              ["Impor tamu & buat QR", `/app/events/${event.id}/guests`, "Impor CSV/XLSX, generate link personal dan QR per tamu."],
              ["Blast WhatsApp & check-in", `/app/events/${event.id}/blast`, "Kirim undangan bertahap, lalu pindai QR di hari-H."],
            ].map(([title, href, description], index) => (
              <Link key={title} href={href} className="row-between card-hover" style={{ borderBottom: "1px solid var(--ui-border)", paddingBottom: 12 }}>
                <div className="row" style={{ gap: 12 }}><span className="badge badge-primary">{index + 1}</span><div><strong className="small">{title}</strong><div className="tiny muted">{description}</div></div></div>
                <span className="muted">→</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
      <Card style={{ marginTop: 20 }}>
        <SectionHeading title="Jadwal acara" description="Detail multi-sesi dengan timezone & peta." action={<Link href={`/app/events/${event.id}/schedules`} className="btn btn-sm">Kelola</Link>} />
        {event.schedules.length === 0 ? <EmptyState title="Belum ada jadwal" /> : (
          <div className="table-wrap" style={{ border: 0 }}><table className="table"><thead><tr><th>Sesi</th><th>Waktu</th><th>Lokasi</th><th>Zona waktu</th></tr></thead>
            <tbody>{event.schedules.map((row) => <tr key={row.id}><td><strong>{row.title}</strong></td><td>{formatDateTime(row.startsAt)}</td><td className="small">{row.venueName}<div className="tiny muted">{row.address}</div></td><td className="tiny">{row.timezone}</td></tr>)}</tbody></table></div>
        )}
      </Card>
    </div>
  );
}
