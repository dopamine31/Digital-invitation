export type VoucherLike = {
  code: string; type: string; value: number; minTotal: number; quota: number; used: number;
  packageCode: string | null; userId: number | null; startsAt: Date | null; endsAt: Date | null; active: boolean | null;
};

export function validateVoucher(v: VoucherLike | undefined | null, subtotal: number, pkgCode: string, userId: number, now = new Date()): { ok: boolean; message: string } {
  if (!v || !v.active) return { ok: false, message: "Kode voucher tidak ditemukan." };
  if (v.startsAt && now < v.startsAt) return { ok: false, message: "Promo belum dimulai." };
  if (v.endsAt && now > v.endsAt) return { ok: false, message: "Promo sudah berakhir." };
  if (v.used >= v.quota) return { ok: false, message: "Kuota voucher habis." };
  if (subtotal < v.minTotal) return { ok: false, message: `Minimal transaksi Rp ${v.minTotal.toLocaleString("id-ID")}.` };
  if (v.packageCode && v.packageCode !== pkgCode) return { ok: false, message: `Voucher khusus paket ${v.packageCode}.` };
  if (v.userId && v.userId !== userId) return { ok: false, message: "Voucher ini khusus akun lain." };
  return { ok: true, message: "Voucher berhasil dipakai." };
}

export function voucherDiscount(v: Pick<VoucherLike, "type" | "value">, subtotal: number) {
  const d = v.type === "percent" ? Math.round((subtotal * Math.min(v.value, 100)) / 100) : v.value;
  return Math.max(0, Math.min(d, subtotal));
}

export function computeTotals(o: { packagePrice: number; templatePrice: number; addonPrices: number[]; discount?: number }) {
  const subtotal = o.packagePrice + o.templatePrice + o.addonPrices.reduce((a, b) => a + b, 0);
  const discount = Math.max(0, Math.min(o.discount ?? 0, subtotal));
  return { subtotal, discount, total: subtotal - discount };
}
