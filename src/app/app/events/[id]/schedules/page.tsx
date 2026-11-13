import { notFound, redirect } from "next/navigation";
import { getActor, tenantIdOrThrow } from "@/server/context";
import { getEventWorkspace } from "@/server/queries";
import { ScheduleManager } from "@/components/dashboard/ScheduleManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jadwal" };

export default async function SchedulesPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor(); if (!actor) redirect("/login");
  const { id } = await params;
  const workspace = await getEventWorkspace(tenantIdOrThrow(actor), id);
  if (!workspace) notFound();
  return <ScheduleManager workspace={workspace} />;
}
