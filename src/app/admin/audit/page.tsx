import { redirect } from "next/navigation";
import { getActor } from "@/server/context";
import { getAuditLogsAction } from "@/server/actions/admin";
import { Card, EmptyState, Badge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit Log" };

export default async function AdminAuditPage() {
  const actor = await getActor(); if (!actor) redirect("/login");
  const response = await getAuditLogsAction(300);
  const rows = response.ok ? response.data : [];
  const exportCsv = () => {
    const csv = ["waktu,aktor,aksi,entitas,tenant"].concat(rows.map((row) => [row.createdAt, row.actorEmail ?? "", row.action, row.entity, row.tenantId ?? ""].map((value) => `"${value}"`).join(","))).join("\n");
    return csv;
  };
  return (
    <div className="page">
      <div className="page-header"><div><h1 className="page-title">Audit log</h1><p className="page-subtitle">Semua aksi sensitif: tenant, paket, impersonate, API key, GDPR, dan billing.</p></div><a className="btn btn-sm" href={`data:text/csv;charset=utf-8,${encodeURIComponent(exportCsv())}`} download="audit-log.csv">Ekspor CSV</a></div>
      <Card>{rows.length === 0 ? <EmptyState title="Belum ada audit" /> : (
        <div className="table-wrap" style={{ border: 0 }}><table className="table"><thead><tr><th>Waktu</th><th>Aktor</th><th>Aksi</th><th>Entitas</th><th>Tenant</th></tr></thead><tbody>
          {rows.map((row) => <tr key={row.id}><td className="tiny muted">{formatDateTime(row.createdAt)}</td><td className="small">{row.actorEmail ?? "system"}</td><td><Badge tone="primary">{row.action}</Badge></td><td>{row.entity}</td><td className="tiny mono">{row.tenantId ?? "platform"}</td></tr>)}
        </tbody></table></div>
      )}</Card>
    </div>
  );
}
