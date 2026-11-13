"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, QrCode, Search, UserPlus, WifiOff, Wifi, Check, X, Printer, Armchair, RefreshCw } from "lucide-react";
import { Button, Badge, StatCard, EmptyState } from "@/components/ui";
import { Modal, Tabs, toast } from "@/components/client-ui";
import {
  checkInByQrAction, checkInManualAction, searchGuestsForCheckInAction,
  createWalkInAction, offlineSyncAction, getCheckinStatsAction,
  assignSeatingAction, saveSeatingTableAction, type CheckInOutcome,
} from "@/server/actions/checkin";
import { formatDateTime } from "@/lib/format";

interface DetectorLike { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> }
type DetectorCtor = new (options: { formats: string[] }) => DetectorLike;
interface BarcodeWindow { BarcodeDetector?: DetectorCtor }

interface OfflineItem { payload: string; station: string; deviceId: string; at: string }

export interface CheckinStats {
  invited: number; attending: number; checkedIn: number; paxExpected: number; paxPresent: number;
  recent: { name: string; at: string; station: string }[];
}

const STORAGE_KEY = "rasa:offline-checkins";

export function CheckinConsole({ eventId, initialStats }: { eventId: string; initialStats: CheckinStats }) {
  const [stats, setStats] = useState(initialStats);
  const [tab, setTab] = useState("scan");
  const [scanning, setScanning] = useState(false);
  const [payload, setPayload] = useState("");
  const [station, setStation] = useState("loket-1");
  const [deviceId] = useState(() => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `dev-${Date.now()}`);
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState<OfflineItem[]>([]);
  const [outcome, setOutcome] = useState<{ ok: boolean; data?: CheckInOutcome; message: string } | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; groupLabel: string; checkedIn: boolean; tableNumber: string | null }[]>([]);
  const [walkIn, setWalkIn] = useState({ name: "", phone: "", pax: 1 });
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [seating, setSeating] = useState({ guestId: "", tableNumber: "", seatNumber: "", tableName: "", capacity: 10 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);

  const refreshStats = useCallback(async () => {
    const response = await getCheckinStatsAction(eventId);
    if (response.ok) setStats(response.data);
  }, [eventId]);

  const record = useCallback(async (raw: string, offline: boolean) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const response = await checkInByQrAction({ eventId, payload: raw, station, deviceId, offline });
    busyRef.current = false;
    if (!response.ok) { setOutcome({ ok: false, message: response.error }); return; }
    setOutcome({
      ok: !response.data.duplicate,
      data: response.data,
      message: response.data.duplicate ? `DUPLIKAT — ${response.data.guestName} sudah check-in` : `Berhasil — ${response.data.guestName}`,
    });
    if (!response.data.duplicate) void refreshStats();
    window.setTimeout(() => setOutcome(null), 4200);
  }, [deviceId, eventId, refreshStats, station]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try { setQueue(JSON.parse(localStorage.getItem(`${STORAGE_KEY}:${eventId}`) ?? "[]") as OfflineItem[]); } catch { setQueue([]); }
      setOnline(navigator.onLine);
    });
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, [eventId]);

  useEffect(() => {
    if (!online || queue.length === 0) return;
    let cancelled = false;
    const sync = async () => {
      const response = await offlineSyncAction(eventId, queue);
      if (cancelled || !response.ok) return;
      setQueue([]); localStorage.setItem(`${STORAGE_KEY}:${eventId}`, "[]");
      toast(`${response.data.synced} check-in offline tersinkron · ${response.data.duplicates} duplikat`);
      void refreshStats();
    };
    void sync();
    return () => { cancelled = true; };
  }, [eventId, online, queue, refreshStats]);

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { toast("Kamera tidak tersedia; gunakan input manual", "err"); return; }
    const Detector = (window as unknown as BarcodeWindow).BarcodeDetector;
    if (!Detector) { toast("Browser belum mendukung BarcodeDetector; gunakan scanner eksternal / input manual", "err"); return; }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) { videoRef.current.srcObject = streamRef.current; await videoRef.current.play(); }
      setScanning(true);
      const detector = new Detector({ formats: ["qr_code"] });
      const canvas = document.createElement("canvas");
      const tick = async () => {
        if (!streamRef.current || !videoRef.current) return;
        canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight;
        canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
        try {
          const codes = await detector.detect(canvas);
          const code = codes[0]?.rawValue;
          if (code) {
            if (!navigator.onLine) {
              const item = { payload: code, station, deviceId, at: new Date().toISOString() };
              setQueue((current) => { const next = [...current, item]; localStorage.setItem(`${STORAGE_KEY}:${eventId}`, JSON.stringify(next)); return next; });
              setOutcome({ ok: true, message: "Tersimpan offline — akan disinkron saat online" });
            } else void record(code, false);
            await new Promise((resolve) => window.setTimeout(resolve, 1400));
          }
        } catch { /* frame detection gagal; lanjut frame berikutnya */ }
        window.requestAnimationFrame(() => void tick());
      };
      void tick();
    } catch { toast("Izin kamera ditolak", "err"); }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null; setScanning(false);
  };
  useEffect(() => () => stopCamera(), []);

  const search = async () => {
    const response = await searchGuestsForCheckInAction(eventId, query);
    if (response.ok) setResults(response.data);
    else toast(response.error, "err");
  };

  const manual = async (guestId: string) => {
    const response = await checkInManualAction(eventId, guestId, station);
    if (!response.ok) { toast(response.error, "err"); return; }
    setOutcome({ ok: !response.data.duplicate, data: response.data, message: response.data.duplicate ? "DUPLIKAT — sudah check-in" : `Berhasil — ${response.data.guestName}` });
    void search(); void refreshStats();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Check-in QR</h1><p className="page-subtitle">Multi-loket, anti-duplikat, offline-first PWA, walk-in, dan nomor meja.</p></div>
        <div className="row"><Badge tone={online ? "success" : "danger"}>{online ? <Wifi size={12} /> : <WifiOff size={12} />} {online ? "Online" : `Offline · ${queue.length} antrean`}</Badge><Button size="sm" onClick={refreshStats}><RefreshCw size={14} /> Segarkan</Button></div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <StatCard label="Diundang" value={stats.invited} />
        <StatCard label="RSVP hadir" value={stats.attending} />
        <StatCard label="Check-in" value={stats.checkedIn} hint={`${stats.paxPresent} / ${stats.paxExpected} pax`} />
        <StatCard label="Belum hadir" value={Math.max(0, stats.attending - stats.checkedIn)} />
      </div>

      {outcome ? <div className={`notice ${outcome.ok ? "notice-success" : "notice-error"}`} role="alert" style={{ fontSize: 18, fontWeight: 650 }}>{outcome.ok ? <Check size={18} style={{ verticalAlign: -3 }} /> : <X size={18} style={{ verticalAlign: -3 }} />} {outcome.message}{outcome.data?.tableNumber ? ` · Meja ${outcome.data.tableNumber}` : ""}</div> : null}

      <div className="card">
        <Tabs tabs={[{ id: "scan", label: "Scanner" }, { id: "manual", label: "Cari & manual" }, { id: "seating", label: "Meja & kartu" }, { id: "recent", label: "Log terbaru" }]} active={tab} onChange={setTab} />
        <div style={{ marginTop: 20 }}>
          {tab === "scan" ? (
            <div className="grid grid-2" style={{ alignItems: "start" }}>
              <div className="stack">
                <div className="field"><label className="label">Loket / station</label><input className="input" value={station} onChange={(e) => setStation(e.target.value)} /></div>
                <div style={{ position: "relative", background: "#111", borderRadius: 14, minHeight: 280, display: "grid", placeItems: "center", overflow: "hidden" }}>
                  <video ref={videoRef} muted playsInline style={{ width: "100%", maxHeight: 360, objectFit: "cover", display: scanning ? "block" : "none" }} />
                  {!scanning ? <div className="center" style={{ color: "#fff", opacity: .7 }}><QrCode size={48} /><p className="small">Aktifkan kamera untuk memindai QR e-ticket</p></div> : null}
                  {scanning ? <div style={{ position: "absolute", inset: "16% 20%", border: "2px solid #fff", borderRadius: 12, boxShadow: "0 0 0 9999px rgba(0,0,0,.25)" }} /> : null}
                </div>
                <div className="row">{scanning ? <Button variant="danger" onClick={stopCamera}>Matikan kamera</Button> : <Button variant="primary" onClick={startCamera}><Camera size={15} /> Aktifkan kamera</Button>}<Button onClick={() => setWalkInOpen(true)}><UserPlus size={15} /> Walk-in</Button></div>
                <div className="field"><label className="label">Atau tempel payload QR (scanner eksternal)</label><div className="row"><input className="input mono" value={payload} onChange={(e) => setPayload(e.target.value)} placeholder="eventId.guestId.nonce.signature" /><Button onClick={() => payload && void record(payload, !online)}>Check-in</Button></div></div>
              </div>
              <div className="stack">
                <div className="notice"><strong>Anti-duplikat</strong><p className="small" style={{ marginTop: 6 }}>Constraint unik <code>(eventId, guestId)</code> di database dan penanganan error P2002 memastikan satu QR hanya valid satu kali, termasuk saat sinkronisasi multi-perangkat.</p></div>
                <div className="notice"><strong>Offline-first</strong><p className="small" style={{ marginTop: 6 }}>{queue.length} scan tersimpan di perangkat ini. Saat koneksi kembali, antrean dikirim lewat <code>offlineSyncAction</code> dengan idempotensi.</p></div>
                <div className="card"><strong className="small">Perangkat ini</strong><div className="tiny muted mono" style={{ marginTop: 6 }}>{deviceId}</div></div>
              </div>
            </div>
          ) : null}

          {tab === "manual" ? (
            <div className="stack">
              <div className="row"><input className="input" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(); }} placeholder="Cari nama tamu…" aria-label="Cari tamu" /><Button onClick={search}><Search size={15} /> Cari</Button></div>
              {results.length === 0 ? <EmptyState title="Cari tamu untuk check-in manual" /> : (
                <div className="table-wrap" style={{ border: 0 }}><table className="table"><thead><tr><th>Nama</th><th>Grup</th><th>Meja</th><th>Status</th><th /></tr></thead><tbody>
                  {results.map((row) => <tr key={row.id}><td>{row.name}</td><td className="small">{row.groupLabel}</td><td>{row.tableNumber ?? "—"}</td><td>{row.checkedIn ? <Badge tone="success">Hadir</Badge> : <Badge>Belum</Badge>}</td><td><Button size="sm" onClick={() => manual(row.id)} disabled={row.checkedIn}>Check-in</Button></td></tr>)}
                </tbody></table></div>
              )}
            </div>
          ) : null}

          {tab === "seating" ? (
            <div className="grid grid-2" style={{ alignItems: "start" }}>
              <div className="stack">
                <h3>Tetapkan nomor meja</h3>
                <div className="field"><label className="label">ID tamu</label><input className="input mono" value={seating.guestId} onChange={(e) => setSeating({ ...seating, guestId: e.target.value })} /></div>
                <div className="grid grid-2"><div className="field"><label className="label">Meja</label><input className="input" value={seating.tableNumber} onChange={(e) => setSeating({ ...seating, tableNumber: e.target.value })} /></div><div className="field"><label className="label">Kursi</label><input className="input" value={seating.seatNumber} onChange={(e) => setSeating({ ...seating, seatNumber: e.target.value })} /></div></div>
                <Button variant="primary" onClick={async () => { const r = await assignSeatingAction(eventId, seating.guestId, seating.tableNumber, seating.seatNumber); if (r.ok) toast("Tempat duduk disimpan"); else toast(r.error, "err"); }}><Armchair size={15} /> Simpan</Button>
              </div>
              <div className="stack">
                <h3>Definisikan meja</h3>
                <div className="grid grid-2"><div className="field"><label className="label">Nama meja</label><input className="input" value={seating.tableName} onChange={(e) => setSeating({ ...seating, tableName: e.target.value })} /></div><div className="field"><label className="label">Kapasitas</label><input className="input" type="number" min={1} max={50} value={seating.capacity} onChange={(e) => setSeating({ ...seating, capacity: Number(e.target.value) })} /></div></div>
                <Button onClick={async () => { const r = await saveSeatingTableAction(eventId, seating.tableName, seating.capacity); if (r.ok) toast("Meja dibuat"); else toast(r.error, "err"); }}>Buat meja</Button>
                <Button onClick={() => window.print()}><Printer size={15} /> Cetak kartu meja</Button>
                <div className="notice small">Gunakan CSS <code>@media print</code> untuk kartu meja; data grup dan nomor meja tersedia pada halaman Tamu.</div>
              </div>
            </div>
          ) : null}

          {tab === "recent" ? (
            stats.recent.length === 0 ? <EmptyState title="Belum ada check-in" /> : (
              <div className="table-wrap" style={{ border: 0 }}><table className="table"><thead><tr><th>Tamu</th><th>Loket</th><th>Waktu</th></tr></thead><tbody>{stats.recent.map((row, index) => <tr key={`${row.name}-${index}`}><td>{row.name}</td><td>{row.station}</td><td>{formatDateTime(row.at)}</td></tr>)}</tbody></table></div>
            )
          ) : null}
        </div>
      </div>

      {walkInOpen ? (
        <Modal title="Daftarkan tamu walk-in" onClose={() => setWalkInOpen(false)}>
          <div className="stack">
            <div className="field"><label className="label">Nama</label><input className="input" value={walkIn.name} onChange={(e) => setWalkIn({ ...walkIn, name: e.target.value })} /></div>
            <div className="grid grid-2"><div className="field"><label className="label">No. HP (opsional)</label><input className="input" value={walkIn.phone} onChange={(e) => setWalkIn({ ...walkIn, phone: e.target.value })} /></div><div className="field"><label className="label">Pax</label><input className="input" type="number" min={1} max={10} value={walkIn.pax} onChange={(e) => setWalkIn({ ...walkIn, pax: Number(e.target.value) })} /></div></div>
            <Button variant="primary" onClick={async () => { const r = await createWalkInAction({ eventId, ...walkIn }); if (!r.ok) { toast(r.error, "err"); return; } setOutcome({ ok: true, data: r.data, message: `Walk-in ${r.data.guestName} langsung check-in` }); setWalkInOpen(false); void refreshStats(); }} disabled={walkIn.name.length < 2}>Daftar & check-in</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
