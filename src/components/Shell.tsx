"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Home, Mail, LayoutTemplate, ShoppingBag, User, Bell, LifeBuoy, Heart, LogOut, Menu, X, BarChart3, Users, Package, CreditCard, Ticket, FileText,
  Settings, Shield, ScrollText, Tags, UserCog, ClipboardList, Sparkles,
} from "lucide-react";

const ICONS = { Home, Mail, LayoutTemplate, ShoppingBag, User, Bell, LifeBuoy, Heart, BarChart3, Users, Package, CreditCard, Ticket, FileText, Settings, Shield, ScrollText, Tags, UserCog, ClipboardList, Sparkles };
export type IconKey = keyof typeof ICONS;
export type NavItem = { href: string; label: string; icon: IconKey; exact?: boolean };

export function Shell({ brand, user, nav, bottom, unread, logout, children, area }: {
  brand: string; user: { name: string; role: string }; nav: NavItem[]; bottom: NavItem[]; unread: number; logout: () => Promise<void>; children: ReactNode; area: "app" | "admin";
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (n: NavItem) => (n.exact ? path === n.href : path === n.href || path.startsWith(n.href + "/"));
  const Item = ({ n, onClick }: { n: NavItem; onClick?: () => void }) => {
    const I = ICONS[n.icon];
    return (
      <Link href={n.href} onClick={onClick} aria-current={active(n) ? "page" : undefined}
        className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${active(n) ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}>
        <I size={18} />{n.label}
      </Link>
    );
  };
  const roleLabel = user.role === "owner" ? "Super Admin" : user.role === "staff" ? "Staff" : "Customer";
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="no-print sticky top-0 hidden h-screen flex-col border-r border-stone-200 bg-white p-4 lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 px-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 font-display text-lg text-amber-300">D</span><span className="font-display text-base font-semibold leading-tight">{brand}</span></Link>
        <nav className="flex-1 space-y-1 overflow-y-auto" aria-label="Menu utama">{nav.map((n) => <Item key={n.href} n={n} />)}</nav>
        <div className="mt-4 rounded-xl bg-stone-50 p-3">
          <p className="truncate text-sm font-semibold">{user.name}</p><p className="text-xs text-stone-500">{roleLabel}</p>
          <form action={logout}><button className="mt-2 flex items-center gap-2 text-xs font-medium text-red-600"><LogOut size={14} /> Keluar</button></form>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-stone-200 bg-white/90 px-4 backdrop-blur lg:px-8">
          <Link href="/" className="font-display text-base font-semibold lg:hidden">{brand}</Link>
          <span className="hidden text-sm text-stone-500 lg:block">{area === "admin" ? "Panel Pengelola" : "Dashboard Saya"}</span>
          <div className="flex items-center gap-1">
            <Link href={area === "admin" ? "/admin/notifications" : "/app/notifications"} aria-label="Notifikasi" className="relative flex h-11 w-11 items-center justify-center rounded-xl hover:bg-stone-100">
              <Bell size={20} />{unread > 0 && <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
            </Link>
            <button type="button" aria-label="Menu" className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-stone-100 lg:hidden" onClick={() => setOpen(true)}><Menu size={20} /></button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 lg:px-8 lg:pb-12 lg:pt-8">{children}</main>
      </div>

      <nav className="no-print safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-stone-200 bg-white/95 backdrop-blur lg:hidden" aria-label="Navigasi bawah">
        {bottom.slice(0, 4).map((n) => {
          const I = ICONS[n.icon];
          return (
            <Link key={n.href} href={n.href} className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active(n) ? "text-stone-900" : "text-stone-400"}`}>
              <I size={20} strokeWidth={active(n) ? 2.4 : 1.8} />{n.label}
            </Link>
          );
        })}
        <button type="button" onClick={() => setOpen(true)} className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-stone-400"><Menu size={20} />Lainnya</button>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal>
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="fade-up safe-bottom absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-4">
            <div className="mb-3 flex items-center justify-between"><div><p className="font-semibold">{user.name}</p><p className="text-xs text-stone-500">{roleLabel}</p></div>
              <button type="button" aria-label="Tutup" className="flex h-11 w-11 items-center justify-center rounded-xl bg-stone-100" onClick={() => setOpen(false)}><X size={18} /></button></div>
            <div className="grid gap-1">{nav.map((n) => <Item key={n.href} n={n} onClick={() => setOpen(false)} />)}</div>
            <form action={logout}><button className="btn btn-ghost mt-3 w-full text-red-600"><LogOut size={16} /> Keluar</button></form>
          </div>
        </div>
      )}
    </div>
  );
}
