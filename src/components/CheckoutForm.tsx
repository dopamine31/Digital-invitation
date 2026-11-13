"use client";
import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { ActionForm, Submit } from "@/components/ActionForm";
import { createOrderAction } from "@/server/actions/customer";
import { idr } from "@/lib/format";

type Pkg = { code: string; name: string; price: number; promoPrice: number | null; description: string; features: string[]; highlight: boolean; allowed: boolean };
type Addon = { code: string; name: string; price: number; description: string };

export function CheckoutForm({ templateSlug, templateName, templatePrice, invitationId, packages, addons, defaultPkg }: {
  templateSlug: string; templateName: string; templatePrice: number; invitationId: number | null; packages: Pkg[]; addons: Addon[]; defaultPkg: string;
}) {
  const [pkg, setPkg] = useState(defaultPkg);
  const [picked, setPicked] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [v, setV] = useState<{ ok: boolean; message: string; discount: number } | null>(null);
  const cur = packages.find((p) => p.code === pkg)!;
  const subtotal = useMemo(() => (cur.promoPrice ?? cur.price) + templatePrice + addons.filter((a) => picked.includes(a.code)).reduce((x, a) => x + a.price, 0), [cur, picked, addons, templatePrice]);
  const discount = v?.ok ? Math.min(v.discount, subtotal) : 0;
  async function apply() {
    if (!code.trim()) return;
    const r = await fetch(`/api/checkout/voucher?code=${encodeURIComponent(code)}&subtotal=${subtotal}&pkg=${pkg}`);
    setV(await r.json());
  }
  return (
    <ActionForm action={createOrderAction} noRefresh className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <input type="hidden" name="template" value={templateSlug} />{invitationId && <input type="hidden" name="invitation" value={invitationId} />}
      <input type="hidden" name="pkg" value={pkg} /><input type="hidden" name="voucher" value={v?.ok ? code : ""} />
      <div className="space-y-6">
        <section><h2 className="mb-3 font-semibold">1. Pilih paket</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {packages.map((p) => (
              <button type="button" key={p.code} disabled={!p.allowed} onClick={() => { setPkg(p.code); setV(null); }} aria-pressed={pkg === p.code}
                className={`card p-4 text-left transition ${pkg === p.code ? "ring-2 ring-stone-900" : ""} ${!p.allowed ? "opacity-40" : "hover:shadow-md"}`}>
                <div className="flex items-center justify-between"><span className="font-display text-lg font-semibold">{p.name}</span>{p.highlight && <span className="rounded-full bg-amber-200 px-2 text-[10px] font-bold">POPULER</span>}</div>
                <p className="mt-1 text-sm font-bold">{p.promoPrice != null && <s className="mr-1 text-xs font-normal text-stone-400">{idr(p.price)}</s>}{(p.promoPrice ?? p.price) === 0 ? "Gratis" : idr(p.promoPrice ?? p.price)}</p>
                <p className="mt-1 text-xs text-stone-500">{p.description}</p>
                <ul className="mt-2 space-y-0.5 text-xs">{p.features.slice(0, 5).map((f) => <li key={f} className="flex gap-1"><Check size={12} className="mt-0.5 flex-none text-emerald-600" />{f}</li>)}</ul>
                {!p.allowed && <p className="mt-2 text-[11px] text-red-600">Tidak mencukupi untuk template ini</p>}
              </button>))}
          </div>
        </section>
        {addons.length > 0 && pkg !== "custom" && (
          <section><h2 className="mb-3 font-semibold">2. Fitur tambahan (opsional)</h2>
            <div className="space-y-2">{addons.map((a) => (
              <label key={a.code} className="card flex min-h-[56px] cursor-pointer items-center gap-3 p-3"><input type="checkbox" name="addons" value={a.code} className="h-5 w-5" checked={picked.includes(a.code)} onChange={(e) => setPicked((l) => (e.target.checked ? [...l, a.code] : l.filter((x) => x !== a.code)))} />
                <span className="flex-1 text-sm"><b>{a.name}</b><span className="block text-xs text-stone-500">{a.description}</span></span><span className="text-sm font-semibold">{idr(a.price)}</span></label>))}</div></section>)}
        <section><h2 className="mb-3 font-semibold">3. Catatan {pkg === "custom" ? "& brief desain" : "(opsional)"}</h2>
          <textarea name="note" className="input" rows={3} maxLength={500} placeholder={pkg === "custom" ? "Ceritakan konsep, warna, dan referensi desain yang Anda inginkan…" : "Catatan untuk tim kami"} /></section>
      </div>
      <aside className="card h-fit space-y-3 p-4 lg:sticky lg:top-20">
        <h2 className="font-semibold">Ringkasan pesanan</h2>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between"><dt className="text-stone-500">Template</dt><dd className="text-right font-medium">{templateName}</dd></div>
          <div className="flex justify-between"><dt className="text-stone-500">Paket {cur.name}</dt><dd>{idr(cur.promoPrice ?? cur.price)}</dd></div>
          {templatePrice > 0 && <div className="flex justify-between"><dt className="text-stone-500">Biaya template</dt><dd>{idr(templatePrice)}</dd></div>}
          {addons.filter((a) => picked.includes(a.code)).map((a) => <div key={a.code} className="flex justify-between"><dt className="text-stone-500">{a.name}</dt><dd>{idr(a.price)}</dd></div>)}
          {discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Voucher {code.toUpperCase()}</dt><dd>-{idr(discount)}</dd></div>}
        </dl>
        <div className="flex gap-2"><input className="input" placeholder="Kode voucher" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setV(null); }} aria-label="Kode voucher" /><button type="button" className="btn btn-ghost" onClick={apply}>Pakai</button></div>
        {v && <p className={`text-xs ${v.ok ? "text-emerald-700" : "text-red-600"}`} role="status">{v.message}</p>}
        <div className="flex items-center justify-between border-t border-stone-200 pt-3"><span className="font-semibold">Total</span><span className="font-display text-2xl font-semibold" data-testid="total">{subtotal - discount === 0 ? "Gratis" : idr(subtotal - discount)}</span></div>
        <Submit className="btn btn-brand w-full">{subtotal - discount === 0 ? "Buat undangan gratis" : "Buat pesanan"}</Submit>
        <p className="text-[11px] text-stone-400">Harga dihitung ulang di server. Pembayaran: transfer manual (verifikasi admin) atau simulasi demo.</p>
      </aside>
    </ActionForm>
  );
}
