import Link from "next/link";
import { prisma } from "@/lib/db";
import { THEMES } from "@/lib/themes";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

async function getPlans() {
  try {
    const rows = await prisma.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
    return rows.map((row) => ({ code: row.code, name: row.name, price: row.monthlyPrice, description: row.description }));
  } catch {
    return [
      { code: "STARTER", name: "Starter", price: 99000, description: "1 acara, 100 tamu, RSVP lengkap" },
      { code: "GROWTH", name: "Growth", price: 249000, description: "5 acara, 1.000 tamu, blast & check-in" },
      { code: "STUDIO", name: "Studio", price: 599000, description: "Tanpa batas, white-label, API & webhook" },
    ];
  }
}

export default async function HomePage() {
  const plans = await getPlans();
  return (
    <main>
      <header className="topbar" style={{ padding: "0 clamp(20px,5vw,64px)" }}>
        <Link href="/" className="row" style={{ gap: 10 }}><span className="brand-mark">R</span><strong style={{ fontFamily: "var(--ui-font-display)", fontSize: 20 }}>Rasa Undangan</strong></Link>
        <nav className="row" style={{ gap: 18 }}>
          <a href="#tema" className="small hide-mobile">Tema</a>
          <a href="#fitur" className="small hide-mobile">Fitur</a>
          <a href="#harga" className="small hide-mobile">Harga</a>
          <Link href="/login" className="btn btn-sm">Masuk</Link>
          <Link href="/register" className="btn btn-sm btn-primary">Coba gratis</Link>
        </nav>
      </header>

      <section className="hero">
        <p className="hero-eyebrow">Undangan digital · RSVP · Check-in</p>
        <h1>Satu platform untuk <em style={{ color: "var(--ui-primary)" }}>setiap momen</em> yang berarti.</h1>
        <p>Bangun undangan premium yang benar-benar milik Anda. Multi-tenant, multi-acara, 100% customizable — dari sampul, tipografi, form RSVP, hingga notifikasi WhatsApp.</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link href="/register" className="btn btn-primary" style={{ padding: "13px 26px" }}>Mulai gratis 14 hari</Link>
          <Link href="/i/pernikahan-andi-siti" className="btn" style={{ padding: "13px 26px" }}>Lihat undangan demo</Link>
        </div>
        <div className="hero-frame" aria-label="Pratinjau undangan">
          <div style={{ height: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", background: "#FBF8F2" }}>
            <div style={{ display: "grid", placeItems: "center", padding: 30, borderRight: "1px solid #E6DCCB" }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ letterSpacing: ".3em", fontSize: 10, color: "#9A7B4F" }}>THE WEDDING OF</p>
                <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(1.8rem,4vw,3.4rem)", color: "#2E2A25", margin: "14px 0" }}>Andi &amp; Siti</h2>
                <p style={{ fontSize: 11, color: "#7A736A" }}>Sabtu, 12 Desember 2026 · Surabaya</p>
              </div>
            </div>
            <div style={{ background: "linear-gradient(140deg,#EFE3CE,#D9C09A)", display: "grid", placeItems: "center", position: "relative" }}>
              <div style={{ width: 180, height: 230, borderRadius: "90px 90px 8px 8px", border: "2px solid #9A7B4F", background: "rgba(255,255,255,.35)" }} />
            </div>
          </div>
        </div>
      </section>

      <section className="section-block" id="tema" style={{ background: "var(--ui-surface)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="row-between" style={{ marginBottom: 32 }}>
            <div><p className="hero-eyebrow">8 tema siap pakai</p><h2>Struktur berbeda, bukan sekadar warna.</h2></div>
            <p className="muted" style={{ maxWidth: 360 }}>Setiap tema punya komposisi sampul, ornamen, tipografi, dan ritme section sendiri. Lalu kustomisasi semuanya tanpa kode.</p>
          </div>
          <div className="grid grid-4">
            {THEMES.map((theme) => (
              <div key={theme.id} className="card card-hover" style={{ padding: 12 }}>
                <div className="theme-swatch" style={{ background: theme.background.type === "gradient" ? theme.background.value : theme.colors.background, fontFamily: theme.fonts.display, color: theme.colors.primary }}>
                  <span style={{ color: theme.dark ? theme.colors.accent : theme.colors.primary }}>{theme.name}</span>
                </div>
                <div style={{ padding: "12px 6px 4px" }}><strong style={{ fontSize: 13 }}>{theme.name}</strong><p className="tiny muted" style={{ marginTop: 4 }}>{theme.description}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-block" id="fitur">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <p className="hero-eyebrow">Satu alur kerja utuh</p>
          <h2 style={{ marginBottom: 34 }}>Dari daftar tamu sampai laporan hari-H.</h2>
          <div className="grid grid-3">
            {[
              ["Editor visual", "Drag & drop section, undo/redo, autosave, versioning & rollback, live preview tiga ukuran layar."],
              ["PIC di sampul", "Nama dan nomor PIC tampil di cover & kontak, tombol wa.me dengan pesan terisi, sekaligus tujuan notifikasi RSVP."],
              ["RSVP Engine", "Form builder dengan conditional logic, kuota pax, sesi kedatangan, menu, deadline, multi-bahasa, dan auto-close."],
              ["Impor & blast", "CSV/XLSX dengan mapping kolom + deteksi duplikat, link personal + QR, antrean WhatsApp bertahap dengan throttle."],
              ["Check-in QR", "Scanner kamera, offline-first PWA, multi-loket, anti duplikat, walk-in, nomor meja, dan counter real-time."],
              ["Analitik & API", "Unique visitor, RSVP rate, heatmap section, UTM, ekspor CSV/XLSX/PDF, REST API ber-API-key + webhook HMAC."],
            ].map(([title, body]) => (
              <div className="card card-hover" key={title}><h3 style={{ fontFamily: "var(--ui-font-body)", fontSize: 16 }}>{title}</h3><p className="small muted" style={{ marginTop: 10, lineHeight: 1.7 }}>{body}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-block" id="harga" style={{ background: "var(--ui-surface)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p className="hero-eyebrow">Harga transparan</p>
          <h2 style={{ marginBottom: 34 }}>Paket yang tumbuh bersama bisnis Anda.</h2>
          <div className="grid grid-3">
            {plans.map((plan, index) => (
              <div className="card" key={plan.code} style={{ borderColor: index === 1 ? "var(--ui-primary)" : undefined }}>
                <span className="badge badge-primary">{plan.code}</span>
                <h3 style={{ marginTop: 14 }}>{plan.name}</h3>
                <div style={{ fontFamily: "var(--ui-font-display)", fontSize: 34, margin: "12px 0" }}>{formatCurrency(plan.price)}<span className="small muted"> /bulan</span></div>
                <p className="small muted">{plan.description}</p>
                <Link href="/register" className={`btn ${index === 1 ? "btn-primary" : ""}`} style={{ width: "100%", marginTop: 20 }}>Pilih paket</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer style={{ padding: "50px 24px", borderTop: "1px solid var(--ui-border)", textAlign: "center" }}>
        <strong style={{ fontFamily: "var(--ui-font-display)", fontSize: 22 }}>Rasa Undangan</strong>
        <p className="small muted" style={{ marginTop: 8 }}>© {new Date().getFullYear()} · <Link href="/privacy">Kebijakan Privasi</Link> · Dibangun dengan Next.js, Prisma, PostgreSQL, Redis & MinIO.</p>
      </footer>
    </main>
  );
}
