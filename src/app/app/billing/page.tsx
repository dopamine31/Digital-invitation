import { redirect } from "next/navigation";
import { getActor, tenantIdOrThrow } from "@/server/context";
import { getBillingData } from "@/server/queries";
import { BillingPanel } from "@/components/dashboard/BillingPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Langganan" };

export default async function BillingPage() {
  const actor = await getActor(); if (!actor) redirect("/login");
  const data = await getBillingData(tenantIdOrThrow(actor), actor);
  return <BillingPanel data={data} />;
}
