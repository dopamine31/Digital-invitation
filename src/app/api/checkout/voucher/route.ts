import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { vouchers } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { validateVoucher, voucherDiscount } from "@/lib/pricing";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function GET(req: Request) {
  const u = await getSession();
  if (!u) return NextResponse.json({ ok: false, message: "Silakan masuk." }, { status: 401 });
  if (!rateLimit(`voucher:${clientIp(req)}:${u.id}`, 20, 60_000)) return NextResponse.json({ ok: false, message: "Terlalu banyak percobaan." }, { status: 429 });
  const q = new URL(req.url).searchParams;
  const code = (q.get("code") ?? "").toUpperCase().slice(0, 30);
  const subtotal = Number(q.get("subtotal") ?? 0), pkg = q.get("pkg") ?? "";
  const [v] = await db.select().from(vouchers).where(eq(vouchers.code, code)).limit(1);
  const chk = validateVoucher(v, subtotal, pkg, u.id);
  return NextResponse.json({ ...chk, discount: chk.ok ? voucherDiscount(v, subtotal) : 0 });
}
