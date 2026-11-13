"use client";
import { useState } from "react";
import { ActionForm, Submit, useToast } from "@/components/ActionForm";
import { processImage } from "@/components/editor/fields";
import { changePasswordAction, updateProfileAction } from "@/server/actions/customer";

export function AccountForms({ user }: { user: { name: string; email: string; phone: string; avatar: string } }) {
  const [avatar, setAvatar] = useState("");
  const toast = useToast();
  const shown = avatar || user.avatar;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ActionForm action={updateProfileAction} className="card space-y-3 p-5">
        <h2 className="font-semibold">Profil</h2>
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-stone-200 text-xl font-semibold">{/* eslint-disable-next-line @next/next/no-img-element */}{shown ? <img src={shown} alt="Foto profil" className="h-full w-full object-cover" /> : user.name[0]}</div>
          <label className="btn btn-ghost btn-sm cursor-pointer">Ganti foto<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { setAvatar(await processImage(f, 1, 256, 0.8)); } catch (er) { toast((er as Error).message, "err"); } }} /></label>
        </div>
        <input type="hidden" name="avatar" value={avatar} />
        <div><label className="label">Nama</label><input name="name" required defaultValue={user.name} className="input" /></div>
        <div><label className="label">Email</label><input value={user.email} disabled className="input bg-stone-50" /></div>
        <div><label className="label">Nomor WhatsApp</label><input name="phone" defaultValue={user.phone} inputMode="tel" className="input" /></div>
        <Submit>Simpan profil</Submit>
      </ActionForm>
      <ActionForm action={changePasswordAction} resetOnSuccess className="card space-y-3 p-5">
        <h2 className="font-semibold">Ubah kata sandi</h2>
        <div><label className="label">Kata sandi saat ini</label><input name="current" type="password" required className="input" autoComplete="current-password" /></div>
        <div><label className="label">Kata sandi baru (min. 8 karakter)</label><input name="next" type="password" required minLength={8} className="input" autoComplete="new-password" /></div>
        <Submit>Ubah kata sandi</Submit>
      </ActionForm>
    </div>
  );
}
