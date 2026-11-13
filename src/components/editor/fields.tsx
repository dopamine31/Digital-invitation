"use client";
import { useRef, useState, type ReactNode } from "react";
import { ImagePlus, Lock, Trash2 } from "lucide-react";
import { useToast } from "@/components/ActionForm";

export const ASPECTS: { label: string; value: number | null }[] = [
  { label: "Asli", value: null }, { label: "1:1", value: 1 }, { label: "4:5", value: 4 / 5 }, { label: "3:4", value: 3 / 4 }, { label: "16:9", value: 16 / 9 },
];

/** Resize + crop tengah ke rasio tertentu, kompres ke JPEG. Berjalan di browser. */
export async function processImage(file: File, aspect: number | null, maxSide = 1280, quality = 0.78): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Gunakan file JPG, PNG, atau WebP.");
  if (file.size > 12 * 1024 * 1024) throw new Error("Ukuran file maksimal 12 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Gambar tidak dapat dibaca.")); i.src = url; });
    let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
    if (aspect) { if (sw / sh > aspect) { const nw = sh * aspect; sx = (sw - nw) / 2; sw = nw; } else { const nh = sw / aspect; sy = (sh - nh) / 2; sh = nh; } }
    const scale = Math.min(1, maxSide / Math.max(sw, sh));
    const c = document.createElement("canvas");
    c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
    c.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", quality);
  } finally { URL.revokeObjectURL(url); }
}

export function TextField({ label, value, onChange, multiline, type = "text", placeholder, rows = 3, max }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean; type?: string; placeholder?: string; rows?: number; max?: number;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {multiline ? <textarea className="input" rows={rows} value={value ?? ""} maxLength={max ?? 1000} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        : <input className="input" type={type} value={value ?? ""} maxLength={max ?? 300} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}
    </label>
  );
}

export function PhotoField({ label, value, onChange, aspect = 1, maxSide = 1000 }: { label: string; value: string; onChange: (v: string) => void; aspect?: number | null; maxSide?: number }) {
  const ref = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-xl border border-dashed border-stone-300 bg-stone-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="text-stone-400" size={20} />}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => ref.current?.click()}>{busy ? "Memproses…" : value ? "Ganti foto" : "Unggah foto"}</button>
          {value && <button type="button" className="btn btn-soft btn-sm" aria-label="Hapus foto" onClick={() => onChange("")}><Trash2 size={14} /></button>}
        </div>
        <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
          setBusy(true);
          try { onChange(await processImage(f, aspect, maxSide)); } catch (er) { toast((er as Error).message, "err"); }
          setBusy(false);
        }} />
      </div>
    </div>
  );
}

export function Group({ title, children, locked, lockText, open }: { title: string; children: ReactNode; locked?: boolean; lockText?: string; open?: boolean }) {
  return (
    <details open={open} className="group rounded-xl border border-stone-200 bg-white">
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between px-4 text-sm font-semibold">
        <span className="flex items-center gap-2">{title}{locked && <Lock size={13} className="text-amber-600" />}</span><span className="text-stone-400 transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="space-y-3 border-t border-stone-100 p-4">
        {locked && <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">🔒 {lockText ?? "Fitur ini membutuhkan upgrade paket."}</p>}
        <fieldset disabled={locked} className="space-y-3 disabled:opacity-50">{children}</fieldset>
      </div>
    </details>
  );
}
