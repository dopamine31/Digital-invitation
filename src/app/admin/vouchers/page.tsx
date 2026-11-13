import { asc } from "drizzle-orm";
import { db } from "@/db";
import { vouchers } from "@/db/schema";
import { requirePerm } from "@/lib/auth";
import { getPackages } from "@/server/core";
import { ActionForm, Submit } from "@/components/ActionForm";
import { Badge, Field, PageHeader } from "@/components/ui";
import { saveVoucherAction } from "@/server/actions/admin";

export const metadata = { title: "Promo & Voucher" };
type V = typeof vouchers.$inferSelect;
const d = (x: Date | null) => (x ? x.toISOString().slice(0, 10) : "");

function VoucherForm({ v, pkgs }: { v?: V; pkgs: { code: string; name: string }[] }) {
  return (
    <ActionForm action={saveVoucherAction} resetOnSuccess={!v} className="card space-y-3 p-4">
      <input type="hidden" name="id" value={v?.id ?? 0} />
      <div className="flex items-center justify-between"><h2 className="font-mono font-semibold">{v?.code ?? "Voucher baru"}</h2>{v && <Badge tone={v.active ? "green" : "gray"}>{v.used}/{v.quota} terpakai</Badge>}</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Field label="Kode"><input name="code" required defaultValue={v?.code} className="input uppercase" /></Field><Field label="Jenis"><select name="type" defaultValue={v?.type ?? "percent"} className="input"><option value="percent">Persen (%)</option><option value="fixed">Nominal (Rp)</option></select></Field>
        <Field label="Nilai"><input name="value" type="number" min={1} defaultValue={v?.value ?? 10} className="input" /></Field><Field label="Kuota"><input name="quota" type="number" min={1} defaultValue={v?.quota ?? 100} className="input" /></Field></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Field label="Min. transaksi"><input name="minTotal" type="number" min={0} defaultValue={v?.minTotal ?? 0} className="input" /></Field><Field label="Khusus paket"><select name="packageCode" defaultValue={v?.packageCode ?? ""} className="input"><option value="">Semua</option>{pkgs.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</select></Field>
        <Field label="Mulai"><input name="startsAt" type="date" defaultValue={d(v?.startsAt ?? null)} className="input" /></Field><Field label="Berakhir"><input name="endsAt" type="date" defaultValue={d(v?.endsAt ?? null)} className="input" /></Field></div>
      <Field label="Khusus customer (ID user, opsional)"><input name="userId" type="number" defaultValue={v?.userId ?? ""} className="input" /></Field>
      <div className="flex flex-wrap items-center gap-3"><label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={v ? !!v.active : true} className="h-5 w-5" /> Aktif</label><Submit className="btn btn-brand btn-sm">{v ? "Simpan" : "Buat voucher"}</Submit></div>
    </ActionForm>
  );
}

export default async function VouchersPage() {
  await requirePerm("vouchers");
  const [rows, pkgs] = await Promise.all([db.select().from(vouchers).orderBy(asc(vouchers.id)), getPackages()]);
  const pk = pkgs.filter((p) => !p.isAddon).map((p) => ({ code: p.code, name: p.name }));
  return (
    <>
      <PageHeader title="Promo & Voucher" subtitle="Diskon persen/nominal, periode, kuota, minimal transaksi, khusus paket/customer." />
      <div className="grid gap-4 xl:grid-cols-2"><VoucherForm pkgs={pk} />{rows.map((v) => (
        <div key={v.id} className="space-y-2"><VoucherForm v={v} pkgs={pk} />
          <ActionForm action={saveVoucherAction} confirm={`Hapus voucher ${v.code}?`}><input type="hidden" name="id" value={v.id} /><input type="hidden" name="op" value="delete" /><Submit className="btn btn-ghost btn-sm text-red-600">Hapus {v.code}</Submit></ActionForm></div>))}</div>
    </>
  );
}
