import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  constantTimeEqual, hashIdentifier, hashIp, hmac, makeCsrfToken, randomNumericCode,
  randomToken, sha256, verifyCsrfToken, verifyPassword,
} from "@/lib/crypto";
import { AppError } from "@/lib/result";
import type { Locale } from "@/lib/types";
import type { Role as RbacRole } from "@/lib/rbac";
import { toInputJson } from "@/lib/db-json";

export const SESSION_COOKIE = "rasa_session";
export const IMPERSONATE_COOKIE = "rasa_impersonate";
const SESSION_TTL_DAYS = 14;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  tenantId: string | null;
  platformRole: string;
  status: string;
  locale: Locale;
  avatarUrl: string | null;
}

export interface SessionContext {
  sessionId: string;
  tokenHash: string;
  user: SessionUser;
  actor: SessionUser;
  impersonating: boolean;
  tenantId: string | null;
  roles: RbacRole[];
  role: RbacRole;
  eventIds: string[];
  csrfToken: string;
  ip: string | null;
  userAgent: string | null;
}

function mapUser(row: {
  id: string; email: string; name: string; tenantId: string | null;
  platformRole: string; status: string; locale: string; avatarUrl: string | null;
}): SessionUser {
  return {
    id: row.id, email: row.email, name: row.name, tenantId: row.tenantId,
    platformRole: row.platformRole, status: row.status,
    locale: row.locale === "en" ? "en" : "id", avatarUrl: row.avatarUrl,
  };
}

async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const head = await headers();
  const forwarded = head.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  return { ip: forwarded ?? head.get("x-real-ip"), userAgent: head.get("user-agent") };
}

export async function createSession(userId: string, impersonatorId?: string): Promise<SessionContext> {
  const token = randomToken(32);
  const tokenHash = sha256(token);
  const csrfSecret = randomToken(16);
  const meta = await requestMeta();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 3600_000);
  await prisma.session.create({
    data: {
      userId, tokenHash, csrfSecret, expiresAt,
      impersonatorId: impersonatorId ?? null,
      ipHash: hashIp(meta.ip),
      userAgentHash: meta.userAgent ? hashIdentifier(meta.userAgent) : null,
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true, secure: env().NODE_ENV === "production", sameSite: "lax",
    path: "/", expires: expiresAt,
  });
  const context = await buildSessionContext(tokenHash);
  if (!context) throw new AppError("SESSION_FAILED", "Gagal membuat sesi.", 500);
  return context;
}

export async function revokeSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } });
  jar.delete(SESSION_COOKIE);
  jar.delete(IMPERSONATE_COOKIE);
}

function parseImpersonationCookie(raw: string | undefined): { targetUserId: string; actorId: string } | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 4) return null;
  const [targetUserId, actorId, expires, signature] = parts as [string, string, string, string];
  if (Number(expires) < Date.now()) return null;
  if (!constantTimeEqual(hmac(`${targetUserId}.${actorId}.${expires}`), signature)) return null;
  return { targetUserId, actorId };
}

export function createImpersonationToken(targetUserId: string, actorId: string): string {
  const expires = (Date.now() + 60 * 60_000).toString();
  return `${targetUserId}.${actorId}.${expires}.${hmac(`${targetUserId}.${actorId}.${expires}`)}`;
}

export async function startImpersonation(targetUserId: string, actorId: string): Promise<void> {
  const jar = await cookies();
  jar.set(IMPERSONATE_COOKIE, createImpersonationToken(targetUserId, actorId), {
    httpOnly: true, secure: env().NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 3600,
  });
}

export async function stopImpersonation(): Promise<void> {
  const jar = await cookies();
  jar.delete(IMPERSONATE_COOKIE);
}

async function buildSessionContext(tokenHash: string): Promise<SessionContext | null> {
  const session = await prisma.session.findUnique({ where: { tokenHash } });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
  const jar = await cookies();
  const impersonation = parseImpersonationCookie(jar.get(IMPERSONATE_COOKIE)?.value);
  const effectiveId = impersonation?.targetUserId ?? session.userId;
  const actorId = impersonation?.actorId ?? session.userId;
  const [effectiveRow, actorRow] = await Promise.all([
    prisma.user.findUnique({ where: { id: effectiveId } }),
    prisma.user.findUnique({ where: { id: actorId } }),
  ]);
  if (!effectiveRow || !actorRow) return null;
  if (effectiveRow.status !== "ACTIVE" || actorRow.status !== "ACTIVE") return null;
  const impersonating = Boolean(impersonation);
  if (impersonating && actorRow.platformRole !== "SUPER_ADMIN") return null;

  const memberships = await prisma.membership.findMany({ where: { userId: effectiveId, tenantId: effectiveRow.tenantId ?? "" } });
  const roleValues: RbacRole[] = effectiveRow.platformRole === "SUPER_ADMIN" ? ["SUPER_ADMIN"] : memberships.map((m) => m.role as RbacRole);
  const platformRole = effectiveRow.platformRole;
  const role: RbacRole = platformRole === "SUPER_ADMIN"
    ? "SUPER_ADMIN"
    : (["TENANT_ADMIN", "EVENT_OWNER", "CO_HOST", "EDITOR", "CHECKIN_STAFF", "VIEWER"] as RbacRole[])
        .find((candidate) => roleValues.includes(candidate)) ?? "VIEWER";

  if (effectiveRow.tenantId && platformRole !== "SUPER_ADMIN") {
    const tenant = await prisma.tenant.findUnique({ where: { id: effectiveRow.tenantId } });
    if (!tenant || ["SUSPENDED", "BANNED", "EXPIRED"].includes(tenant.status)) return null;
  }

  return {
    sessionId: session.id,
    tokenHash,
    user: mapUser(effectiveRow),
    actor: mapUser(actorRow),
    impersonating,
    tenantId: effectiveRow.tenantId,
    roles: roleValues,
    role,
    eventIds: memberships.map((m) => m.eventId).filter((id): id is string => Boolean(id)),
    csrfToken: makeCsrfToken(tokenHash),
    ip: session.ipHash,
    userAgent: session.userAgentHash,
  };
}

