import { redirect } from "next/navigation";
import { getActor, tenantIdOrThrow } from "@/server/context";
import { listNotificationLogs } from "@/server/queries";
import { Card, EmptyState, Badge, StatCard } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifikasi" };

export default async function NotificationsPage() {
  const actor = await getActor(); if (!actor) redirect("/login");
  const logs = await listNotificationLogs(tenantIdOrThrow(actor), 200);
  return (
    <div className="page">
      <div className="page-header"><div><h1 className="page-title">Log notifikasi</h1><p className="page-subtitle">Konfirmasi RSVP ke owner & PIC, blast WhatsApp/email, dan webhook — nomor selalu masked.</p></div></div>
      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <StatCard label="Total log" value={logs.length} />
        <StatCard label="Terkirim" value={logs.filter((row) => row.status === "SENT").length} />
        <StatCard label="Gagal" value={logs.filter((row) => row.status === "FAILED").length} />
      </div>
      <Card>
        {logs.length === 0 ? <EmptyState title="Belum ada notifikasi" description="RSVP baru, blast, dan webhook akan tercatat di sini." /> : (
          <div className="table-wrap" style={{ border: 0 }}><table className="table"><thead><tr><th>Kanal</th><th>Provider</th><th>Tujuan</th><th>Status</th><th>Waktu</th></tr></thead><tbody>
            {logs.map((row) => <tr key={row.id}><td>{row.channel}</td><td>{row.provider}</td><td className="mono small">{row.toMasked ?? "—"}</td><td><Badge tone={row.status === "SENT" ? "success" : "warn"}>{row.status}</Badge></td><td className="tiny muted">{formatDateTime(row.createdAt)}</td></tr>)}
          </tbody></table></div>
        )}
      </Card>
    </div>
  );
}
