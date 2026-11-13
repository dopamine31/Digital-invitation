import Link from "next/link";
import { Eye, Pencil, Plus } from "lucide-react";
import { requirePerm } from "@/lib/auth";
import { getTemplatesWithCat } from "@/server/core";
import { ActionForm, Submit } from "@/components/ActionForm";
import { Badge, PageHeader, StatusBadge } from "@/components/ui";
import { TemplateThumb } from "@/components/TemplateThumb";
import { templateOpAction } from "@/server/actions/admin";
import { idr } from "@/lib/format";
import type { TemplateConfig } from "@/types";

export const metadata = { title: "Manajemen Template" };

export default async function AdminTemplates() {
  await requirePerm("templates");
  const rows = await getTemplatesWithCat(false);
  return (
    <>
      <PageHeader title="Template" subtitle={`${rows.length} template · konfigurasi desain fleksibel (cover, ornamen, font, warna, animasi)`} actions={<Link href="/admin/templates/new" className="btn btn-brand"><Plus size={16} /> Tambah template</Link>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {rows.map((t) => (
          <div key={t.id} className="card overflow-hidden">
            <TemplateThumb cfg={t.config as unknown as TemplateConfig} />
            <div className="space-y-2 p-3">
              <p className="truncate text-sm font-semibold">{t.name}</p>
              <div className="flex flex-wrap gap-1"><Badge tone="violet">{t.tier}</Badge><StatusBadge status={t.status === "published" ? "published" : "draft"} />{t.featured && <Badge tone="amber">Unggulan</Badge>}{t.isNew && <Badge tone="red">Baru</Badge>}</div>
              <p className="text-xs text-stone-500">{t.catName} · {idr(t.price)} · ★ {t.popularity}</p>
              <div className="flex flex-wrap gap-1">
                <Link className="btn btn-ghost btn-sm" href={`/admin/templates/${t.id}`}><Pencil size={13} /> Edit</Link>
                <Link className="btn btn-ghost btn-sm" target="_blank" href={`/preview/${t.slug}`}><Eye size={13} /> Preview</Link>
                <ActionForm action={templateOpAction}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="op" value="duplicate" /><Submit className="btn btn-ghost btn-sm">Duplikat</Submit></ActionForm>
                <ActionForm action={templateOpAction} confirm={`Hapus template "${t.name}"?`}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="op" value="delete" /><Submit className="btn btn-ghost btn-sm text-red-600">Hapus</Submit></ActionForm>
              </div>
            </div>
          </div>))}
      </div>
    </>
  );
}