export async function getSession(): Promise<SessionContext | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return buildSessionContext(sha256(token));
}

export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) throw new AppError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  return session;
}

/** Verifikasi double-submit CSRF. Dipakai form server actions & REST API. */
export async function assertCsrf(token: string | null | undefined): Promise<void> {
  const session = await getSession();
  if (!session) throw new AppError("UNAUTHENTICATED", "Sesi tidak ditemukan.", 401);
  if (!token || !verifyCsrfToken(session.tokenHash, token)) throw new AppError("CSRF_FAILED", "Token CSRF tidak valid.", 403);
}

/** Cegah request lintas origin untuk endpoint publik/API. */
export async function assertSameOrigin(request: Request): Promise<void> {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const allowed = new URL(env().APP_URL).host;
  if (new URL(origin).host !== host && new URL(origin).host !== allowed) {
    throw new AppError("BAD_ORIGIN", "Origin tidak diizinkan.", 403);
  }
}

export interface VerificationIssue { token: string; code: string | null; expiresAt: Date }

export async function issueVerification(input: {
  identifier: string; channel: "EMAIL" | "WHATSAPP" | "SMS"; purpose: string;
  tenantId?: string | null; meta?: Record<string, unknown>; ttlMinutes?: number; withCode?: boolean;
}): Promise<VerificationIssue> {
  const identifier = hashIdentifier(input.identifier);
  await prisma.verificationToken.updateMany({
    where: { identifier, purpose: input.purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  const token = randomToken(24);
  const code = input.withCode ? randomNumericCode(6) : null;
  const expiresAt = new Date(Date.now() + (input.ttlMinutes ?? 15) * 60_000);
  await prisma.verificationToken.create({
    data: {
      tenantId: input.tenantId ?? null, identifier, channel: input.channel, purpose: input.purpose,
      tokenHash: sha256(token), codeHash: code ? sha256(code) : null, expiresAt,
      meta: toInputJson(input.meta ?? {}),
    },
  });
  return { token, code, expiresAt };
}

export async function consumeVerification(input: {
  identifier?: string; purpose: string; token?: string; code?: string;
}): Promise<{ meta: Record<string, unknown> } | null> {
  const identifier = input.identifier ? hashIdentifier(input.identifier) : undefined;
  const tokenHash = input.token ? sha256(input.token) : undefined;
  const codeHash = input.code ? sha256(input.code) : undefined;
  if (!tokenHash && !codeHash) return null;
  const row = await prisma.verificationToken.findFirst({
    where: { ...(identifier ? { identifier } : {}), purpose: input.purpose, consumedAt: null, expiresAt: { gt: new Date() }, ...(tokenHash ? { tokenHash } : {}), ...(codeHash ? { codeHash } : {}) },
  });
  if (!row || row.attempts >= 5) {
    if (row) await prisma.verificationToken.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return null;
  }
  await prisma.verificationToken.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
  return { meta: (row.meta ?? {}) as Record<string, unknown> };
}

export async function authenticatePassword(email: string, password: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || user.status !== "ACTIVE" || !(await verifyPassword(password, user.passwordHash))) return null;
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return mapUser(user);
}

export function googleAuthUrl(state: string): string | null {
  const clientId = env().GOOGLE_CLIENT_ID;
  if (!clientId) return null;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: env().GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface GoogleProfile { email: string; name: string; avatarUrl: string | null }

export async function exchangeGoogleCode(code: string): Promise<GoogleProfile | null> {
  const config = env();
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) return null;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: config.GOOGLE_CLIENT_ID, client_secret: config.GOOGLE_CLIENT_SECRET,
      redirect_uri: config.GOOGLE_REDIRECT_URI, grant_type: "authorization_code",
    }).toString(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!tokenResponse.ok) return null;
  const tokenData = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenData.access_token) return null;
  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!profileResponse.ok) return null;
  const profile = (await profileResponse.json()) as { email?: string; name?: string; picture?: string; email_verified?: boolean };
  if (!profile.email || !profile.email_verified) return null;
  return { email: profile.email.toLowerCase(), name: profile.name ?? profile.email, avatarUrl: profile.picture ?? null };
}
