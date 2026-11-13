import { prisma } from "@/lib/db";
import { decrypt, sha256 } from "@/lib/crypto";
import { rateLimit } from "@/lib/ratelimit";
import { webhookSignature } from "@/lib/webhook";
import { AppError } from "@/lib/result";

export interface ApiIdentity { tenantId: string; apiKeyId: string; scopes: string[] }

/**
 * Autentikasi REST: API key (Bearer) + HMAC-SHA256 atas `timestamp.rawBody`
 * dengan secret yang diberikan saat key dibuat. Rate limit per key.
 */
export async function authenticateApiRequest(request: Request, rawBody = "", requiredScope?: string): Promise<ApiIdentity> {
  const auth = request.headers.get("authorization") ?? "";
  const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!key) throw new AppError("API_KEY_REQUIRED", "Header Authorization: Bearer <api_key> wajib ada.", 401);
  const keyHash = sha256(key);
  const row = await prisma.apiKey.findUnique({ where: { keyHash } });
  if (!row || row.revokedAt) throw new AppError("API_KEY_INVALID", "API key tidak valid.", 401);
  const scopes = Array.isArray(row.scopes) ? (row.scopes as unknown[]).map(String) : [];
  if (requiredScope && !scopes.includes(requiredScope) && !scopes.includes("*")) {
    throw new AppError("API_SCOPE", `API key tidak memiliki scope ${requiredScope}.`, 403);
  }
  const limit = await rateLimit(`api:${keyHash}`, 120, 60);
  if (!limit.allowed) throw new AppError("RATE_LIMIT", "Batas permintaan API tercapai.", 429);
  if (request.method !== "GET") {
    const timestamp = request.headers.get("x-rasa-timestamp") ?? "";
    const signature = request.headers.get("x-rasa-signature") ?? "";
    let secret = "";
    try { secret = decrypt(row.secretEncrypted); } catch { secret = ""; }
    if (!timestamp || !signature || !secret) throw new AppError("SIGNATURE_REQUIRED", "Header X-Rasa-Timestamp & X-Rasa-Signature wajib ada.", 401);
    if (Math.abs(Date.now() - Number(timestamp) * 1000) > 5 * 60_000) throw new AppError("SIGNATURE_EXPIRED", "Timestamp kedaluwarsa.", 401);
    const expected = webhookSignature(secret, timestamp, rawBody);
    if (signature.replace(/^sha256=/, "") !== expected) throw new AppError("SIGNATURE_INVALID", "Signature HMAC tidak valid.", 401);
  }
  await prisma.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
  return { tenantId: row.tenantId, apiKeyId: row.id, scopes };
}

export function apiError(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
  }
  return Response.json({ ok: false, code: "INTERNAL_ERROR", error: error instanceof Error ? error.message : "Kesalahan tak dikenal" }, { status: 500 });
}
