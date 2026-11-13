import Link from "next/link";
import { ArrowRight, Check, Heart, Link2, LayoutTemplate, QrCode, Smartphone, Sparkles, Users, Wand2, ShieldCheck, Star } from "lucide-react";
import { getCategories, getContent, getPackages, getTemplatesWithCat } from "@/server/core";
import { TemplateCard, priceMap } from "@/components/Catalog";
import { idr } from "@/lib/format";

const FEATURES = [
  [LayoutTemplate, "30+ template berkarakter", "Setiap template punya cover, tipografi, animasi, galeri, dan ornamen yang berbeda."],
  [Wand2, "Editor semudah mengisi formulir", "Simple Editor untuk pemula, Advanced Editor untuk kontrol penuh. Live preview & autosave."],
  [Link2, "Link personal per tamu", "Nama tamu muncul di cover. Kirim lewat WhatsApp dalam satu klik."],
  [Users, "RSVP, ucapan & buku tamu", "Rekap kehadiran real-time, moderasi ucapan, dan anti-spam."],
  [QrCode, "QR Code & check-in", "Scan QR tamu di lokasi acara, cegah check-in ganda, lihat rekap kehadiran."],
  [Smartphone, "Mobile-first & PWA", "Cepat dibuka dari WhatsApp. Dashboard bisa dipasang seperti aplikasi."],
] as const;

