import { notFound, redirect } from "next/navigation";
import { getActor, tenantIdOrThrow } from "@/server/context";
import { getEventWorkspace, listWishes } from "@/server/queries";
import { WishModeration } from "@/components/dashboard/WishModeration";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ucapan" };

export default async function WishesPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor(); if (!actor) redirect("/login");
  const { id } = await params; const tenantId = tenantIdOrThrow(actor);
  const [workspace, wishes] = await Promise.all([getEventWorkspace(tenantId, id), listWishes(tenantId, id)]);
  if (!workspace) notFound();
  return <WishModeration eventId={id} wishes={wishes} />;
}
