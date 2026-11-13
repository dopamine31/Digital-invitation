import { notFound } from "next/navigation";
import { getContent } from "@/server/core";

const TITLES: Record<string, string> = { terms: "Syarat & Ketentuan", privacy: "Kebijakan Privasi" };

export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getContent();
  const body = (c.pages as Record<string, string>)[slug];
  if (!body || !TITLES[slug]) notFound();
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-3xl font-semibold">{TITLES[slug]}</h1>
      <div className="mt-6 whitespace-pre-line text-stone-700">{body}</div>
    </div>
  );
}
