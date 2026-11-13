import { notFound, redirect } from "next/navigation";
import { getActor, tenantIdOrThrow } from "@/server/context";
import { getEventWorkspace } from "@/server/queries";
import { getCheckinStatsAction } from "@/server/actions/checkin";
import { CheckinConsole } from "@/components/dashboard/CheckinConsole";

export const dynamic = "force-dynamic";
export const metadata = { title: "Check-in" };

export default async function CheckinPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const { id } = await params;
  const tenantId = tenantIdOrThrow(actor);
  const [workspace, response] = await Promise.all([getEventWorkspace(tenantId, id), getCheckinStatsAction(id)]);
  if (!workspace || !response.ok) notFound();
  return <CheckinConsole eventId={id} initialStats={response.data} />;
}
