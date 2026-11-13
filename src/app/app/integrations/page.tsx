import { redirect } from "next/navigation";
import { getActor } from "@/server/context";
import { listApiKeysAction, listWebhooksAction } from "@/server/actions/integrations";
import { IntegrationsPanel } from "@/components/dashboard/IntegrationsPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "API & Webhook" };

export default async function IntegrationsPage() {
  const actor = await getActor(); if (!actor) redirect("/login");
  const [keys, hooks] = await Promise.all([listApiKeysAction(), listWebhooksAction()]);
  return <IntegrationsPanel keys={keys.ok ? keys.data : []} hooks={hooks.ok ? hooks.data : []} />;
}
