import { CatalogView } from "@/components/Catalog";
import { PageHeader } from "@/components/ui";
import { requireCustomer } from "@/lib/auth";

export const metadata = { title: "Katalog Template" };

export default async function AppTemplates({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [u, sp] = await Promise.all([requireCustomer(), searchParams]);
  return (<><PageHeader title="Katalog Template" subtitle="Pilih template, lihat demo, lalu mulai membuat undangan." /><CatalogView base="/app/templates" sp={sp} userId={u.id} /></>);
}
