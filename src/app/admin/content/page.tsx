import { requirePerm } from "@/lib/auth";
import { getContent } from "@/server/core";
import { ActionForm, Submit } from "@/components/ActionForm";
import { Field, PageHeader } from "@/components/ui";
import { saveContentAction } from "@/server/actions/admin";

export const metadata = { title: "Manajemen Konten" };

export default async function ContentPage() {
  await requirePerm("content");
  const c = await getContent();
  return (
    <>
      <PageHeader title="Konten Website" subtitle="Hero, banner, FAQ, testimoni, dan halaman legal." />
      <ActionForm action={saveContentAction} className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3 p-4"><h2 className="font-semibold">Hero & banner</h2>
          <Field label="Judul hero"><textarea name="heroTitle" rows={2} defaultValue={c.heroTitle} className="input" /></Field><Field label="Subjudul hero"><textarea name="heroSubtitle" rows={3} defaultValue={c.heroSubtitle} className="input" /></Field>
          <Field label="Banner homepage (kosongkan untuk menyembunyikan)"><input name="banner" defaultValue={c.banner} className="input" /></Field>
          <Field label="Bantuan (teks pusat bantuan)"><textarea name="help" rows={3} defaultValue={c.pages.help} className="input" /></Field></section>
        <section className="card space-y-3 p-4"><h2 className="font-semibold">FAQ & testimoni</h2>
          <Field label="FAQ — format: Pertanyaan | Jawaban (satu per baris)"><textarea name="faq" rows={7} defaultValue={c.faq.map((f) => `${f.q} | ${f.a}`).join("\n")} className="input text-xs" /></Field>
          <Field label="Testimoni — format: Nama | Peran | Isi (satu per baris)"><textarea name="testimonials" rows={5} defaultValue={c.testimonials.map((t) => `${t.name} | ${t.role} | ${t.text}`).join("\n")} className="input text-xs" /></Field></section>
        <section className="card space-y-3 p-4 lg:col-span-2"><h2 className="font-semibold">Halaman legal</h2>
          <div className="grid gap-3 lg:grid-cols-2"><Field label="Syarat & Ketentuan"><textarea name="terms" rows={6} defaultValue={c.pages.terms} className="input" /></Field><Field label="Kebijakan Privasi"><textarea name="privacy" rows={6} defaultValue={c.pages.privacy} className="input" /></Field></div>
          <Submit className="btn btn-brand">Simpan konten</Submit></section>
      </ActionForm>
    </>
  );
}
