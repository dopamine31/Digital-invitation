import { notFound, redirect } from "next/navigation";
import { getActor, tenantIdOrThrow } from "@/server/context";
import { getEventWorkspace, listBlasts, listBlastMessages } from "@/server/queries";
import { BlastStudio } from "@/components/dashboard/BlastStudio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Blast" };

export default async function BlastPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const { id } = await params;
  const tenantId = tenantIdOrThrow(actor);
  const [workspace, blasts] = await Promise.all([getEventWorkspace(tenantId, id), listBlasts(tenantId, id)]);
  if (!workspace) notFound();
  const batches = await Promise.all(blasts.map(async (blast) => [blast.id, await listBlastMessages(tenantId, blast.id)] as const));
  return <BlastStudio workspace={workspace} blasts={blasts} messages={Object.fromEntries(batches)} />;
}
