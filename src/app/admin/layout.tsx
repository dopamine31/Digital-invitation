import { redirect } from "next/navigation";
import { getActor } from "@/server/context";
import { DashboardShell } from "@/components/layout/shell";
import { Toaster } from "@/components/client-ui";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.user.platformRole !== "SUPER_ADMIN") redirect("/app");
  return (
    <DashboardShell
      admin
      user={{
        name: actor.user.name, email: actor.user.email,
        tenantName: "Platform", role: "SUPER_ADMIN", impersonating: actor.impersonating,
      }}
    >
      {children}
      <Toaster />
    </DashboardShell>
  );
}
