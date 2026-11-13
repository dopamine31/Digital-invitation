import { TemplateDetail } from "@/components/TemplateDetail";
import { requireCustomer } from "@/lib/auth";

export default async function AppTemplate({ params }: { params: Promise<{ slug: string }> }) {
  const [u, { slug }] = await Promise.all([requireCustomer(), params]);
  return <TemplateDetail slug={slug} backHref="/app/templates" userId={u.id} />;
}
