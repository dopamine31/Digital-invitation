import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ensureSeed } from "@/lib/seed";

const COOKIE = "dis_session";
const secret = () => process.env.SESSION_SECRET || "dev-only-secret-change-me-in-production";

export function hashPassword(p: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(p, salt, 64).toString("hex")}`;
}
export function verifyPassword(p: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(p, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const signValue = (payload: string) => createHmac("sha256", secret()).update(payload).digest("hex");
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("hex");

export async function createSession(userId: number) {
  const exp = Date.now() + 7 * 24 * 3600_000;
  const payload = `${userId}.${exp}`;
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    path: "/", maxAge: 7 * 24 * 3600,
  });
}
export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export const getSession = cache(async () => {
  await ensureSeed();
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [id, exp, sig] = raw.split(".");
  if (!id || !exp || !sig) return null;
  const expected = sign(`${id}.${exp}`);
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  if (Number(exp) < Date.now()) return null;
  const [u] = await db.select().from(users).where(eq(users.id, Number(id))).limit(1);
  if (!u || u.status !== "active") return null;
  return u;
});
export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export async function requireUser(next = "/app") {
  const u = await getSession();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}
export async function requireCustomer() {
  const u = await requireUser("/app");
  if (u.role !== "customer") redirect("/admin");
  return u;
}
export async function requireStaff() {
  const u = await requireUser("/admin");
  if (u.role === "customer") redirect("/app");
  return u;
}
export const ADMIN_PERMS = ["orders", "payments", "customers", "templates", "packages", "vouchers", "content", "support", "logs"] as const;
export const hasPerm = (u: { role: string; permissions: string[] }, perm: string) =>
  u.role === "owner" || (u.role === "staff" && u.permissions.includes(perm));
export async function requirePerm(perm: string) {
  const u = await requireStaff();
  if (!hasPerm(u, perm)) redirect("/admin?denied=1");
  return u;
}
export async function requireOwner() {
  const u = await requireStaff();
  if (u.role !== "owner") redirect("/admin?denied=1");
  return u;
}
/** Versi untuk server action / API: melempar error, bukan redirect */
export async function assertPerm(perm: string) {
  const u = await getSession();
  if (!u || !hasPerm(u, perm)) throw new Error("Akses ditolak");
  return u;
}
export async function assertOwner() {
  const u = await getSession();
  if (!u || u.role !== "owner") throw new Error("Akses ditolak");
  return u;
}
export async function assertCustomer() {
  const u = await getSession();
  if (!u || u.role !== "customer") throw new Error("Silakan masuk sebagai customer");
  return u;
}
