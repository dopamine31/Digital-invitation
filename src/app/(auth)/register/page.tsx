import { RegisterForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Daftar" };

export default function RegisterPage() {
  return (
    <div className="stack" style={{ gap: 22 }}>
      <div>
        <span className="badge badge-primary">Trial 14 hari · tanpa kartu</span>
        <h1 style={{ marginTop: 14 }}>Mulai studio Anda</h1>
        <p className="muted" style={{ marginTop: 8 }}>Tenant, brand, dan kuota Anda langsung siap dipakai.</p>
      </div>
      <RegisterForm />
    </div>
  );
}
