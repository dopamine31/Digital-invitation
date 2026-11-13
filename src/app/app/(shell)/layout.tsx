import type { ReactNode } from "react";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireCustomer } from "@/lib/auth";
import { Shell, type NavItem } from "@/components/Shell";
import { logoutAction } from "@/server/actions/auth";
import { getSite } from "@/server/core";

export const NAV: NavItem[] = [
  { href: "/app", label: "Ringkasan", icon: "Home", exact: true },
  { href: "/app/invitations", label: "Undangan Saya", icon: "Mail" },
  { href: "/app/templates", label: "Template", icon: "LayoutTemplate" },
  { href: "/app/orders", label: "Pesanan", icon: "ShoppingBag" },
  { href: "/app/support", label: "Bantuan", icon: "LifeBuoy" },
  { href: "/app/notifications", label: "Notifikasi", icon: "Bell" },
  { href: "/app/account", label: "Akun", icon: "User" },
];

export default async function CustomerLayout({ children }: { children: ReactNode }) {
  const [u, site] = await Promise.all([requireCustomer(), getSite()]);
  const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, u.id), eq(notifications.read, false)));
  return (
    <Shell brand={site.name} user={{ name: u.name, role: u.role }} nav={NAV} bottom={NAV.slice(0, 4)} unread={c} logout={logoutAction} area="app">{children}</Shell>
  );
}
