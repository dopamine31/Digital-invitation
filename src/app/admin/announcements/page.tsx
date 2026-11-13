import { redirect } from "next/navigation";
import { getActor } from "@/server/context";
import { prisma } from "@/lib/db";
import { AnnouncementsAdmin, type AnnouncementRow } from "@/components/admin/AdminPanels";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pengumuman" };

export default async function AdminAnnouncementsPage() {
  const actor = await getActor(); if (!actor) redirect("/login");
  const rows = await prisma.announcement.findMany({ orderBy: { publishedAt: "desc" }, take: 50 });
  const items: AnnouncementRow[] = rows.map((row) => ({
    id: row.id, title: row.title, body: row.body, active: row.active,
    publishedAt: row.publishedAt.toISOString(),
  }));
  return <AnnouncementsAdmin items={items} />;
}
