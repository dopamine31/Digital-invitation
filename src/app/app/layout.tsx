import { redirect } from "next/navigation";
import { getActor } from "@/server/context";
import { prisma } from "@/lib/db";
import { DashboardShell } from "@/components/layout/shell";
import { Toaster } from "@/components/client-ui";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!actor.tenantId) redirect("/admin");
  let maintenance = false;
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: "maintenance" } });
    maintenance = Boolean((setting?.value as { enabled?: boolean } | null)?.enabled);
  } catch { maintenance = false; }
  if (maintenance && actor.role !== "SUPER_ADMIN") redirect("/");
  return (
    <DashboardShell
      admin={false}
      user={{
        name: actor.user.name, email: actor.user.email,
        tenantName: actor.tenant?.name ?? "Studio", role: actor.planCode,
        impersonating: actor.impersonating,
      }}
    >
      {children}
      <Toaster />
    </DashboardShell>
  );
}
