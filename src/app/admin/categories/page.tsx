import { requirePerm } from "@/lib/auth";
import { getCategories } from "@/server/core";
import { ActionForm, Submit } from "@/components/ActionForm";
import { PageHeader } from "@/components/ui";
import { saveCategoryAction } from "@/server/actions/admin";

export const metadata = { title: "Kategori" };

export default async function CategoriesPage() {
  await requirePerm("templates");
  const cats = await getCategories();
  return (
    <>
      <PageHeader title="Kategori" subtitle="Kategori acara untuk template. Anda dapat membuat kategori baru." />
      <ActionForm action={saveCategoryAction} resetOnSuccess className="card mb-4 grid gap-3 p-4 sm:grid-cols-[60px_1fr_1fr_90px_auto]">
        <input type="hidden" name="id" value={0} /><input name="icon" placeholder="🎉" className="input" aria-label="Ikon" maxLength={4} /><input name="name" required placeholder="Nama kategori baru" className="input" aria-label="Nama" /><input name="slug" placeholder="slug (opsional)" className="input" aria-label="Slug" />
        <input name="sortOrder" type="number" defaultValue={cats.length} className="input" aria-label="Urutan" /><Submit className="btn btn-brand">Tambah</Submit>
      </ActionForm>
      <div className="space-y-2">{cats.map((c) => (
        <div key={c.id} className="card flex flex-wrap items-center gap-2 p-3">
          <ActionForm action={saveCategoryAction} className="flex flex-1 flex-wrap items-center gap-2"><input type="hidden" name="id" value={c.id} />
            <input name="icon" defaultValue={c.icon ?? ""} className="input !w-16" aria-label="Ikon" maxLength={4} /><input name="name" defaultValue={c.name} className="input !w-auto min-w-[140px] flex-1" aria-label="Nama" /><input name="slug" defaultValue={c.slug} className="input !w-auto min-w-[120px] flex-1" aria-label="Slug" /><input name="sortOrder" type="number" defaultValue={c.sortOrder ?? 0} className="input !w-20" aria-label="Urutan" /><Submit className="btn btn-ghost btn-sm">Simpan</Submit></ActionForm>
          <ActionForm action={saveCategoryAction} confirm={`Hapus kategori ${c.name}?`}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="op" value="delete" /><Submit className="btn btn-ghost btn-sm text-red-600">Hapus</Submit></ActionForm>
        </div>))}</div>
    </>
  );
}
