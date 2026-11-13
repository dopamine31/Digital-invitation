import Link from "next/link";

export const metadata = { title: "Kebijakan Privasi" };

export default function PrivacyPage() {
  return (
    <main className="page" style={{ maxWidth: 760 }}>
      <Link href="/" className="small" style={{ color: "var(--ui-primary)" }}>← Beranda</Link>
      <h1 style={{ marginTop: 24 }}>Kebijakan Privasi</h1>
      <div className="stack" style={{ marginTop: 24, lineHeight: 1.8 }}>
        <p>Rasa Undangan memproses data pribadi tamu (nama, nomor WhatsApp, email, jawaban RSVP) semata-mata untuk penyelenggaraan acara yang Anda kelola. Data disimpan terisolasi per tenant dan tidak pernah dibagikan antar tenant.</p>
        <h3>Keamanan</h3>
        <p>Nomor telepon disimpan terenkripsi (AES-256-GCM) dan ditampilkan secara masked di log. Kata sandi di-hash dengan bcrypt. Seluruh akses dicatat dalam audit log dan diperiksa melalui RBAC di server.</p>
        <h3>Hak Anda (UU PDP / GDPR)</h3>
        <p>Pemilik data dapat meminta ekspor atau penghapusan data pribadi melalui Super Admin (menu Pengaturan Sistem → GDPR) atau menghubungi PIC acara. Tamu dapat berhenti menerima pesan blast kapan saja melalui tautan opt-out.</p>
        <h3>Cookie</h3>
        <p>Kami hanya menggunakan cookie sesi httpOnly untuk autentikasi dan cookie preferensi tema. Tidak ada pelacakan iklan pihak ketiga pada halaman undangan.</p>
        <h3>Kontak</h3>
        <p>Untuk pertanyaan privasi, hubungi PIC yang tertera pada undangan Anda atau administrator platform.</p>
      </div>
    </main>
  );
}
