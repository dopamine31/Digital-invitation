import { redirect } from "next/navigation";
import { getActor } from "@/server/context";
import { prisma } from "@/lib/db";
import { listTenantsAction } from "@/server/actions/admin";
import { TenantAdmin, type PlanRow } from "@/components/admin/AdminPanels";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kelola Tenant" };

export default async function AdminTenantsPage() {
  const actor = await getActor(); if (!actor) redirect("/login");
  const [result, plans] = await Promise.all([listTenantsAction(), prisma.plan.findMany({ orderBy: { sortOrder: "asc" } })]);
  const planRows: PlanRow[] = plans.map((plan) => ({
    id: plan.id, code: plan.code, name: plan.name, monthlyPrice: plan.monthlyPrice,
    yearlyPrice: plan.yearlyPrice, trialDays: plan.trialDays,
    limits: plan.limits, features: plan.features, isActive: plan.isActive,
  }));
  return <TenantAdmin tenants={result.ok ? result.data : []} plans={planRows} />;
}
