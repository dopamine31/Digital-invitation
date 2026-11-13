import Link from "next/link";
import { LifeBuoy, MessageCircle, Ticket } from "lucide-react";
import { getContent, getSite } from "@/server/core";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Pusat Bantuan" };

export default async function HelpPage() {
  const [c, site, user] = await Promise.all([getContent(), getSite(), getSession()]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-3xl font-semibold">Pusat Bantuan</h1>
      <p className="mt-2 text-stone-600">{c.pages.help}</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <a href={`https://wa.me/${site.whatsapp}?text=${encodeURIComponent("Halo, saya butuh bantuan dengan undangan digital.")}`} className="card flex items-center gap-3 p-4 hover:shadow-md"><MessageCircle className="text-emerald-600" /><div><p className="font-semibold">Chat WhatsApp</p><p className="text-xs text-stone-500">09.00–17.00 WIB</p></div></a>
        <Link href={user ? (user.role === "customer" ? "/app/support" : "/admin/support") : "/login?next=/app/support"} className="card flex items-center gap-3 p-4 hover:shadow-md"><Ticket className="text-amber-700" /><div><p className="font-semibold">Kirim tiket bantuan</p><p className="text-xs text-stone-500">Dibalas oleh tim kami di dashboard</p></div></Link>
      </div>
      <h2 className="font-display mt-10 flex items-center gap-2 text-xl font-semibold"><LifeBuoy size={20} /> FAQ</h2>
      <div className="mt-4 space-y-2">{c.faq.map((f) => (<details key={f.q} className="card group p-4"><summary className="cursor-pointer list-none font-medium">{f.q}</summary><p className="mt-2 text-sm text-stone-600">{f.a}</p></details>))}</div>
    </div>
  );
}
