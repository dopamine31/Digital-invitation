import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "@/lib/env";
import { AppError } from "@/lib/result";

const BCRYPT_ROUNDS = 12;

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmac(value: string, secret: string = env().AUTH_SECRET): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function hashIdentifier(value: string): string {
  return sha256(value.trim().toLowerCase());
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function randomNumericCode(length = 6): string {
  const digits = randomBytes(length).toString("hex");
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += String(parseInt(digits[i] ?? "0", 16) % 10);
  }
  return out;
}

export function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function encryptionKey(): Buffer {
  return createHash("sha256").update(env().ENCRYPTION_KEY).digest();
}

/** AES-256-GCM. Format: v1.<iv>.<tag>.<ciphertext> semuanya base64url. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decrypt(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new AppError("CRYPTO_INVALID", "Format data terenkripsi tidak valid.", 500);
  const [, ivHex, tagHex, dataHex] = parts as [string, string, string, string];
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivHex, "base64url"));
  decipher.setAuthTag(Buffer.from(tagHex, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "base64url")), decipher.final()]).toString("utf8");
}

export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

export function maskPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = normalizePhone(input);
  if (digits.length < 7) return "***";
  return `${digits.slice(0, 5)}****${digits.slice(-2)}`;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(password, hash);
}

export function hashIp(ip: string | null | undefined): string | null {
  return ip ? sha256(`${ip}|${env().CSRF_SALT}`) : null;
}

/** Payload QR tamu: <eventId>.<guestId>.<nonce>.<signature>. */
export function signGuestQr(eventId: string, guestId: string, nonce: string): string {
  const payload = `${eventId}.${guestId}.${nonce}`;
  return `${payload}.${hmac(payload).slice(0, 24)}`;
}

export function verifyGuestQr(value: string): { eventId: string; guestId: string } | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const [eventId, guestId, nonce, signature] = parts as [string, string, string, string];
  if (!eventId || !guestId || !nonce || !signature) return null;
  const expected = hmac(`${eventId}.${guestId}.${nonce}`).slice(0, 24);
  if (!constantTimeEqual(signature, expected)) return null;
  return { eventId, guestId };
}

/** Token double-submit CSRF yang terikat pada sesi. */
export function makeCsrfToken(sessionTokenHash: string): string {
  return hmac(`csrf:${sessionTokenHash}`, env().CSRF_SALT);
}

export function verifyCsrfToken(sessionTokenHash: string, token: string | null): boolean {
  if (!token) return false;
  return constantTimeEqual(makeCsrfToken(sessionTokenHash), token);
}
