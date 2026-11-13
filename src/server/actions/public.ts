"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signValue } from "@/lib/auth";
import { loadInvitationBySlug } from "@/server/invitations";
import { rateLimit } from "@/lib/ratelimit";

export async function unlockInvitation(slug: string, formData: FormData) {
  const pw = String(formData.get("password") ?? "");
  const rawBack = String(formData.get("back") ?? "");
  const back = /^\?[A-Za-z0-9%=&_.\-]{0,300}$/.test(rawBack) ? rawBack : "";
  const row = await loadInvitationBySlug(slug);
  if (!row || !row.inv.password) redirect(`/i/${slug}`);
  if (!rateLimit(`unlock:${slug}`, 10, 60_000)) redirect(`/i/${slug}?err=rate`);
  if (pw !== row.inv.password) redirect(`/i/${slug}?err=1`);
  (await cookies()).set(`invpw_${row.inv.id}`, signValue(`inv:${row.inv.id}:${row.inv.password}`), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 86400 });
  redirect(`/i/${slug}${back}`);
}
