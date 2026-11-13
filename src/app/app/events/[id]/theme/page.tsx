import { notFound, redirect } from "next/navigation";
import { getActor, tenantIdOrThrow } from "@/server/context";
import { getEventWorkspace } from "@/server/queries";
import { ThemeCustomizer } from "@/components/editor/ThemeCustomizer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tema & PIC" };

export default async function ThemePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const { id } = await params;
  const workspace = await getEventWorkspace(tenantIdOrThrow(actor), id);
  if (!workspace) notFound();
  return <ThemeCustomizer workspace={workspace} />;
}
