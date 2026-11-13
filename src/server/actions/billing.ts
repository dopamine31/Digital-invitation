"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor, requirePermission, audit, tenantIdOrThrow } from "@/server/context";
import { tenantClient } from "@/lib/tenant";
import { computeInvoice, couponDiscount, nextPeriodEnd, subscriptionState, GRACE_PERIOD_DAYS } from "@/lib/billing";
import { paymentAdapter } from "@/adapters/payment";
import { dispatchWebhookEvent } from "@/server/webhooks";
import { toInputJson } from "@/lib/db-json";
import { AppError, err, ok, type Result } from "@/lib/result";
import { formatCurrency } from "@/lib/format";

export async function getPlansAction(): Promise<Result<{ id: string; code: string; name: string; monthlyPrice: number; yearlyPrice: number; description: string; limits: unknown; features: unknown }[]>> {
  try {
    const plans = await prisma.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
    return ok(plans.map((plan) => ({
      id: plan.id, code: plan.code, name: plan.name,
      monthlyPrice: plan.monthlyPrice, yearlyPrice: plan.yearlyPrice,
      description: plan.description, limits: plan.limits, features: plan.features,
    })));
  } catch (error: unknown) {
    return err("PLAN_FAILED", error instanceof Error ? error.message : "Gagal memuat paket.");
  }
}

export async function validateCouponAction(code: string, planId: string): Promise<Result<{ discount: number; type: string; value: number }>> {
  try {
    const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (!coupon) return err("COUPON_NOT_FOUND", "Kupon tidak ditemukan.");
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return err("PLAN_NOT_FOUND", "Paket tidak ditemukan.");
    const applies = Array.isArray(coupon.appliesToPlanIds) ? (coupon.appliesToPlanIds as unknown[]).map(String) : [];
    const result = couponDiscount({
      type: coupon.type === "FIXED" ? "FIXED" : "PERCENT", value: coupon.value,
      active: coupon.active, maxRedemptions: coupon.maxRedemptions, redeemedCount: coupon.redeemedCount,
      validFrom: coupon.validFrom, validUntil: coupon.validUntil, appliesToPlanIds: applies,
    }, plan.monthlyPrice, plan.id);
    if (!result.ok) return err("COUPON_INVALID", result.reason ?? "Kupon tidak berlaku.");
    return ok({ discount: result.discount, type: coupon.type, value: coupon.value });
  } catch (error: unknown) {
    return err("COUPON_FAILED", error instanceof Error ? error.message : "Gagal memeriksa kupon.");
  }
}

const checkoutSchema = z.object({
  planId: z.string(), cycle: z.enum(["MONTHLY", "YEARLY"]), couponCode: z.string().max(40).optional(),
});

