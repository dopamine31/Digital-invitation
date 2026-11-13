import { redirect } from "next/navigation";
import { getActor } from "@/server/context";
import { prisma } from "@/lib/db";
import { PlansAdmin, type PlanRow } from "@/components/admin/AdminPanels";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paket & Harga" };

export default async function AdminPlansPage() {
  const actor = await getActor(); if (!actor) redirect("/login");
  const plans = await prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });
  const rows: PlanRow[] = plans.map((plan) => ({
    id: plan.id, code: plan.code, name: plan.name, monthlyPrice: plan.monthlyPrice,
    yearlyPrice: plan.yearlyPrice, trialDays: plan.trialDays,
    limits: plan.limits, features: plan.features, isActive: plan.isActive,
  }));
  return <PlansAdmin plans={rows} />;
}
