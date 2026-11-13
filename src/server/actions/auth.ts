"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  authenticatePassword, consumeVerification, createSession, exchangeGoogleCode,
  googleAuthUrl, issueVerification, revokeSession, requireSession,
} from "@/lib/auth";
import { assertCsrf } from "@/lib/auth";
import { hashPassword, hmac, normalizePhone, randomToken, sha256 } from "@/lib/crypto";
import { slugify } from "@/lib/format";
import { recordAudit } from "@/lib/audit";
import { emailAdapter } from "@/adapters/email";
import { whatsappAdapter } from "@/adapters/whatsapp";
import { env } from "@/lib/env";
import { err, ok, type Result } from "@/lib/result";
import { toInputJson } from "@/lib/db-json";
import { AppError } from "@/lib/result";

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8).max(200) });
const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  tenantName: z.string().min(2).max(120),
  phone: z.string().max(25).optional(),
  locale: z.enum(["id", "en"]).default("id"),
});

export async function loginAction(input: z.infer<typeof loginSchema>): Promise<Result<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", parsed.error.issues[0]?.message ?? "Data tidak valid.");
  try {
    const user = await authenticatePassword(parsed.data.email, parsed.data.password);
    if (!user) return err("INVALID_CREDENTIALS", "Email atau kata sandi salah.");
    await createSession(user.id);
    await recordAudit({ tenantId: user.tenantId, actorId: user.id, actorEmail: user.email, action: "auth.login", entity: "Session" });
    return ok({ redirectTo: user.platformRole === "SUPER_ADMIN" ? "/admin" : "/app" });
  } catch (error: unknown) {
    return err("LOGIN_FAILED", error instanceof Error ? error.message : "Gagal masuk.");
  }
}

export async function registerAction(input: z.infer<typeof registerSchema>): Promise<Result<{ redirectTo: string }>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", parsed.error.issues[0]?.message ?? "Data tidak valid.");
  const data = parsed.data;
  const email = data.email.trim().toLowerCase();
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return err("EMAIL_TAKEN", "Email sudah terdaftar. Silakan masuk.");
    const plan = await prisma.plan.findFirst({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
    if (!plan) return err("NO_PLAN", "Paket belum tersedia. Jalankan `npm run db:seed` terlebih dahulu.");
    const baseSlug = slugify(data.tenantName) || `tenant-${randomToken(4).toLowerCase()}`;
    let tenantSlug = baseSlug;
    let suffix = 1;
    while (await prisma.tenant.findUnique({ where: { slug: tenantSlug } })) {
      suffix += 1;
      tenantSlug = `${baseSlug}-${suffix}`;
    }
    const passwordHash = await hashPassword(data.password);
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + plan.trialDays * 24 * 3600_000);
    const tenant = await prisma.tenant.create({
      data: {
        name: data.tenantName, slug: tenantSlug, subdomain: tenantSlug,
        planId: plan.id, status: "TRIAL", trialEndsAt,
        branding: toInputJson({ primaryColor: "#9A7B4F", tagline: "Undangan digital yang berkesan" }),
        themeConfig: toInputJson({ themeId: "elegant-ivory" }),
        locale: data.locale,
      },
    });
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id, email, name: data.name, passwordHash,
        platformRole: "USER", status: "ACTIVE", locale: data.locale,
        phoneEncrypted: data.phone ? data.phone : null,
        phoneMasked: data.phone ? `${normalizePhone(data.phone).slice(0, 5)}****${normalizePhone(data.phone).slice(-2)}` : null,
        phoneHash: data.phone ? sha256(normalizePhone(data.phone)) : null,
        emailVerifiedAt: null,
      },
    });
    await prisma.membership.createMany({
      data: [
        { tenantId: tenant.id, userId: user.id, role: "TENANT_ADMIN" },
        { tenantId: tenant.id, userId: user.id, role: "EVENT_OWNER" },
      ],
    });
    await prisma.subscription.create({
      data: {
        tenantId: tenant.id, planId: plan.id, status: "TRIALING", billingCycle: "MONTHLY",
        startedAt: now, currentPeriodEnd: trialEndsAt, autoRenew: true,
      },
    });
    await prisma.referral.create({
      data: { tenantId: tenant.id, code: `REF-${randomToken(5).toUpperCase()}`, commissionPercent: 10 },
    });
    await createSession(user.id);
    await recordAudit({ tenantId: tenant.id, actorId: user.id, actorEmail: email, action: "auth.register", entity: "Tenant", entityId: tenant.id, after: { tenantSlug, planCode: plan.code } });
    return ok({ redirectTo: "/app/events/new" });
  } catch (error: unknown) {
    return err("REGISTER_FAILED", error instanceof Error ? error.message : "Gagal mendaftar.");
  }
}

