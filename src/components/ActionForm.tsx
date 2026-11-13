"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, X, Loader2 } from "lucide-react";
import type { ActionResult } from "@/types";

/* ---------- Toast ---------- */
type Toast = { id: number; text: string; type: "ok" | "err" };
const ToastCtx = createContext<(text: string, type?: "ok" | "err") => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, type: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((l) => [...l.slice(-3), { id, text, type }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} role="status" className={`fade-up pointer-events-auto flex max-w-sm items-start gap-2 rounded-xl px-4 py-3 text-sm text-white shadow-xl ${t.type === "ok" ? "bg-stone-900" : "bg-red-600"}`}>
            {t.type === "ok" ? <CheckCircle2 size={18} className="mt-0.5 flex-none text-emerald-400" /> : <AlertTriangle size={18} className="mt-0.5 flex-none" />}
            <span>{t.text}</span>
            <button type="button" aria-label="Tutup" onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))}><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Dialog konfirmasi ---------- */
export function ConfirmDialog({ open, message, onYes, onNo }: { open: boolean; message: string; onYes: () => void; onNo: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 p-4 sm:items-center" role="alertdialog" aria-modal onClick={onNo}>
      <div className="fade-up w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-medium text-stone-900">Konfirmasi</p>
        <p className="mt-1 text-sm text-stone-600">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onNo}>Batal</button>
          <button type="button" className="btn btn-danger btn-sm" onClick={onYes} autoFocus>Ya, lanjutkan</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- ActionForm ---------- */
const PendingCtx = createContext({ pending: false, ready: false });
type Action = (fd: FormData) => Promise<ActionResult>;

export function ActionForm({ action, children, className, confirm, resetOnSuccess, noRefresh, onDone, id }: {
  action: Action; children: ReactNode; className?: string; confirm?: string; resetOnSuccess?: boolean; noRefresh?: boolean; onDone?: (r: ActionResult) => void; id?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState<FormData | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  // tombol submit baru aktif setelah hydrasi, agar form tidak pernah terkirim sebagai GET native (mencegah password muncul di URL)
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const run = (fd: FormData) => start(async () => {
    try {
      const r = await action(fd);
      toast(r.message, r.ok ? "ok" : "err");
      if (r.ok) {
        if (resetOnSuccess) ref.current?.reset();
        onDone?.(r);
        if (r.redirect) router.push(r.redirect); else if (!noRefresh) router.refresh();
      }
    } catch {
      toast("Terjadi kesalahan. Coba lagi.", "err");
    }
  });

  return (
    <PendingCtx.Provider value={{ pending, ready }}>
      <form ref={ref} id={id} method="post" className={className} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); if (confirm) setAsk(fd); else run(fd); }}>
        {children}
      </form>
      <ConfirmDialog open={!!ask} message={confirm ?? ""} onNo={() => setAsk(null)} onYes={() => { const fd = ask!; setAsk(null); run(fd); }} />
    </PendingCtx.Provider>
  );
}

export function Submit({ children, className = "btn btn-primary", disabled }: { children: ReactNode; className?: string; disabled?: boolean }) {
  const { pending, ready } = useContext(PendingCtx);
  return (
    <button type="submit" disabled={pending || !ready || disabled} className={className}>
      {pending && <Loader2 size={14} className="animate-spin" />}{children}
    </button>
  );
}
