import { notFound, redirect } from "next/navigation";
import { getActor, tenantIdOrThrow } from "@/server/context";
import { getEventWorkspace } from "@/server/queries";
import { getAnalyticsAction } from "@/server/actions/analytics";
import { StatCard, Card, SectionHeading, BarChart, Badge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analitik" };

export default async function AnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor(); if (!actor) redirect("/login");
  const { id } = await params; const tenantId = tenantIdOrThrow(actor);
  const [workspace, response] = await Promise.all([getEventWorkspace(tenantId, id), getAnalyticsAction(id)]);
  if (!workspace || !response.ok) notFound();
  const data = response.data;
  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Analitik acara</h1><p className="page-subtitle">Kunjungan, konversi RSVP, jawaban kustom, UTM, dan section heatmap.</p></div>
        <div className="row">
          {["csv", "xlsx", "pdf"].map((format) => <a key={format} href={`/api/exports/${id}?type=analytics&format=${format}`} className="btn btn-sm">{format.toUpperCase()}</a>)}
          <a href={`/api/exports/${id}?type=analytics&format=pdf`} target="_blank" rel="noreferrer" className="btn btn-sm">Cetak / PDF</a>
        </div>
      </div>
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <StatCard label="Total kunjungan" value={data.visits} hint={`${data.uniqueVisitors} unique visitor`} />
        <StatCard label="Tamu membuka" value={data.opened} hint={`${data.guests} tamu terdaftar`} />
        <StatCard label="RSVP rate" value={`${data.rsvpRate}%`} hint={`${data.rsvpTotal} respon`} />
        <StatCard label="Check-in" value={data.checkedIn} hint={`${data.paxExpected} pax diperkirakan`} />
      </div>
      <div className="grid grid-2">
        <Card><SectionHeading title="Timeline 14 hari" description="Kunjungan dan RSVP per hari." /><BarChart data={data.timeline.map((item) => ({ label: item.date.slice(5), value: item.visits }))} height={180} /><div className="tiny muted" style={{ marginTop: 10 }}>RSVP per hari: {data.timeline.map((item) => `${item.date.slice(5)}:${item.rsvps}`).join(" · ") || "—"}</div></Card>
        <Card><SectionHeading title="Komposisi RSVP" description="Hadir, mungkin, tidak hadir, belum menjawab." />
          <div className="stack">
            {[["Hadir", data.attending], ["Mungkin", data.maybe], ["Tidak hadir", data.declined], ["Belum menjawab", data.pending]].map(([label, value]) => (
              <div className="row-between small" key={String(label)} style={{ borderBottom: "1px solid var(--ui-border)", paddingBottom: 8 }}><span className="muted">{label}</span><strong>{value}</strong></div>
            ))}
          </div>
        </Card>
      </div>
      <div className="grid grid-3" style={{ marginTop: 20 }}>
        <Card><SectionHeading title="Sumber UTM" description="Atribusi tautan." />{data.utmSources.length === 0 ? <EmptyState title="Belum ada data" /> : data.utmSources.map((row) => <div className="row-between small" key={row.source} style={{ padding: "6px 0" }}><span>{row.source}</span><Badge tone="primary">{row.clicks}</Badge></div>)}</Card>
        <Card><SectionHeading title="Heatmap section" description="Bagian paling dilihat." />{data.sectionHeatmap.length === 0 ? <EmptyState title="Belum ada data" /> : data.sectionHeatmap.map((row) => <div className="row-between small" key={row.section} style={{ padding: "6px 0" }}><span>{row.section}</span><strong>{row.views}</strong></div>)}</Card>
        <Card><SectionHeading title="Jawaban kustom" description="Distribusi pilihan." />{data.answerBreakdown.length === 0 ? <EmptyState title="Belum ada jawaban" /> : data.answerBreakdown.map((field) => <div key={field.fieldId} style={{ marginBottom: 12 }}><strong className="small">{field.label}</strong>{field.counts.map((item) => <div className="row-between tiny muted" key={item.value}><span>{item.value}</span><span>{item.count}</span></div>)}</div>)}</Card>
      </div>
    </div>
  );
}