export async function logoutAction(): Promise<Result<{ redirectTo: string }>> {
  const session = await requireSession();
  await recordAudit({ tenantId: session.tenantId, actorId: session.actor.id, actorEmail: session.actor.email, action: "auth.logout", entity: "Session" });
  await revokeSession();
  return ok({ redirectTo: "/login" });
}

const otpRequestSchema = z.object({ identifier: z.string().min(5).max(160), channel: z.enum(["EMAIL", "WHATSAPP"]) });

export async function requestOtpAction(input: z.infer<typeof otpRequestSchema>): Promise<Result<{ devCode?: string }>> {
  const parsed = otpRequestSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", "Email atau nomor WhatsApp tidak valid.");
  const { identifier, channel } = parsed.data;
  const normalized = channel === "WHATSAPP" ? normalizePhone(identifier) : identifier.toLowerCase();
  const user = channel === "WHATSAPP"
    ? await prisma.user.findUnique({ where: { phoneHash: sha256(normalized) } })
    : await prisma.user.findUnique({ where: { email: normalized } });
  // Tidak membocorkan keberadaan akun: selalu kirim respons sukses.
  const issued = await issueVerification({ identifier: normalized, channel, purpose: "OTP_LOGIN", withCode: true, ttlMinutes: 10 });
  if (user) {
    const message = `Kode masuk Rasa Undangan: ${issued.code ?? ""}. Jangan bagikan kode ini.`;
    if (channel === "EMAIL") await emailAdapter().send({ to: normalized, subject: "Kode masuk Rasa Undangan", html: `<p>${message}</p>` });
    else await whatsappAdapter().send({ to: normalized, body: message, templateKey: "otp" });
  }
  const mockMode = env().WHATSAPP_ADAPTER === "mock" && env().EMAIL_ADAPTER === "mock" && env().NODE_ENV !== "production";
  return ok(mockMode && user ? { devCode: issued.code ?? undefined } : {});
}

const otpVerifySchema = z.object({ identifier: z.string().min(5).max(160), channel: z.enum(["EMAIL", "WHATSAPP"]), code: z.string().length(6) });

export async function verifyOtpAction(input: z.infer<typeof otpVerifySchema>): Promise<Result<{ redirectTo: string }>> {
  const parsed = otpVerifySchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", "Kode OTP harus 6 digit.");
  const normalized = parsed.data.channel === "WHATSAPP"
    ? normalizePhone(parsed.data.identifier)
    : parsed.data.identifier.toLowerCase();
  const consumed = await consumeVerification({ identifier: normalized, purpose: "OTP_LOGIN", code: parsed.data.code });
  if (!consumed) return err("OTP_INVALID", "Kode salah atau sudah kedaluwarsa.");
  const user = parsed.data.channel === "WHATSAPP"
    ? await prisma.user.findUnique({ where: { phoneHash: sha256(normalized) } })
    : await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) return err("USER_NOT_FOUND", "Akun tidak ditemukan.");
  await createSession(user.id);
  await recordAudit({ tenantId: user.tenantId, actorId: user.id, actorEmail: user.email, action: "auth.otp_login", entity: "Session" });
  return ok({ redirectTo: user.platformRole === "SUPER_ADMIN" ? "/admin" : "/app" });
}

const magicSchema = z.object({ email: z.string().email() });

