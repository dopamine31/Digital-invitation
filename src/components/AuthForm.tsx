"use client";
import { useState } from "react";
import Link from "next/link";
import { ActionForm, Submit } from "@/components/ActionForm";
import { loginAction, registerAction } from "@/server/actions/auth";

const DEMOS = [
  { label: "Owner", email: "owner@demo.id", pw: "owner123" },
  { label: "Staff", email: "staff@demo.id", pw: "staff123" },
  { label: "Customer", email: "customer@demo.id", pw: "customer123" },
];

export function AuthForm({ mode, next }: { mode: "login" | "register"; next?: string }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  return (
    <div className="card w-full max-w-md p-6 sm:p-8">
      <h1 className="font-display text-2xl font-semibold">{mode === "login" ? "Masuk ke akun" : "Buat akun baru"}</h1>
      <p className="mt-1 text-sm text-stone-500">{mode === "login" ? "Kelola undangan, pesanan, dan tamu Anda." : "Gratis. Mulai buat undangan pertama Anda."}</p>
      <ActionForm action={mode === "login" ? loginAction : registerAction} className="mt-6 space-y-4" noRefresh>
        <input type="hidden" name="next" value={next ?? ""} />
        {mode === "register" && (<>
          <div><label className="label" htmlFor="name">Nama lengkap</label><input id="name" name="name" required className="input" autoComplete="name" /></div>
          <div><label className="label" htmlFor="phone">Nomor WhatsApp</label><input id="phone" name="phone" inputMode="tel" className="input" placeholder="08xxxxxxxxxx" autoComplete="tel" /></div>
        </>)}
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label className="label" htmlFor="password">Kata sandi</label><input id="password" name="password" type="password" required minLength={mode === "register" ? 8 : 1} className="input" autoComplete={mode === "login" ? "current-password" : "new-password"} value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <Submit className="btn btn-primary w-full">{mode === "login" ? "Masuk" : "Daftar"}</Submit>
      </ActionForm>
      <p className="mt-4 text-center text-sm text-stone-500">
        {mode === "login" ? <>Belum punya akun? <Link className="font-semibold text-stone-900 underline" href="/register">Daftar</Link></> : <>Sudah punya akun? <Link className="font-semibold text-stone-900 underline" href="/login">Masuk</Link></>}
      </p>
      {mode === "login" && (
        <div className="mt-6 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-900">Akun demo (klik untuk mengisi)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEMOS.map((d) => <button key={d.label} type="button" className="btn btn-ghost btn-sm" onClick={() => { setEmail(d.email); setPw(d.pw); }}>{d.label}</button>)}
          </div>
        </div>
      )}
    </div>
  );
}
