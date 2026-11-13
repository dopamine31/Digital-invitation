import { redirect } from "next/navigation";
import { getActor } from "@/server/context";
import { getKpisAction } from "@/server/actions/admin";
import { KpiTiles } from "@/components/admin/AdminPanels";
import { Card, SectionHeading, BarChart, Badge } from "@/components/ui";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kinerja Platform" };

export default async function AdminHomePage() {
  const actor = await getActor(); if (!actor) redirect("/login");
  const response = await getKpisAction();
  if (!response.ok) return <div className="page"><div className="notice notice-error">Gagal memuat KPI: {response.error}</div></div>;
  const data = response.data;
  return (
    <div className="page">
      <div className="page-header"><div><h1 className="page-title">Kinerja platform</h1><p className="page-subtitle">MRR/ARR, tenant, acara, RSVP, churn, funnel trial, error, storage & bandwidth.</p></div><Badge tone="primary">Super Admin</Badge></div>
      <KpiTiles kpis={data} />
      <div className="grid grid-3" style={{ marginTop: 20 }}>
        <Card><SectionHeading title="RSVP 14 hari" description="Tren konversi platform." /><BarChart data={data.timeline.map((item) => ({ label: item.date.slice(5), value: item.rsvps }))} height={170} /></Card>
        <Card><SectionHeading title="Distribusi paket" description="Jumlah tenant per paket." />{data.planDistribution.map((row) => <div className="row-between small" key={row.code} style={{ borderBottom: "1px solid var(--ui-border)", padding: "8px 0" }}><span>{row.code}</span><strong>{row.count}</strong></div>)}</Card>
        <Card><SectionHeading title="Ringkasan pendapatan" description="Faktur lunas & revenue." /><div className="stat-value">{formatCurrency(data.revenue)}</div><div className="small muted" style={{ marginTop: 10 }}>{data.paidInvoices} faktur lunas · {data.errorRate}% error notifikasi</div></Card>
      </div>
    </div>
  );
}
