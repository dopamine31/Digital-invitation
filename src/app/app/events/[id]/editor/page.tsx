import { notFound, redirect } from "next/navigation";
import { getActor, tenantIdOrThrow } from "@/server/context";
import { getEventWorkspace } from "@/server/queries";
import { EditorClient } from "@/components/editor/EditorClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editor undangan" };

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const { id } = await params;
  const workspace = await getEventWorkspace(tenantIdOrThrow(actor), id);
  if (!workspace) notFound();
  return <EditorClient workspace={workspace} />;
}
