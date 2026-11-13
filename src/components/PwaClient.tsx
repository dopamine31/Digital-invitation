"use client";
import { useEffect, useState } from "react";
import { Download, RefreshCw, WifiOff } from "lucide-react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function PwaClient() {
  const [install, setInstall] = useState<BIPEvent | null>(null);
  const [update, setUpdate] = useState<ServiceWorkerRegistration | null>(null);
  const [offline, setOffline] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        const check = () => { if (reg.waiting && navigator.serviceWorker.controller) setUpdate(reg); };
        check();
        reg.addEventListener("updatefound", () => reg.installing?.addEventListener("statechange", check));
      }).catch(() => undefined);
      // reload hanya saat PEMBARUAN (sudah ada controller sebelumnya), bukan saat instalasi pertama
      const hadController = !!navigator.serviceWorker.controller;
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
    }
    const onBip = (e: Event) => { e.preventDefault(); setInstall(e as BIPEvent); };
    const on = () => setOffline(false), off = () => setOffline(true);
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    setOffline(!navigator.onLine);
    return () => { window.removeEventListener("beforeinstallprompt", onBip); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const path = typeof window !== "undefined" ? window.location.pathname : "";
  if (path.startsWith("/i/") || path.startsWith("/preview")) return null;
  return (
    <>
      {offline && <div className="fixed inset-x-0 top-0 z-[120] flex items-center justify-center gap-2 bg-amber-400 px-3 py-1.5 text-xs font-medium text-black"><WifiOff size={14} /> Anda sedang offline — beberapa fitur tidak tersedia.</div>}
      {(install || update) && !hidden && (
        <div className="fixed inset-x-3 bottom-20 z-[90] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-stone-900 p-3 text-sm text-white shadow-2xl lg:bottom-6">
          {update ? <RefreshCw size={18} /> : <Download size={18} />}
          <span className="flex-1">{update ? "Versi baru aplikasi tersedia." : "Pasang aplikasi di layar utama Anda."}</span>
          <button type="button" className="btn btn-sm bg-amber-300 text-black" onClick={async () => {
            if (update) update.waiting?.postMessage({ type: "SKIP_WAITING" });
            else if (install) { await install.prompt(); setInstall(null); }
          }}>{update ? "Perbarui" : "Pasang"}</button>
          <button type="button" className="text-xs text-stone-400" onClick={() => setHidden(true)}>Nanti</button>
        </div>
      )}
    </>
  );
}
