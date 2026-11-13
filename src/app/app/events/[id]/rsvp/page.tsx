import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getActor, tenantIdOrThrow } from "@/server/context";
import { getEventWorkspace, listRsvps } from "@/server/queries";
import { RsvpFormBuilder } from "@/components/dashboard/RsvpFormBuilder";
import { Card, SectionHeading, Badge, EmptyState } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "RSVP" };

export default async function RsvpPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const { id } = await params;
  const tenantId = tenantIdOrThrow(actor);
  const [workspace, rsvps] = await Promise.all([getEventWorkspace(tenantId, id), listRsvps(tenantId, id)]);
  if (!workspace) notFound();
  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">RSVP & formulir</h1><p className="page-subtitle">{rsvps.length} konfirmasi masuk · {rsvps.filter((r) => r.status === "ATTENDING").reduce((sum, r) => sum + r.pax, 0)} pax hadir.</p></div>
        <div className="row"><a href={`/api/exports/${id}?type=rsvp&format=xlsx`} className="btn btn-sm">Ekspor XLSX</a><Link href={`/i/${workspace.slug}#heading-rsvp`} target="_blank" className="btn btn-sm btn-primary">Coba form publik ↗</Link></div>
      </div>
      <RsvpFormBuilder workspace={workspace} />
      <Card style={{ marginTop: 20 }}>
        <SectionHeading title="Jawaban RSVP terbaru" description="Data personal, jawaban kustom, dan atribusi UTM." />
        {rsvps.length === 0 ? <EmptyState title="Belum ada RSVP" description="Bagikan link personal untuk mulai menerima konfirmasi." /> : (
          <div className="table-wrap" style={{ border: 0 }}><table className="table"><thead><tr><th>Tamu</th><th>Status</th><th>Pax</th><th>Sesi</th><th>Menu</th><th>Jawaban kustom</th><th>UTM</th><th>Waktu</th></tr></thead>
            <tbody>{rsvps.slice(0, 100).map((row) => (
              <tr key={row.id}><td><strong>{row.guestName}</strong><div className="tiny muted">{row.groupLabel}</div></td>
                <td><Badge tone={row.status === "ATTENDING" ? "success" : "warn"}>{row.status}</Badge></td><td>{row.pax}</td>
                <td className="small">{row.sessionId ?? "—"}</td><td className="small">{row.mealChoice ?? "—"}</td>
                <td className="tiny mono">{JSON.stringify(row.answers).slice(0, 90)}</td><td className="tiny">{row.utmSource ?? "—"}</td><td className="tiny muted">{formatDateTime(row.submittedAt)}</td></tr>
            ))}</tbody></table></div>
        )}
      </Card>
    </div>
  );
}
