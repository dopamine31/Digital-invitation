import { describe, expect, it } from "vitest";
import { computeTotals, validateVoucher, voucherDiscount, type VoucherLike } from "@/lib/pricing";

const v = (o: Partial<VoucherLike> = {}): VoucherLike => ({ code: "X", type: "percent", value: 10, minTotal: 0, quota: 10, used: 0, packageCode: null, userId: null, startsAt: null, endsAt: null, active: true, ...o });

describe("pricing", () => {
  it("menghitung total dengan add-on dan diskon", () => {
    expect(computeTotals({ packagePrice: 79000, templatePrice: 25000, addonPrices: [25000], discount: 10000 })).toEqual({ subtotal: 129000, discount: 10000, total: 119000 });
  });
  it("diskon tidak melebihi subtotal", () => {
    expect(computeTotals({ packagePrice: 1000, templatePrice: 0, addonPrices: [], discount: 99999 }).total).toBe(0);
  });
  it("diskon persen & nominal", () => {
    expect(voucherDiscount({ type: "percent", value: 10 }, 100000)).toBe(10000);
    expect(voucherDiscount({ type: "fixed", value: 25000 }, 20000)).toBe(20000);
  });
  it("validasi voucher: kuota, minimal, paket, periode", () => {
    expect(validateVoucher(v(), 50000, "basic", 1).ok).toBe(true);
    expect(validateVoucher(undefined, 50000, "basic", 1).ok).toBe(false);
    expect(validateVoucher(v({ used: 10 }), 50000, "basic", 1).ok).toBe(false);
    expect(validateVoucher(v({ minTotal: 90000 }), 50000, "basic", 1).ok).toBe(false);
    expect(validateVoucher(v({ packageCode: "exclusive" }), 50000, "basic", 1).ok).toBe(false);
    expect(validateVoucher(v({ endsAt: new Date(Date.now() - 1000) }), 50000, "basic", 1).ok).toBe(false);
    expect(validateVoucher(v({ userId: 9 }), 50000, "basic", 1).ok).toBe(false);
  });
});
