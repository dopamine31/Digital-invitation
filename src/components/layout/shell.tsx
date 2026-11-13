"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, CalendarDays, CreditCard, UserRoundCog, Plug, Bell,
  Shield, Building2, Package, Palette, Flag, Megaphone, Settings2, ScrollText,
  LogOut, ChevronDown, Sparkles,
} from "lucide-react";
import { ThemeToggle, MobileMenuButton, toast } from "@/components/client-ui";
import { logoutAction } from "@/server/actions/auth";
import { stopImpersonationAction } from "@/server/actions/admin";

export interface ShellUser {
  name: string; email: string; tenantName: string; role: string; impersonating: boolean;
}

const OWNER_NAV = [
  { label: "nav.overview", href: "/app", icon: LayoutDashboard },
  { label: "nav.events", href: "/app/events", icon: CalendarDays },
  { label: "nav.billing", href: "/app/billing", icon: CreditCard },
  { label: "nav.team", href: "/app/team", icon: UserRoundCog },
  { label: "nav.integrations", href: "/app/integrations", icon: Plug },
  { label: "nav.notifications", href: "/app/notifications", icon: Bell },
];

const ADMIN_NAV = [
  { label: "admin.kpi", href: "/admin", icon: LayoutDashboard },
  { label: "nav.tenants", href: "/admin/tenants", icon: Building2 },
  { label: "nav.plans", href: "/admin/plans", icon: Package },
  { label: "nav.templates", href: "/admin/templates", icon: Palette },
  { label: "nav.moderation", href: "/admin/moderation", icon: Flag },
  { label: "nav.announcements", href: "/admin/announcements", icon: Megaphone },
  { label: "nav.settings", href: "/admin/settings", icon: Settings2 },
  { label: "nav.audit", href: "/admin/audit", icon: ScrollText },
];

const LABELS: Record<string, string> = {
  "nav.overview": "Ringkasan", "nav.events": "Acara", "nav.billing": "Langganan",
  "nav.team": "Tim & Kolaborasi", "nav.integrations": "API & Webhook", "nav.notifications": "Notifikasi",
  "admin.kpi": "Kinerja Platform", "nav.tenants": "Tenant", "nav.plans": "Paket & Harga",
  "nav.templates": "Marketplace Template", "nav.moderation": "Moderasi",
  "nav.announcements": "Pengumuman", "nav.settings": "Pengaturan Sistem", "nav.audit": "Audit Log",
};

export function DashboardShell({ children, user, admin }: { children: React.ReactNode; user: ShellUser; admin: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const nav = admin ? ADMIN_NAV : OWNER_NAV;

  const doLogout = async () => {
    const result = await logoutAction();
    if (result.ok) router.push(result.data.redirectTo);
    else toast(result.error, "err");
  };
  const stopImpersonation = async () => {
    const result = await stopImpersonationAction();
    router.replace(result.ok ? result.data.redirectTo : "/admin");
  };

  return (
    <div className="app-shell">
      {user.impersonating ? (
        <div className="impersonate-banner" style={{ gridColumn: "1 / -1", position: "sticky", top: 0, zIndex: 70 }}>
          <span><Shield size={14} style={{ verticalAlign: -2, marginRight: 6 }} /> Anda sedang <strong>impersonate</strong> tenant <strong>{user.tenantName}</strong>. Semua aksi dicatat di audit log.</span>
          <button className="btn btn-sm" onClick={stopImpersonation}>Hentikan</button>
        </div>
      ) : null}
      <aside className="app-sidebar" data-open={open}>
        <div className="row-between" style={{ padding: "0 8px 16px" }}>
          <Link href={admin ? "/admin" : "/app"} className="row" style={{ gap: 9 }}>
            <span className="brand-mark">R</span>
            <span><strong style={{ fontFamily: "var(--ui-font-display)", fontSize: 19, display: "block", lineHeight: 1 }}>Rasa Undangan</strong><span className="tiny muted">{admin ? "Super Admin" : "Studio"}</span></span>
          </Link>
        </div>
        <div className="sidebar-label">Menu utama</div>
        {nav.map((item) => {
          const Icon = item.icon;
          const active = item.href === (admin ? "/admin" : "/app") ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className="sidebar-link" data-active={active} onClick={() => setOpen(false)}>
              <Icon size={17} /> {LABELS[item.label] ?? item.label}
            </Link>
          );
        })}
        {admin ? (
          <>
            <div className="sidebar-label">Area lain</div>
            <Link href="/app" className="sidebar-link"><Sparkles size={17} /> Lihat sebagai customer</Link>
          </>
        ) : null}
        <div style={{ flex: 1 }} />
        <div className="card" style={{ padding: 12, background: "var(--ui-surface-2)" }}>
          <div className="tiny muted">Paket aktif</div>
          <div style={{ fontWeight: 650, marginTop: 3 }}>{user.role}</div>
          <Link href={admin ? "/admin/plans" : "/app/billing"} className="small" style={{ color: "var(--ui-primary)" }}>Kelola langganan →</Link>
        </div>
        <button className="sidebar-link" onClick={doLogout} style={{ width: "100%", border: 0, background: "none", cursor: "pointer", textAlign: "left" }}>
          <LogOut size={17} /> Keluar
        </button>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="row" style={{ gap: 10 }}>
            <span className="show-mobile"><MobileMenuButton onClick={() => setOpen(true)} /></span>
            <span className="small muted">{user.tenantName}</span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <ThemeToggle />
            <div style={{ position: "relative" }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setMenu(!menu)} aria-expanded={menu}>
                <span className="brand-mark" style={{ width: 26, height: 26, fontSize: 13 }}>{user.name.slice(0, 1).toUpperCase()}</span>
                <span className="hide-mobile">{user.name}</span> <ChevronDown size={14} />
              </button>
              {menu ? (
                <div className="card" style={{ position: "absolute", right: 0, top: 44, minWidth: 210, padding: 12, zIndex: 50 }}>
                  <div className="small"><strong>{user.name}</strong></div>
                  <div className="tiny muted">{user.email}</div>
                  <div className="divider" />
                  <Link href="/privacy" className="sidebar-link">Kebijakan Privasi</Link>
                  <button className="sidebar-link" style={{ width: "100%", border: 0, background: "none", cursor: "pointer", textAlign: "left" }} onClick={doLogout}>Keluar</button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