export async function createCheckoutAction(input: z.infer<typeof checkoutSchema>): Promise<Result<{ invoiceId: string; paymentUrl: string; total: number }>> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", "Data checkout tidak valid.");
  try {
    const actor = await requirePermission("billing.manage");
    const tenantId = tenantIdOrThrow(actor);
    const plan = await prisma.plan.findUnique({ where: { id: parsed.data.planId } });
    if (!plan || !plan.isActive) return err("PLAN_NOT_FOUND", "Paket tidak tersedia.");
    let discount = 0;
    let couponCode: string | null = null;
    if (parsed.data.couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { code: parsed.data.couponCode.trim().toUpperCase() } });
      if (coupon) {
        const applies = Array.isArray(coupon.appliesToPlanIds) ? (coupon.appliesToPlanIds as unknown[]).map(String) : [];
        const applied = couponDiscount({
          type: coupon.type === "FIXED" ? "FIXED" : "PERCENT", value: coupon.value,
          active: coupon.active, maxRedemptions: coupon.maxRedemptions, redeemedCount: coupon.redeemedCount,
          validFrom: coupon.validFrom, validUntil: coupon.validUntil, appliesToPlanIds: applies,
        }, parsed.data.cycle === "YEARLY" ? plan.yearlyPrice : plan.monthlyPrice, plan.id);
        if (applied.ok) {
          discount = applied.discount;
          couponCode = coupon.code;
          await prisma.coupon.update({ where: { id: coupon.id }, data: { redeemedCount: { increment: 1 } } });
        }
      }
    }
    const price = computeInvoice({
      monthlyPrice: plan.monthlyPrice, yearlyPrice: plan.yearlyPrice,
      cycle: parsed.data.cycle, discountFixed: discount, taxPercent: 0,
    });
    const db = tenantClient(tenantId);
    const number = `INV/${new Date().getFullYear()}/${Date.now().toString(36).toUpperCase()}`;
    const invoice = await db.invoice.create({
      data: {
        tenantId, number, planId: plan.id, amount: price.subtotal, discount: price.discount,
        tax: price.tax, total: price.total, currency: "IDR", status: "PENDING",
        dueAt: new Date(Date.now() + 3 * 24 * 3600_000), couponCode,
        provider: paymentAdapter().name.toUpperCase(),
        meta: toInputJson({ cycle: parsed.data.cycle }),
      },
    });
    if (couponCode) {
      await db.couponRedemption.create({ data: { tenantId, couponId: couponCode, invoiceId: invoice.id, discountApplied: discount } });
    }
    const session = await paymentAdapter().createSession({
      invoiceId: invoice.id, invoiceNumber: number, amount: price.total, currency: "IDR",
      customerName: actor.user.name, customerEmail: actor.user.email,
      description: `Langganan ${plan.name} (${parsed.data.cycle === "YEARLY" ? "tahunan" : "bulanan"})`,
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/app/billing?paid=1`,
    });
    await db.invoice.update({ where: { id: invoice.id, tenantId }, data: { providerRef: session.reference } });
    await audit(actor, "billing.checkout", "Invoice", invoice.id, undefined, { planCode: plan.code, total: price.total });
    revalidatePath("/app/billing");
    return ok({ invoiceId: invoice.id, paymentUrl: session.paymentUrl, total: price.total });
  } catch (error: unknown) {
    if (error instanceof AppError) return err(error.code, error.message);
    return err("CHECKOUT_FAILED", error instanceof Error ? error.message : "Gagal membuat tagihan.");
  }
}

/** Konfirmasi pembayaran adaptor mock; untuk provider asli dipicu webhook ber-signature. */
export async function confirmMockPaymentAction(invoiceId: string): Promise<Result<{ paid: true }>> {
  try {
    const actor = await requirePermission("billing.manage");
    const tenantId = tenantIdOrThrow(actor);
    const db = tenantClient(tenantId);
    const invoice = await db.invoice.findFirst({ where: { id: invoiceId, tenantId } });
    if (!invoice) return err("NOT_FOUND", "Invoice tidak ditemukan.");
    if (invoice.status === "PAID") return ok({ paid: true });
    await markInvoicePaid(tenantId, invoice.id, invoice.planId, invoice.total, "MOCK", invoice.providerRef ?? `MOCK-${invoice.number}`);
    await audit(actor, "billing.paid", "Invoice", invoiceId, undefined, { total: invoice.total });
    revalidatePath("/app/billing");
    return ok({ paid: true });
  } catch (error: unknown) {
    return err("PAYMENT_FAILED", error instanceof Error ? error.message : "Gagal mengonfirmasi pembayaran.");
  }
}

export async function markInvoicePaid(tenantId: string, invoiceId: string, planId: string, amount: number, provider: string, reference: string): Promise<void> {
  const db = tenantClient(tenantId);
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  const invoice = await db.invoice.findFirst({ where: { id: invoiceId, tenantId } });
  if (!invoice) throw new AppError("NOT_FOUND", "Invoice tidak ditemukan.", 404);
  await db.invoice.update({ where: { id: invoiceId, tenantId }, data: { status: "PAID", paidAt: new Date() } });
  await db.transaction.create({
    data: { tenantId, invoiceId, amount, provider, providerRef: reference, status: "PAID", rawPayload: toInputJson({ reference }) },
  });
  const cycle = ((invoice.meta as Record<string, unknown> | null)?.cycle === "YEARLY" ? "YEARLY" : "MONTHLY") as "MONTHLY" | "YEARLY";
  const start = new Date();
  const end = nextPeriodEnd(start, cycle);
  const active = await db.subscription.findFirst({ where: { tenantId, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE", "GRACE"] } } });
  if (active) {
    await db.subscription.update({
      where: { id: active.id, tenantId },
      data: { planId, status: "ACTIVE", billingCycle: cycle, startedAt: start, currentPeriodEnd: end, graceUntil: null, cancelledAt: null },
    });
  } else {
    await db.subscription.create({
      data: { tenantId, planId, status: "ACTIVE", billingCycle: cycle, startedAt: start, currentPeriodEnd: end },
    });
  }
  await prisma.tenant.update({ where: { id: tenantId }, data: { planId, status: "ACTIVE", graceUntil: null } });
  await dispatchWebhookEvent(tenantId, "order.paid", {
    invoiceId, invoiceNumber: invoice.number, amount, planId: planId, planCode: plan?.code ?? "", paidAt: new Date().toISOString(),
  });
}

/** Auto-expire dengan grace period; dipanggil worker saat startup & berkala. */
export async function expireSubscriptions(): Promise<number> {
  const subs = await prisma.subscription.findMany({ where: { status: { in: ["TRIALING", "ACTIVE", "PAST_DUE", "GRACE"] } } });
  const now = new Date();
  let changed = 0;
  for (const sub of subs) {
    const state = subscriptionState(sub.status, sub.currentPeriodEnd, now);
    if (state === sub.status) continue;
    const graceUntil = new Date(sub.currentPeriodEnd);
    graceUntil.setUTCDate(graceUntil.getUTCDate() + GRACE_PERIOD_DAYS);
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: state === "EXPIRED" ? "EXPIRED" : state, graceUntil: state === "GRACE" ? graceUntil : null } });
    await prisma.tenant.update({
      where: { id: sub.tenantId },
      data: { status: state === "EXPIRED" ? "EXPIRED" : state === "GRACE" ? "GRACE" : "PAST_DUE", graceUntil: state === "GRACE" ? graceUntil : null },
    });
    changed += 1;
  }
  return changed;
}

export async function billingSummaryAction(): Promise<Result<{ planCode: string; total: number; label: string; invoices: number }>> {
  try {
    const actor = await requireActor();
    const tenantId = tenantIdOrThrow(actor);
    const db = tenantClient(tenantId);
    const invoices = await db.invoice.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
    return ok({
      planCode: actor.planCode,
      total: invoices.filter((row) => row.status === "PAID").reduce((sum, row) => sum + row.total, 0),
      label: formatCurrency(invoices.filter((row) => row.status === "PAID").reduce((sum, row) => sum + row.total, 0)),
      invoices: invoices.length,
    });
  } catch (error: unknown) {
    return err("BILLING_FAILED", error instanceof Error ? error.message : "Gagal memuat tagihan.");
  }
}
