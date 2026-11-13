import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor, tenantIdOrThrow } from "@/server/context";
import { getEventWorkspace } from "@/server/queries";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const NAV = [
  { key: "", label: "Ringkasan" }, { key: "editor", label: "Editor" }, { key: "theme", label: "Tema" },
  { key: "schedules", label: "Jadwal" }, { key: "guests", label: "Tamu" }, { key: "rsvp", label: "RSVP" },
  { key: "blast", label: "Blast" }, { key: "checkin", label: "Check-in" }, { key: "wishes", label: "Ucapan" },
  { key: "analytics", label: "Analitik" },
];

export default async function EventLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const { id } = await params;
  const event = await getEventWorkspace(tenantIdOrThrow(actor), id);
  if (!event) notFound();
  return (
    <div>
      <div style={{ padding: "18px clamp(18px,3vw,40px) 0", borderBottom: "1px solid var(--ui-border)", background: "var(--ui-surface)" }}>
        <div className="row-between">
          <div>
            <Link href="/app/events" className="tiny muted">← Semua acara</Link>
            <div className="row" style={{ gap: 10, marginTop: 6 }}><h2 style={{ fontSize: 22 }}>{event.title}</h2><Badge tone={event.status === "PUBLISHED" ? "success" : "warn"}>{event.status === "PUBLISHED" ? "Terbit" : "Draf"}</Badge></div>
          </div>
          <Link href={`/i/${event.slug}`} target="_blank" className="btn btn-sm">Buka undangan ↗</Link>
        </div>
        <div className="tabs" style={{ marginTop: 14, borderBottom: 0 }}>
          {NAV.map((item) => (
            <Link key={item.key} href={`/app/events/${id}${item.key ? `/${item.key}` : ""}`} className="tab" data-active={false}>{item.label}</Link>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
