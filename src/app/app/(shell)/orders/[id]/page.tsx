import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireCustomer } from "@/lib/auth";
import { getPackages, getSite, getSystem } from "@/server/core";
import { OrderPay } from "@/components/OrderPay";
import { PageHeader, StatusBadge } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { dateID, idr } from "@/lib/format";

export const metadata = { title: "Detail Pesanan" };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireCustomer();
  const [o] = await db.select().from(s.orders).where(and(eq(s.orders.id, Number((await params).id)), eq(s.orders.userId, u.id))).limit(1);
  if (!o) notFound();
  const [pay] = await db.select().from(s.payments).where(eq(s.payments.orderId, o.id)).limit(1);
  const [tpl] = o.templateId ? await db.select().from(s.templates).where(eq(s.templates.id, o.templateId)).limit(1) : [];
  const [site, sys, allPkgs] = await Promise.all([getSite(), getSystem(), getPackages(true)]);
  const pkgPrice = allPkgs.find((p) => p.code === o.packageCode);
  const addonRows = allPkgs.filter((p) => o.addons.includes(p.code));
  const base = o.subtotal - (tpl?.price ?? 0) - addonRows.reduce((a, p) => a + p.price, 0);
  void pkgPrice;
  const payable = o.status === "menunggu_pembayaran" || o.status === "menunggu_verifikasi";
  const steps = ["menunggu_pembayaran", "menunggu_verifikasi", "dibayar", "dalam_pengerjaan", "siap_diterbitkan", "selesai"];
  const idx = steps.indexOf(o.status);
  return (
    <>
      <Link href="/app/orders" className="no-print text-sm text-stone-500">← Semua pesanan</Link>
      <PageHeader title={`Pesanan ${o.number}`} subtitle={dateID(o.createdAt, true)} actions={<><StatusBadge status={o.status} /><PrintButton /></>} />
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="card p-5" id="invoice">
            <div className="flex items-start justify-between"><div><p className="font-display text-xl font-semibold">{site.name}</p><p className="text-xs text-stone-500">{site.address}<br />{site.email}</p></div><div className="text-right"><p className="text-xs uppercase text-stone-400">Invoice</p><p className="font-mono text-sm font-semibold">{o.number}</p></div></div>
            <div className="my-4 border-t border-dashed border-stone-200" />
            <p className="text-xs text-stone-500">Ditagihkan kepada</p><p className="font-medium">{u.name}</p><p className="text-sm text-stone-500">{u.email}</p>
            <table className="mt-4 w-full text-sm"><tbody className="divide-y divide-stone-100">
              <tr><td className="py-2">Paket {o.packageCode}{tpl ? ` — template ${tpl.name}` : ""}</td><td className="py-2 text-right">{idr(base)}</td></tr>
              {tpl && tpl.price > 0 && <tr><td className="py-2">Biaya template</td><td className="py-2 text-right">{idr(tpl.price)}</td></tr>}
              {addonRows.map((a) => <tr key={a.code}><td className="py-2">Add-on: {a.name}</td><td className="py-2 text-right">{idr(a.price)}</td></tr>)}
              {o.discount > 0 && <tr><td className="py-2 text-emerald-700">Diskon {o.voucherCode}</td><td className="py-2 text-right text-emerald-700">-{idr(o.discount)}</td></tr>}
              <tr><td className="py-3 font-semibold">Total</td><td className="py-3 text-right font-display text-xl font-semibold">{idr(o.total)}</td></tr></tbody></table>
            {pay && <p className="mt-2 text-xs text-stone-500">Pembayaran: {pay.method} · ref {pay.reference} · <b>{pay.status}</b></p>}
          </div>
          <div className="card no-print p-5"><h2 className="mb-3 text-sm font-semibold">Progres pesanan</h2>
            {o.status === "dibatalkan" || o.status === "refund" ? <StatusBadge status={o.status} /> : (
              <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">{steps.map((st, i) => (<li key={st} className={`rounded-lg p-2 text-center text-[10px] font-medium ${i <= idx ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-400"}`}>{st.replace(/_/g, " ")}</li>))}</ol>)}
            {o.invitationId && <Link href={`/app/invitations/${o.invitationId}/edit`} className="btn btn-primary btn-sm mt-4">Buka editor undangan</Link>}
          </div>
        </div>
        {payable && <OrderPay orderId={o.id} bank={{ name: sys.bankName, number: sys.bankNumber, holder: sys.bankHolder }} demo={sys.paymentProvider === "demo"} hasProof={!!pay?.proof} />}
      </div>
    </>
  );
}
