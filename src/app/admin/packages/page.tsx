import { requirePerm } from "@/lib/auth";
import { getPackages } from "@/server/core";
import { ActionForm, Submit } from "@/components/ActionForm";
import { Badge, Field, PageHeader } from "@/components/ui";
import { savePackageAction } from "@/server/actions/admin";
import { DEFAULT_ENT } from "@/lib/entitlements";

export const metadata = { title: "Paket & Produk" };

function PackageForm({ p }: { p?: Awaited<ReturnType<typeof getPackages>>[number] }) {
  return (
    <ActionForm action={savePackageAction} resetOnSuccess={!p} className="card space-y-3 p-4">
      <input type="hidden" name="id" value={p?.id ?? 0} />
      <div className="flex items-center justify-between"><h2 className="font-semibold">{p ? p.name : "Paket / add-on baru"}</h2>{p && <div className="flex gap-1"><Badge tone="violet">{p.code}</Badge>{p.isAddon && <Badge tone="blue">Add-on</Badge>}</div>}</div>
      <div className="grid grid-cols-2 gap-3"><Field label="Nama"><input name="name" required defaultValue={p?.name} className="input" /></Field>{!p ? <Field label="Kode"><input name="code" placeholder="mis. gold" className="input" /></Field> : <Field label="Urutan"><input name="sortOrder" type="number" defaultValue={p.sortOrder ?? 0} className="input" /></Field>}</div>
      <Field label="Deskripsi"><input name="description" defaultValue={p?.description ?? ""} className="input" /></Field>
      <div className="grid grid-cols-3 gap-3"><Field label="Harga normal"><input name="price" type="number" min={0} defaultValue={p?.price ?? 0} className="input" /></Field><Field label="Harga promo" hint="Kosong = tanpa promo"><input name="promoPrice" type="number" min={0} defaultValue={p?.promoPrice ?? ""} className="input" /></Field><Field label="Masa aktif (hari)"><input name="durationDays" type="number" min={1} defaultValue={p?.durationDays ?? 90} className="input" /></Field></div>
      <Field label="Fitur yang tampil (satu per baris)"><textarea name="features" rows={4} defaultValue={(p?.features ?? []).join("\n")} className="input" /></Field>
      <Field label="Entitlements (JSON)" hint="Batas & fitur yang DIPAKSA server: maxGuests, maxPhotos, personalized, guestbook, video, …"><textarea name="entitlements" rows={6} defaultValue={JSON.stringify(p?.entitlements ?? { maxGuests: 50, maxPhotos: 8 }, null, 1)} className="input font-mono text-xs" /></Field>
      <div className="flex flex-wrap gap-4 text-sm"><label className="flex min-h-[44px] items-center gap-2"><input type="checkbox" name="highlight" defaultChecked={!!p?.highlight} className="h-5 w-5" /> Terpopuler</label><label className="flex min-h-[44px] items-center gap-2"><input type="checkbox" name="active" defaultChecked={p ? !!p.active : true} className="h-5 w-5" /> Aktif</label>
        {!p && <label className="flex min-h-[44px] items-center gap-2"><input type="checkbox" name="isAddon" className="h-5 w-5" /> Add-on</label>}</div>
      <Submit className="btn btn-brand">{p ? "Simpan paket" : "Buat paket"}</Submit>
    </ActionForm>
  );
}

export default async function PackagesPage() {
  await requirePerm("packages");
  const all = await getPackages(true);
  return (
    <>
      <PageHeader title="Paket & Produk" subtitle="Harga, promo, masa aktif, dan batas fitur dibaca dari sini — tidak ada yang di-hardcode di frontend." />
      <p className="mb-4 text-xs text-stone-500">Kunci entitlement yang didukung: {Object.keys(DEFAULT_ENT).join(", ")}</p>
      <div className="grid gap-4 xl:grid-cols-2">{all.map((p) => <PackageForm key={p.id} p={p} />)}<PackageForm /></div>
    </>
  );
}
