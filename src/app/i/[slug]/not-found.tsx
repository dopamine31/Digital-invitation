import Link from "next/link";

export default function InvitationNotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}>
      <div>
        <h1>Undangan tidak ditemukan</h1>
        <p className="muted" style={{ marginTop: 10 }}>Tautan mungkin salah atau acara belum diterbitkan. Hubungi PIC yang tertera pada pesan Anda.</p>
        <Link href="/" className="btn btn-primary" style={{ marginTop: 24 }}>Ke beranda</Link>
      </div>
    </main>
  );
}
