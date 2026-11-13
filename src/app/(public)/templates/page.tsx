import { CatalogView } from "@/components/Catalog";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Katalog Template Undangan" };

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [sp, user] = await Promise.all([searchParams, getSession()]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-semibold">Katalog Template</h1>
      <p className="mb-6 mt-1 text-sm text-stone-500">Cari berdasarkan kategori, harga, warna, dan gaya. Klik template untuk demo langsung.</p>
      <CatalogView base="/templates" sp={sp} userId={user?.role === "customer" ? user.id : undefined} />
    </div>
  );
}
