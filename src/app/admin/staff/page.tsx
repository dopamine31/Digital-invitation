import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ADMIN_PERMS, requireOwner } from "@/lib/auth";
import { ActionForm, Submit } from "@/components/ActionForm";
import { Badge, Field, PageHeader } from "@/components/ui";
import { saveStaffAction } from "@/server/actions/admin";

export const metadata = { title: "Manajemen Staff" };
const PL: Record<string, string> = { orders: "Pesanan", payments: "Pembayaran & refund", customers: "Customer", templates: "Template & kategori", packages: "Paket", vouchers: "Promo", content: "Konten", support: "Tiket bantuan", logs: "Audit log" };

function StaffForm({ u }: { u?: typeof users.$inferSelect }) {
  return (
    <ActionForm action={saveStaffAction} resetOnSuccess={!u} className="card space-y-3 p-4">
      <input type="hidden" name="id" value={u?.id ?? 0} />
      <div className="flex items-center justify-between"><h2 className="font-semibold">{u ? u.name : "Tambah staff"}</h2>{u && <Badge tone={u.status === "active" ? "green" : "red"}>{u.status === "active" ? "Aktif" : "Nonaktif"}</Badge>}</div>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Nama"><input name="name" required defaultValue={u?.name} className="input" /></Field><Field label="Telepon"><input name="phone" defaultValue={u?.phone ?? ""} className="input" /></Field>
        {!u && <><Field label="Email"><input name="email" type="email" required className="input" /></Field><Field label="Password awal (min. 8)"><input name="password" type="password" minLength={8} required className="input" /></Field></>}{u && <Field label="Email"><input value={u.email} disabled className="input bg-stone-50" /></Field>}</div>
      <Field label="Hak akses menu (permission)"><div className="grid grid-cols-2 gap-1">{ADMIN_PERMS.map((p) => <label key={p} className="flex min-h-[40px] items-center gap-2 text-sm"><input type="checkbox" name="perm" value={p} defaultChecked={u?.permissions.includes(p)} className="h-4 w-4" />{PL[p]}</label>)}</div></Field>
      <Submit className="btn btn-brand btn-sm">{u ? "Simpan" : "Tambah staff"}</Submit>
    </ActionForm>
  );
}

export default async function StaffPage() {
  await requireOwner();
  const staff = await db.select().from(users).where(eq(users.role, "staff"));
  return (
    <>
      <PageHeader title="Staff" subtitle="Atur siapa yang boleh mengakses menu apa. Pembatasan diverifikasi di server." />
      <div className="grid gap-4 xl:grid-cols-2"><StaffForm />{staff.map((u) => (
        <div key={u.id} className="space-y-2"><StaffForm u={u} />
          <ActionForm action={saveStaffAction} confirm={u.status === "active" ? `Nonaktifkan ${u.name}?` : `Aktifkan ${u.name}?`}><input type="hidden" name="id" value={u.id} /><input type="hidden" name="op" value="toggle" /><Submit className="btn btn-ghost btn-sm">{u.status === "active" ? "Nonaktifkan" : "Aktifkan"}</Submit></ActionForm></div>))}</div>
    </>
  );
}
