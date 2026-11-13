import Link from "next/link";
import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0"><h1 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h1>{subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between text-xs font-medium text-stone-500"><span>{label}</span>{icon}</div>
      <div className="mt-2 font-display text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-stone-400">{hint}</div>}
    </div>
  );
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="rounded-full bg-stone-100 p-3 text-stone-400"><Inbox /></div>
      <p className="mt-3 font-medium">{title}</p>{text && <p className="mt-1 max-w-sm text-sm text-stone-500">{text}</p>}{action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const TONES: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-800", amber: "bg-amber-100 text-amber-800", red: "bg-red-100 text-red-700",
  blue: "bg-sky-100 text-sky-800", gray: "bg-stone-100 text-stone-700", violet: "bg-violet-100 text-violet-800",
};
export const STATUS_TONE: Record<string, string> = {
  menunggu_pembayaran: "amber", menunggu_verifikasi: "blue", dibayar: "green", dalam_pengerjaan: "violet", menunggu_revisi: "amber",
  siap_diterbitkan: "blue", selesai: "green", dibatalkan: "red", refund: "red",
  pending: "amber", berhasil: "green", ditolak: "red", draft: "gray", published: "green", archived: "gray",
  open: "amber", dibalas: "blue", active: "green", blocked: "red", hadir: "green", tidak: "red",
};
export const STATUS_LABEL: Record<string, string> = {
  menunggu_pembayaran: "Menunggu pembayaran", menunggu_verifikasi: "Menunggu verifikasi", dibayar: "Dibayar", dalam_pengerjaan: "Dalam pengerjaan",
  menunggu_revisi: "Menunggu revisi", siap_diterbitkan: "Siap diterbitkan", selesai: "Selesai", dibatalkan: "Dibatalkan", refund: "Refund",
  pending: "Pending", berhasil: "Berhasil", ditolak: "Ditolak", draft: "Draft", published: "Terbit", archived: "Diarsipkan",
  open: "Terbuka", dibalas: "Dibalas", active: "Aktif", blocked: "Diblokir", hadir: "Hadir", tidak: "Tidak hadir",
};
export const ORDER_STATUSES = ["menunggu_pembayaran", "menunggu_verifikasi", "dibayar", "dalam_pengerjaan", "menunggu_revisi", "siap_diterbitkan", "selesai", "dibatalkan", "refund"];

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${TONES[tone] ?? TONES.gray}`}>{children}</span>;
}
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={STATUS_TONE[status] ?? "gray"}>{STATUS_LABEL[status] ?? status}</Badge>;

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="card overflow-x-auto"><table className="w-full min-w-[560px] divide-y divide-stone-100">{children}</table></div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <div><label className="label">{label}</label>{children}{hint && <p className="mt-1 text-[11px] text-stone-400">{hint}</p>}</div>;
}

export function TabLinks({ items, current }: { items: { href: string; label: string; key: string }[]; current: string }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-stone-100 p-1">
      {items.map((i) => (
        <Link key={i.key} href={i.href} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${current === i.key ? "bg-white shadow-sm" : "text-stone-500 hover:text-stone-900"}`}>{i.label}</Link>
      ))}
    </div>
  );
}

/** Bar chart sederhana berbasis SVG (ringan, tanpa library) */
export function BarChart({ data, color = "#9a7440", format }: { data: { label: string; value: number }[]; color?: string; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-44 items-end gap-1.5" role="img" aria-label="Grafik">
      {data.map((d, i) => (
        <div key={i} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">
          <div className="rounded-t-md transition-all group-hover:opacity-80" style={{ height: `${Math.max(2, (d.value / max) * 100)}%`, background: color }} />
          <span className="mt-1 truncate text-center text-[9px] text-stone-400">{d.label}</span>
          <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-stone-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">{format ? format(d.value) : d.value}</span>
        </div>
      ))}
    </div>
  );
}
