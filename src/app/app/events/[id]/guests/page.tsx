import { notFound, redirect } from "next/navigation";
import { getActor, tenantIdOrThrow } from "@/server/context";
import { getEventWorkspace, listGuests } from "@/server/queries";
import { GuestManager } from "@/components/guests/GuestManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tamu" };

export default async function GuestsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; group?: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const { id } = await params;
  const query = await searchParams;
  const tenantId = tenantIdOrThrow(actor);
  const [workspace, guests] = await Promise.all([
    getEventWorkspace(tenantId, id), listGuests(tenantId, id, query.q ?? "", query.group ?? ""),
  ]);
  if (!workspace) notFound();
  return <GuestManager eventId={id} slug={workspace.slug} guests={guests} />;
}
