import type { ReactNode } from "react";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { hasPerm, requireStaff } from "@/lib/auth";
import { Shell, type NavItem } from "@/components/Shell";
import { logoutAction } from "@/server/actions/auth";
import { getSite } from "@/server/core";

const ALL: (NavItem & { perm?: string; owner?: boolean })[] = [
  { href: "/admin", label: "Dashboard", icon: "BarChart3", exact: true },
  { href: "/admin/orders", label: "Pesanan", icon: "ClipboardList", perm: "orders" },
  { href: "/admin/payments", label: "Pembayaran", icon: "CreditCard", perm: "payments" },
  { href: "/admin/customers", label: "Customer", icon: "Users", perm: "customers" },
  { href: "/admin/templates", label: "Template", icon: "LayoutTemplate", perm: "templates" },
  { href: "/admin/categories", label: "Kategori", icon: "Tags", perm: "templates" },
  { href: "/admin/packages", label: "Paket & Produk", icon: "Package", perm: "packages" },
  { href: "/admin/vouchers", label: "Promo", icon: "Ticket", perm: "vouchers" },
  { href: "/admin/content", label: "Konten", icon: "FileText", perm: "content" },
  { href: "/admin/support", label: "Tiket Bantuan", icon: "LifeBuoy", perm: "support" },
  { href: "/admin/staff", label: "Staff", icon: "UserCog", owner: true },
  { href: "/admin/logs", label: "Audit Log", icon: "ScrollText", perm: "logs" },
  { href: "/admin/settings", label: "Pengaturan", icon: "Settings", owner: true },
  { href: "/admin/notifications", label: "Notifikasi", icon: "Bell" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [u, site] = await Promise.all([requireStaff(), getSite()]);
  const nav = ALL.filter((n) => (n.owner ? u.role === "owner" : n.perm ? hasPerm(u, n.perm) : true)).map(({ href, label, icon, exact }) => ({ href, label, icon, exact }));
  const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, u.id), eq(notifications.read, false)));
  return <Shell brand={site.name} user={{ name: u.name, role: u.role }} nav={nav} bottom={nav.slice(0, 4)} unread={c} logout={logoutAction} area="admin">{children}</Shell>;
}