export default async function Home() {
  const [content, pkgs, cats, tpls, price] = await Promise.all([getContent(), getPackages(), getCategories(), getTemplatesWithCat(), priceMap()]);
  const featured = tpls.filter((t) => t.featured).slice(0, 8);
  const plans = pkgs.filter((p) => !p.isAddon);
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 lg:grid-cols-2 lg:pt-20">
          <div className="fade-up">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900"><Sparkles size={14} /> Digital Invitation Studio</span>
            <h1 className="font-display mt-5 text-4xl font-semibold leading-[1.1] sm:text-5xl lg:text-[3.4rem]">{content.heroTitle}</h1>
            <p className="mt-5 max-w-xl text-base text-stone-600 sm:text-lg">{content.heroSubtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/templates" className="btn btn-primary">Lihat Template <ArrowRight size={16} /></Link>
              <Link href="/i/andi-dan-siti?to=Bapak%20Budi" className="btn btn-ghost">Lihat Contoh Undangan</Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-stone-600">
              {["Gratis mulai hari ini", "Tanpa aplikasi untuk tamu", "Bisa dibuka dari HP"].map((x) => <li key={x} className="flex items-center gap-1.5"><Check size={16} className="text-emerald-600" />{x}</li>)}
            </ul>
          </div>
          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-6 rounded-[3rem] bg-gradient-to-br from-amber-100 via-stone-100 to-rose-100" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/hero.jpg" alt="Undangan digital di ponsel" className="relative aspect-[4/5] w-full rounded-[2rem] object-cover shadow-2xl" />
            <div className="absolute -bottom-5 -left-3 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-xl"><span className="rounded-xl bg-emerald-100 p-2 text-emerald-700"><Heart size={18} /></span><div><p className="text-xs text-stone-500">RSVP masuk hari ini</p><p className="text-sm font-semibold">+24 tamu hadir</p></div></div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex items-end justify-between"><div><h2 className="font-display text-2xl font-semibold sm:text-3xl">Template unggulan</h2><p className="mt-1 text-sm text-stone-500">Pilih gaya yang paling mewakili momen Anda.</p></div><Link href="/templates" className="text-sm font-semibold underline">Semua template</Link></div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">{featured.map((t) => <TemplateCard key={t.id} t={t} href={`/templates/${t.slug}`} price={price(t)} />)}</div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">Untuk setiap jenis acara</h2>
        <div className="mt-5 flex flex-wrap gap-2">
          {cats.map((c) => <Link key={c.id} href={`/templates?cat=${c.slug}`} className="rounded-full border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium hover:border-stone-900">{c.icon} {c.name}</Link>)}
        </div>
      </section>

      <section className="bg-white py-16"><div className="mx-auto max-w-6xl px-4">
        <h2 className="font-display text-center text-2xl font-semibold sm:text-3xl">Semua yang Anda butuhkan, dalam satu studio</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([I, t, d]) => <div key={t} className="rounded-2xl border border-stone-200 p-5"><span className="inline-flex rounded-xl bg-stone-900 p-2.5 text-amber-300"><I size={20} /></span><h3 className="mt-4 font-semibold">{t}</h3><p className="mt-1 text-sm text-stone-600">{d}</p></div>)}
        </div></div></section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-center text-2xl font-semibold sm:text-3xl">Cara kerjanya</h2>
        <ol className="mt-10 grid gap-5 md:grid-cols-4">
          {[["Pilih template", "Jelajahi katalog & lihat demo langsung."], ["Isi data acara", "Nama, tanggal, lokasi, foto. Preview langsung terlihat."], ["Bayar & terbitkan", "Pilih paket, bayar, lalu publish dengan satu klik."], ["Bagikan ke tamu", "Link personal via WhatsApp, pantau RSVP & kehadiran."]].map(([t, d], i) => (
            <li key={t} className="relative rounded-2xl border border-stone-200 bg-white p-5"><span className="font-display text-4xl text-amber-600/40">{i + 1}</span><h3 className="mt-2 font-semibold">{t}</h3><p className="mt-1 text-sm text-stone-600">{d}</p></li>))}
        </ol>
      </section>

      <section id="harga" className="bg-stone-900 py-16 text-white"><div className="mx-auto max-w-6xl px-4">
        <h2 className="font-display text-center text-2xl font-semibold sm:text-3xl">Paket & harga</h2>
        <p className="mt-2 text-center text-sm text-stone-400">Harga transparan. Bayar sekali per undangan.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {plans.map((p) => (
            <div key={p.code} className={`flex flex-col rounded-2xl p-5 ${p.highlight ? "bg-amber-50 text-stone-900 ring-2 ring-amber-400" : "bg-white/5"}`}>
              {p.highlight && <span className="mb-2 w-fit rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-black">TERPOPULER</span>}
              <h3 className="font-display text-xl font-semibold">{p.name}</h3>
              <div className="mt-2">{p.promoPrice != null && <span className="mr-2 text-xs line-through opacity-50">{idr(p.price)}</span>}<span className="text-2xl font-bold">{(p.promoPrice ?? p.price) === 0 ? "Gratis" : idr(p.promoPrice ?? p.price)}</span></div>
              <p className="mt-1 text-xs opacity-70">{p.description}</p>
              <ul className="mt-4 flex-1 space-y-1.5 text-xs">{p.features.map((f) => <li key={f} className="flex gap-1.5"><Check size={14} className="mt-0.5 flex-none text-emerald-500" />{f}</li>)}</ul>
              <Link href={p.code === "custom" ? "/help" : "/templates"} className={`btn mt-5 ${p.highlight ? "btn-primary" : "bg-white text-stone-900 hover:bg-stone-200"}`}>{p.code === "custom" ? "Konsultasi" : "Pilih paket"}</Link>
            </div>))}
        </div></div></section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-center text-2xl font-semibold sm:text-3xl">Kata mereka</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {content.testimonials.map((t) => (<figure key={t.name} className="card p-5"><div className="flex gap-0.5 text-amber-500">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={14} fill="currentColor" />)}</div><blockquote className="mt-3 text-sm text-stone-700">“{t.text}”</blockquote><figcaption className="mt-4 text-sm font-semibold">{t.name}<span className="block text-xs font-normal text-stone-500">{t.role}</span></figcaption></figure>))}
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-4 py-8">
        <h2 className="font-display text-center text-2xl font-semibold sm:text-3xl">Pertanyaan umum</h2>
        <div className="mt-6 space-y-2">{content.faq.map((f) => (<details key={f.q} className="card group p-4"><summary className="flex min-h-[28px] cursor-pointer list-none items-center justify-between font-medium">{f.q}<span className="text-xl text-stone-400 transition group-open:rotate-45">+</span></summary><p className="mt-2 text-sm text-stone-600">{f.a}</p></details>))}</div>
      </section>

      <section className="mx-auto mt-12 max-w-6xl px-4">
        <div className="rounded-3xl bg-gradient-to-br from-stone-900 to-stone-700 px-6 py-12 text-center text-white">
          <ShieldCheck className="mx-auto text-amber-300" /><h2 className="font-display mt-3 text-2xl font-semibold sm:text-3xl">Siap membuat undangan yang berkesan?</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-stone-300">Mulai gratis. Upgrade kapan saja saat Anda membutuhkan fitur premium.</p>
          <Link href="/register" className="btn mt-6 bg-amber-300 text-black hover:bg-amber-200">Buat undangan sekarang</Link>
        </div>
      </section>
    </>
  );
}