export async function requestMagicLinkAction(input: z.infer<typeof magicSchema>): Promise<Result<{ devToken?: string }>> {
  const parsed = magicSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", "Email tidak valid.");
  const email = parsed.data.email.toLowerCase();
  const issued = await issueVerification({ identifier: email, channel: "EMAIL", purpose: "MAGIC_LINK", ttlMinutes: 20, meta: { email } });
  const url = `${env().APP_URL}/api/auth/magic?token=${issued.token}`;
  await emailAdapter().send({ to: email, subject: "Magic link Rasa Undangan", html: `<p>Masuk dengan tautan berikut:</p><p><a href="${url}">${url}</a></p>` });
  const mockMode = env().EMAIL_ADAPTER === "mock" && env().NODE_ENV !== "production";
  return ok(mockMode ? { devToken: issued.token } : {});
}

export async function googleSignInAction(): Promise<Result<{ url: string }>> {
  const state = hmac(`${Date.now()}`).slice(0, 32);
  const url = googleAuthUrl(state);
  if (!url) return err("GOOGLE_DISABLED", "OAuth Google belum dikonfigurasi (isi GOOGLE_CLIENT_ID & SECRET).");
  return ok({ url });
}

/** Dipanggil route callback Google; membuat tenant baru bila belum punya akun. */
export async function completeGoogleSignIn(code: string): Promise<string> {
  const profile = await exchangeGoogleCode(code);
  if (!profile) throw new AppError("OAUTH_FAILED", "Gagal memverifikasi akun Google.", 401);
  let user = await prisma.user.findUnique({ where: { email: profile.email } });
  if (!user) {
    const plan = await prisma.plan.findFirst({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
    if (!plan) throw new AppError("NO_PLAN", "Paket belum tersedia.");
    const slug = slugify(profile.name) || `tenant-${randomToken(4).toLowerCase()}`;
    const tenant = await prisma.tenant.create({
      data: { name: `${profile.name}`, slug, subdomain: slug, planId: plan.id, status: "TRIAL", trialEndsAt: new Date(Date.now() + plan.trialDays * 24 * 3600_000) },
    });
    user = await prisma.user.create({
      data: { tenantId: tenant.id, email: profile.email, name: profile.name, avatarUrl: profile.avatarUrl, platformRole: "USER", status: "ACTIVE", emailVerifiedAt: new Date() },
    });
    await prisma.membership.create({ data: { tenantId: tenant.id, userId: user.id, role: "TENANT_ADMIN" } });
    await recordAudit({ tenantId: tenant.id, actorId: user.id, actorEmail: user.email, action: "auth.google_register", entity: "Tenant", entityId: tenant.id });
  }
  await createSession(user.id);
  return user.platformRole === "SUPER_ADMIN" ? "/admin" : "/app";
}

export async function consumeMagicToken(token: string): Promise<string> {
  const consumed = await consumeVerification({ purpose: "MAGIC_LINK", token });
  if (!consumed) throw new AppError("MAGIC_INVALID", "Magic link tidak valid atau kedaluwarsa.", 401);
  const email = typeof consumed.meta.email === "string" ? consumed.meta.email : "";
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError("USER_NOT_FOUND", "Akun tidak ditemukan.", 404);
  await createSession(user.id);
  return user.platformRole === "SUPER_ADMIN" ? "/admin" : "/app";
}

export async function changePasswordAction(input: { current: string; next: string; csrf: string }): Promise<Result<{ ok: true }>> {
  const session = await requireSession();
  await assertCsrf(input.csrf);
  if (input.next.length < 8) return err("VALIDATION", "Kata sandi minimal 8 karakter.");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return err("NOT_FOUND", "Pengguna tidak ditemukan.");
  const valid = await authenticatePassword(user.email, input.current);
  if (!valid) return err("INVALID_CREDENTIALS", "Kata sandi lama salah.");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.next) } });
  await recordAudit({ tenantId: user.tenantId, actorId: user.id, actorEmail: user.email, action: "auth.password_changed", entity: "User", entityId: user.id });
  return ok({ ok: true });
}

export async function redirectToApp(): Promise<never> {
  redirect("/app");
}
