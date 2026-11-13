"use server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, destroySession, hashPassword, verifyPassword, getSession } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";
import { rateLimit } from "@/lib/ratelimit";
import { logActivity, notify } from "@/server/core";
import { fail, ok, safe, str } from "./util";

const home = (role: string) => (role === "customer" ? "/app" : "/admin");

export async function loginAction(fd: FormData) {
  return safe(async () => {
    await ensureSeed();
    const email = str(fd, "email", 120).toLowerCase();
    const password = String(fd.get("password") ?? "");
    if (!rateLimit(`login:${email}`, 8, 5 * 60_000)) return fail("Terlalu banyak percobaan. Coba lagi dalam beberapa menit.");
    const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!u || !verifyPassword(password, u.passwordHash)) return fail("Email atau kata sandi salah.");
    if (u.status !== "active") return fail("Akun Anda dinonaktifkan. Hubungi admin.");
    await createSession(u.id);
    await logActivity(u.id, "Login", "auth", u.id, u.role);
    const next = str(fd, "next", 200);
    const area = u.role === "customer" ? "/app" : "/admin";
    return ok("Selamat datang kembali!", next.startsWith(area) ? next : home(u.role));
  });
}

const registerSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter").max(80),
  email: z.string().email("Email tidak valid").max(120),
  phone: z.string().max(20).optional(),
  password: z.string().min(8, "Kata sandi minimal 8 karakter").max(100),
});
export async function registerAction(fd: FormData) {
  return safe(async () => {
    await ensureSeed();
    const p = registerSchema.safeParse({ name: str(fd, "name", 80), email: str(fd, "email", 120).toLowerCase(), phone: str(fd, "phone", 20), password: String(fd.get("password") ?? "") });
    if (!p.success) return fail(p.error.issues[0].message);
    if (!rateLimit(`register:${p.data.email}`, 5, 10 * 60_000)) return fail("Terlalu banyak percobaan.");
    const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, p.data.email)).limit(1);
    if (exists) return fail("Email sudah terdaftar. Silakan masuk.");
    // role selalu 'customer' — tidak pernah dibaca dari input pengguna
    const [u] = await db.insert(users).values({ name: p.data.name, email: p.data.email, phone: p.data.phone ?? "", passwordHash: hashPassword(p.data.password), role: "customer" }).returning();
    await createSession(u.id);
    await notify(u.id, "system", "Selamat datang!", "Akun Anda siap. Pilih template pertama Anda.", "/app/templates");
    await logActivity(u.id, "Registrasi", "auth", u.id);
    return ok("Akun berhasil dibuat.", "/app");
  });
}

export async function logoutAction() {
  const u = await getSession();
  if (u) await logActivity(u.id, "Logout", "auth", u.id);
  await destroySession();
  redirect("/");
}
