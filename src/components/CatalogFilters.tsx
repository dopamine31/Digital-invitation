"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

type Opt = { value: string; label: string };
export function CatalogFilters({ categories, styles }: { categories: Opt[]; styles: Opt[] }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp.toString());
    if (v) n.set(k, v); else n.delete(k);
    router.replace(`${path}?${n.toString()}`, { scroll: false });
  };
  // debounce pencarian 350ms
  useEffect(() => {
    clearTimeout(timer.current);
    if (q === (sp.get("q") ?? "")) return;
    timer.current = setTimeout(() => set("q", q), 350);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const sel = (k: string, label: string, opts: Opt[]) => (
    <select aria-label={label} className="input !min-h-[40px] !w-auto min-w-[130px] flex-none" value={sp.get(k) ?? ""} onChange={(e) => set(k, e.target.value)}>
      <option value="">{label}</option>{opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
  return (
    <div className="mb-5 space-y-3">
      <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari template: islami, minimalis, emas…" className="input !pl-9" aria-label="Cari template" /></div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {sel("cat", "Semua kategori", categories)}
        {sel("price", "Harga", [{ value: "free", label: "Gratis" }, { value: "basic", label: "Basic" }, { value: "premium", label: "Premium" }, { value: "exclusive", label: "Exclusive" }])}
        {sel("tone", "Warna", [{ value: "light", label: "Terang" }, { value: "dark", label: "Gelap" }])}
        {sel("style", "Gaya / tema", styles)}
        {sel("sort", "Urutkan", [{ value: "popular", label: "Terpopuler" }, { value: "new", label: "Terbaru" }, { value: "price", label: "Harga terendah" }, { value: "recommended", label: "Rekomendasi" }])}
        {sel("show", "Tampilkan", [{ value: "featured", label: "Unggulan" }, { value: "fav", label: "Favorit saya" }])}
      </div>
    </div>
  );
}
