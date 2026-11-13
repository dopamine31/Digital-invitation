import Link from "next/link";
import type { ReactNode } from "react";
import { Camera as Instagram, Globe as Facebook, Play as Youtube, MessageCircle, Menu } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getContent, getSite, getSystem } from "@/server/core";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [site, user, system, content] = await Promise.all([getSite(), getSession(), getSystem(), getContent()]);
  if (system.maintenance && (!user || user.role === "customer")) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="max-w-md"><p className="text-5xl">🛠️</p><h1 className="font-display mt-4 text-3xl font-semibold">Sedang dalam pemeliharaan</h1>
          <p className="mt-2 text-stone-600">Kami sedang meningkatkan layanan. Undangan yang sudah terbit tetap dapat dibuka. Silakan kembali beberapa saat lagi.</p>
          <Link href="/login" className="mt-6 inline-block text-sm text-stone-500 underline">Masuk pengelola</Link></div>
      </main>
    );
  }
  const links = [["/templates", "Template"], ["/#harga", "Harga"], ["/#faq", "FAQ"], ["/help", "Bantuan"]];
  const dash = user ? (user.role === "customer" ? "/app" : "/admin") : null;
  return (
    <div className="min-h-screen">
      {content.banner && <div className="bg-stone-900 px-4 py-2 text-center text-xs text-amber-200">{content.banner}</div>}
      <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-[#faf8f5]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 font-display text-lg text-amber-300">D</span><span className="font-display text-lg font-semibold">{site.name}</span></Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-stone-600 md:flex">{links.map(([h, l]) => <Link key={h} href={h} className="hover:text-stone-900">{l}</Link>)}</nav>
          <div className="flex items-center gap-2">
            {dash ? <Link href={dash} className="btn btn-primary btn-sm">Dashboard</Link> : <><Link href="/login" className="btn btn-ghost btn-sm hidden sm:inline-flex">Masuk</Link><Link href="/register" className="btn btn-primary btn-sm">Daftar Gratis</Link></>}
            <details className="relative md:hidden"><summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl hover:bg-stone-100" aria-label="Menu"><Menu size={20} /></summary>
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-stone-200 bg-white p-2 shadow-xl">{links.map(([h, l]) => <Link key={h} href={h} className="block rounded-lg px-3 py-3 text-sm hover:bg-stone-50">{l}</Link>)}{!dash && <Link href="/login" className="block rounded-lg px-3 py-3 text-sm hover:bg-stone-50">Masuk</Link>}</div></details>
          </div>
        </div>
      </header>
      {children}
      <footer className="mt-20 bg-stone-900 text-stone-300">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4">
          <div className="md:col-span-2"><p className="font-display text-xl font-semibold text-white">{site.name}</p><p className="mt-2 max-w-sm text-sm text-stone-400">{site.tagline}</p>
            <div className="mt-4 flex gap-3">
              <a aria-label="Instagram" href={site.instagram} className="rounded-full bg-white/10 p-2 hover:bg-white/20"><Instagram size={16} /></a>
              <a aria-label="Facebook" href={site.facebook} className="rounded-full bg-white/10 p-2 hover:bg-white/20"><Facebook size={16} /></a>
              <a aria-label="YouTube" href={site.youtube} className="rounded-full bg-white/10 p-2 hover:bg-white/20"><Youtube size={16} /></a>
              <a aria-label="WhatsApp" href={`https://wa.me/${site.whatsapp}`} className="rounded-full bg-white/10 p-2 hover:bg-white/20"><MessageCircle size={16} /></a></div></div>
          <div className="text-sm"><p className="mb-2 font-semibold text-white">Layanan</p><ul className="space-y-1.5"><li><Link href="/templates">Katalog Template</Link></li><li><Link href="/#harga">Paket & Harga</Link></li><li><Link href="/help">Pusat Bantuan</Link></li><li><Link href="/login">Masuk</Link></li></ul></div>
          <div className="text-sm"><p className="mb-2 font-semibold text-white">Kontak</p><p>{site.email}</p><p>WA: +{site.whatsapp}</p><p className="mt-1 text-stone-400">{site.address}</p>
            <ul className="mt-3 space-y-1.5"><li><Link href="/pages/terms">Syarat & Ketentuan</Link></li><li><Link href="/pages/privacy">Kebijakan Privasi</Link></li></ul></div>
        </div>
        <p className="border-t border-white/10 py-4 text-center text-xs text-stone-500">© {new Date().getFullYear()} {site.name}. Semua hak dilindungi.</p>
      </footer>
    </div>
  );
}
