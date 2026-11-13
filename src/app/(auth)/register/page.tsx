import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Daftar" };

export default async function RegisterPage() {
  const u = await getSession();
  if (u) redirect(u.role === "customer" ? "/app" : "/admin");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,#f3ead9,#faf8f5_60%)] p-4">
      <Link href="/" className="mb-6 font-display text-xl font-semibold">Digital Invitation Studio</Link>
      <AuthForm mode="register" />
    </main>
  );
}
