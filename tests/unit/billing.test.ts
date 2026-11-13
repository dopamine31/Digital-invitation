import { describe, expect, it } from "vitest";
import {
  checkQuota, computeArr, computeInvoice, computeMrr, couponDiscount,
  churnRate, nextPeriodEnd, parseFeatures, parseLimits, subscriptionState, trialToPaidRate,
} from "@/lib/billing";

const now = new Date("2026-11-13T00:00:00Z");

describe("billing", () => {
  it("menghitung faktur diskon + pajak tanpa total negatif", () => {
    expect(computeInvoice({ monthlyPrice: 100000, yearlyPrice: 1000000, cycle: "MONTHLY", discountFixed: 20000, taxPercent: 10 })).toEqual({
      subtotal: 100000, discount: 20000, tax: 8000, total: 88000,
    });
    expect(computeInvoice({ monthlyPrice: 100, yearlyPrice: 100, cycle: "MONTHLY", discountFixed: 999 }).total).toBe(0);
  });

  it("kupon menghormati aktif, masa berlaku, kuota, dan cakupan paket", () => {
    const rule = { type: "PERCENT" as const, value: 20, active: true, maxRedemptions: 10, redeemedCount: 1, validFrom: new Date("2026-01-01Z"), validUntil: new Date("2026-12-31Z"), appliesToPlanIds: ["p1"] };
    expect(couponDiscount(rule, 100000, "p1", now).discount).toBe(20000);
    expect(couponDiscount({ ...rule, appliesToPlanIds: ["p1"] }, 100000, "p2", now).ok).toBe(false);
    expect(couponDiscount({ ...rule, redeemedCount: 10 }, 100000, "p1", now).ok).toBe(false);
  });

  it("MRR/ARR hanya menghitung subscription aktif dan menormalkan tahunan", () => {
    const plans = [{ id: "p1", monthlyPrice: 100000, yearlyPrice: 1000000 }];
    const mrr = computeMrr([{ planId: "p1", billingCycle: "YEARLY", status: "ACTIVE" }, { planId: "p1", billingCycle: "MONTHLY", status: "TRIALING" }], plans);
    expect(mrr).toBeCloseTo(1000000 / 12, 5);
    expect(computeArr(mrr)).toBeCloseTo(1000000, 5);
  });

  it("kuota, trial conversion, churn, grace period", () => {
    const limits = parseLimits({ maxEvents: 2, maxGuestsPerEvent: 100 });
    expect(checkQuota({ metric: "maxEvents", current: 2, requested: 1, limits }).allowed).toBe(false);
    expect(trialToPaidRate(10, 4)).toBe(40);
    expect(churnRate(100, 3)).toBe(3);
    expect(subscriptionState("ACTIVE", new Date("2026-11-10T00:00:00Z"), now)).toBe("GRACE");
    expect(subscriptionState("ACTIVE", new Date("2026-10-01T00:00:00Z"), now)).toBe("EXPIRED");
    expect(nextPeriodEnd(now, "MONTHLY").getUTCMonth()).toBe(11);
    expect(parseFeatures({ customCss: true }).customCss).toBe(true);
    expect(parseLimits(null).maxEvents).toBe(1);
  });
});
