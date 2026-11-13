import { notFound, redirect } from "next/navigation";
import { getActor, tenantIdOrThrow } from "@/server/context";
import { listEvents } from "@/server/queries";
import { listMembersAction, listCommentsAction } from "@/server/actions/team";
import { TeamPanel } from "@/components/dashboard/TeamPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tim" };

export default async function TeamPage() {
  const actor = await getActor(); if (!actor) redirect("/login");
  const tenantId = tenantIdOrThrow(actor);
  const [membersResult, events] = await Promise.all([listMembersAction(), listEvents(tenantId)]);
  const first = events[0];
  if (!first || !membersResult.ok) notFound();
  const commentsResult = await listCommentsAction(first.id);
  return <TeamPanel members={membersResult.data} comments={commentsResult.ok ? commentsResult.data : []} workspace={{ id: first.id, title: first.title }} />;
}
