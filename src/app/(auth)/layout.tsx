import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 520px)" }}>
      <div style={{ background: "linear-gradient(150deg,#2B241B,#5A4530 55%,#8B6A43)", color: "#F7F0E3", padding: "clamp(40px,7vw,90px)", display: "flex", flexDirection: "column", justifyContent: "space-between" }} className="auth-aside">
        <Link href="/" className="row" style={{ gap: 10 }}><span className="brand-mark">R</span><strong style={{ fontFamily: "var(--ui-font-display)", fontSize: 22 }}>Rasa Undangan</strong></Link>
        <div>
          <p style={{ letterSpacing: ".22em", textTransform: "uppercase", fontSize: 11, opacity: .75 }}>Undangan digital kelas premium</p>
          <h1 style={{ fontSize: "clamp(2.6rem,5vw,4.6rem)", lineHeight: 1.05, margin: "20px 0" }}>Setiap acara,<br /><em>terasa berbeda.</em></h1>
          <p style={{ maxWidth: 470, opacity: .82, lineHeight: 1.8 }}>Bangun undangan yang sepenuhnya milik Anda: tema, tipografi, section, RSVP, blast WhatsApp, check-in QR, hingga analitik — dalam satu platform.</p>
        </div>
        <p style={{ fontSize: 12, opacity: .55 }}>© {new Date().getFullYear()} Rasa Undangan · Dibuat untuk momen yang berarti.</p>
      </div>
      <main style={{ display: "grid", placeItems: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: 400 }}>{children}</div>
      </main>
    </div>
  );
}
