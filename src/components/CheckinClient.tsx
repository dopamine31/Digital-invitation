"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, CheckCircle2, XCircle } from "lucide-react";
import { checkInAction } from "@/server/actions/customer";

type BD = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

export function CheckinClient({ invId }: { invId: number }) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  const [supported, setSupported] = useState(true);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [code, setCode] = useState("");
  const busy = useRef(false);
  const last = useRef("");

  async function submit(value: string) {
    if (busy.current || !value) return;
    busy.current = true;
    const fd = new FormData(); fd.set("id", String(invId)); fd.set("code", value);
    const r = await checkInAction(fd);
    setResult({ ok: r.ok, text: r.message });
    if (r.ok) router.refresh();
    setTimeout(() => { busy.current = false; last.current = ""; }, 2200);
  }

  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | undefined; let raf = 0; let alive = true;
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => BD }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) { setSupported(false); setOn(false); return; }
    const det = new Detector({ formats: ["qr_code"] });
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(async (st) => {
      stream = st;
      if (!video.current) return;
      video.current.srcObject = st; await video.current.play();
      const tick = async () => {
        if (!alive) return;
        try { const codes = await det.detect(video.current!); const v = codes[0]?.rawValue; if (v && v !== last.current) { last.current = v; submit(v); } } catch { /* abaikan */ }
        raf = requestAnimationFrame(tick);
      };
      tick();
    }).catch(() => { setResult({ ok: false, text: "Kamera tidak dapat diakses. Izinkan akses kamera atau gunakan input kode manual." }); setOn(false); });
    return () => { alive = false; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="relative aspect-[4/3] bg-stone-900">
          <video ref={video} playsInline muted className="h-full w-full object-cover" />
          {!on && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white"><Camera size={36} className="opacity-60" /><button type="button" className="btn bg-amber-300 text-black" onClick={() => { setSupported(true); setOn(true); }}>Mulai scan QR</button></div>}
          {on && <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-amber-300/80" />}
        </div>
        <div className="flex items-center justify-between p-3">{on ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOn(false)}><CameraOff size={14} /> Matikan kamera</button> : <span className="text-xs text-stone-500">Arahkan kamera ke QR tamu.</span>}
          {!supported && <span className="text-xs text-amber-700">Browser ini belum mendukung scan kamera. Gunakan kode manual.</span>}</div>
      </div>
      <form className="card flex gap-2 p-3" onSubmit={(e) => { e.preventDefault(); submit(code.trim()); setCode(""); }}>
        <input className="input" placeholder="Kode tamu / tempel link QR" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Kode tamu" />
        <button className="btn btn-primary" type="submit">Check-in</button>
      </form>
      {result && <div role="status" className={`flex items-start gap-2 rounded-xl p-3 text-sm ${result.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{result.ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}{result.text}</div>}
    </div>
  );
}
