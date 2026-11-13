import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor, tenantIdOrThrow } from "@/server/context";
import { getOwnerDashboard } from "@/server/queries";
import { StatCard, Card, Badge, EmptyState, BarChart, SectionHeading } from "@/components/ui";
import { formatDateTime, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ringkasan" };

export default async function OverviewPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!actor.tenantId) redirect("/admin");
  const data = await getOwnerDashboard(tenantIdOrThrow(actor));
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="badge badge-primary">{actor.planCode}</span>
          <h1 className="page-title" style={{ marginTop: 10 }}>Halo, {actor.user.name.split(" ")[0]} 👋</h1>
          <p className="page-subtitle">Ringkasan seluruh acara, tamu, dan konfirmasi kehadiran Anda.</p>
        </div>
        <div className="row">
          <Link href="/app/events" className="btn">Kelola acara</Link>
          <Link href="/app/events/new" className="btn btn-primary">+ Acara baru</Link>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <StatCard label="Acara aktif" value={formatNumber(data.eventCount)} hint="Termasuk draf" />
        <StatCard label="Total tamu" value={formatNumber(data.guestCount)} hint="Seluruh acara" />
        <StatCard label="RSVP masuk" value={formatNumber(data.rsvpCount)} hint={`${data.attendanceRate}% dari tamu`} />
        <StatCard label="Sudah check-in" value={formatNumber(data.checkInCount)} hint="Real-time" />
      </div>

      <div className="grid grid-2">
        <Card>
          <SectionHeading title="Acara terbaru" description="Klik untuk membuka workspace acara." action={<Link href="/app/events" className="btn btn-sm">Semua</Link>} />
          {data.events.length === 0 ? <EmptyState title="Belum ada acara" description="Mulai dari wizard: pilih jenis acara, tema, lalu isi data." action={<Link href="/app/events/new" className="btn btn-primary btn-sm">Buat acara</Link>} /> : (
            <div className="stack">
              {data.events.map((event) => (
                <Link key={event.id} href={`/app/events/${event.id}`} className="row-between" style={{ borderBottom: "1px solid var(--ui-border)", paddingBottom: 10 }}>
                  <div><strong>{event.title}</strong><div className="tiny muted">{formatDateTime(event.startsAt)} · {event.guestCount} tamu · {event.rsvpCount} RSVP</div></div>
                  <Badge tone={event.status === "PUBLISHED" ? "success" : "warn"}>{event.status === "PUBLISHED" ? "Terbit" : "Draf"}</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <SectionHeading title="Notifikasi terbaru" description="RSVP, blast, dan aktivitas tim." action={<Link href="/app/notifications" className="btn btn-sm">Semua</Link>} />
          {data.notifications.length === 0 ? <EmptyState title="Belum ada notifikasi" description="Notifikasi RSVP baru akan muncul di sini." /> : (
            <div className="stack">
              {data.notifications.slice(0, 5).map((item) => (
                <div key={item.id} className="row-between" style={{ borderBottom: "1px solid var(--ui-border)", paddingBottom: 10 }}>
                  <div><strong className="small">{item.title}</strong><div className="tiny muted">{item.body}</div></div>
                  <span className="tiny muted">{formatDateTime(item.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-2" style={{ marginTop: 20 }}>
        <Card>
          <SectionHeading title="RSVP terbaru" description="Konfirmasi yang baru masuk." />
          {data.recentRsvps.length === 0 ? <EmptyState title="Belum ada RSVP" /> : (
            <div className="table-wrap" style={{ border: 0 }}>
              <table className="table"><thead><tr><th>Tamu</th><th>Acara</th><th>Status</th><th>Waktu</th></tr></thead>
                <tbody>{data.recentRsvps.map((row, index) => (
                  <tr key={`${row.guestName}-${index}`}><td>{row.guestName}</td><td className="small muted">{row.eventTitle}</td><td><Badge tone={row.status === "ATTENDING" ? "success" : "warn"}>{row.status}</Badge></td><td className="tiny muted">{formatDateTime(row.submittedAt)}</td></tr>
                ))}</tbody></table>
            </div>
          )}
        </Card>
        <Card>
          <SectionHeading title="Aktivitas 14 hari" description="Distribusi RSVP per hari." />
          <BarChart data={data.recentRsvps.reduce<{ label: string; value: number }[]>((acc, row) => {
            const key = row.submittedAt.slice(5, 10);
            const found = acc.find((item) => item.label === key);
            if (found) found.value += 1; else acc.push({ label: key, value: 1 });
            return acc;
          }, [])} />
          <div className="divider" />
          <div className="row-between small muted"><span>Blast terkirim</span><strong>{data.blastCount}</strong></div>
          <div className="row-between small muted" style={{ marginTop: 8 }}><span>Notifikasi belum dibaca</span><strong>{data.unreadNotifications}</strong></div>
        </Card>
      </div>
    </div>
  );
}
