"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/components/client-ui";
import { Button } from "@/components/ui";
import {
  loginAction, registerAction, requestOtpAction, verifyOtpAction, requestMagicLinkAction,
} from "@/server/actions/auth";

const DEMO = [
  { label: "Super Admin", email: "superadmin@rasa.id", password: "SuperAdmin!234" },
  { label: "Owner Acara", email: "owner@harmoni.id", password: "Owner!234" },
  { label: "Panitia", email: "panitia@harmoni.id", password: "Panitia!234" },
];

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    const result = await loginAction({ email, password });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    toast("Selamat datang kembali");
    router.push(result.data.redirectTo);
    router.refresh();
  };

  return (
    <div className="stack">
      <form onSubmit={submit} className="stack">
        <div className="field">
          <label className="label" htmlFor="login-email">Email</label>
          <input id="login-email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@domain.id" />
        </div>
        <div className="field">
          <label className="label" htmlFor="login-password">Kata sandi</label>
          <input id="login-password" className="input" type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 8 karakter" />
        </div>
        {error ? <div className="notice notice-error" role="alert">{error}</div> : null}
        <Button type="submit" variant="primary" disabled={busy}>{busy ? <span className="spinner" /> : null} Masuk</Button>
      </form>

      <div className="row-between tiny muted"><span>Atau lanjutkan dengan</span></div>
      <div className="row">
        <a href="/api/auth/google/start" className="btn btn-sm" style={{ flex: 1 }}>Google OAuth</a>
        <Link href="/login?mode=otp" className="btn btn-sm" style={{ flex: 1 }}>Kode OTP</Link>
        <Link href="/login?mode=magic" className="btn btn-sm" style={{ flex: 1 }}>Magic Link</Link>
      </div>

      <div className="divider" />
      <div>
        <div className="tiny muted" style={{ marginBottom: 8 }}>Akun demo — klik untuk mengisi otomatis</div>
        <div className="pill-row">
          {DEMO.map((item) => (
            <button key={item.email} type="button" className="btn btn-sm" onClick={() => { setEmail(item.email); setPassword(item.password); }}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <p className="small center muted">Belum punya akun? <Link href="/register" style={{ color: "var(--ui-primary)", fontWeight: 600 }}>Daftar gratis</Link></p>
    </div>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", tenantName: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    const result = await registerAction({ ...form, locale: "id" });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    toast("Akun dan tenant berhasil dibuat");
    router.push(result.data.redirectTo);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="stack">
      <div className="field"><label className="label" htmlFor="reg-name">Nama lengkap</label><input id="reg-name" className="input" required value={form.name} onChange={update("name")} /></div>
      <div className="field"><label className="label" htmlFor="reg-tenant">Nama organisasi / brand</label><input id="reg-tenant" className="input" required value={form.tenantName} onChange={update("tenantName")} placeholder="Harmoni Wedding Organizer" /></div>
      <div className="field"><label className="label" htmlFor="reg-email">Email</label><input id="reg-email" className="input" type="email" required value={form.email} onChange={update("email")} /></div>
      <div className="field"><label className="label" htmlFor="reg-phone">No. WhatsApp</label><input id="reg-phone" className="input" value={form.phone} onChange={update("phone")} placeholder="0812..." /></div>
      <div className="field"><label className="label" htmlFor="reg-password">Kata sandi</label><input id="reg-password" className="input" type="password" required minLength={8} value={form.password} onChange={update("password")} /></div>
      {error ? <div className="notice notice-error" role="alert">{error}</div> : null}
      <label className="row small" style={{ gap: 8 }}><input className="checkbox" type="checkbox" required /> Saya menyetujui <Link href="/privacy" style={{ color: "var(--ui-primary)" }}>Kebijakan Privasi</Link></label>
      <Button type="submit" variant="primary" disabled={busy}>{busy ? <span className="spinner" /> : null} Buat akun & mulai</Button>
      <p className="small center muted">Sudah punya akun? <Link href="/login" style={{ color: "var(--ui-primary)", fontWeight: 600 }}>Masuk</Link></p>
    </form>
  );
}

export function OtpForm() {
  const router = useRouter();
  const [channel, setChannel] = useState<"EMAIL" | "WHATSAPP">("EMAIL");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const request = async () => {
    setBusy(true); setError("");
    const result = await requestOtpAction({ identifier, channel });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setSent(true);
    setDevCode(result.data.devCode ?? "");
    toast("Kode dikirim (lihat log adapter mock)");
  };
  const verify = async () => {
    setBusy(true); setError("");
    const result = await verifyOtpAction({ identifier, channel, code });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    router.push(result.data.redirectTo); router.refresh();
  };

  return (
    <div className="stack">
      <div className="row">
        <Button variant={channel === "EMAIL" ? "primary" : "default"} size="sm" onClick={() => setChannel("EMAIL")}>Email</Button>
        <Button variant={channel === "WHATSAPP" ? "primary" : "default"} size="sm" onClick={() => setChannel("WHATSAPP")}>WhatsApp</Button>
      </div>
      <div className="field">
        <label className="label" htmlFor="otp-id">{channel === "EMAIL" ? "Email" : "Nomor WhatsApp"}</label>
        <input id="otp-id" className="input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={channel === "EMAIL" ? "nama@domain.id" : "0812..."} />
      </div>
      {!sent ? <Button variant="primary" onClick={request} disabled={busy || identifier.length < 5}>Kirim kode</Button> : (
        <>
          <div className="field"><label className="label" htmlFor="otp-code">Kode 6 digit</label><input id="otp-code" className="input mono" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></div>
          {devCode ? <div className="notice">Mode mock — kode Anda: <strong className="mono">{devCode}</strong></div> : null}
          <Button variant="primary" onClick={verify} disabled={busy || code.length !== 6}>Verifikasi & masuk</Button>
        </>
      )}
      {error ? <div className="notice notice-error">{error}</div> : null}
      <Link href="/login" className="small center" style={{ color: "var(--ui-primary)" }}>Kembali ke login</Link>
    </div>
  );
}

export function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const result = await requestMagicLinkAction({ email });
    setBusy(false);
    if (!result.ok) { toast(result.error, "err"); return; }
    toast("Magic link dikirim");
    if (result.data.devToken) setLink(`/api/auth/magic?token=${result.data.devToken}`);
  };
  return (
    <div className="stack">
      <div className="field"><label className="label" htmlFor="magic-email">Email terdaftar</label><input id="magic-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <Button variant="primary" onClick={submit} disabled={busy || !email.includes("@")}>Kirim magic link</Button>
      {link ? <div className="notice">Mode mock: <a href={link} style={{ color: "var(--ui-primary)", fontWeight: 700 }}>Klik untuk masuk</a></div> : null}
      <Link href="/login" className="small center" style={{ color: "var(--ui-primary)" }}>Kembali ke login</Link>
    </div>
  );
}
