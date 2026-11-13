import { redirect } from "next/navigation";
import { getActor } from "@/server/context";
import { prisma } from "@/lib/db";
import { ModerationAdmin, type ReportRow } from "@/components/admin/AdminPanels";

export const dynamic = "force-dynamic";
export const metadata = { title: "Moderasi" };

export default async function AdminModerationPage() {
  const actor = await getActor(); if (!actor) redirect("/login");
  const rows = await prisma.reportAbuse.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const reports: ReportRow[] = rows.map((row) => ({
    id: row.id, reason: row.reason, details: row.details, status: row.status,
    createdAt: row.createdAt.toISOString(), reporterEmail: row.reporterEmail,
  }));
  return <ModerationAdmin reports={reports} />;
}
