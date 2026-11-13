import { redirect } from "next/navigation";
import { getActor } from "@/server/context";
import { prisma } from "@/lib/db";
import { TemplatesAdmin, type TemplateRow } from "@/components/admin/AdminPanels";

export const dynamic = "force-dynamic";
export const metadata = { title: "Marketplace Template" };

export default async function AdminTemplatesPage() {
  const actor = await getActor(); if (!actor) redirect("/login");
  const rows = await prisma.template.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const templates: TemplateRow[] = rows.map((row) => ({
    id: row.id, code: row.code, name: row.name, category: row.category,
    themeId: row.themeId, status: row.status, featured: row.featured,
  }));
  return <TemplatesAdmin templates={templates} />;
}
