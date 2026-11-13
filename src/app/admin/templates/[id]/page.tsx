import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { templates } from "@/db/schema";
import { requirePerm } from "@/lib/auth";
import { getCategories } from "@/server/core";
import { ActionForm, Submit } from "@/components/ActionForm";
import { Field, PageHeader } from "@/components/ui";
import { saveTemplateAction } from "@/server/actions/admin";
import { FONT_CHOICES } from "@/components/editor/types";
import { ALL_SECTIONS, SECTION_LABELS, type TemplateConfig } from "@/types";
import { TEMPLATE_SEEDS } from "@/templates/registry";

export const metadata = { title: "Edit Template" };
const OPT = {
  cover: ["center", "split", "frame", "arch", "stack", "type", "full", "circle"], orn: ["floral", "leaf", "geo", "islamic", "batik", "wave", "marble", "line", "dots", "gold", "stars", "none"],
  gal: ["grid", "masonry", "polaroid", "slider", "film", "mosaic"], anim: ["fade", "rise", "zoom", "blur", "slide", "flip"], btn: ["pill", "square", "outline", "underline", "soft"], ev: ["cards", "timeline", "split", "ticket"],
} as const;
const LBL = { cover: "Layout cover", orn: "Ornamen", gal: "Galeri", anim: "Animasi", btn: "Tombol", ev: "Detail acara" };

export default async function EditTemplate({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("templates");
  const { id } = await params;
  const cats = await getCategories();
  const t = id === "new" ? null : (await db.select().from(templates).where(eq(templates.id, Number(id))).limit(1))[0];
  if (id !== "new" && !t) notFound();
  const cfg = (t?.config ?? TEMPLATE_SEEDS[1].cfg) as unknown as TemplateConfig;
  const fonts = (cur: string) => Array.from(new Set([cur, ...FONT_CHOICES]));
  return (
    <>
      <Link href="/admin/templates" className="text-sm text-stone-500">← Template</Link>
      <PageHeader title={t ? `Edit: ${t.name}` : "Template baru"} />
      <ActionForm action={saveTemplateAction} noRefresh className="grid gap-4 lg:grid-cols-2">
        <input type="hidden" name="id" value={t?.id ?? 0} />
        <section className="card space-y-3 p-4"><h2 className="font-semibold">Informasi</h2>
          <Field label="Nama"><input name="name" required defaultValue={t?.name} className="input" /></Field>
          <Field label="Slug" hint="Kosongkan untuk otomatis"><input name="slug" defaultValue={t?.slug} className="input" /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Kategori"><select name="categoryId" defaultValue={t?.categoryId ?? cats[0]?.id} className="input">{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Gaya / tema"><input name="style" defaultValue={t?.style ?? ""} className="input" /></Field></div>
          <Field label="Deskripsi"><textarea name="description" defaultValue={t?.description ?? ""} rows={2} className="input" /></Field>
          <div className="grid grid-cols-3 gap-3"><Field label="Tier / paket minimum"><select name="tier" defaultValue={t?.tier ?? "free"} className="input">{["free", "basic", "premium", "exclusive"].map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Biaya tambahan (Rp)"><input name="price" type="number" min={0} defaultValue={t?.price ?? 0} className="input" /></Field><Field label="Popularitas"><input name="popularity" type="number" min={0} defaultValue={t?.popularity ?? 0} className="input" /></Field></div>
          <div className="flex flex-wrap gap-4 text-sm"><label className="flex min-h-[44px] items-center gap-2"><input type="checkbox" name="featured" defaultChecked={!!t?.featured} className="h-5 w-5" /> Unggulan</label><label className="flex min-h-[44px] items-center gap-2"><input type="checkbox" name="isNew" defaultChecked={!!t?.isNew} className="h-5 w-5" /> Terbaru</label>
            <Field label="Status"><select name="status" defaultValue={t?.status ?? "published"} className="input"><option value="published">Terbit</option><option value="draft">Draft</option></select></Field></div>
          <Field label="Fitur (satu per baris)"><textarea name="features" defaultValue={(t?.features ?? ["Cover animasi", "Countdown", "RSVP"]).join("\n")} rows={4} className="input" /></Field>
          <Field label="Tag (pisahkan koma)"><input name="tags" defaultValue={(t?.tags ?? []).join(", ")} className="input" /></Field>
          <Field label="Section yang didukung"><div className="grid grid-cols-2 gap-1">{ALL_SECTIONS.map((k) => <label key={k} className="flex min-h-[40px] items-center gap-2 text-sm"><input type="checkbox" name="sections" value={k} defaultChecked={t ? t.sections.includes(k) : true} className="h-4 w-4" />{SECTION_LABELS[k]}</label>)}</div></Field>
        </section>
        <section className="card space-y-3 p-4"><h2 className="font-semibold">Konfigurasi desain</h2>
          <div className="grid grid-cols-2 gap-3">{(Object.keys(OPT) as (keyof typeof OPT)[]).map((k) => <Field key={k} label={LBL[k]}><select name={k} defaultValue={cfg[k]} className="input capitalize">{OPT[k].map((o) => <option key={o}>{o}</option>)}</select></Field>)}</div>
          <div className="grid grid-cols-3 gap-3">{(["head", "body", "script"] as const).map((k) => <Field key={k} label={k === "head" ? "Font judul" : k === "body" ? "Font isi" : "Font aksen"}><select name={k} defaultValue={cfg[k]} className="input">{fonts(cfg[k]).map((f) => <option key={f}>{f}</option>)}</select></Field>)}</div>
          <div className="grid grid-cols-3 gap-3">{(["bg", "surface", "text", "muted", "accent", "accent2"] as const).map((k) => <Field key={k} label={k}><input type="color" name={`pal_${k}`} defaultValue={cfg.pal[k]} className="h-11 w-full cursor-pointer rounded-lg border border-stone-300 bg-white p-1" /></Field>)}</div>
          <div className="grid grid-cols-2 gap-3"><label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" name="dark" defaultChecked={cfg.dark} className="h-5 w-5" /> Tema gelap</label><Field label="Radius sudut (px)"><input name="rad" type="number" min={0} max={32} defaultValue={cfg.rad} className="input" /></Field></div>
          <Submit className="btn btn-brand w-full">Simpan template</Submit>
        </section>
      </ActionForm>
    </>
  );
}
