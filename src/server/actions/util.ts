import type { ActionResult } from "@/types";

/** Bungkus server action: error → pesan yang aman untuk pengguna (tanpa stack trace). */
export async function safe(fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await fn();
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    if (m === "Akses ditolak" || m.startsWith("Silakan")) return { ok: false, message: m };
    if (m.startsWith("NEXT_REDIRECT")) throw e;
    console.error("[action]", e);
    return { ok: false, message: "Terjadi kesalahan pada server. Coba lagi." };
  }
}
export const ok = (message: string, redirect?: string): ActionResult => ({ ok: true, message, redirect });
export const fail = (message: string): ActionResult => ({ ok: false, message });
export const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? "").trim().slice(0, max);
export const num = (fd: FormData, k: string, def = 0) => { const n = Number(fd.get(k)); return Number.isFinite(n) ? Math.round(n) : def; };
