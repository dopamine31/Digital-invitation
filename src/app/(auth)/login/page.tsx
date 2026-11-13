import { LoginForm, OtpForm, MagicLinkForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Masuk" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string; error?: string }> }) {
  const { mode, error } = await searchParams;
  return (
    <div className="stack" style={{ gap: 22 }}>
      <div>
        <span className="badge badge-primary">Studio & Super Admin</span>
        <h1 style={{ marginTop: 14 }}>Selamat datang kembali</h1>
        <p className="muted" style={{ marginTop: 8 }}>Masuk untuk mengelola acara, tamu, dan RSVP.</p>
      </div>
      {error ? <div className="notice notice-error">Autentikasi gagal. Silakan coba lagi.</div> : null}
      {mode === "otp" ? <OtpForm /> : mode === "magic" ? <MagicLinkForm /> : <LoginForm />}
    </div>
  );
}
