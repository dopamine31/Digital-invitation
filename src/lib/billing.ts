import type { JsonObject, PlanFeatures, PlanLimits } from "@/lib/types";

export const DEFAULT_LIMITS: PlanLimits = {
  maxEvents: 1, maxGuestsPerEvent: 100, maxStorageMb: 100, maxBlastsPerMonth: 200, seats: 1,
};

export const DEFAULT_FEATURES: PlanFeatures = {
  customDomain: false, whiteLabel: false, apiAccess: false, webhooks: false,
  customFonts: false, customCss: false, removeBranding: false, livestream: false,
  offlineCheckin: false, advancedAnalytics: false, prioritySupport: false,
};

export function parseLimits(raw: unknown): PlanLimits {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_LIMITS };
  const input = raw as Partial<PlanLimits>;
  return {
    maxEvents: intOr(input.maxEvents, DEFAULT_LIMITS.maxEvents),
    maxGuestsPerEvent: intOr(input.maxGuestsPerEvent, DEFAULT_LIMITS.maxGuestsPerEvent),
    maxStorageMb: intOr(input.maxStorageMb, DEFAULT_LIMITS.maxStorageMb),
    maxBlastsPerMonth: intOr(input.maxBlastsPerMonth, DEFAULT_LIMITS.maxBlastsPerMonth),
    seats: intOr(input.seats, DEFAULT_LIMITS.seats),
  };
}

export function parseFeatures(raw: unknown): PlanFeatures {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_FEATURES };
  const input = raw as Partial<PlanFeatures>;
  const out = { ...DEFAULT_FEATURES };
  for (const key of Object.keys(DEFAULT_FEATURES) as (keyof PlanFeatures)[]) {
    if (typeof input[key] === "boolean") out[key] = input[key] as boolean;
  }
  return out;
}

function intOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

export function hasFeature(features: PlanFeatures, key: keyof PlanFeatures): boolean {
  return features[key] === true;
}

export interface QuotaCheck {
  metric: keyof PlanLimits;
  current: number;
  requested: number;
  limits: PlanLimits;
}

export function checkQuota(input: QuotaCheck): { allowed: boolean; limit: number; remaining: number } {
  const limit = input.limits[input.metric];
  const remaining = Math.max(0, limit - input.current);
  return { allowed: input.requested <= remaining, limit, remaining };
}

export interface PriceInput {
  monthlyPrice: number;
  yearlyPrice: number;
  cycle: "MONTHLY" | "YEARLY";
  discountPercent?: number;
  discountFixed?: number;
  taxPercent?: number;
}

export function computeInvoice(input: PriceInput): { subtotal: number; discount: number; tax: number; total: number } {
  const subtotal = Math.max(0, input.cycle === "YEARLY" ? input.yearlyPrice : input.monthlyPrice);
  const percentDiscount = Math.round(subtotal * Math.min(100, Math.max(0, input.discountPercent ?? 0)) / 100);
  const discount = Math.min(subtotal, percentDiscount + Math.max(0, input.discountFixed ?? 0));
  const taxable = subtotal - discount;
  const tax = Math.round(taxable * Math.min(100, Math.max(0, input.taxPercent ?? 0)) / 100);
  return { subtotal, discount, tax, total: taxable + tax };
}

export interface CouponRule {
  type: "PERCENT" | "FIXED";
  value: number;
  active: boolean;
  maxRedemptions: number;
  redeemedCount: number;
  validFrom: Date;
  validUntil: Date | null;
  appliesToPlanIds: string[];
}

export function couponDiscount(coupon: CouponRule, price: number, planId: string, now: Date = new Date()): { ok: boolean; discount: number; reason?: string } {
  if (!coupon.active) return { ok: false, discount: 0, reason: "Kupon tidak aktif." };
  if (now < coupon.validFrom || (coupon.validUntil && now > coupon.validUntil)) return { ok: false, discount: 0, reason: "Kupon sudah kedaluwarsa." };
  if (coupon.maxRedemptions > 0 && coupon.redeemedCount >= coupon.maxRedemptions) return { ok: false, discount: 0, reason: "Kuota kupon habis." };
  if (coupon.appliesToPlanIds.length > 0 && !coupon.appliesToPlanIds.includes(planId)) return { ok: false, discount: 0, reason: "Kupon tidak berlaku untuk paket ini." };
  const discount = coupon.type === "PERCENT"
    ? Math.round(price * Math.min(100, Math.max(0, coupon.value)) / 100)
    : Math.min(price, Math.max(0, coupon.value));
  return { ok: true, discount };
}

export interface SubscriptionRow { planId: string; billingCycle: string; status: string; }
export interface PlanRow { id: string; monthlyPrice: number; yearlyPrice: number; }

/** MRR dalam IDR: langganan tahunan dibagi 12, trial/tidak aktif tidak dihitung. */
export function computeMrr(subscriptions: readonly SubscriptionRow[], plans: readonly PlanRow[]): number {
  const byId = new Map(plans.map((plan) => [plan.id, plan]));
  return subscriptions.reduce((total, subscription) => {
    if (!["ACTIVE", "PAST_DUE", "GRACE"].includes(subscription.status)) return total;
    const plan = byId.get(subscription.planId);
    if (!plan) return total;
    return total + (subscription.billingCycle === "YEARLY" ? plan.yearlyPrice / 12 : plan.monthlyPrice);
  }, 0);
}

export function computeArr(mrr: number): number {
  return mrr * 12;
}

export function nextPeriodEnd(from: Date, cycle: "MONTHLY" | "YEARLY"): Date {
  const next = new Date(from);
  if (cycle === "YEARLY") next.setUTCFullYear(next.getUTCFullYear() + 1);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

export const GRACE_PERIOD_DAYS = 7;

export function subscriptionState(status: string, currentPeriodEnd: Date, now: Date = new Date()): "ACTIVE" | "PAST_DUE" | "GRACE" | "EXPIRED" {
  if (status === "CANCELLED" || status === "EXPIRED") return "EXPIRED";
  if (now <= currentPeriodEnd) return "ACTIVE";
  const graceUntil = new Date(currentPeriodEnd);
  graceUntil.setUTCDate(graceUntil.getUTCDate() + GRACE_PERIOD_DAYS);
  if (now <= graceUntil) return "GRACE";
  return "EXPIRED";
}

export function trialToPaidRate(trials: number, paid: number): number {
  return trials <= 0 ? 0 : Math.round((paid / trials) * 1000) / 10;
}

export function churnRate(activeAtStart: number, churned: number): number {
  return activeAtStart <= 0 ? 0 : Math.round((churned / activeAtStart) * 1000) / 10;
}

export function limitsToJson(limits: PlanLimits): JsonObject {
  return JSON.parse(JSON.stringify(limits)) as JsonObject;
}

export function featuresToJson(features: PlanFeatures): JsonObject {
  return JSON.parse(JSON.stringify(features)) as JsonObject;
}
