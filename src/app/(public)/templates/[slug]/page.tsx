import { TemplateDetail } from "@/components/TemplateDetail";
import { getSession } from "@/lib/auth";

export default async function TemplatePage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, user] = await Promise.all([params, getSession()]);
  return <div className="mx-auto max-w-6xl px-4 py-8"><TemplateDetail slug={slug} backHref="/templates" userId={user?.role === "customer" ? user.id : undefined} /></div>;
}
