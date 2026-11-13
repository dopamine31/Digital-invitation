import { redirect } from "next/navigation";
import { getActor } from "@/server/context";
import { prisma } from "@/lib/db";
import { listTenantsAction } from "@/server/actions/admin";
import { SettingsAdmin, type FlagRow, type SettingRow } from "@/components/admin/AdminPanels";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pengaturan Sistem" };

export default async function AdminSettingsPage() {
  const actor = await getActor(); if (!actor) redirect("/login");
  const [flags, settings, tenants] = await Promise.all([
    prisma.featureFlag.findMany(), prisma.systemSetting.findMany({ take: 100 }), listTenantsAction(),
  ]);
  const flagRows: FlagRow[] = flags.map((row) => ({ key: row.key, enabledGlobally: row.enabledGlobally }));
  const settingRows: SettingRow[] = settings.map((row) => ({ key: row.key, value: row.value }));
  return <SettingsAdmin flags={flagRows} settings={settingRows} tenants={tenants.ok ? tenants.data : []} />;
}
